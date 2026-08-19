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
    const aresIco = aresData?.ico || '';
    const aresDic = aresData?.dic || '';
    const officialName = aresData?.obchodniJmeno || client.name;
    const addressText = aresData?.sidlo?.textovaAdresa || '';

    // Step 2: Use Gemini 3.6 AI to analyze company & recommend SeePoint ad strategy
    const apiKey = process.env.GEMINI_API_KEY;
    let aiEnrichmentResult: {
      foundIco?: string;
      foundDic?: string;
      foundWebsite?: string;
      foundStreet?: string;
      foundCity?: string;
      foundZip?: string;
      businessField?: string;
      companySummary?: string;
      executives?: string;
      recommendedCarriers?: Array<{ type: string; reason: string }>;
      salesAdvice?: string[];
    } | null = null;

    if (apiKey) {
      const prompt = `Jsi seniorní CRM analytik a marketingový poradce české reklamní agentury SeePoint.

Analýza klienta:
- Název firmy: "${officialName}"
- IČO v databázi/ARES: "${aresIco || client.companyId || 'Chybí'}"
- DIČ v databázi/ARES: "${aresDic || client.dic || 'Chybí'}"
- Sídlo/Adresa: "${addressText || `${client.billingStreet || ''}, ${client.billingCity || ''}`}"
- Web klienta: "${client.website || 'Neuveden'}"
- Stávající poznámky: "${client.note || ''}"

Tvé úkoly:
1. Pokud chybí IČO nebo DIČ, zkus podle názvu firmy dohledat oficiální 8místné IČO a DIČ v ČR (např. CZ12345678).
2. Pokud chybí web klienta, uveď pravděpodobnou URL adresu webu klienta.
3. Identifikuj přesný hlavní obor činnosti firmy v češtině.
4. Napiš 2-3 stručné věty představující firmu, její rozsah a cílovou skupinu.
5. Doplň jména statutárních orgánů / jednatelů, pokud jsou známá nebo pravděpodobná.
6. Navrhni 3 DOPORUČENÉ REKLAMNÍ NOSIČE ze sítě SeePoint pro tohoto klienta (Městská navigace VO, City Postery & Lavičky, Galerie VENKU, Billboardy) s konkrétními důvody.
7. Napiš 2 konkrétní prodejní argumenty pro obchodníka SeePoint.

Vrať POUZE platný JSON objekt bez markdownu ve tvaru:
{
  "foundIco": "8místné IČO nebo null",
  "foundDic": "DIČ nebo null",
  "foundWebsite": "https://... nebo null",
  "foundStreet": "Ulice a č.p. nebo null",
  "foundCity": "Město nebo null",
  "foundZip": "PSČ nebo null",
  "businessField": "Hlavní obor činnosti",
  "companySummary": "2-3 věty o zaměření a profilu firmy...",
  "executives": "Jména jednatelů",
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

    // Step 3: Combine best verified values from ARES + Gemini AI + Existing DB
    const finalIco = aresIco || aiEnrichmentResult?.foundIco || client.companyId || null;
    const finalDic = aresDic || aiEnrichmentResult?.foundDic || client.dic || null;
    const finalWebsite = client.website || aiEnrichmentResult?.foundWebsite || null;

    const finalStreet = aresData?.sidlo?.ulice
      ? `${aresData.sidlo.ulice} ${aresData.sidlo.cisloDomovni || ''}`.trim()
      : aiEnrichmentResult?.foundStreet || client.billingStreet || null;

    const finalCity = aresData?.sidlo?.nazevObce || aiEnrichmentResult?.foundCity || client.billingCity || null;
    const finalZip = aresData?.sidlo?.psc ? String(aresData.sidlo.psc) : aiEnrichmentResult?.foundZip || client.billingZip || null;

    // Save directly into client in database!
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        companyId: finalIco,
        dic: finalDic,
        website: finalWebsite,
        billingStreet: finalStreet,
        billingCity: finalCity,
        billingZip: finalZip,
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
