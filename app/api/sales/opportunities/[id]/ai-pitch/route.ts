import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';
import { getGeminiApiKey } from '@/lib/ai-gemini';
import { logAIUsage } from '@/lib/ai-usage';
import { findNearbyCarriers } from '@/lib/opportunities/distance';
import { getOrganizationWorkCategories } from '@/lib/work-categories-server';
import { normalizeClientName } from '@/lib/crm/domain';
import { sendTransactionalEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const PREFERRED_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];

export type AiSalesPitchResult = {
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  companyId: string;
  dic: string;
  website: string;
  salesAngle: string;
  recommendedProduction: string[];
  emailSubject: string;
  emailBody: string;
  callScript: string[];
  nearbyCarriers: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    city: string;
    distanceKm?: number;
    availabilityStatus?: 'AVAILABLE' | 'OCCUPIED';
    availabilityLabel?: string;
  }>;
  generatedAt?: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI klíč (GEMINI_API_KEY) není v prostředí nakonfigurován.' },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;
    const organizationId = user.organizationId;
    enterTenantContext({ organizationId, userId: user.id });

    const [opportunity, org, workCategories] = await Promise.all([
      prisma.salesOpportunity.findFirst({
        where: { id, organizationId },
        include: {
          client: {
            include: {
              contacts: { take: 5 },
            },
          },
        },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, email: true, phone: true, website: true, city: true },
      }),
      getOrganizationWorkCategories(organizationId),
    ]);

    if (!opportunity) {
      return NextResponse.json({ error: 'Obchodní příležitost nebyla nalezena.' }, { status: 404 });
    }

    // 1. Geocode opportunity if coordinates are missing so we can find nearby carriers
    let lat = opportunity.latitude;
    let lng = opportunity.longitude;
    if ((lat === null || lng === null) && (opportunity.address || opportunity.city)) {
      const geoQuery = [opportunity.address, opportunity.city].filter(Boolean).join(', ');
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=cz&q=${encodeURIComponent(geoQuery)}`,
          {
            headers: { 'User-Agent': 'SeePOINT-internal/1.0' },
            signal: AbortSignal.timeout(3000),
          }
        );
        if (geoRes.ok) {
          const rows = (await geoRes.json()) as Array<{ lat: string; lon: string }>;
          if (rows?.[0]) {
            const parsedLat = Number(rows[0].lat);
            const parsedLng = Number(rows[0].lon);
            if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
              lat = parsedLat;
              lng = parsedLng;
            }
          }
        }
      } catch {
        // Ignore geocoding timeout
      }
    }

    // 2. Find real carriers near the opportunity or in the same city
    let matchedCarriers: Array<{
      id: string;
      code: string;
      name: string;
      type: string;
      city: string;
      distanceKm?: number;
      availabilityStatus?: 'AVAILABLE' | 'OCCUPIED';
      availabilityLabel?: string;
    }> = [];

    if (typeof lat === 'number' && typeof lng === 'number') {
      const nearby = await findNearbyCarriers(organizationId, lat, lng, 8);
      matchedCarriers = nearby.slice(0, 8).map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        type: String(c.type),
        city: c.city,
        distanceKm: c.distanceKm,
      }));
    }

    if (matchedCarriers.length < 4 && opportunity.city) {
      const cityCarriers = await prisma.advertisingCarrier.findMany({
        where: {
          organizationId,
          archivedAt: null,
          status: 'ACTIVE',
          city: { contains: opportunity.city.trim(), mode: 'insensitive' },
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          city: true,
        },
        take: 6,
      });
      const existingIds = new Set(matchedCarriers.map((c) => c.id));
      for (const cc of cityCarriers) {
        if (!existingIds.has(cc.id) && matchedCarriers.length < 8) {
          matchedCarriers.push({
            id: cc.id,
            code: cc.code,
            name: cc.name,
            type: String(cc.type),
            city: cc.city,
          });
        }
      }
    }

    // 2b. Enrich matchedCarriers with real-time Occupancy availability
    if (matchedCarriers.length > 0) {
      const now = new Date();
      const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const carrierIds = matchedCarriers.map((c) => c.id);

      const activeOccupancies = await prisma.occupancy.findMany({
        where: {
          organizationId,
          surface: { carrierId: { in: carrierIds } },
          status: { in: ['OCCUPIED', 'RESERVED'] },
          dateTo: { gte: now },
          dateFrom: { lte: in14Days },
        },
        select: {
          dateTo: true,
          surface: { select: { carrierId: true } },
        },
        orderBy: { dateTo: 'desc' },
      });

      const occupiedUntilByCarrier = new Map<string, Date>();
      for (const occ of activeOccupancies) {
        const cId = occ.surface.carrierId;
        const prev = occupiedUntilByCarrier.get(cId);
        if (!prev || occ.dateTo > prev) {
          occupiedUntilByCarrier.set(cId, occ.dateTo);
        }
      }

      matchedCarriers = matchedCarriers
        .map((c) => {
          const occupiedUntil = occupiedUntilByCarrier.get(c.id);
          if (occupiedUntil) {
            return {
              ...c,
              availabilityStatus: 'OCCUPIED' as const,
              availabilityLabel: `Obsazeno do ${occupiedUntil.toLocaleDateString('cs-CZ')}`,
            };
          }
          return {
            ...c,
            availabilityStatus: 'AVAILABLE' as const,
            availabilityLabel: 'Volný ihned',
          };
        })
        .sort((a, b) => {
          if (a.availabilityStatus !== b.availabilityStatus) {
            return a.availabilityStatus === 'AVAILABLE' ? -1 : 1;
          }
          return (a.distanceKm ?? 99) - (b.distanceKm ?? 99);
        })
        .slice(0, 6);
    }

    // 3. Quick ARES lookup by companyName or companyId for verified IČO / official details
    let aresInfo = '';
    try {
      const aresSearchRes = await fetch(
        `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            obchodniJmeno: opportunity.companyName.trim().slice(0, 120),
            start: 0,
            pocet: 3,
          }),
          signal: AbortSignal.timeout(4000),
        }
      );
      if (aresSearchRes.ok) {
        const aresJson = await aresSearchRes.json();
        const subjects = Array.isArray(aresJson?.ekonomickeSubjekty)
          ? aresJson.ekonomickeSubjekty
          : [];
        if (subjects.length > 0) {
          aresInfo = subjects
            .map(
              (s: { ico?: string; dic?: string; obchodniJmeno?: string; sidlo?: { textovaAdresa?: string } }) =>
                `IČO: ${s.ico || ''}, DIČ: ${s.dic || ''}, Název: ${s.obchodniJmeno || ''}, Sídlo: ${s.sidlo?.textovaAdresa || ''}`
            )
            .join(' | ');
        }
      }
    } catch {
      // Non-blocking ARES lookup
    }

    const existingCrmContacts = opportunity.client
      ? [
          opportunity.client.contactPerson
            ? `${opportunity.client.contactPerson} (${opportunity.client.email || ''} ${opportunity.client.phone || ''})`
            : '',
          ...(opportunity.client.contacts || []).map(
            (ct) =>
              `${ct.firstName} ${ct.lastName}${ct.title ? ` [${ct.title}]` : ''}: ${ct.email || ''} ${ct.phone || ''}`
          ),
        ]
          .filter(Boolean)
          .join('; ')
      : 'Žádný kontakt v CRM zatím není.';

    const carriersListStr =
      matchedCarriers.length > 0
        ? matchedCarriers
            .map(
              (c) =>
                `- [${c.code}] ${c.name} (${c.type}, ${c.city}${c.distanceKm !== undefined ? `, vzdálenost ${c.distanceKm} km od cíle` : ''}, stav: ${c.availabilityLabel || 'Volný ihned'})`
            )
            .join('\n')
        : '- V naší síti v daném regionu disponujeme venkovními reklamními nosiči (billboardy, CLV, navigační cedule na sloupech VO).';

    const servicesListStr = workCategories
      .map((wc) => `${wc.label} (${wc.description})`)
      .join(', ');

    const senderName = user.name || org?.name || 'Obchodní tým SeePOINT';
    const senderCompany = org?.name || 'SeePOINT';
    const senderPhone = org?.phone || '';

    const systemPrompt = `Jsi špičkový B2B obchodník české reklamní a výrobní agentury "${senderCompany}".
Tvým úkolem je připravit kompletní obchodní podklady a oslovení na míru pro tuto detekovanou obchodní příležitost:

DETEKOVANÁ PŘÍLEŽITOST:
- Firma / Značka: ${opportunity.companyName}
- Událost: ${opportunity.title} (${opportunity.eventType})
- Shrnutí události: ${opportunity.summary}
- Město / Lokalita: ${[opportunity.address, opportunity.city, opportunity.region].filter(Boolean).join(', ') || 'ČR'}
- Zdrojový článek / web: ${opportunity.sourceTitle} (${opportunity.sourceUrl})
- Web firmy (pokud znám): ${opportunity.website || opportunity.client?.website || 'Dohledej na internetu'}
- IČO / ARES kandidáti: ${opportunity.companyId || opportunity.client?.companyId || aresInfo || 'Dohledej na internetu'}
- Stávající kontakty v našem CRM: ${existingCrmContacts}

NAŠE DOSTUPNÉ REKLAMNÍ NOSIČE V OKOLÍ TÉTO AKCE (se stavem obsazenosti):
${carriersListStr}

NAŠE VÝROBNÍ A MONTÁŽNÍ SLUŽBY (vlastní tiskárna, dílna a montážní posádky):
${servicesListStr}

POKYNY PRO VYHLEDÁVÁNÍ A PŘÍPRAVU OSLOVENÍ:
1. **DOHLEDEJ REÁLNÉ KONTAKTY PŘES GOOGLE SEARCH:**
   - Najdi oficiální web firmy "${opportunity.companyName}" a dohledej konkrétní kontaktní osobu (jednatel, majitel, marketingový manažer, vedoucí pobočky nebo obchodní oddělení), telefonní číslo a e-mailovou adresu.
   - Pokud máme už kontakt v CRM, ověř ho nebo doplň chybějící telefon/e-mail.
   - Nikdy si nevymýšlej neexistující e-mail nebo telefon! Pokud najdeš jen firemní recepci/info e-mail a telefon na prodejnu, uveď je.
2. **VYBER KONKRÉTNÍ PRODUKTY A SLUŽBY NA MÍRU:**
   - Upřednostni nosiče, které mají stav "Volný ihned" (uveď jejich konkrétní lokality/kódy z našeho seznamu výše) + naši výrobu a montáž přímo pro jejich akci (např. u nové prodejny/pobočky: polep výloh a vstupu, 3D světelné logo, navigační cedule k prodejně, reklamní plachty/bannery).
3. **NAPIŠ PERSONALIZOVANÝ, LIDSKÝ E-MAIL (emailSubject + emailBody):**
   - Žádné robotické klišé typu "Doufám, že se máte skvěle".
   - Piš věcně, přátelsky a konkrétně: zmiň jejich chystanou událost (${opportunity.title}) v dané lokalitě, rovnou jim nabídni konkrétní plochy v okolí + kompletní výrobu/polepy na klíč, a navrhni krátký telefonát nebo zaslání mapky volných ploch.
   - Podepiš e-mail jménem: ${senderName}, ${senderCompany}${senderPhone ? `, tel.: ${senderPhone}` : ''}.
4. **PŘIPRAV TAHÁK DO TELEFONU (callScript):**
   - 3 stručné, přirozené body pro 30vteřinový telefonát (1. Otevření hovoru s odkazem na jejich akci, 2. Konkrétní nabídka nosičů v okolí + polepů/výroby, 3. Uzavření – domluva zaslání konkrétní mapky s cenou).

Vrať POUZE validní JSON v tomto formátu:
{
  "contactName": "Jméno a příjmení kontaktní osoby (nebo 'Vedení společnosti / Marketing')",
  "contactRole": "Role (např. 'Jednatel', 'Marketing', 'Vedoucí pobočky')",
  "contactEmail": "nalezeny@email.cz nebo prázdný řetězec",
  "contactPhone": "+420 ... nebo prázdný řetězec",
  "companyId": "8místné IČO nebo prázdný řetězec",
  "dic": "DIČ nebo prázdný řetězec",
  "website": "https://... nebo prázdný řetězec",
  "salesAngle": "1–2 věty pro našeho obchodníka: proč zrovna teď tato firma potřebuje naši reklamu a výrobu",
  "recommendedProduction": ["Polep výloh a vstupu provozovny", "Navigační směrovky na sloupech VO", "..."],
  "emailSubject": "Předmět e-mailu",
  "emailBody": "Celý text e-mailu včetně oslovení a podpisu",
  "callScript": [
    "1. Úvod: ...",
    "2. Nabídka: ...",
    "3. Domluva dalšího kroku: ..."
  ]
}`;

    let parsed: Omit<AiSalesPitchResult, 'nearbyCarriers'> | null = null;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(28_000)]);

    for (const modelName of PREFERRED_MODELS) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemPrompt }] }],
              tools: [{ googleSearch: {} }],
              generationConfig: {
                temperature: 0.2,
              },
            }),
          }
        );

        if (!response.ok) continue;
        const data = await response.json();
        const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
          ? data.candidates[0].content.parts
          : [];
        const rawText = parts
          .map((p: { text?: string }) => (typeof p?.text === 'string' ? p.text : ''))
          .join('\n')
          .trim();
        if (!rawText) continue;

        const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        const jsonStr =
          firstBrace !== -1 && lastBrace !== -1
            ? cleaned.slice(firstBrace, lastBrace + 1)
            : cleaned;
        parsed = JSON.parse(jsonStr);

        await logAIUsage({
          organizationId,
          userId: user.id,
          modelName,
          feature: 'SALES_RADAR',
          promptTokens: Math.ceil(systemPrompt.length / 4),
          outputTokens: Math.ceil(rawText.length / 4),
        });
        break;
      } catch (err) {
        console.warn(`[ai-pitch] Model ${modelName} failed:`, err);
      }
    }

    if (!parsed || !parsed.emailSubject || !parsed.emailBody) {
      return NextResponse.json(
        { error: 'AI Obchodníkovi se nepodařilo vygenerovat návrh oslovení. Zkuste to prosím znovu.' },
        { status: 422 }
      );
    }

    const result: AiSalesPitchResult = {
      contactName: parsed.contactName || opportunity.client?.contactPerson || '',
      contactRole: parsed.contactRole || '',
      contactEmail: parsed.contactEmail || opportunity.client?.email || '',
      contactPhone: parsed.contactPhone || opportunity.client?.phone || '',
      companyId: parsed.companyId || opportunity.companyId || opportunity.client?.companyId || '',
      dic: parsed.dic || opportunity.client?.dic || '',
      website: parsed.website || opportunity.website || opportunity.client?.website || '',
      salesAngle: parsed.salesAngle || '',
      recommendedProduction: Array.isArray(parsed.recommendedProduction)
        ? parsed.recommendedProduction.slice(0, 5)
        : [],
      emailSubject: parsed.emailSubject,
      emailBody: parsed.emailBody,
      callScript: Array.isArray(parsed.callScript) ? parsed.callScript : [],
      nearbyCarriers: matchedCarriers,
      generatedAt: new Date().toISOString(),
    };

    // Persist generated pitch into opportunity.scoreReasons so it remains saved across page reloads
    const existingScoreMeta =
      opportunity.scoreReasons &&
      typeof opportunity.scoreReasons === 'object' &&
      !Array.isArray(opportunity.scoreReasons)
        ? (opportunity.scoreReasons as Record<string, unknown>)
        : Array.isArray(opportunity.scoreReasons)
        ? { reasons: opportunity.scoreReasons }
        : {};

    await prisma.salesOpportunity
      .updateMany({
        where: { id, organizationId },
        data: {
          companyId: result.companyId || opportunity.companyId,
          website: result.website || opportunity.website,
          scoreReasons: {
            ...existingScoreMeta,
            aiSalesPitch: result,
          },
        },
      })
      .catch(() => null);

    return NextResponse.json({ ok: true, pitch: result });
  } catch (error) {
    console.error('[api/sales/opportunities/ai-pitch] POST failed:', error);
    return NextResponse.json(
      { error: 'Při přípravě obchodního oslovení došlo k chybě.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;

  try {
    const { id } = await params;
    const organizationId = user.organizationId;
    enterTenantContext({ organizationId, userId: user.id });

    const body = (await request.json().catch(() => ({}))) as {
      action?: 'save_to_crm' | 'send_email' | 'log_call';
      contactName?: string;
      contactRole?: string;
      contactEmail?: string;
      contactPhone?: string;
      companyId?: string;
      dic?: string;
      website?: string;
      emailSubject?: string;
      emailBody?: string;
      callNotes?: string;
    };

    const action = body.action || 'save_to_crm';

    const opportunity = await prisma.salesOpportunity.findFirst({
      where: { id, organizationId },
    });
    if (!opportunity) {
      return NextResponse.json({ error: 'Příležitost nebyla nalezena.' }, { status: 404 });
    }

    const contactName = body.contactName?.trim() || undefined;
    const contactRole = body.contactRole?.trim() || undefined;
    const contactEmail = body.contactEmail?.trim() || undefined;
    const contactPhone = body.contactPhone?.trim() || undefined;
    const companyId = body.companyId?.replace(/\s+/g, '').trim() || opportunity.companyId || undefined;
    const dic = body.dic?.replace(/\s+/g, '').trim() || undefined;
    const website = body.website?.trim() || opportunity.website || undefined;

    if (action === 'send_email') {
      if (!contactEmail || !body.emailSubject?.trim() || !body.emailBody?.trim()) {
        return NextResponse.json(
          { error: 'Pro odeslání e-mailu vyplňte e-mail příjemce, předmět a text zprávy.' },
          { status: 400 }
        );
      }
    }

    // 1. Ensure CRM Client is linked & enriched with discovered contacts
    let clientId = opportunity.clientId;
    const normalizedName = normalizeClientName(opportunity.companyName);

    if (!clientId) {
      const existingClient = await prisma.client.findFirst({
        where: {
          organizationId,
          active: true,
          OR: [
            { normalizedName },
            ...(companyId ? [{ companyId }] : []),
          ],
        },
      });

      if (existingClient) {
        clientId = existingClient.id;
        await prisma.client.update({
          where: { id: existingClient.id },
          data: {
            companyId: existingClient.companyId || companyId || null,
            dic: existingClient.dic || dic || null,
            website: existingClient.website || website || null,
            contactPerson: existingClient.contactPerson || contactName || null,
            email: existingClient.email || contactEmail || null,
            phone: existingClient.phone || contactPhone || null,
            lastActivityAt: new Date(),
          },
        });
      } else {
        const createdClient = await prisma.client.create({
          data: {
            organizationId,
            name: opportunity.companyName,
            normalizedName,
            companyId: companyId || null,
            dic: dic || null,
            website: website || null,
            contactPerson: contactName || null,
            email: contactEmail || null,
            phone: contactPhone || null,
            billingCity: opportunity.city || null,
            billingStreet: opportunity.address || null,
            status: 'LEAD',
            clientType: 'DIRECT_CLIENT',
            pricingSegment: 'COMMERCIAL',
            assignedUserId: opportunity.assignedToUserId || user.id,
            note: `Vytvořeno AI Obchodníkem z příležitosti: ${opportunity.title}`,
          },
        });
        clientId = createdClient.id;
      }
    } else {
      const existingClient = await prisma.client.findFirst({
        where: { id: clientId, organizationId },
      });
      if (existingClient) {
        await prisma.client.update({
          where: { id: existingClient.id },
          data: {
            companyId: existingClient.companyId || companyId || null,
            dic: existingClient.dic || dic || null,
            website: existingClient.website || website || null,
            contactPerson: existingClient.contactPerson || contactName || null,
            email: existingClient.email || contactEmail || null,
            phone: existingClient.phone || contactPhone || null,
            lastActivityAt: new Date(),
          },
        });
      }
    }

    // 2. Save ClientContact if we have contact details
    if (clientId && (contactName || contactEmail || contactPhone)) {
      const nameParts = (contactName || opportunity.companyName).trim().split(/\s+/);
      const firstName = nameParts[0] || 'Kontakt';
      const lastName = nameParts.slice(1).join(' ') || opportunity.companyName;

      const orConditions = [
        ...(contactEmail ? [{ email: contactEmail }] : []),
        ...(contactPhone ? [{ phone: contactPhone }] : []),
      ];

      const existingContact =
        orConditions.length > 0
          ? await prisma.clientContact.findFirst({
              where: {
                clientId,
                OR: orConditions,
              },
            })
          : null;

      if (!existingContact) {
        await prisma.clientContact.create({
          data: {
            organizationId,
            clientId,
            firstName,
            lastName,
            title: contactRole || 'Kontakt z AI Obchodníka',
            email: contactEmail || null,
            phone: contactPhone || null,
            isPrimary: true,
          },
        });
      }
    }

    // 3. Send email if action === 'send_email'
    let emailDelivery: unknown = null;
    if (action === 'send_email' && contactEmail && body.emailSubject && body.emailBody) {
      emailDelivery = await sendTransactionalEmail({
        to: contactEmail,
        subject: body.emailSubject.trim(),
        message: body.emailBody.trim(),
        template: 'client-crm-email',
        organizationId,
        idempotencyKey: `ai-sales-pitch-${id}-${Date.now()}`,
      });

      if (clientId) {
        await prisma.clientCommunication.create({
          data: {
            organizationId,
            clientId,
            authorUserId: user.id,
            type: 'EMAIL',
            subject: body.emailSubject.trim(),
            content: body.emailBody.trim(),
            isInternal: false,
          },
        });
      }
    }

    // 4. Log call if action === 'log_call'
    if (action === 'log_call' && clientId) {
      await prisma.clientCommunication.create({
        data: {
          organizationId,
          clientId,
          authorUserId: user.id,
          type: 'PHONE_CALL',
          subject: `Telefonické oslovení — ${opportunity.title}`,
          content:
            body.callNotes?.trim() ||
            `Telefonický kontakt přes AI Obchodníka (${contactName || opportunity.companyName}, tel. ${contactPhone || 'neuveden'}).`,
          isInternal: false,
        },
      });
    }

    // 5. Update SalesOpportunity status, metadata, and persisted aiSalesPitch
    const nextStatus =
      action === 'send_email' || action === 'log_call'
        ? 'CONTACTED'
        : opportunity.status === 'NEW'
        ? 'REVIEWED'
        : opportunity.status;

    const existingScoreMeta =
      opportunity.scoreReasons &&
      typeof opportunity.scoreReasons === 'object' &&
      !Array.isArray(opportunity.scoreReasons)
        ? (opportunity.scoreReasons as Record<string, unknown>)
        : Array.isArray(opportunity.scoreReasons)
        ? { reasons: opportunity.scoreReasons }
        : {};

    const existingPitch =
      existingScoreMeta.aiSalesPitch && typeof existingScoreMeta.aiSalesPitch === 'object'
        ? (existingScoreMeta.aiSalesPitch as Record<string, unknown>)
        : {};

    await prisma.salesOpportunity.updateMany({
      where: { id, organizationId },
      data: {
        clientId,
        companyId: companyId || opportunity.companyId,
        website: website || opportunity.website,
        status: nextStatus,
        scoreReasons: {
          ...existingScoreMeta,
          aiSalesPitch: {
            ...existingPitch,
            ...(contactName !== undefined ? { contactName } : {}),
            ...(contactRole !== undefined ? { contactRole } : {}),
            ...(contactEmail !== undefined ? { contactEmail } : {}),
            ...(contactPhone !== undefined ? { contactPhone } : {}),
            ...(companyId !== undefined ? { companyId } : {}),
            ...(dic !== undefined ? { dic } : {}),
            ...(website !== undefined ? { website } : {}),
            ...(body.emailSubject !== undefined ? { emailSubject: body.emailSubject } : {}),
            ...(body.emailBody !== undefined ? { emailBody: body.emailBody } : {}),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      clientId,
      status: nextStatus,
      emailDelivery,
    });
  } catch (error) {
    console.error('[api/sales/opportunities/ai-pitch] PUT failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Uložení obchodní akce selhalo.' },
      { status: 500 }
    );
  }
}
