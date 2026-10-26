import { extractionInstruction, extractFacts } from './semantic-core';
import { radarRequestSignal } from './deadline';
import { OpportunityEventType } from '@prisma/client';
import type { CreateOpportunityInput, OrganizationRadarProfileData } from './types';
import { parseOpportunityCreateInput } from './policy';

export async function searchLiveOpportunitiesWithGemini(
  profile: OrganizationRadarProfileData,
  deadline = Date.now() + 60_000,
  existingLeadSummaries: string[] = []
): Promise<CreateOpportunityInput[]> {
  const rawKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GEMINI_KEY;

  const apiKey = rawKey ? rawKey.replace(/[^\x20-\x7E]/g, '').replace(/["']/g, '').trim() : '';
  const effectiveGeminiKey = apiKey.startsWith('sk-') ? '' : apiKey;

  // Live web search grounding requires Gemini API
  if (!effectiveGeminiKey) {
    throw new Error('Živé hledání není nakonfigurováno: chybí Gemini API klíč.');
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

  const exclusionBlock = existingLeadSummaries.length > 0
    ? `\nJIŽ EVIDOVANÉ PŘÍLEŽITOSTI V CRM (TYTO KONKRÉTNÍ AKCE/PRODEJNY UŽ V DATABÁZI MÁME – NEVRACEJ JE ZNOVU, NAJDI JINÉ NOVÉ SUBJEKTY A AKCE):\n- ${existingLeadSummaries.slice(0, 35).join('\n- ')}\n`
    : '';

  const prompt = `Jsi specializovaný AI Obchodní radar pro venkovní reklamu (OOH - Out Of Home) v České republice.
Dnešní datum je: ${todayISO}.
${extractionInstruction}
${regionsStr}.
${citiesStr}.
${keywordsStr}
Dostupné typy venkovních reklamních ploch: ${mediaTypesStr}.
Sledované kategorie: ${eventTypesStr}.
${exclusionBlock}
Tvým úkolem je na českém internetu, v regionálních denících, radničních zpravodajích a oborových médiích vyhledat reálné aktuální a nadcházející události a obchodní příležitosti pro venkovní reklamu (billboardy, citylighty, navigační šipky/tabule) v uvedených městech a regionech:
1. Nové prodejny, pobočky, supermarkety, restaurace, kavárny, fastfoody, pekárny, hobby markety, retail parky nebo nákupní centra (které se připravují, otevírají nebo nedávno otevřely).
2. Developerské a rezidenční projekty, prodej nových bytů, řadových domů či stavebních pozemků, nové komerční a průmyslové zóny.
3. Autosalony, autoservisy, STK, mycí centra, showroomy nábytku, kuchyní, koupelen, podlah, stavebniny a zahradní centra.
4. Soukromé kliniky, stomatologická a estetická centra, optiky, lékárny, fitness centra, wellness, aquaparky, ski areály a rodinné zábavní parky.
5. Stěhování poboček na novou adresu, rebranding nebo znovuotevření po rekonstrukci (vysoká potřeba navigačních cedulí NAVIGATION_SIGN).
6. Nadcházející kulturní, hudební, gastro a sportovní festivaly, koncerty, veletrhy, výstavy, dny otevřených dveří a velké náborové (HR) kampaně průmyslových firem v regionu.

PŘÍSNÁ PRAVIDLA:
- Hledej POUZE skutečné, ověřitelné události a firmy ze zpravodajských či firemních webů pro uvedené lokality (pokud je seznam měst zadán, pokryj rovnoměrně různá cílová města, nejen největší město).
- NIKDY si nevymýšlej neexistující firmy ani smyšlené události.
- Vždy uveď skutečnou URL adresu článku nebo webu v poli "sourceUrl".
- Pokud město v článku není jednoznačné, zadej "city": null.

Vrať VÝHRADNĚ platný JSON seznam (pole objektů) s 8 až 12 nalezenými příležitostmi:
[
  {
    "companyName": "Přesný název firmy, značky, developera, pořadatele nebo akce",
    "companyId": null,
    "website": "https://www.firma.cz nebo null",
    "eventType": "NEW_BRANCH | STORE_OPENING | RESTAURANT_OPENING | CAR_DEALERSHIP | RETAIL_PARK | EXPANSION | RELOCATION | REOPENING | MARKETING_EVENT | EVENT_EXHIBITION | SEASONAL_CAMPAIGN | OTHER",
    "title": "Stručný atraktivní titulek příležitosti (max 8 slov)",
    "evidenceFact": "Ověřený fakt z článku: co přesně se otevírá/staví/děje a kde (bez domněnek)",
    "aiInterpretation": "AI interpretace: proč je tato událost komerčně relevantní pro venkovní OOH reklamu nebo navigační značení",
    "aiRecommendation": "Doporučený další krok (Next Best Action) pro obchodní tým",
    "summary": "Stručné shrnutí události a proč potřebují billboardy/navigační cedule (2-3 věty)",
    "city": "Město události nebo null",
    "region": "Kraj události nebo null",
    "address": "Ulice/lokalita nebo null",
    "eventDate": "Datum YYYY-MM-DD (pouze pokud je >= ${todayISO}, jinak null)",
    "sourceUrl": "Skutečná URL zprávy / článku",
    "sourceTitle": "Titulek článku nebo název zdroje",
    "suggestedMediaTypes": ["BILLBOARD", "CITYLIGHT", "NAVIGATION_SIGN"]
  }
]`;

  const configuredOppModel = process.env.GEMINI_OPPORTUNITY_MODEL?.trim();
  const models = configuredOppModel
    ? [configuredOppModel]
    : ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];

  let jsonText = '';
  let failure = 'Gemini nevrátil použitelnou odpověď.';

  for (const model of models) {
    if (Date.now() >= deadline) break;
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
        signal: radarRequestSignal(deadline, 60_000),
      });

      if (!resp.ok) { failure = `Gemini ${model}: HTTP ${resp.status}.`; continue; }
      if (resp.ok) {
        const data = await resp.json();
        const parts = Array.isArray(data.candidates?.[0]?.content?.parts)
          ? data.candidates[0].content.parts
          : [];
        const rawPartText = parts
          .map((p: { text?: string }) => (typeof p?.text === 'string' ? p.text : ''))
          .join('\n')
          .trim();
        if (rawPartText) {
          jsonText = rawPartText;
          break;
        }
      }
    } catch (e) {
      failure = `Gemini ${model}: požadavek selhal nebo překročil časový limit.`;
      // All retries share the same deadline.
      console.warn(`Model ${model} live search attempt failed:`, e instanceof Error ? e.message : e);
    }
  }

  if (!jsonText) {
    throw new Error(failure);
  }

  try {
    const cleanJson = jsonText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const arrayStart = cleanJson.indexOf('[');
    const arrayEnd = cleanJson.lastIndexOf(']');
    if (arrayStart === -1 || arrayEnd === -1) throw new Error('Neplatný JSON.');

    const jsonSnippet = cleanJson.slice(arrayStart, arrayEnd + 1);
    const rawItems = JSON.parse(jsonSnippet);
    if (!Array.isArray(rawItems)) throw new Error('Odpověď není seznam.');

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

        if (typeof item.sourceUrl !== 'string' || !/^https?:\/\//.test(item.sourceUrl)) continue;
        const sourceUrl = typeof item.sourceUrl === 'string' && item.sourceUrl.startsWith('http')
          ? item.sourceUrl.trim().slice(0, 2000)
          : '';

        const evidenceFact = typeof item.evidenceFact === 'string' && item.evidenceFact.trim() ? item.evidenceFact.trim().slice(0, 4000) : undefined;
        const aiInterpretation = typeof item.aiInterpretation === 'string' && item.aiInterpretation.trim() ? item.aiInterpretation.trim().slice(0, 4000) : undefined;
        const aiRecommendation = typeof item.aiRecommendation === 'string' && item.aiRecommendation.trim() ? item.aiRecommendation.trim().slice(0, 4000) : undefined;

        const parsed = parseOpportunityCreateInput({
          semanticData: extractFacts(item.semanticData),
          companyName,
          companyId: typeof item.companyId === 'string' && /^\d{8}$/.test(item.companyId.replace(/\s/g, ''))
            ? item.companyId.replace(/\s/g, '')
            : undefined,
          website: typeof item.website === 'string' && item.website.startsWith('http') ? item.website.trim() : undefined,
          eventType: (Object.values(OpportunityEventType).includes(item.eventType) ? item.eventType : 'NEW_BRANCH') as OpportunityEventType,
          title,
          summary,
          evidenceFact,
          aiInterpretation,
          aiRecommendation,
          city: typeof item.city === 'string' && item.city.trim() && item.city.trim().toLowerCase() !== 'null' ? item.city.trim().slice(0, 120) : null,
          region: typeof item.region === 'string' && item.region.trim() && item.region.trim().toLowerCase() !== 'null' ? item.region.trim().slice(0, 120) : null,
          address: typeof item.address === 'string' && item.address.trim() ? item.address.trim().slice(0, 300) : undefined,
          eventDate: validDate,
          sourceUrl,
          sourceTitle: typeof item.sourceTitle === 'string' && item.sourceTitle.trim() ? item.sourceTitle.trim().slice(0, 500) : 'AI Živý webový průzkum',
          sourcePublishedAt: typeof item.sourcePublishedAt === 'string' ? item.sourcePublishedAt : undefined,
          suggestedMediaTypes: suggestedMedia,
        });

        results.push(parsed);
      } catch (itemErr) {
        console.warn('Skipping unparseable live opportunity item:', itemErr instanceof Error ? itemErr.message : itemErr);
      }
    }

    if (rawItems.length > 0 && results.length === 0) throw new Error('Žádná položka neprošla validací.');
    return results;
  } catch (parseErr) {
    console.error('Error parsing live search JSON:', parseErr);
    throw new Error('Gemini vrátil neplatné nebo nepoužitelné příležitosti.');
  }
}
