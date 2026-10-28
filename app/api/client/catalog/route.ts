import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';
import { normalizeClientName } from '@/lib/crm/domain';
import { createOffer } from '@/lib/offers/service';
import type { CurrentUser } from '@/lib/rbac';
import type { MediaType } from '@prisma/client';

export const dynamic = 'force-dynamic';

const DEFAULT_MEDIA_PRICES: Record<string, number> = {
  BILLBOARD: 5500,
  BIGBOARD: 12900,
  CITYLIGHT: 3900,
  CITY_POSTER: 2500,
  PROMO_BENCH: 1900,
  NAVIGATION_SIGN: 1500,
  LED_SCREEN: 8900,
  BANNER: 3500,
  OTHER: 3500,
};

const PRINT_INSTALL_UNIT_PRICE: Record<string, number> = {
  BILLBOARD: 1800,
  BIGBOARD: 4900,
  CITYLIGHT: 650,
  CITY_POSTER: 450,
  PROMO_BENCH: 950,
  NAVIGATION_SIGN: 850,
  LED_SCREEN: 0,
  BANNER: 1400,
  OTHER: 1200,
};

async function resolvePublicCatalogOrganization(orgParam?: string | null) {
  if (orgParam?.trim()) {
    const clean = orgParam.trim();
    const byIdOrSlug = await prisma.organization.findFirst({
      where: {
        isActive: true,
        OR: [{ id: clean }, { slug: clean }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        email: true,
        phone: true,
        website: true,
        city: true,
        street: true,
      },
    });
    if (byIdOrSlug) return byIdOrSlug;
  }

  // Fallback: pick primary active organization
  return prisma.organization.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      email: true,
      phone: true,
      website: true,
      city: true,
      street: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

function defaultCampaignDates() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 3, 0));
  return {
    dateFrom: from.toISOString().slice(0, 10),
    dateTo: to.toISOString().slice(0, 10),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Optional ARES lookup helper for self-service checkout
    const aresIco = searchParams.get('aresIco')?.replace(/\s+/g, '').trim();
    if (aresIco && /^\d{8}$/.test(aresIco)) {
      try {
        const aresRes = await fetch(
          `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${aresIco}`,
          {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(4500),
          }
        );
        if (aresRes.ok) {
          const data = (await aresRes.json()) as {
            ico?: string;
            dic?: string;
            obchodniJmeno?: string;
            sidlo?: {
              textovaAdresa?: string;
              nazevObce?: string;
              nazevUlice?: string;
              cisloDomovni?: number;
            };
          };
          return NextResponse.json({
            ok: true,
            company: {
              companyId: data.ico || aresIco,
              dic: data.dic || '',
              companyName: data.obchodniJmeno || '',
              city: data.sidlo?.nazevObce || '',
              address: data.sidlo?.textovaAdresa || '',
            },
          });
        }
      } catch {
        // Ignore ARES timeout
      }
      return NextResponse.json({ ok: false, error: 'Subjekt v ARES nebyl nalezen.' }, { status: 404 });
    }

    const org = await resolvePublicCatalogOrganization(searchParams.get('org'));
    if (!org) {
      return NextResponse.json({ error: 'Katalog není momentálně dostupný.' }, { status: 404 });
    }

    const organizationId = org.id;
    enterTenantContext({ organizationId, source: 'public-token' });

    const defaults = defaultCampaignDates();
    const rawFrom = searchParams.get('dateFrom') || defaults.dateFrom;
    const rawTo = searchParams.get('dateTo') || defaults.dateTo;

    const parsedFrom = new Date(`${rawFrom}T00:00:00.000Z`);
    const parsedTo = new Date(`${rawTo}T23:59:59.999Z`);
    const dateFrom = Number.isNaN(parsedFrom.getTime()) ? new Date(`${defaults.dateFrom}T00:00:00.000Z`) : parsedFrom;
    const dateTo =
      Number.isNaN(parsedTo.getTime()) || parsedTo < dateFrom
        ? new Date(Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth() + 3, 0, 23, 59, 59))
        : parsedTo;

    const [surfaces, priceRules] = await Promise.all([
      prisma.advertisingSurface.findMany({
        where: {
          organizationId,
          carrier: {
            organizationId,
            archivedAt: null,
            status: 'ACTIVE',
          },
        },
        include: {
          carrier: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              city: true,
              street: true,
              address: true,
              locality: true,
              region: true,
              latitude: true,
              longitude: true,
              description: true,
              placementDescription: true,
              photos: {
                where: { isPrivate: false, type: { not: 'EXPENSE_RECEIPT' } },
                orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                take: 2,
                select: { id: true, url: true },
              },
            },
          },
          photos: {
            where: { isPrivate: false, type: { not: 'EXPENSE_RECEIPT' } },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            take: 2,
            select: { id: true, url: true },
          },
          occupancies: {
            where: {
              organizationId,
              status: { in: ['OCCUPIED', 'RESERVED'] },
              dateTo: { gte: dateFrom },
              dateFrom: { lte: dateTo },
            },
            select: {
              id: true,
              dateFrom: true,
              dateTo: true,
              status: true,
            },
            orderBy: { dateTo: 'desc' },
          },
        },
        orderBy: [{ carrier: { city: 'asc' } }, { carrier: { code: 'asc' } }],
        take: 400,
      }),
      prisma.offerPriceRule.findMany({
        where: {
          organizationId,
          active: true,
          category: 'RENTAL',
        },
        orderBy: [{ sortOrder: 'asc' }],
      }),
    ]);

    const catalogItems = surfaces.map((s) => {
      // Resolve monthly rental price
      let monthlyPrice = s.price && Number(s.price) > 0 ? Number(s.price) : 0;
      if (monthlyPrice <= 0) {
        const cityNorm = (s.carrier.city || '').trim().toLowerCase();
        const rule = priceRules.find((r) => {
          const mediaOk = !r.mediaType || r.mediaType === s.mediaType;
          const cityOk = !r.city || r.city.trim().toLowerCase() === cityNorm;
          return mediaOk && cityOk;
        });
        if (rule && Number(rule.unitPrice) > 0) {
          monthlyPrice = Number(rule.unitPrice);
        } else {
          monthlyPrice = DEFAULT_MEDIA_PRICES[s.mediaType] || DEFAULT_MEDIA_PRICES.OTHER;
        }
      }

      const printInstallPrice =
        PRINT_INSTALL_UNIT_PRICE[s.mediaType] ?? PRINT_INSTALL_UNIT_PRICE.OTHER;

      // Resolve photo URL
      const primaryPhoto = s.photos[0] || s.carrier.photos[0] || null;
      const photoUrl = primaryPhoto
        ? `/api/client/catalog/photos/${primaryPhoto.id}?org=${encodeURIComponent(organizationId)}&thumbnail=1`
        : null;

      // Resolve availability in [dateFrom, dateTo]
      const latestOccupancy = s.occupancies[0] || null;
      const isAvailable = !latestOccupancy;
      const occupiedUntil = latestOccupancy ? latestOccupancy.dateTo.toISOString().slice(0, 10) : null;
      const nextAvailableFrom = latestOccupancy
        ? new Date(latestOccupancy.dateTo.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        : null;

      return {
        surfaceId: s.id,
        surfaceName: s.name,
        carrierId: s.carrier.id,
        carrierCode: s.carrier.code,
        carrierName: s.carrier.name,
        carrierType: String(s.carrier.type),
        mediaType: String(s.mediaType),
        city: s.carrier.city,
        street: s.carrier.street || s.carrier.address || s.carrier.locality || '',
        region: s.carrier.region || '',
        latitude: s.carrier.latitude,
        longitude: s.carrier.longitude,
        size: s.size || (s.mediaType === 'BILLBOARD' ? '5,1 × 2,4 m (Eurobillboard)' : s.mediaType === 'CITYLIGHT' ? '1,185 × 1,75 m (CLV)' : 'Standardní formát'),
        orientation: s.orientation || s.sidePosition || '',
        directionDescription: s.directionDescription || s.carrier.placementDescription || s.carrier.description || '',
        monthlyPrice,
        printInstallPrice,
        photoUrl,
        isAvailable,
        occupiedUntil,
        nextAvailableFrom,
      };
    });

    const cities = Array.from(new Set(catalogItems.map((i) => i.city).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'cs')
    );

    const mediaTypes = Array.from(new Set(catalogItems.map((i) => i.mediaType).filter(Boolean)));

    return NextResponse.json({
      ok: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        email: org.email,
        phone: org.phone,
        website: org.website,
        city: org.city,
      },
      dateFrom: dateFrom.toISOString().slice(0, 10),
      dateTo: dateTo.toISOString().slice(0, 10),
      cities,
      mediaTypes,
      items: catalogItems,
    });
  } catch (error) {
    console.error('[api/client/catalog] GET failed:', error);
    return NextResponse.json(
      { error: 'Katalog reklamních ploch se nepodařilo načíst.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      orgId?: string;
      dateFrom?: string;
      dateTo?: string;
      surfaceIds?: string[];
      includePrintAndInstall?: boolean;
      companyName?: string;
      companyId?: string;
      dic?: string;
      billingAddress?: string;
      billingCity?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      campaignName?: string;
      note?: string;
    };

    const org = await resolvePublicCatalogOrganization(body.orgId);
    if (!org) {
      return NextResponse.json({ error: 'Organizace nebyla nalezena.' }, { status: 404 });
    }

    const organizationId = org.id;
    enterTenantContext({ organizationId, source: 'public-token' });

    const surfaceIds = Array.isArray(body.surfaceIds)
      ? Array.from(new Set(body.surfaceIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)))
      : [];

    if (surfaceIds.length === 0) {
      return NextResponse.json(
        { error: 'Vyberte prosím alespoň jednu reklamní plochu do nabídky.' },
        { status: 400 }
      );
    }

    const companyName = (body.companyName || body.contactName || '').trim();
    const contactName = (body.contactName || companyName).trim();
    const contactEmail = (body.contactEmail || '').trim();
    const contactPhone = (body.contactPhone || '').trim();

    if (!companyName || !contactEmail || !contactPhone) {
      return NextResponse.json(
        { error: 'Vyplňte prosím název firmy/jméno, e-mail a telefonní číslo.' },
        { status: 400 }
      );
    }

    const defaults = defaultCampaignDates();
    const dateFromStr =
      body.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(body.dateFrom) ? body.dateFrom : defaults.dateFrom;
    const dateToStr =
      body.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(body.dateTo) && body.dateTo >= dateFromStr
        ? body.dateTo
        : defaults.dateTo;

    const dFrom = new Date(`${dateFromStr}T00:00:00.000Z`);
    const dTo = new Date(`${dateToStr}T23:59:59.999Z`);
    const diffDays = Math.max(1, Math.round((dTo.getTime() - dFrom.getTime()) / (1000 * 60 * 60 * 24)));
    const monthsCount = Math.max(1, Math.round(diffDays / 30));

    // Load selected surfaces and price rules
    const [surfaces, priceRules, orgMember] = await Promise.all([
      prisma.advertisingSurface.findMany({
        where: {
          id: { in: surfaceIds },
          organizationId,
        },
        include: {
          carrier: {
            select: { code: true, name: true, city: true, street: true, address: true },
          },
        },
      }),
      prisma.offerPriceRule.findMany({
        where: {
          organizationId,
          active: true,
          category: 'RENTAL',
        },
        orderBy: [{ sortOrder: 'asc' }],
      }),
      prisma.organizationMember.findFirst({
        where: {
          organizationId,
          isActive: true,
          role: { in: ['OWNER', 'ADMIN', 'SALES'] },
        },
        include: {
          user: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (surfaces.length === 0) {
      return NextResponse.json(
        { error: 'Vybrané reklamní plochy nebyly nalezeny.' },
        { status: 404 }
      );
    }

    // 1. Find or create Client in CRM
    const normalizedName = normalizeClientName(companyName);
    const cleanIco = body.companyId?.replace(/\s+/g, '').trim() || undefined;
    const cleanDic = body.dic?.replace(/\s+/g, '').trim() || undefined;

    let client = await prisma.client.findFirst({
      where: {
        organizationId,
        active: true,
        OR: [
          { normalizedName },
          ...(cleanIco ? [{ companyId: cleanIco }] : []),
          { email: { equals: contactEmail, mode: 'insensitive' } },
        ],
      },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          organizationId,
          name: companyName,
          normalizedName,
          companyId: cleanIco || null,
          dic: cleanDic || null,
          contactPerson: contactName,
          email: contactEmail,
          phone: contactPhone,
          billingCity: body.billingCity?.trim() || surfaces[0]?.carrier.city || null,
          billingStreet: body.billingAddress?.trim() || null,
          status: 'LEAD',
          clientType: 'DIRECT_CLIENT',
          pricingSegment: 'COMMERCIAL',
          assignedUserId: orgMember?.userId || null,
          note: `Samoobslužná poptávka z Katalogu ploch (${surfaces.length} ploch, ${dateFromStr} – ${dateToStr}).`,
        },
      });
    } else {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          companyId: client.companyId || cleanIco || null,
          dic: client.dic || cleanDic || null,
          contactPerson: client.contactPerson || contactName,
          email: client.email || contactEmail,
          phone: client.phone || contactPhone,
          lastActivityAt: new Date(),
        },
      });
    }

    // Ensure primary ClientContact exists
    const existingContact = await prisma.clientContact.findFirst({
      where: {
        clientId: client.id,
        OR: [{ email: contactEmail }, { phone: contactPhone }],
      },
    });

    if (!existingContact) {
      const nameParts = contactName.split(/\s+/);
      const firstName = nameParts[0] || contactName;
      const lastName = nameParts.slice(1).join(' ') || companyName;
      await prisma.clientContact.create({
        data: {
          organizationId,
          clientId: client.id,
          firstName,
          lastName,
          title: 'Samoobslužná rezervace (Katalog ploch)',
          email: contactEmail,
          phone: contactPhone,
          isPrimary: true,
          isCommercial: true,
        },
      });
    }

    // 2. Build Offer items with catalog prices
    let printInstallTotal = 0;
    const offerItems = surfaces.map((s) => {
      let monthlyPrice = s.price && Number(s.price) > 0 ? Number(s.price) : 0;
      if (monthlyPrice <= 0) {
        const cityNorm = (s.carrier.city || '').trim().toLowerCase();
        const rule = priceRules.find((r) => {
          const mediaOk = !r.mediaType || r.mediaType === (s.mediaType as MediaType);
          const cityOk = !r.city || r.city.trim().toLowerCase() === cityNorm;
          return mediaOk && cityOk;
        });
        monthlyPrice =
          rule && Number(rule.unitPrice) > 0
            ? Number(rule.unitPrice)
            : DEFAULT_MEDIA_PRICES[s.mediaType] || DEFAULT_MEDIA_PRICES.OTHER;
      }

      if (body.includePrintAndInstall) {
        printInstallTotal +=
          PRINT_INSTALL_UNIT_PRICE[s.mediaType] ?? PRINT_INSTALL_UNIT_PRICE.OTHER;
      }

      return {
        surfaceId: s.id,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        quantity: String(monthsCount),
        unit: 'měsíc',
        unitPrice: String(monthlyPrice),
        discountPercent: '0',
        discountAmount: '0',
        groupLabel: 'Vybrané reklamní plochy z Katalogu',
        customTitle: `${s.carrier.code} · ${s.name} (${s.carrier.city})`,
        clientDescription: [
          s.carrier.street || s.carrier.address,
          s.size,
          body.includePrintAndInstall ? 'vč. požadavku na výrobu a instalaci' : '',
        ]
          .filter(Boolean)
          .join(' · '),
      };
    });

    const citiesStr = Array.from(new Set(surfaces.map((s) => s.carrier.city).filter(Boolean))).join(', ');
    const offerTitle =
      body.campaignName?.trim() ||
      `Kampaň z Katalogu ploch: ${companyName} (${citiesStr || 'ČR'}, ${surfaces.length} ploch)`;

    const actorUser: CurrentUser = {
      id: orgMember?.user.id || 'catalog-self-service',
      name: orgMember?.user.name || org.name || 'Obchodní tým SeePOINT',
      email: orgMember?.user.email || org.email || 'obchod@seepoint.cz',
      role: 'ADMIN',
      allowedRoles: ['ADMIN'],
      organizationId,
    };

    const clientMessage = `Dobrý den, ${contactName},\n\nděkujeme za Váš výběr reklamních ploch v našem online katalogu ${org.name}.\n\nPřipravili jsme pro Vás tuto rekapitulaci nabídky na termín ${dateFromStr} až ${dateToStr} (${monthsCount} ${
      monthsCount === 1 ? 'měsíc' : monthsCount < 5 ? 'měsíce' : 'měsíců'
    }).${
      body.includePrintAndInstall
        ? `\nSoučástí Vaší poptávky je také kompletní výroba a instalace reklamních plachet/plakátů (orientační kalkulace výroby a výlepu: ${printInstallTotal.toLocaleString('cs-CZ')} Kč bez DPH).`
        : ''
    }\n\nNáš obchodní tým nyní prověří finální harmonogram výlepů a obratem Vám potvrdí závaznou rezervaci ploch.\n\nS přátelským pozdravem,\n${org.name}`;

    const internalNote = [
      `🛒 SAMOOBSLUŽNÁ REZERVACE Z KATALOGU PLOCH (/client/catalog)`,
      `Klient: ${companyName}${cleanIco ? ` (IČO: ${cleanIco})` : ''}`,
      `Kontakt: ${contactName}, ${contactEmail}, ${contactPhone}`,
      `Termín: ${dateFromStr} – ${dateToStr} (${monthsCount} měs.)`,
      body.includePrintAndInstall
        ? `Požaduje tisk a instalaci: ANO (odhad výroby a montáže: ${printInstallTotal.toLocaleString('cs-CZ')} Kč bez DPH)`
        : `Požaduje tisk a instalaci: NE (pouze pronájem ploch)`,
      body.note?.trim() ? `Poznámka klienta: ${body.note.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const { offer } = await createOffer(
      actorUser,
      {
        clientId: client.id,
        title: offerTitle,
        campaignName: offerTitle,
        contactPerson: contactName,
        contactEmail,
        contactPhone,
        pricingTier: 'COMMERCIAL',
        taxRate: '21',
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        internalNote,
        clientMessage,
        confirmNegotiation: true,
        chargeSelections: [],
        items: offerItems,
      },
      'draft'
    );

    // Log communication in CRM so it shows up on the client's timeline
    if (orgMember?.userId) {
      await prisma.clientCommunication
        .create({
          data: {
            organizationId,
            clientId: client.id,
            authorUserId: orgMember.userId,
            type: 'NOTE',
            subject: `Samoobslužná nabídka z Katalogu ploch (${surfaces.length} ploch)`,
            content: internalNote,
            isInternal: false,
          },
        })
        .catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      offer: {
        id: offer.id,
        title: offer.title,
        portalToken: offer.portalToken,
        portalUrl: offer.portalToken ? `/offer/${offer.portalToken}` : null,
        subtotal: offer.subtotal,
        totalWithTax: offer.totalWithTax,
        printInstallTotal: body.includePrintAndInstall ? printInstallTotal : 0,
        monthsCount,
        surfaceCount: surfaces.length,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
      },
    });
  } catch (error) {
    console.error('[api/client/catalog] POST failed:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Nepodařilo se vytvořit nabídku z vybraných ploch.',
      },
      { status: 500 }
    );
  }
}
