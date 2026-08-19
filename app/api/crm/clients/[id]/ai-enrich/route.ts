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
    const client = await prisma.client.findUnique({ where: { id } });

    if (!client) {
      return NextResponse.json({ error: 'Klient nenalezen.' }, { status: 404 });
    }

    // Step 1: Query Czech State ARES Register if companyId (IČO) is present or search by name
    let aresData: any = null;
    const icoToSearch = client.companyId?.replace(/\s+/g, '') || '';

    if (icoToSearch && /^\d{8}$/.test(icoToSearch)) {
      try {
        const aresRes = await fetch(
          `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${icoToSearch}`,
          { headers: { Accept: 'application/json' } }
        );
        if (aresRes.ok) {
          aresData = await aresRes.json();
        }
      } catch (e) {
        console.warn('ARES IČO fetch failed:', e);
      }
    }

    // If no IČO or lookup failed, attempt name search in ARES
    if (!aresData && client.name) {
      try {
        const aresSearchRes = await fetch(
          `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ obchodniJmeno: client.name.trim(), start: 0, pocet: 1 }),
          }
        );
        if (aresSearchRes.ok) {
          const searchJson = await aresSearchRes.json();
          if (searchJson.ekonomickeSubjekty && searchJson.ekonomickeSubjekty.length > 0) {
            aresData = searchJson.ekonomickeSubjekty[0];
          }
        }
      } catch (e) {
        console.warn('ARES name search failed:', e);
      }
    }

    // Extracted ARES details
    const verifiedIco = aresData?.ico || client.companyId || '';
    const verifiedDic = aresData?.dic || client.dic || '';
    const officialName = aresData?.obchodniJmeno || client.name;
    const addressText = aresData?.sidlo?.textovaAdresa || '';

    // Step 2: Use Gemini 3.6 AI to analyze company & recommend SeePoint ad strategy
    const apiKey = process.env.GEMINI_API_KEY;
    let aiEnrichmentResult = null;

    if (apiKey) {
      const prompt = `Jsi seniorní CRM analytik a marketingový poradce české reklamní agentury SeePoint (specializace na OOH venkovní reklamu, městskou navigaci na sloupech VO, lavičky, Galerie VENKU a billboardy).

Analýza klienta:
- Název firmy: "${officialName}"
- IČO: "${verifiedIco}"
- Sídlo/Adresa: "${addressText || `${client.billingStreet}, ${client.billingCity}`}"
- Web klienta: "${client.website || 'Neuveden'}"
- Stávající poznámky: "${client.note || ''}"

Tvé úkoly:
1. Identifikuj přesný hlavní obor činnosti firmy (v češtině).
2. Napiš 2-3 stručné věty představující firmu, její rozsah a cílovou skupinu.
3. Doplň jména statutárních orgánů / jednatelů, pokud jsou známá nebo pravděpodobná.
4. Navrhni 3 DOPORUČENÉ REKLAMNÍ NOSIČE ze sítě SeePoint pro tohoto klienta:
   - Městská navigace (směrové tabule na sloupech VO u sjezdů a křižovatek)
   - City Postery & Lavičky (reklama na městském inventáři pro zásah chodců)
   - Galerie VENKU (venkovní výstavy na frekventovaných náměstích)
   - Solitéry & Billboardy na hlavních přivaděčích
   U každého nosiče uveď konkrétní důvod, proč je pro tohoto klienta ideální.
5. Napiš 2 konkrétní prodejní argumenty / tipy pro obchodníka SeePoint při sjednávání zakázky.

Vrať POUZE platný JSON objekt bez markdownu ve tvaru:
{
  "businessField": "Hlavní obor činnosti",
  "companySummary": "2-3 věty o zaměření a profilu firmy...",
  "executives": "Jména jednatelů nebo 'Neuvedeno v rejstříku'",
  "recommendedCarriers": [
    { "type": "Městská navigace VO", "reason": "Proč je vhodná..." },
    { "type": "City Postery & Lavičky", "reason": "Proč je vhodná..." },
    { "type": "Galerie VENKU", "reason": "Proč je vhodná..." }
  ],
  "salesAdvice": [
    "Tip pro obchodníka 1...",
    "Tip pro obchodníka 2..."
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

    // Step 3: Update client record in DB with verified details
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        companyId: verifiedIco || client.companyId,
        dic: verifiedDic || client.dic,
        billingStreet: aresData?.sidlo?.ulice
          ? `${aresData.sidlo.ulice} ${aresData.sidlo.cisloDomovni || ''}`.trim()
          : client.billingStreet,
        billingCity: aresData?.sidlo?.nazevObce || client.billingCity,
        billingZip: aresData?.sidlo?.psc ? String(aresData.sidlo.psc) : client.billingZip,
        note: aiEnrichmentResult?.companySummary
          ? `${client.note ? `${client.note}\n\n` : ''}🤖 AI Profil (${new Date().toLocaleDateString('cs-CZ')}): Obor: ${aiEnrichmentResult.businessField}. ${aiEnrichmentResult.companySummary}`
          : client.note,
      },
    });

    return NextResponse.json({
      ok: true,
      client: updatedClient,
      aresData: aresData
        ? {
            ico: aresData.ico,
            dic: aresData.dic,
            name: aresData.obchodniJmeno,
            address: addressText,
          }
        : null,
      aiEnrichment: aiEnrichmentResult,
    });
  } catch (err: any) {
    console.error('AI Client Enrich API error:', err);
    return NextResponse.json({ error: err.message || 'Chyba při AI dohledání klienta.' }, { status: 500 });
  }
}
