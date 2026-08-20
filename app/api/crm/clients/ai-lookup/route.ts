import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return NextResponse.json({ error: 'Přihlášení vyžadováno.' }, { status: 401 });
    }

    const { query } = (await request.json().catch(() => ({}))) as { query?: string };
    const searchKeyword = (query || '').trim();

    if (!searchKeyword) {
      return NextResponse.json({ error: 'Zadejte název firmy nebo IČO.' }, { status: 400 });
    }

    const icoToSearch = searchKeyword.replace(/\s+/g, '');
    const isIco = /^\d{8}$/.test(icoToSearch);

    let aresCandidates: any[] = [];

    // 1A. Exact IČO Lookup in ARES
    if (isIco) {
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
    if (aresCandidates.length === 0) {
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

    // Step 2: Use Gemini 3.6 AI with Live Google Search Grounding to select best candidate & fill form values
    const apiKey = process.env.GEMINI_API_KEY;
    let aiResult: {
      name?: string;
      companyId?: string;
      dic?: string;
      email?: string;
      phone?: string;
      contactPerson?: string;
      billingCity?: string;
      billingStreet?: string;
      billingZip?: string;
      website?: string;
    } | null = null;

    if (apiKey) {
      const prompt = `Jsi CRM asistent české reklamní agentury SeePoint. Uživatel chce založit nového klienta do CRM podle zadání: "${searchKeyword}".

ARES rejstřík kandidáti:
${candidatesSummaryStr || 'Žádní kandidáti v ARES nenalezeni'}

ÚKOLY:
1. Vyber správnou firmu (např. pro zadání "Canis" vybereš "CANIS SAFETY a.s.", NIKOLIV nesouvisející firmy).
2. Připrav zjištěné kontaktní a fakturační údaje pro formulář.
3. Použij živé Google vyhledávání pro zjištění aktuálního webu, e-mailu a telefonu firmy.

Vrať POUZE platný JSON bez markdownu ve tvaru:
{
  "name": "CANIS SAFETY a.s.",
  "companyId": "25877698",
  "dic": "CZ25877698",
  "email": "info@canis.cz",
  "phone": "+420 800 156 500",
  "contactPerson": "Ing. Jaromír Páral (Předseda představenstva)",
  "billingCity": "Ostrava",
  "billingStreet": "Poděbradská 260/59",
  "billingZip": "19800",
  "website": "https://www.canis.cz"
}`;

      const modelsToTry = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
      for (const model of modelsToTry) {
        try {
          const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ googleSearch: {} }],
              }),
            }
          );

          if (aiRes.ok) {
            const aiJson = await aiRes.json();
            const rawText = aiJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            aiResult = JSON.parse(cleanJson);
            if (aiResult) break;
          }
        } catch (e) {
          console.error(`AI Lookup error with model ${model}:`, e);
        }
      }
    }

    const matchedAres = aresCandidates[0] || null;

    const finalData = {
      name: aiResult?.name || matchedAres?.obchodniJmeno || searchKeyword,
      companyId: isIco ? icoToSearch : aiResult?.companyId || matchedAres?.ico || '',
      dic: aiResult?.dic || matchedAres?.dic || '',
      email: aiResult?.email || '',
      phone: aiResult?.phone || '',
      contactPerson: aiResult?.contactPerson || '',
      billingCity: aiResult?.billingCity || matchedAres?.sidlo?.nazevObce || '',
      billingStreet: aiResult?.billingStreet || matchedAres?.sidlo?.ulice || '',
      billingZip: aiResult?.billingZip || (matchedAres?.sidlo?.psc ? String(matchedAres.sidlo.psc) : ''),
      website: aiResult?.website || '',
    };

    return NextResponse.json({ ok: true, data: finalData });
  } catch (err: any) {
    console.error('AI Lookup API error:', err);
    return NextResponse.json({ error: err.message || 'Chyba při načítání firmy.' }, { status: 500 });
  }
}
