import 'server-only';
import { OpportunityEventType } from '@prisma/client';
import type { CreateOpportunityInput, OrganizationRadarProfileData } from './types';
import { parseOpportunityCreateInput } from './policy';

export async function searchLiveOpportunitiesWithGemini(
  profile: OrganizationRadarProfileData
): Promise<CreateOpportunityInput[]> {
  const rawKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY;

  const rawOpenAiKey = process.env.OPENAI_API_KEY;
  const apiKey = rawKey ? rawKey.replace(/[^\x20-\x7E]/g, '').replace(/["']/g, '').trim() : '';
  const openAiKey = rawOpenAiKey ? rawOpenAiKey.replace(/[^\x20-\x7E]/g, '').replace(/["']/g, '').trim() : '';
  const effectiveGeminiKey = apiKey.startsWith('sk-') ? '' : apiKey;

  // Live web search grounding requires Gemini API
  if (!effectiveGeminiKey) {
    return [];
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  const citiesStr = profile.targetCities && profile.targetCities.length > 0
    ? `Klíčová města a lokality firmy: ${profile.targetCities.join(', ')}`
    : '';

  const regionsStr = profile.targetRegions && profile.targetRegions.length > 0
    ? `Zájmové kraje firmy: ${profile.targetRegions.join(', ')}`
    : 'Působnost firmy: Česká republika';

  const mediaTypesStr = profile.preferredMediaTypes && profile.preferredMediaTypes.length > 0
    ? profile.preferredMediaTypes.join(', ')
    : 'BILLBOARD, BIGBOARD, CITYLIGHT, BANNER, CITY_POSTER, NAVIGATION_SIGN';

  const eventTypesStr = profile.focusEventTypes && profile.focusEventTypes.length > 0
    ? profile.focusEventTypes.join(', ')
    : 'STORE_OPENING, NEW_BRANCH, RETAIL_PARK, EXPANSION, RESTAURANT_OPENING, MARKETING_EVENT, EVENT_EXHIBITION';

  const keywordsStr = profile.customKeywords && profile.customKeywords.length > 0
    ? `Doplňující sledovaná klíčová slova: ${profile.customKeywords.join(', ')}`
    : '';

  const prompt = `Jsi specializovaný AI Obchodní radar pro venkovní reklamu (OOH - Out Of Home) v České republice.
Dnešní datum je: ${todayISO}.
${regionsStr}.
${citiesStr}.
${keywordsStr}
Dostupné typy venkovních reklamních ploch: ${mediaTypesStr}.
Sledované kategorie: ${eventTypesStr}.

Tvým úkolem je na českém internetu a ve zprávách vyhledat reálné aktuální a nadcházející události a obchodní příležitosti pro venkovní reklamu v uvedených lokalitách a regionech:
1. Nové prodejny, pobočky, restaurace, autosalony, hobby markety, retail parky nebo nákupní centra, které se otevírají nebo nedávno otevřely.
2. Nadcházející kulturní, hudební, divadelní, sportovní festivaly, veletrhy, výstavy nebo městské akce.
3. Významné expanze firem, nová logistická či výrobní centra, náborové HR kampaně.

PŘÍSNÁ PRAVIDLA:
- Hledej POUZE skutečné, ověřitelné události ze zpravodajských webů a médií pro uvedené lokality.
- NIKDY si nevymýšlej neexistující firmy ani smyšlené události.
- Vždy uveď skutečnou URL adresu článku nebo média v poli "sourceUrl".
- Pokud město v článku není jednoznačné, zadej "city": null.

Vrať VÝHRADNĚ platný JSON seznam (pole objektů) s 6 až 12 nalezenými příležitostmi:
[
  {
    "companyName": "Přesný název firmy, značky, pořadatele nebo akce",
    "companyId": null,
    "website": "https://www.firma.cz nebo null",
    "eventType": "NEW_BRANCH | STORE_OPENING | RESTAURANT_OPENING | RETAIL_PARK | EXPANSION | RELOCATION | MARKETING_EVENT | EVENT_EXHIBITION | OTHER",
    "title": "Stručný atraktivní titulek příležitosti (max 8 slov)",
    "summary": "Stručné shrnutí události a proč potřebují billboardy/reklamu (2-3 věty)",
    "city": "Město události nebo null",
    "region": "Kraj události nebo null",
    "address": "Ulice/lokalita nebo null",
    "eventDate": "Datum YYYY-MM-DD (pouze pokud je >= ${todayISO}, jinak null)",
    "sourceUrl": "Skutečná URL zprávy / článku",
    "sourceTitle": "Titulek článku nebo název zdroje",
    "suggestedMediaTypes": ["BILLBOARD", "CITYLIGHT"]
  }
]`;

  const configuredOppModel = process.env.GEMINI_OPPORTUNITY_MODEL?.trim();
  const models = configuredOppModel
    ? [configuredOppModel]
    : ['gemini-3.6-flash', 'gemini-flash-latest'];

  let jsonText = '';

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': effectiveGeminiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (resp.ok) {
        const data = await resp.json();
        const rawPartText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (rawPartText) {
          jsonText = rawPartText;
          break;
        }
      }
    } catch (e) {
      // Try next model if timeout or error
      console.warn(`Model ${model} live search attempt failed:`, e instanceof Error ? e.message : e);
    }
  }

  if (!jsonText) {
    return [];
  }

  try {
    const cleanJson = jsonText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const arrayStart = cleanJson.indexOf('[');
    const arrayEnd = cleanJson.lastIndexOf(']');
    if (arrayStart === -1 || arrayEnd === -1) return [];

    const jsonSnippet = cleanJson.slice(arrayStart, arrayEnd + 1);
    const rawItems = JSON.parse(jsonSnippet);
    if (!Array.isArray(rawItems)) return [];

    const results: CreateOpportunityInput[] = [];
    for (const item of rawItems) {
      try {
        if (!item || typeof item !== 'object') continue;
        const eventDateStr = typeof item.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.eventDate)
          ? item.eventDate
          : undefined;

        // Ensure date is not in the past
        const validDate = eventDateStr && eventDateStr >= todayISO ? eventDateStr : undefined;

        const defaultMedia = profile.preferredMediaTypes?.slice(0, 3) || ['BILLBOARD', 'CITYLIGHT'];
        const suggestedMedia = Array.isArray(item.suggestedMediaTypes) && item.suggestedMediaTypes.length > 0
          ? item.suggestedMediaTypes
          : defaultMedia;

        const companyName = String(item.companyName || '').trim().slice(0, 200);
        if (!companyName) continue;

        const title = String(item.title || `Příležitost ${companyName}`).trim().slice(0, 240);
        const summary = String(item.summary || 'Dohledaná obchodní příležitost.').trim().slice(0, 4000);

        const sourceUrl = typeof item.sourceUrl === 'string' && item.sourceUrl.startsWith('http')
          ? item.sourceUrl.trim().slice(0, 2000)
          : 'https://radar.internal/';

        const parsed = parseOpportunityCreateInput({
          companyName,
          companyId: typeof item.companyId === 'string' && /^\d{8}$/.test(item.companyId.replace(/\s/g, ''))
            ? item.companyId.replace(/\s/g, '')
            : undefined,
          website: typeof item.website === 'string' && item.website.startsWith('http') ? item.website.trim() : undefined,
          eventType: (Object.values(OpportunityEventType).includes(item.eventType) ? item.eventType : 'NEW_BRANCH') as OpportunityEventType,
          title,
          summary,
          city: typeof item.city === 'string' && item.city.trim() && item.city.trim().toLowerCase() !== 'null' ? item.city.trim().slice(0, 120) : null,
          region: typeof item.region === 'string' && item.region.trim() && item.region.trim().toLowerCase() !== 'null' ? item.region.trim().slice(0, 120) : null,
          address: typeof item.address === 'string' && item.address.trim() ? item.address.trim().slice(0, 300) : undefined,
          eventDate: validDate,
          sourceUrl,
          sourceTitle: typeof item.sourceTitle === 'string' && item.sourceTitle.trim() ? item.sourceTitle.trim().slice(0, 500) : 'AI Živý webový průzkum',
          sourcePublishedAt: todayISO,
          suggestedMediaTypes: suggestedMedia,
        });

        results.push(parsed);
      } catch (itemErr) {
        console.warn('Skipping unparseable live opportunity item:', itemErr instanceof Error ? itemErr.message : itemErr);
      }
    }

    return results;
  } catch (parseErr) {
    console.error('Error parsing live search JSON:', parseErr);
    return [];
  }
}
