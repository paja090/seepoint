import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return NextResponse.json({ error: 'Přihlášení vyžadováno.' }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      searchQuery?: string;
      overrideIco?: string;
    };

    const client = await prisma.client.findUnique({
      where: { id },
      include: { contacts: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Klient nenalezen.' }, { status: 404 });
    }

    const searchKeyword = (body.searchQuery || body.overrideIco || client.companyId || client.name || '').trim();
    const icoToSearch = body.overrideIco?.replace(/\s+/g, '') || client.companyId?.replace(/\s+/g, '') || '';

    let aresCandidates: any[] = [];

    // 1A. Exact IČO Lookup in ARES
    if (icoToSearch && /^\d{8}$/.test(icoToSearch)) {
      try {
        const aresRes = await fetch(
          `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${icoToSearch}`,
          { headers: { Accept: 'application/json' } }
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

    // Step 2: Use Gemini 3.6 AI to pick the BEST matching company candidate & enrich profile
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
      recommendedCarriers?: Array<{ type: string; reason: string }>;
      salesAdvice?: string[];
    } | null = null;

    if (apiKey) {
      const prompt = `Jsi seniorní CRM analytik a obchodní asistent české reklamní agentury SeePoint.

Zadání hledaného klienta:
- Zadání/Hledaný pojem: "${searchKeyword}"
- Současný název v CRM: "${client.name}"
- Současný web: "${client.website || 'Neuveden'}"
- Současné sídlo/město: "${client.billingCity || 'Neuvedeno'}"

Nalezené kandidátní subjekty z českého státního rejstříku ARES:
${candidatesSummaryStr || 'Žádné subjekty nenalezeny'}

TVÉ ÚKOLY:
1. Z kandidátů z ARES vyber ten JEDINÝ SPRÁVNÝ hlavně odpovídající hledané značce/firmě (např. pro zadání "Canis" vybereš "CANIS SAFETY a.s." - pracovní oděvy, NIKOLIV "AuraCanis s.r.o." nebo nesouvisející firmy).
2. Pokud v ARES kandidátech správná firma je, určete její přesný oficiální právní název (selectedOfficialName), IČO (selectedIco) a DIČ (selectedDic).
3. Vytvoř přirozený obchodní název značky (tradingName, např. "CANIS SAFETY - Pracovní oděvy a ochranné pomůcky").
4. Uveď webové stránky firmy (foundWebsite), hlavního e-mail (foundEmail) a telefon (foundPhone).
5. Určete hlavní obor činnosti v češtině (businessField).
6. Napiš 2-3 stručné věty představující profil a zaměření firmy (companySummary).
7. Uveď jména jednatelů / vedení (executives).
8. Uveď kontaktní osoby (contactPersons) s e-mailem a telefonem.
9. Navrhni 3 DOPORUČENÉ REKLAMNÍ NOSIČE ze sítě SeePoint pro tohoto klienta s důvody.
10. Napiš 2 prodejní argumenty pro obchodníka SeePoint.

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
  "companySummary": "CANIS SAFETY a.s. je přední český výrobce a dovozce pracovních oděvů, obuvi a ochranných pomůcek pro průmysl, stavebnictví a řemesla.",
  "executives": "Ing. Jaromír Páral, David Páral",
  "contactPersons": [
    {
      "firstName": "Jaromír",
      "lastName": "Páral",
      "title": "Předseda představenstva",
      "email": "info@canis.cz",
      "phone": "+420 800 156 500"
    }
  ],
  "recommendedCarriers": [
    { "type": "Městská navigace VO u průmyslových zón", "reason": "Navedení firemních zákazníků a řemeslníků přímo k prodejnám CANIS." },
    { "type": "City Postery & Lavičky u zastávek", "reason": "Zásah pracujících a řemeslníků při cestě do práce." },
    { "type": "Solitéry & Billboardy na přivaděčích měst", "reason": "Vysoká viditelnost pro B2B nákupčí stavebních a montážních firem." }
  ],
  "salesAdvice": [
    "Zdůraznit velkoplošnou navigaci pro pobočkovou síť po ČR.",
    "Nabídnout dlouhodobou prezentaci u velkých průmyslových parků."
  ]
}`;

      try {
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          }
        );

        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          const rawText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          aiEnrichmentResult = JSON.parse(cleanJson);
        }
      } catch (e) {
        console.error('Gemini AI enrichment error:', e);
      }
    }

    // Step 3: Extract selected ARES candidate details if chosen by AI
    const selectedCandIdx = (aiEnrichmentResult?.selectedIndex || 1) - 1;
    const matchedAres = aresCandidates[selectedCandIdx] || aresCandidates[0] || null;

    const finalOfficialName =
      aiEnrichmentResult?.selectedOfficialName || matchedAres?.obchodniJmeno || client.name;
    const finalTradingName = aiEnrichmentResult?.tradingName || client.tradingName || client.name;

    const finalIco =
      matchedAres?.ico || aiEnrichmentResult?.selectedIco || body.overrideIco || client.companyId || null;
    const finalDic = matchedAres?.dic || aiEnrichmentResult?.selectedDic || client.dic || null;
    const finalWebsite = client.website || aiEnrichmentResult?.foundWebsite || null;
    const finalEmail = client.email || aiEnrichmentResult?.foundEmail || null;
    const finalPhone = client.phone || aiEnrichmentResult?.foundPhone || null;
    const firstExecName = aiEnrichmentResult?.contactPersons?.[0]
      ? `${aiEnrichmentResult.contactPersons[0].firstName} ${aiEnrichmentResult.contactPersons[0].lastName}`
      : aiEnrichmentResult?.executives || client.contactPerson;

    const finalStreet = matchedAres?.sidlo?.ulice
      ? `${matchedAres.sidlo.ulice} ${matchedAres.sidlo.cisloDomovni || ''}`.trim()
      : aiEnrichmentResult?.foundStreet || client.billingStreet || null;

    const finalCity = matchedAres?.sidlo?.nazevObce || aiEnrichmentResult?.foundCity || client.billingCity || null;
    const finalZip = matchedAres?.sidlo?.psc ? String(matchedAres.sidlo.psc) : aiEnrichmentResult?.foundZip || client.billingZip || null;

    // Save CORRECT official legal name & verified data directly into DB
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        name: finalOfficialName,
        tradingName: finalTradingName,
        companyId: finalIco,
        dic: finalDic,
        website: finalWebsite,
        email: finalEmail,
        phone: finalPhone,
        contactPerson: firstExecName || client.contactPerson,
        billingStreet: finalStreet,
        billingCity: finalCity,
        billingZip: finalZip,
        note: aiEnrichmentResult?.companySummary
          ? `${client.note ? `${client.note}\n\n` : ''}🤖 AI Profil (${new Date().toLocaleDateString('cs-CZ')}): Obor: ${aiEnrichmentResult.businessField}. ${aiEnrichmentResult.companySummary}`
          : client.note,
      },
    });

    // Step 4: Automatically insert contact persons into client.contacts (`ClientContact` table)
    let createdContactsCount = 0;
    if (aiEnrichmentResult?.contactPersons && Array.isArray(aiEnrichmentResult.contactPersons)) {
      for (const cp of aiEnrichmentResult.contactPersons) {
        if (!cp.firstName || !cp.lastName) continue;
        const exists = client.contacts.some(
          (existing) =>
            existing.firstName.toLowerCase() === cp.firstName.toLowerCase() &&
            existing.lastName.toLowerCase() === cp.lastName.toLowerCase()
        );

        if (!exists) {
          await prisma.clientContact.create({
            data: {
              clientId: id,
              firstName: cp.firstName,
              lastName: cp.lastName,
              title: cp.title || 'Jednatel / Kontaktní osoba',
              email: cp.email || finalEmail || null,
              phone: cp.phone || finalPhone || null,
              isPrimary: client.contacts.length === 0,
              isCommercial: true,
            },
          });
          createdContactsCount++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      client: updatedClient,
      createdContactsCount,
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
  } catch (err: any) {
    console.error('AI Client Enrich API error:', err);
    return NextResponse.json({ error: err.message || 'Chyba při AI dohledání klienta.' }, { status: 500 });
  }
}
