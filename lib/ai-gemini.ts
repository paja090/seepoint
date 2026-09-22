import { prisma } from '@/lib/db';
import { logAIUsage } from './ai-usage';
import { validOdometer } from './odometer';

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
 * Resolves the Gemini API key in preferred order:
 * 1. GEMINI_API_KEY (primary standard)
 * 2. GOOGLE_GEMINI_API_KEY (supported fallback from Vercel)
 * 3. GOOGLE_AI_KEY
 * 4. GEMINI_KEY
 * 5. GOOGLE_GEMINI_KEY
 * 6. GOOGLE_GENAI_API_KEY
 * 7. GEMINI_API_TOKEN
 * 
 * Non-aggressive sanitizing: only trims whitespace and strips one matching pair of outer quotes.
 */
export function getGeminiApiKey(): string | undefined {
  const rawKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_GEMINI_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GEMINI_API_TOKEN;

  if (!rawKey) return undefined;
  let cleaned = rawKey.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned || undefined;
}

/**
 * Helper to fetch Google Gemini API using REST endpoint with model fallback
 */
async function callGeminiVision(prompt: string, imageBase64OrUrl: string) {
  const apiKey = getGeminiApiKey();

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
  const modelsToTry = (configuredModels.length ? configuredModels : ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'])
    .filter((model, index, values) => /^[A-Za-z0-9._-]+$/.test(model) && values.indexOf(model) === index)
    .slice(0, 3);

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
    const prompt = `Jsi AI inspektor venkovní reklamy a nosičů (billboardy, citylighty, navigační tabule, bannery).
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

    if (!geminiResult || typeof geminiResult.confidence !== 'number') {
      if (data.photoId) {
        await prisma.photo.update({
          where: { id: data.photoId },
          data: { aiStatus: 'FAILED' },
        }).catch(() => null);
      }
      return { photoId: data.photoId, aiStatus: 'FAILED' as const };
    }

    const confidence = geminiResult.confidence;
    const labels = Array.isArray(geminiResult.labels) ? geminiResult.labels : ['reklamní nosič'];
    const suggestedCode = geminiResult.suggestedCode || data.expectedCarrierCode;

    // Safely update DB if photo exists
    if (data.photoId) {
      const existing = await prisma.photo.findUnique({ where: { id: data.photoId } }).catch(() => null);
      if (existing) {
        if (existing.organizationId) {
          void logAIUsage({
            organizationId: existing.organizationId,
            feature: 'PHOTO_ANALYSIS',
            modelName: 'gemini-3.6-flash',
            promptTokens: 400,
            outputTokens: 200,
            imageCount: 1,
            costEstimateUsd: 0.002,
            metadata: { photoId: data.photoId, action: 'carrier-inspection' },
          });
        }

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
      detectedClient: geminiResult.detectedClient || null,
      summary: geminiResult.summary || 'Fotografie byla úspěšně zpracována a zkontrolována AI.',
    };
  } catch (err) {
    console.error('AI carrier analysis error:', err);
    return { photoId: data.photoId, aiStatus: 'FAILED' as const };
  }
}

/**
 * 2. AI Fuel Receipt OCR & Parser
 */
export async function parseOdometerWithGemini(image: string): Promise<{ odometer: number }> {
  const result = await callGeminiVision(`Přečti celkový počet najetých kilometrů z fotografie přístrojové desky vozidla.
Hledej celkový stav ODO / odometr v km. Nezaměňuj jej s denním počítadlem TRIP, dojezdem, rychlostí, časem ani servisním intervalem.
Vrať JSON {"odometer": celé číslo v km nebo null}. Mezery mezi tisíci ignoruj. Pokud celkový stav není jednoznačně čitelný nebo je v mílích, vrať null. Nikdy číslo neodhaduj.`, image);
  if (!validOdometer(result?.odometer)) throw new Error('Stav tachometru není jednoznačně čitelný.');
  return { odometer: result.odometer };
}

export async function parseFuelReceiptWithGemini(imageUrlBase64: string): Promise<GeminiFuelReceipt> {
  const prompt = `Jsi asistent pro vytěžování účtenek firemních vozidel a nákupů pohonných hmot. Analyzuj přiloženou účtenku za pohonné hmoty (benzínka Orlen, Shell, MOL, OMV, EuroOil atd.) nebo snímek účtenky s dopsanými km.

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

  throw new Error('Nepodařilo se vytěžit data z účtenky pomocí AI.');
}

export type GeminiWarehousePhotoItem = {
  matchedCatalogItemId?: string | null;
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
export async function analyzeWarehouseItemsFromPhotoWithGemini(
  imageBase64OrUrl: string,
  catalogContext?: Array<{ id: string; name: string; code?: string | null; unit?: string }>
): Promise<GeminiWarehousePhotoItem[]> {
  const catalogList = catalogContext && catalogContext.length > 0
    ? `\nAKTUÁLNÍ KATALOG POLOŽEK NA SKLADĚ:
${catalogContext.slice(0, 50).map((c) => `- ID: "${c.id}" | Název: "${c.name}"${c.code ? ` | Kód: ${c.code}` : ''} | Jednotka: ${c.unit || 'ks'}`).join('\n')}

POKYNY K PÁROVÁNÍ SE SKLADEM:
Pokud na fotografii vidíš předmět, který odpovídá některé položce z výše uvedeného katalogu skladu (např. značka lepidla jako Duvilax, Den Braven, aku nářadí DeWalt, žebřík Krause, metr CXS, pásky atd.):
- Do pole "matchedCatalogItemId" uveď PŘESNÉ ID položky ze seznamu výše.
- Jako "name" a "unit" přednostně uveď přesný název a jednotku z katalogu skladu.
Pokud předmět v katalogu není, "matchedCatalogItemId" nastav na null.\n`
    : '';

  const prompt = `Jsi AI specialista na rozpoznávání nářadí, montážního a skladového materiálu reklamní a stavební firmy. 
Detailně prozkoumej přiloženou fotografii regálu, dílny, materiálu nebo naloženého kufru auta.
Identifikuj VŠECHNY viditelné předměty, produkty, balení, nářadí, měřidla, žebříky, lepidla, stahovací pásky, hmoždinky atd.${catalogList}

Pro každý nalezený předmět určete:
- matchedCatalogItemId: ID položky z katalogu skladu pokud byla spárována, jinak null
- name: Přesný název předmětu v češtině (pokud odpovídá katalogu, použij název z katalogu)
- category: Buď 'CONSUMABLE' (pokud jde o jednorázový/spotřební materiál jako pásky, lepidlo, pěna, hmoždinky, šrouby) nebo 'RETURNABLE' (pokud jde o vratné nářadí, měřidlo, žebřík, kufry s nářadím, aku stroje)
- quantity: Počet viditelných kusů/balení (číslo)
- unit: Jednotka v češtině ('ks', 'balení', 'sada', 'kbelík', 'kus')
- location: Doporučený regál nebo sektor ('Regál A1 - Nářadí', 'Regál B2 - Spojovací materiál')
- note: Stručná poznámka o předmětu na fotce

Vrať výhradně platný JSON objekt v tomto formátu:
{
  "items": [
    {
      "matchedCatalogItemId": null,
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
        matchedCatalogItemId: typeof i.matchedCatalogItemId === 'string' && i.matchedCatalogItemId.trim() ? i.matchedCatalogItemId.trim() : null,
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

export type GeminiNavigationExtraction = {
  destinationName?: string;
  directionDescription?: string;
  directionArrow?: '➔' | '⬅' | '⬆' | '🧭';
  distanceMeters?: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  rawDetectedText?: string;
};

/**
 * 4. AI Vision navigation signage OCR & Direction/Destination/Distance extraction
 */
export async function extractNavigationFromPhotoWithGemini(data: {
  imageBase64OrUrl: string;
  organizationId?: string;
  photoId?: string;
}): Promise<GeminiNavigationExtraction | null> {
  const prompt = `Jsi AI specialista na rozpoznávání navigačních směrovek, tabulí a reklamních nosičů (např. navigační cedule na sloupech veřejného osvětlení).
Analyzuj přiloženou fotografii nosiče z terénu. Na fotografii hledej navigační tabuli / směrovku a vyčti z ní:
1. "destinationName": Název cíle, prodejny, firmy nebo značky (např. "Form Factory", "Albert", "Kaufland", "Lidl", "Shell", "Decathlon", "Autoservis" atd.). Pokud není žádný cíl zřejmý, vrať null.
2. "directionDescription": Směr navigace slovy v češtině ("vpravo", "vlevo", "rovně", "směr centrum", apod.).
3. "directionArrow": Šipka odpovídající směru ("➔" pro vpravo, "⬅" pro vlevo, "⬆" pro rovně / přímo, "🧭" pokud směr nelze určit).
4. "distanceMeters": Vzdálenost v metrech jako celé číslo (např. 350 pro 350 m, 1200 pro 1.2 km). Pokud vzdálenost není uvedena, vrať null.
5. "confidence": "HIGH" (pokud je text a šipka jasně viditelná), "MEDIUM" (pokud je část odhadnuta), nebo "LOW".
6. "rawDetectedText": Veškerý text a symboly, které jsi na tabuli přečetl.

Vrať VÝHRADNĚ platný JSON objekt v tomto formátu:
{
  "destinationName": "string nebo null",
  "directionDescription": "string nebo null",
  "directionArrow": "➔" | "⬅" | "⬆" | "🧭",
  "distanceMeters": number nebo null,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "rawDetectedText": "string"
}`;

  try {
    const geminiResult = await callGeminiVision(prompt, data.imageBase64OrUrl);
    if (!geminiResult || typeof geminiResult !== 'object') return null;

    const res = geminiResult as Record<string, unknown>;

    const destinationName = typeof res.destinationName === 'string' && res.destinationName.trim() ? res.destinationName.trim() : undefined;
    const directionDescription = typeof res.directionDescription === 'string' && res.directionDescription.trim() ? res.directionDescription.trim() : undefined;
    let directionArrow: '➔' | '⬅' | '⬆' | '🧭' = '🧭';
    if (res.directionArrow === '➔' || res.directionArrow === '⬅' || res.directionArrow === '⬆') {
      directionArrow = res.directionArrow;
    } else if (directionDescription) {
      const norm = directionDescription.toLowerCase();
      if (norm.includes('vpravo') || norm.includes('doprava')) directionArrow = '➔';
      else if (norm.includes('vlevo') || norm.includes('doleva')) directionArrow = '⬅';
      else if (norm.includes('rovně') || norm.includes('rovne') || norm.includes('přímo') || norm.includes('primo')) directionArrow = '⬆';
    }

    let distanceMeters: number | undefined;
    if (typeof res.distanceMeters === 'number' && Number.isFinite(res.distanceMeters) && res.distanceMeters > 0) {
      distanceMeters = Math.round(res.distanceMeters);
    }

    const confidenceRaw = String(res.confidence || '').toUpperCase();
    const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
      confidenceRaw === 'HIGH' ? 'HIGH' : confidenceRaw === 'MEDIUM' ? 'MEDIUM' : 'LOW';

    if (!destinationName && !directionDescription && distanceMeters === undefined) {
      return null;
    }

    if (data.organizationId) {
      void logAIUsage({
        organizationId: data.organizationId,
        feature: 'PHOTO_ANALYSIS',
        modelName: 'gemini-3.6-flash',
        promptTokens: 400,
        outputTokens: 150,
        imageCount: 1,
        costEstimateUsd: 0.002,
        metadata: { photoId: data.photoId, action: 'navigation-sign-ocr' },
      });
    }

    return {
      destinationName,
      directionDescription,
      directionArrow,
      distanceMeters,
      confidence,
      rawDetectedText: typeof res.rawDetectedText === 'string' ? res.rawDetectedText : undefined,
    };
  } catch (err) {
    console.error('Gemini navigation extraction error:', err);
    return null;
  }
}

