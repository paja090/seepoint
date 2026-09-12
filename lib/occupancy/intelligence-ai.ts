import { getGeminiApiKey } from '@/lib/ai-gemini';
import { logAIUsage, estimateGeminiFlashCostUsd } from '@/lib/ai-usage';
import { OccupancyInsightType, OccupancyInsightSeverity } from '@prisma/client';

export type InsightToEnrich = {
  id: string;
  type: OccupancyInsightType;
  severity: OccupancyInsightSeverity;
  title: string;
  deterministicReason: string;
  surfaceName?: string | null;
  carrierCode?: string | null;
  carrierCity?: string | null;
  clientName?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AIEnrichmentResult = {
  aiExplanation: string;
  aiRecommendation: string;
  confidence: number;
};

export type CandidateAlternativeSurface = {
  id: string;
  name: string;
  mediaType: string;
  price?: number | null;
  carrier: {
    id: string;
    code: string;
    name: string;
    city: string;
    region?: string | null;
    street?: string | null;
  };
  score?: number;
  matchReason?: string;
};

export type ParsedOccupancyIntent = {
  intent: 'FIND_AVAILABLE_MEDIA' | 'CHECK_COLLISIONS' | 'EXPIRING_CAMPAIGNS' | 'UNDERUTILIZED_MEDIA' | 'GENERAL_QUERY';
  city?: string;
  region?: string;
  mediaType?: string;
  dateFrom?: string;
  dateTo?: string;
  quantity?: number;
  maxPrice?: number;
  summaryAnswer?: string;
};

/**
 * Deterministic fallback generator when Gemini API is unconfigured or unreachable.
 * Ensures 100% offline resilience without crashing.
 */
export function generateDeterministicFallbackEnrichment(
  insight: InsightToEnrich
): AIEnrichmentResult {
  switch (insight.type) {
    case 'DOUBLE_BOOKING':
      return {
        aiExplanation: `Na ploše došlo k souběhu dvou platných rezervací či kampaní ve stejném časovém okně. Obě rezervace si plochu nárokují současně, což způsobuje provozní a právní kolizi.`,
        aiRecommendation: `Doporučujeme prověřit novější záznam, spojit se s obchodníkem a nabídnout klientovi nejbližší volnou alternativní plochu ve stejném městě.`,
        confidence: 0.95,
      };
    case 'STATUS_MISMATCH':
      return {
        aiExplanation: `Evidovaný stav plochy v inventáři neodpovídá skutečnému stavu aktivních kampaní v kalendáři obsazenosti k dnešnímu dni.`,
        aiRecommendation: `Použijte tlačítko 'Synchronizovat stav plochy', které přepočítá reálnou obsazenost z kalendáře a opraví stav v databázi.`,
        confidence: 0.98,
      };
    case 'EXPIRED_OCCUPANCY':
      return {
        aiExplanation: `Termín kampaně již vypršel v minulosti, ale záznam nebyl v systému řádně označen jako ukončený (FINISHED).`,
        aiRecommendation: `Označte kampaň jako ukončenou (FINISHED), aby se plocha uvolnila v reportech a byla nabízena dalším zájemcům.`,
        confidence: 0.95,
      };
    case 'OFFER_CONFLICT':
      return {
        aiExplanation: `Zaslaná nebo akceptovaná klientská nabídka obsahuje plochu, která byla mezitím obsazena nebo rezervována jinou kampaní.`,
        aiRecommendation: `Zkontrolujte stav nabídky u klienta. Pokud klient nabídku potvrdí, bude nutné navrhnout náhradní plochu stejného typu.`,
        confidence: 0.9,
      };
    case 'EXPIRING_CAMPAIGN':
      return {
        aiExplanation: `Kampaň se blíží ke svému smluvnímu konci. Obchodní tým má ideální příležitost oslovit klienta s nabídkou pokračování.`,
        aiRecommendation: `Kontaktujte klienta s nabídkou prodloužení pronájmu plochy na další období, nebo plochu nabídněte do nových klientských prezentací.`,
        confidence: 0.9,
      };
    case 'UNDERUTILIZED_MEDIA':
      return {
        aiExplanation: `Plocha nebyla dlouhodobě obsazena žádnou platnou kampaní a generuje ušlý zisk z nevyužité kapacity.`,
        aiRecommendation: `Doporučujeme plochu zařadit do akčních balíčků, zvážit dočasnou slevu nebo ji využít pro vlastní sebepropagaci.`,
        confidence: 0.85,
      };
    case 'CALENDAR_GAP':
      return {
        aiExplanation: `Mezi dvěma plánovanými kampaněmi vzniklo krátké volné okno v kalendáři, které zůstává neobsazené.`,
        aiRecommendation: `Využijte volné okno pro nabídku last-minute kampaně se slevou pro lokální partnery nebo pro krátkodobou promo akci.`,
        confidence: 0.85,
      };
    case 'MISSING_DATA':
      return {
        aiExplanation: `Záznam obsahuje neplatné datum (např. začátek po konci kampaně) nebo neúplná data znemožňující kalkulaci dostupnosti.`,
        aiRecommendation: `Otevřete záznam v detailu obsazenosti a opravte kalendářní termín od–do.`,
        confidence: 0.99,
      };
    default:
      return {
        aiExplanation: insight.deterministicReason,
        aiRecommendation: `Zkontrolujte detail plochy a kalendář obsazenosti.`,
        confidence: 0.8,
      };
  }
}

/**
 * Enriches a detected insight with AI explanation and actionable business recommendation.
 * Falls back safely to deterministic Czech text if Gemini is offline.
 */
export async function enrichInsightWithAI(
  organizationId: string,
  insight: InsightToEnrich,
  userId?: string | null
): Promise<AIEnrichmentResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return generateDeterministicFallbackEnrichment(insight);
  }

  const prompt = `Jsi specializovaný AI expert na outdoorovou a OOH reklamu (billboardy, CLV, city postery, navigace) v systému SeePoint OS.
V systému byla detekována následující anomálie obsazenosti:

Typ problému: ${insight.type}
Závažnost: ${insight.severity}
Název: ${insight.title}
Faktický důvod z databáze: ${insight.deterministicReason}
Plocha: ${insight.surfaceName || 'neuvedeno'}
Kód nosiče: ${insight.carrierCode || 'neuvedeno'}
Město: ${insight.carrierCity || 'neuvedeno'}
Klient: ${insight.clientName || 'neuvedeno'}

Tvým úkolem je vytvořit strukturované vysvětlení pro obchodníka a manažera:
1. "aiExplanation": Stručné, přesné a lidsky srozumitelné shrnutí v češtině (1-2 věty), co se stalo a jaký to má praktický dopad.
2. "aiRecommendation": Konkrétní doporučený další krok pro obchodníka (1-2 věty), jak situaci vyřešit nebo využít obchodní příležitost.
3. "confidence": Číslo mezi 0.0 a 1.0 vyjadřující jistotu doporučení.

Odpověz výhradně validním JSON objektem ve tvaru:
{
  "aiExplanation": "...",
  "aiRecommendation": "...",
  "confidence": 0.95
}`;

  const modelsToTry = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) continue;

      const data = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;

      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as Partial<AIEnrichmentResult>;

      if (parsed.aiExplanation && parsed.aiRecommendation) {
        const promptTokens = data.usageMetadata?.promptTokenCount || 300;
        const outputTokens = data.usageMetadata?.candidatesTokenCount || 150;

        void logAIUsage({
          organizationId,
          userId,
          feature: 'OCCUPANCY_INTELLIGENCE',
          modelName: model,
          promptTokens,
          outputTokens,
          costEstimateUsd: estimateGeminiFlashCostUsd({ promptTokens, outputTokens }),
          metadata: { insightId: insight.id, type: insight.type },
        });

        return {
          aiExplanation: parsed.aiExplanation.trim(),
          aiRecommendation: parsed.aiRecommendation.trim(),
          confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.9,
        };
      }
    } catch (err) {
      console.warn(`[Occupancy AI] Enrichment model ${model} failed, attempting fallback:`, err);
    }
  }

  // Fallback if all AI models fail
  return generateDeterministicFallbackEnrichment(insight);
}

/**
 * Ranks deterministically validated alternative candidate surfaces.
 * AI can enhance ranking and provide sales reasons, but CANNOT add unvalidated candidates.
 */
export async function rankAlternativeSurfaces(
  organizationId: string,
  targetSurface: { id: string; name: string; mediaType: string; city: string; price?: number | null },
  candidates: CandidateAlternativeSurface[],
  userId?: string | null
): Promise<CandidateAlternativeSurface[]> {
  if (candidates.length <= 1) return candidates;

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    // Deterministic ranking by city match and price closeness
    return [...candidates].sort((a, b) => {
      const aSameCity = a.carrier.city.toLowerCase() === targetSurface.city.toLowerCase() ? 1 : 0;
      const bSameCity = b.carrier.city.toLowerCase() === targetSurface.city.toLowerCase() ? 1 : 0;
      if (aSameCity !== bSameCity) return bSameCity - aSameCity;

      const aPriceDiff = Math.abs((Number(a.price) || 0) - (Number(targetSurface.price) || 0));
      const bPriceDiff = Math.abs((Number(b.price) || 0) - (Number(targetSurface.price) || 0));
      return aPriceDiff - bPriceDiff;
    });
  }

  const prompt = `Jsi OOH specialista pro výběr náhradních reklamních ploch.
Původní plocha má kolizi nebo je nedostupná:
- Název: ${targetSurface.name}
- Typ média: ${targetSurface.mediaType}
- Město: ${targetSurface.city}
- Cena: ${targetSurface.price ?? 'neuvedena'} Kč

Následující plochy byly backendem ověřeny jako 100% TECHNICKY I KALENDÁŘNĚ VOLNÉ v požadovaném termínu:
${JSON.stringify(candidates.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.carrier.code,
    city: c.carrier.city,
    mediaType: c.mediaType,
    price: c.price,
  })), null, 2)}

Seřaď tyto kandidáty od nejvhodnějšího po méně vhodného a ke každému doplň krátký matchReason v češtině (1 věta pro obchodníka).
Odpověz validním JSON polem objektů:
[
  { "id": "...", "score": 95, "matchReason": "Stejná lokalita i typ média..." }
]`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const rankedList = JSON.parse(cleaned) as Array<{ id: string; score?: number; matchReason?: string }>;
        const rankMap = new Map(rankedList.map((r) => [r.id, r]));

        const rankedCandidates = candidates.map((c) => {
          const r = rankMap.get(c.id);
          return {
            ...c,
            score: r?.score ?? 50,
            matchReason: r?.matchReason || `Dostupná alternativa v lokalitě ${c.carrier.city}`,
          };
        });

        rankedCandidates.sort((a, b) => (b.score || 0) - (a.score || 0));
        return rankedCandidates;
      }
    }
  } catch (err) {
    console.warn('[Occupancy AI] Alternative ranking failed, falling back to deterministic order:', err);
  }

  return candidates;
}

/**
 * Natural language intent parser for "Zeptejte se obsazenosti".
 * Extracts structured query parameters (city, dates, mediaType, intent) without letting LLM execute raw SQL.
 */
export async function parseNaturalLanguageOccupancyQuery(
  query: string,
  availableCities: string[],
  availableMediaTypes: string[]
): Promise<ParsedOccupancyIntent> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    // Deterministic keyword fallback
    const qLower = query.toLowerCase();
    const matchedCity = availableCities.find((c) => qLower.includes(c.toLowerCase()));
    const matchedType = availableMediaTypes.find((t) => qLower.includes(t.toLowerCase()));

    let intent: ParsedOccupancyIntent['intent'] = 'FIND_AVAILABLE_MEDIA';
    if (qLower.includes('koliz') || qLower.includes('konflikt') || qLower.includes('překryv')) {
      intent = 'CHECK_COLLISIONS';
    } else if (qLower.includes('končí') || qLower.includes('expir') || qLower.includes('prodlouž')) {
      intent = 'EXPIRING_CAMPAIGNS';
    } else if (qLower.includes('ležák') || qLower.includes('nevyužit') || qLower.includes('prázdn')) {
      intent = 'UNDERUTILIZED_MEDIA';
    }

    return {
      intent,
      city: matchedCity,
      mediaType: matchedType,
      summaryAnswer: `Hledám ${intent === 'FIND_AVAILABLE_MEDIA' ? 'volné plochy' : 'informace o obsazenosti'}${matchedCity ? ` pro město ${matchedCity}` : ''}${matchedType ? ` typu ${matchedType}` : ''}.`,
    };
  }

  const prompt = `Jsi sémantický parser dotazů nad systémem obsazenosti reklamních ploch.
Uživatel položil dotaz: "${query}"

Dostupná města v databázi: ${JSON.stringify(availableCities.slice(0, 30))}
Dostupné typy médií: ${JSON.stringify(availableMediaTypes)}
Dnešní datum: ${new Date().toISOString().slice(0, 10)}

Extrahuj strukturovaná data.
Podporované záměry (intent):
- "FIND_AVAILABLE_MEDIA": hledání volných ploch pro kampaň
- "CHECK_COLLISIONS": dotaz na kolize, dvojité rezervace, konflikty
- "EXPIRING_CAMPAIGN": dotaz na končící kampaně k retenci
- "UNDERUTILIZED_MEDIA": dotaz na ležáky / nevyužité plochy
- "GENERAL_QUERY": obecný dotaz

Odpověz výhradně validním JSON objektem:
{
  "intent": "FIND_AVAILABLE_MEDIA",
  "city": "Ostrava",
  "region": null,
  "mediaType": "BILLBOARD",
  "dateFrom": "2026-11-01",
  "dateTo": "2026-11-30",
  "quantity": 20,
  "maxPrice": null,
  "summaryAnswer": "Hledám 20 volných billboardů v Ostravě na listopad 2026."
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        return JSON.parse(cleaned) as ParsedOccupancyIntent;
      }
    }
  } catch (err) {
    console.warn('[Occupancy AI] Natural query parsing failed, using fallback:', err);
  }

  return {
    intent: 'FIND_AVAILABLE_MEDIA',
    summaryAnswer: 'Zpracovávám váš dotaz na dostupnost ploch.',
  };
}
