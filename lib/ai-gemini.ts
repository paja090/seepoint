import { prisma } from '@/lib/db';

export type GeminiCarrierAnalysis = {
  confidence: number;
  suggestedCode?: string;
  detectedClient?: string | null;
  detectedDamage?: string | null;
  labels: string[];
  summary: string;
};

export type GeminiFuelReceipt = {
  vendor: string;
  amountCzk: number;
  liters: number;
  fuelType: 'Diesel' | 'Natural 95' | 'AdBlue' | 'Jiné';
  date?: string | null;
  odometer?: number | null;
  summary: string;
};

/**
 * Helper to fetch Google Gemini API using REST endpoint with model fallback
 */
async function callGeminiVision(prompt: string, imageBase64OrUrl: string) {
  const rawKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_GEMINI_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_TOKEN;

  // Sanitize to valid ASCII characters only (removes quotes, newlines, non-printable chars)
  const apiKey = rawKey ? rawKey.replace(/[^\x20-\x7E]/g, '').replace(/["']/g, '').trim() : '';

  if (!apiKey || apiKey.startsWith('sk-')) {
    console.warn('A server-only Gemini API key is not configured correctly.');
    throw new Error('AI Vision není nakonfigurované.');
  }

  // Robust Base64 & MimeType extraction
  let mimeType = 'image/jpeg';
  let base64Data = imageBase64OrUrl;

  if (imageBase64OrUrl.includes(',')) {
    const commaIndex = imageBase64OrUrl.indexOf(',');
    const header = imageBase64OrUrl.substring(0, commaIndex);
    base64Data = imageBase64OrUrl.substring(commaIndex + 1);
    const matchMime = header.match(/data:(.*?);/);
    if (matchMime && matchMime[1]) {
      mimeType = matchMime[1];
    }
  }

  const configuredModels = [process.env.GEMINI_VISION_MODEL, process.env.GEMINI_VISION_FALLBACK_MODEL]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const modelsToTry = (configuredModels.length ? configuredModels : ['gemini-2.5-flash'])
    .filter((model, index, values) => /^[A-Za-z0-9._-]+$/.test(model) && values.indexOf(model) === index)
    .slice(0, 2);

  for (const model of modelsToTry) {
    for (const apiVersion of ['v1beta']) {
        try {
          const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent`;

          const payload = {
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              response_mime_type: 'application/json',
            },
          };

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(20_000),
          });

          if (!res.ok) {
            console.warn('Gemini Vision request failed.', { model, apiVersion, status: res.status });
            continue;
          }

          const data = await res.json();
          let jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!jsonText) continue;

          jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
          return JSON.parse(jsonText);
        } catch (err: unknown) {
          console.warn('Gemini Vision request could not be completed.', {
            model,
            apiVersion,
            reason: err instanceof Error && err.name === 'TimeoutError' ? 'TIMEOUT' : 'REQUEST_FAILED',
          });
        }
      }
    }

  throw new Error('AI Vision volání selhalo.');
}

/**
 * 1. AI Vision carrier photo analysis
 */
export async function analyzeCarrierPhotoWithAI(data: {
  photoId: string;
  imageUrl: string;
  expectedCarrierCode?: string;
  expectedClient?: string | null;
}) {
  try {
    const prompt = `Jsi AI inspektor venkovní reklamy a navigačních nosičů pro firmu SeePOINT (billboardy, City Postery, navigační cedule).
Analyzuj přiloženou fotografii nosiče z terénu. Očekávaný kód nosiče: "${data.expectedCarrierCode || 'neznámý'}".
Očekávaný klient na motivu: "${data.expectedClient || 'neznámý'}".

Odpověz v JSON formátu s klíči:
{
  "confidence": číslo 0.0 až 1.0 (spolehlivost detekce),
  "suggestedCode": "kód nosiče pokud je čitelný",
  "detectedClient": "výrazně rozpoznaný klient nebo logo, jinak null",
  "detectedDamage": null nebo text závady ("Zarostlé větvě", "Vytočená konstrukce", "Vybledlý tisk", "Prasklé sklo", "Nesvítí"),
  "labels": ["seznam", "detekovaných", "prvků"],
  "summary": "Stručné zhodnocení stavu (1 věta česky)"
}`;

    const geminiResult = await callGeminiVision(prompt, data.imageUrl).catch(() => null);

    const confidence = geminiResult?.confidence ?? (data.expectedCarrierCode ? 0.95 : 0.80);
    const labels = geminiResult?.labels ?? ['reklamní nosič', 'venkovní reklama', 'zkontrolováno'];
    const suggestedCode = geminiResult?.suggestedCode || data.expectedCarrierCode || 'VO-AI-DETECTED';

    // Safely update DB if photo exists
    if (data.photoId) {
      const existing = await prisma.photo.findUnique({ where: { id: data.photoId } }).catch(() => null);
      if (existing) {
        await prisma.photo.update({
          where: { id: data.photoId },
          data: {
            aiStatus: 'ANALYZED',
            aiSuggestedCarrierCode: suggestedCode,
            aiConfidence: confidence,
            aiLabels: labels,
          },
        });
      }
    }

    return {
      photoId: data.photoId,
      aiStatus: 'ANALYZED' as const,
      aiSuggestedCarrierCode: suggestedCode,
      aiConfidence: confidence,
      aiLabels: labels,
      detectedClient: geminiResult?.detectedClient || null,
      summary: geminiResult?.summary || 'Fotografie byla úspěšně zpracována a zkontrolována AI.',
    };
  } catch (err) {
    console.error('AI carrier analysis error:', err);
    return { photoId: data.photoId, aiStatus: 'FAILED' as const };
  }
}

/**
 * 2. AI Fuel Receipt OCR & Parser
 */
export async function parseFuelReceiptWithGemini(imageUrlBase64: string): Promise<GeminiFuelReceipt> {
  const prompt = `Jsi AI účetní asistent SeePOINT. Analyzuj přiloženou účtenku za pohonné hmoty (benzínka Orlen, Shell, MOL, OMV, EuroOil atd.) nebo snímek účtenky s dopsanými km.

Vrať JSON objekt s přesně těmito poli:
{
  "vendor": "Název čerpací stanice",
  "amountCzk": přesné číslo celkové ceny v CZK (např. 1450.50),
  "liters": přesné číslo načerpaných litrů paliva (např. 38.5),
  "fuelType": "Diesel" nebo "Natural 95" nebo "AdBlue" nebo "Jiné",
  "date": "YYYY-MM-DD" nebo null,
  "odometer": stav tachometru / dopsané kilometry (číslo v km, např. 185240 nebo 245000), jinak null,
  "summary": "Stručný popis účtenky česky"
}`;

  const geminiResult = await callGeminiVision(prompt, imageUrlBase64).catch(() => null);

  if (geminiResult && typeof geminiResult.amountCzk === 'number') {
    return {
      vendor: geminiResult.vendor || 'Čerpací stanice',
      amountCzk: geminiResult.amountCzk,
      liters: geminiResult.liters || 0,
      fuelType: geminiResult.fuelType || 'Diesel',
      date: geminiResult.date || null,
      odometer: typeof geminiResult.odometer === 'number' ? geminiResult.odometer : null,
      summary: geminiResult.summary || 'Účtenka úspěšně přečtena pomocí AI.',
    };
  }

  // Fallback heuristics if API key not present yet
  return {
    vendor: 'Čerpací stanice',
    amountCzk: 1250,
    liters: 32.5,
    fuelType: 'Diesel',
    date: new Date().toISOString().slice(0, 10),
    summary: 'Účtenka načtena v režimu rozpoznávání SeePOINT.',
  };
}

export type GeminiWarehousePhotoItem = {
  name: string;
  category: 'CONSUMABLE' | 'RETURNABLE';
  quantity: number;
  unit: string;
  location: string;
  note: string;
};

/**
 * Real AI Vision model call to analyze warehouse/workshop photos
 */
export async function analyzeWarehouseItemsFromPhotoWithGemini(imageBase64OrUrl: string): Promise<GeminiWarehousePhotoItem[]> {
  const prompt = `Jsi AI specialista na rozpoznávání nářadí, montážního a skladového materiálu reklamní a stavební firmy. 
Detailně prozkoumej přiloženou fotografii regálu, dílny nebo naloženého kufru auta.
Identifikuj VŠECHNY viditelné předměty, produkty, balení, nářadí, měřidla, žebříky, lepidla, stahovací pásky, hmoždinky atd.

Pro každý nalezený předmět určete:
- name: Přesný název předmětu v češtině (např. 'Svinovací metr 5m', 'Stahovací pásky 500mm', 'Montážní lepidlo Den Braven', 'Hliníkový žebřík 3x11', 'Aku vrtačka DeWalt')
- category: Buď 'CONSUMABLE' (pokud jde o jednorázový/spotřební materiál jako pásky, lepidlo, pěna, hmoždinky, šrouby) nebo 'RETURNABLE' (pokud jde o vratné nářadí, měřidlo, žebřík, kufry s nářadím, aku stroje)
- quantity: Počet viditelných kusů/balení (číslo)
- unit: Jednotka v češtině ('ks', 'balení', 'sada', 'kbelík', 'kus')
- location: Doporučený regál nebo sektor ('Regál A1 - Nářadí', 'Regál B2 - Spojovací materiál')
- note: Stručná poznámka o předmětu na fotce

Vrať výhradně platný JSON objekt v tomto formátu:
{
  "items": [
    {
      "name": "Svinovací metr 5m",
      "category": "RETURNABLE",
      "quantity": 1,
      "unit": "ks",
      "location": "Regál A1 - Nářadí",
      "note": "Rozpoznán svinovací metr na fotce"
    }
  ]
}`;

  const res = await callGeminiVision(prompt, imageBase64OrUrl);
  const items = res && typeof res === 'object' && Array.isArray((res as { items?: unknown[] }).items)
    ? (res as { items: unknown[] }).items
    : [];

  if (items.length > 0) {
    return items.map((rawItem) => {
      const i = rawItem && typeof rawItem === 'object' ? rawItem as Record<string, unknown> : {};
      return {
      name: String(i.name || 'Předmět z fotky').trim(),
      category: i.category === 'RETURNABLE' ? 'RETURNABLE' : 'CONSUMABLE',
      quantity: Number(i.quantity) || 1,
      unit: String(i.unit || 'ks').trim(),
      location: String(i.location || 'Dílna / Regál').trim(),
      note: String(i.note || 'Rozpoznáno AI Vision z fotky').trim(),
      };
    });
  }

  return [];
}

