import 'server-only';
import { getGeminiApiKey } from '@/lib/ai-gemini';
import { readStoredPhoto } from '@/lib/storage/photo-storage';
import { upsertFieldSurveyAiAnalysis } from './data';
import type { FieldSurveyPhoto } from '@prisma/client';

export type FieldSurveyAiResult = {
  suggestedType: 'ACKO' | 'TOWER' | 'BANNER' | 'PLOT' | 'OTHER';
  isUsable: boolean;
  locationDesc: string;
  visibility: string;
  orientation: string;
  surroundings: string;
  obstacles: string;
  placementChar: string;
};

const SYSTEM_PROMPT = `Jsi specializovaný analytik venkovních reklamních ploch pro agenturu SeePoint.
Tvým úkolem je analyzovat fotografii pořízenou v terénu a určit její fyzické a vizuální parametry.

ZÁSADNÍ BEZPEČNOSTNÍ PRAVIDLA:
1. NIKDY nevymýšlej parcelní čísla, čísla LV ani katastrální území.
2. NIKDY nevymýšlej jména vlastníků, kontaktní osoby, telefonní čísla ani e-maily.
3. Analyzuj VÝHRADNĚ to, co je přímo vidět na fotografii.

Vrať JSON v tomto přesném formátu:
{
  "suggestedType": "ACKO" | "TOWER" | "BANNER" | "PLOT" | "OTHER",
  "isUsable": true | false,
  "locationDesc": "Stručný popis místa (např. roh frekventované křižovatky, plot u silnice...)",
  "visibility": "Hodnocení viditelnosti (např. vynikající z hlavního tahu, částečně kryto stromy...)",
  "orientation": "Orientace k dopravnímu proudu (např. čelní, boční, souběžná...)",
  "surroundings": "Charakteristika okolí (např. nákupní zóna, průmyslový areál, rezidenční zástavba...)",
  "obstacles": "Případné překážky (např. žádné, vzrostlé stromy, sloup veřejného osvětlení...)",
  "placementChar": "Charakter umístění (např. plot areálu, fasáda budovy, volné prostranství...)"
}`;

export async function runFieldSurveyAiAnalysis(
  surveyPointId: string,
  photo: Pick<FieldSurveyPhoto, 'id' | 'driveFileId' | 'storageKey' | 'storageProvider' | 'content' | 'url' | 'mimeType'>
) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return upsertFieldSurveyAiAnalysis(surveyPointId, {
      status: 'SKIPPED',
      errorMessage: 'AI API klíč není nakonfigurován.',
    });
  }

  // 1. Získáme binární data fotografie (buď z direct DB content, nebo ze storage)
  let base64Data: string;
  let mimeType = photo.mimeType || 'image/jpeg';

  if (photo.content && photo.content.byteLength > 0) {
    base64Data = Buffer.from(photo.content).toString('base64');
  } else {
    const stored = await readStoredPhoto(photo);
    if (!stored?.body) {
      return upsertFieldSurveyAiAnalysis(surveyPointId, {
        status: 'FAILED',
        errorMessage: 'Nepodařilo se načíst data fotografie pro AI analýzu.',
      });
    }
    const arrayBuf = await new Response(stored.body).arrayBuffer();
    base64Data = Buffer.from(arrayBuf).toString('base64');
    if (stored.contentType) mimeType = stored.contentType;
  }

  const configuredModels = [
    process.env.GEMINI_VISION_MODEL,
    process.env.GEMINI_VISION_FALLBACK_MODEL,
  ]
    .map((m) => m?.trim())
    .filter((m): m is string => Boolean(m));

  const modelsToTry = configuredModels.length > 0
    ? configuredModels
    : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

  let lastError = 'Neznámá chyba AI';

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const payload = {
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
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
        signal: AbortSignal.timeout(25_000),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[field-survey/ai] Model ${model} returned HTTP ${res.status}`, errorText.slice(0, 200));
        lastError = `Gemini HTTP ${res.status}: ${errorText.slice(0, 100)}`;
        continue;
      }

      const responseJson = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const rawText = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        lastError = 'Prázdná odpověď AI';
        continue;
      }

      // Robustní parsování JSONu – odstranění ```json ... ``` markdown bloků
      let cleanText = rawText.trim();
      if (cleanText.includes('```')) {
        cleanText = cleanText.replace(/```(?:json)?\s*/gi, '').replace(/```\s*$/g, '').trim();
      }
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanText = jsonMatch[0];
      }

      const parsed = JSON.parse(cleanText) as Partial<FieldSurveyAiResult>;

      const validTypes = ['ACKO', 'TOWER', 'BANNER', 'PLOT', 'OTHER'] as const;
      const rawType = String(parsed.suggestedType ?? '').toUpperCase();
      const suggestedType = validTypes.includes(rawType as typeof validTypes[number])
        ? (rawType as typeof validTypes[number])
        : 'OTHER';

      return await upsertFieldSurveyAiAnalysis(surveyPointId, {
        status: 'DONE',
        suggestedType,
        isUsable: typeof parsed.isUsable === 'boolean' ? parsed.isUsable : true,
        locationDesc: parsed.locationDesc?.slice(0, 500) || '',
        visibility: parsed.visibility?.slice(0, 500) || '',
        orientation: parsed.orientation?.slice(0, 500) || '',
        surroundings: parsed.surroundings?.slice(0, 500) || '',
        obstacles: parsed.obstacles?.slice(0, 500) || '',
        placementChar: parsed.placementChar?.slice(0, 500) || '',
        rawResponse: parsed,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Chyba volání AI';
    }
  }

  return upsertFieldSurveyAiAnalysis(surveyPointId, {
    status: 'FAILED',
    errorMessage: `Analýza selhala: ${lastError}`,
  });
}
