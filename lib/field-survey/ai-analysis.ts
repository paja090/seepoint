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

  // 1. Získáme binární data fotografie
  const stored = await readStoredPhoto(photo);
  if (!stored?.body) {
    return upsertFieldSurveyAiAnalysis(surveyPointId, {
      status: 'FAILED',
      errorMessage: 'Nepodařilo se načíst data fotografie pro AI analýzu.',
    });
  }

  const arrayBuf = await new Response(stored.body).arrayBuffer();
  const base64Data = Buffer.from(arrayBuf).toString('base64');
  const mimeType = stored.contentType || photo.mimeType || 'image/jpeg';

  const modelsToTry = [
    process.env.GEMINI_VISION_MODEL,
    'gemini-2.5-flash',
    'gemini-1.5-flash',
  ].filter((m): m is string => Boolean(m?.trim()));

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
        lastError = `Gemini HTTP ${res.status}`;
        continue;
      }

      const responseJson = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = 'Prázdná odpověď AI';
        continue;
      }

      const parsed = JSON.parse(text) as FieldSurveyAiResult;

      return await upsertFieldSurveyAiAnalysis(surveyPointId, {
        status: 'DONE',
        suggestedType: parsed.suggestedType,
        isUsable: parsed.isUsable,
        locationDesc: parsed.locationDesc,
        visibility: parsed.visibility,
        orientation: parsed.orientation,
        surroundings: parsed.surroundings,
        obstacles: parsed.obstacles,
        placementChar: parsed.placementChar,
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
