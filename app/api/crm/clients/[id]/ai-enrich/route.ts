import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const dynamic = 'force-dynamic';

type AresCandidate = {
  ico?: string;
  dic?: string;
  obchodniJmeno?: string;
  sidlo?: {
    textovaAdresa?: string;
    nazevObce?: string;
    ulice?: string;
    cisloDomovni?: number | string;
    psc?: number | string;
  };
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiAccess('clients');
    if (isApiDenied(actor)) return actor;
    const limited = await enforceRateLimit(request, hashRateLimitIdentity(`${actor.organizationId}:${actor.id}`), rateLimitPolicies.crmAi);
    if (limited) return limited;

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      searchQuery?: string;
      overrideIco?: string;
    };

    const client = await prisma.client.findFirst({
      where: { id, organizationId: actor.organizationId, active: true },
      select: {
        name: true,
        tradingName: true,
        companyId: true,
        dic: true,
        website: true,
        billingCity: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Klient nenalezen.' }, { status: 404 });
    }

    const searchKeyword = (body.searchQuery || body.overrideIco || client.companyId || client.name || '').trim().slice(0, 200);
    if (!searchKeyword) return NextResponse.json({ error: 'Zadejte název firmy nebo IČO.' }, { status: 400 });
    const icoToSearch = body.overrideIco?.replace(/\s+/g, '') || client.companyId?.replace(/\s+/g, '') || '';

    let aresCandidates: AresCandidate[] = [];

    // 1A. Exact IČO Lookup in ARES
    if (icoToSearch && /^\d{8}$/.test(icoToSearch)) {
      try {
        const aresRes = await fetch(
          `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${icoToSearch}`,
          { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) }
        );
        if (aresRes.ok) {
          const singleSub = await aresRes.json();
          if (singleSub) aresCandidates.push(singleSub);
        }
      } catch (e) {
        console.warn('ARES IČO fetch failed:', e);
      }
    }

    // 1B. Multi-candidate Fuzzy Name Search in ARES (top 10 matches)
    if (aresCandidates.length === 0 && searchKeyword) {
      try {
        const aresSearchRes = await fetch(
          `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ obchodniJmeno: searchKeyword, start: 0, pocet: 10 }),
            signal: AbortSignal.timeout(10_000),
          }
        );
        if (aresSearchRes.ok) {
          const searchJson = await aresSearchRes.json();
          if (searchJson.ekonomickeSubjekty && Array.isArray(searchJson.ekonomickeSubjekty)) {
            aresCandidates = searchJson.ekonomickeSubjekty;
          }
        }
      } catch (e) {
        console.warn('ARES multi-candidate search failed:', e);
      }
    }

    const candidatesSummaryStr = aresCandidates
      .map(
        (c, idx) =>
          `[Kandidát ${idx + 1}] IČO: "${c.ico}", DIČ: "${c.dic || 'Neuvedeno'}", Název: "${c.obchodniJmeno}", Sídlo: "${c.sidlo?.textovaAdresa || ''}"`
      )
      .join('\n');

    // Step 2: Use Gemini 3.6 AI with Live Google Search Grounding to ensure 100% accurate data
    const apiKey = process.env.GEMINI_API_KEY;
    let aiEnrichmentResult: {
      selectedIndex?: number;
      selectedIco?: string;
      selectedDic?: string;
      selectedOfficialName?: string;
      tradingName?: string;
      foundWebsite?: string;
      foundEmail?: string;
      foundPhone?: string;
      foundStreet?: string;
      foundCity?: string;
      foundZip?: string;
      businessField?: string;
      companySummary?: string;
      executives?: string;
      contactPersons?: Array<{
        firstName: string;
        lastName: string;
        title?: string;
        email?: string;
        phone?: string;
      }>;
      msRegionBranches?: Array<{
        name: string;
        street?: string;
        city?: string;
        zip?: string;
        note?: string;
      }>;
      recommendedCarriers?: Array<{ type: string; reason: string }>;
      salesAdvice?: string[];
    } | null = null;

    if (apiKey) {
      const prompt = `Jsi seniorní CRM analytik a obchodní asistent české reklamní agentury SeePoint.

DŮLEŽITÝ KONTEXT AGENTURY SEEPOINT:
Agentura SeePoint působí a vlastní reklamní plochy VÝHRADNĚ V OSTRAVĚ a Moravskoslezském kraji (MS kraj – Ostrava, Opava, Frýdek-Místek, Karviná, Havířov, Třinec, Nový Jičín, Bohumín, Orlová, Krnov, Bruntál, Kopřivnice, Frenštát p.R.).
Praha ani jiné kraje nás NEZAJÍMAJÍ. Všechny reklamní návrhy, pobočky a kontaktní osoby ZACILUJ PRIORITNĚ NA OSTRAVU A MORAVSKOSLEZSKÝ KRAJ!

PŘÍSNÁ PRAVIDLA PRO PRAVDIVOST A ADRESY (LIVE GOOGLE SEARCH):
1. VYUŽIJ ŽIVÉ GOOGLE VYHLEDÁVÁNÍ PRO OVĚŘENÍ SKUTEČNÝCH A REÁLNÝCH PRODEJEN A POBOČEK KLIENTA.
2. NIKDY si NEVYMÝŠLEJ fiktivní nebo neodpovídající ulice, čísla popisná, jména ani kontakty!
3. Uváděj POUZE Skutečné a 100% ověřené adresa prodejen/poboček klienta z oficiálního webu klienta nebo ARES rejstříku.
4. Pokud u pobočky znáš město (např. Ostrava), ale neznáš na 100 % přesnou ulici s číslem popisným, raději pole \`street\` nechej prázdné nebo uveď městskou část (např. "Ostrava - Poruba"), než abys vygeneroval vymyšlenou ulici!
5. Raději uveď méně poboček, které jsou na 100 % reálné a ověřené, než více nepřesných!

Zadání hledaného klienta:
- Zadání/Hledaný pojem: "${searchKeyword}"
- Současný název v CRM: "${client.name}"
- Současný web: "${client.website || 'Neuveden'}"
- Současné sídlo/město: "${client.billingCity || 'Neuvedeno'}"

Nalezené kandidátní subjekty z českého státního rejstříku ARES:
${candidatesSummaryStr || 'Žádné subjekty nenalezeny'}

TVÉ ÚKOLY:
1. Z kandidátů z ARES vyber ten JEDINÝ SPRÁVNÝ hlavně odpovídající hledané značce/firmě (např. pro zadání "Canis" vybereš "CANIS SAFETY a.s." - pracovní oděvy, NIKOLIV nesouvisející firmy).
2. Urči přesný oficiální právní název (selectedOfficialName), IČO (selectedIco) a DIČ (selectedDic).
3. Vytvoř přirozený obchodní název značky (tradingName).
4. Uveď webové stránky firmy (foundWebsite), hlavního e-mail (foundEmail) a telefon (foundPhone).
5. Urči hlavní obor činnosti v češtině (businessField).
6. Napiš 2-3 stručné věty představující profil a zaměření firmy (companySummary).
7. Uveď jména jednatelů / vedení (executives).
8. Uveď reálné kontaktní osoby a manažery (contactPersons) pro Ostrava / MS kraj nebo centrálu.
9. POBOČKY (OSTRAVA & MS KRAJ): Dohledei reálné FYZICKÉ PRODEJNY A POBOČKY klienta v Moravskoslezském kraji s PŘESNÝMI A REÁLNÝMI ADRESAMI. Neuváděj vymyšlené ulice! Vyjmenuj pouze ověřené prodejny v poli \`msRegionBranches\`!
10. Navrhni 3 DOPORUČENÉ REKLAMNÍ NOSIČE ze sítě SeePoint V OSTRAVĚ A MS KRAJI s konkrétními důvody zacílení.
11. Napiš 2 prodejní argumenty zaměřené na podporu ostravských a krajských poboček.

Vrať POUZE platný JSON objekt bez markdownu ve tvaru:
{
  "selectedIndex": 1,
  "selectedIco": "25877698",
  "selectedDic": "CZ25877698",
  "selectedOfficialName": "CANIS SAFETY a.s.",
  "tradingName": "CANIS SAFETY - Pracovní oděvy",
  "foundWebsite": "https://www.canis.cz",
  "foundEmail": "info@canis.cz",
  "foundPhone": "+420 800 156 500",
  "foundStreet": "Poděbradská 260/59",
  "foundCity": "Praha 9",
  "foundZip": "19800",
  "businessField": "Pracovní oděvy, obuv a ochranné pracovní pomůcky",
  "companySummary": "CANIS SAFETY a.s. je přední český dodavatel pracovních oděvů a ochranných pomůcek s prodejnami v OSTRAVĚ a celém MS kraji.",
  "executives": "Ing. Jaromír Páral, David Páral",
  "contactPersons": [
    {
      "firstName": "Jan",
      "lastName": "Novák",
      "title": "Manažer prodeje MS kraj",
      "email": "ostrava@canis.cz",
      "phone": "+420 596 111 222"
    }
  ],
  "msRegionBranches": [
    {
      "name": "CANIS SAFETY - Prodejna Ostrava Hrabůvka",
      "street": "Místecká 329/258",
      "city": "Ostrava - Hrabůvka",
      "zip": "70030",
      "note": "Prodejna a velkosklad Ostrava"
    },
    {
      "name": "CANIS SAFETY - Prodejna Opava",
      "street": "Těšínská 2913/86",
      "city": "Opava",
      "zip": "74601",
      "note": "Prodejna Opava"
    }
  ],
  "recommendedCarriers": [
    { "type": "Městská navigace VO na ulici Místecká a Rudná v Ostravě", "reason": "Přímá velkoplošná navigace řemeslníků ke prodejně a skladu v Ostravě Hrabůvce." },
    { "type": "City Postery a Lavičky na uzlech MHD Ostrava Svinov a ÚAN", "reason": "Oslovení pracovníků a řemeslníků směřujících do průmyslových zón Hrabová a Poruba." },
    { "type": "Solitéry na přivaděči D1 Ostrava – Přívoz / Mošnov", "reason": "Dominantní viditelnost pro B2B firemní zákazníky a montážní firmy z celého MS kraje." }
  ],
  "salesAdvice": [
    "Nabídnout navigaci od sjezdu Místecká k ostravské prodejně CANIS.",
    "Zacílit na podporu návštěvnosti ostravské a opavské prodejny u stavebních firem z MS kraje."
  ]
}`;

      const modelsToTry = [process.env.GEMINI_CRM_MODEL?.trim() || 'gemini-2.5-flash'];
      for (const model of modelsToTry) {
        try {
          const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ googleSearch: {} }],
              }),
              signal: AbortSignal.timeout(20_000),
            }
          );

          if (aiRes.ok) {
            const aiJson = await aiRes.json();
            const rawText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            aiEnrichmentResult = JSON.parse(cleanJson);
            if (aiEnrichmentResult) break;
          } else {
            console.warn(`Gemini model ${model} HTTP ${aiRes.status}`);
          }
        } catch (e) {
          console.error(`Gemini AI enrichment error with model ${model}:`, e);
        }
      }
    }

    // Step 3: Extract selected ARES candidate details if chosen by AI
    const selectedCandIdx = (aiEnrichmentResult?.selectedIndex || 1) - 1;
    const matchedAres = aresCandidates[selectedCandIdx] || aresCandidates[0] || null;

    // If AI is unavailable, return only factual registry/current-CRM data. Do not invent contacts,
    // branches, executives or media recommendations as a "successful" fallback.
    if (!aiEnrichmentResult && (matchedAres || client.name)) {
      const compName = matchedAres?.obchodniJmeno || client.name;
      const compCity = matchedAres?.sidlo?.nazevObce || client.billingCity || undefined;

      aiEnrichmentResult = {
        selectedOfficialName: compName,
        tradingName: client.tradingName || compName,
        selectedIco: matchedAres?.ico || client.companyId || undefined,
        selectedDic: matchedAres?.dic || client.dic || undefined,
        foundWebsite: client.website || undefined,
        foundCity: compCity,
        companySummary: matchedAres
          ? `${compName} je v rejstříku ARES evidována pod IČO ${matchedAres.ico || 'neuvedeno'}.`
          : undefined,
      };
    }

    return NextResponse.json({
      ok: true,
      aresData: matchedAres
        ? {
            ico: matchedAres.ico,
            dic: matchedAres.dic,
            name: matchedAres.obchodniJmeno,
            address: matchedAres.sidlo?.textovaAdresa || '',
          }
        : null,
      aiEnrichment: aiEnrichmentResult,
    });
  } catch (err: unknown) {
    console.error('AI Client Enrich API error:', err instanceof Error ? err.message : 'unknown error');
    return NextResponse.json({ error: 'Návrhy klienta se nepodařilo bezpečně načíst.' }, { status: 500 });
  }
}
