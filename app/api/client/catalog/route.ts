import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enterTenantContext } from '@/lib/tenant-context';
import { normalizeClientName } from '@/lib/crm/domain';
import { createOffer } from '@/lib/offers/service';
import type { CurrentUser } from '@/lib/rbac';
import type { CarrierType, MediaType } from '@prisma/client';

export const dynamic = 'force-dynamic';

// System fallback prices aligned with SeePOINT OS PriceListItem settings
const DEFAULT_MEDIA_PRICES: Record<string, number> = {
  PROMO_BENCH: 1200,
  PROMO_HORIZON: 1000,
  CITY_POSTER: 3300,
  CITYLIGHT: 6000,
  PROMO_MINITOWER: 8000,
  PROMO_TOWER: 20000,
  BILLBOARD: 9500,
  BIGBOARD: 28900,
  FACADE: 9500,
  LED_SCREEN: 35000,
  BANNER: 3500,
  OTHER: 3500,
};

const PRINT_INSTALL_UNIT_PRICE: Record<string, number> = {
  PROMO_BENCH: 400,
  PROMO_HORIZON: 200,
  CITY_POSTER: 1200,
  CITYLIGHT: 500,
  PROMO_MINITOWER: 3500,
  PROMO_TOWER: 15000,
  BILLBOARD: 1500,
  BIGBOARD: 4200,
  FACADE: 2900,
  LED_SCREEN: 0,
  BANNER: 1400,
  OTHER: 1200,
};

const DEFAULT_MIN_QUANTITY: Record<string, number> = {
  PROMO_BENCH: 6,
  PROMO_HORIZON: 10,
  CITY_POSTER: 1,
  CITYLIGHT: 1,
  PROMO_MINITOWER: 1,
  PROMO_TOWER: 1,
  BILLBOARD: 1,
  BIGBOARD: 1,
  FACADE: 1,
  LED_SCREEN: 1,
  BANNER: 1,
  OTHER: 1,
};

function isValidCityName(city?: string | null): boolean {
  if (!city) return false;
  const trimmed = city.trim();
  if (trimmed.length < 2) return false;
  if (/^\d+$/.test(trimmed)) return false;
  return true;
}

function resolveEffectiveMediaType(surfaceMediaType: string, carrierType: string): string {
  if (
    carrierType === 'PROMO_BENCH' ||
    carrierType === 'CITY_POSTER' ||
    carrierType === 'PROMO_HORIZON' ||
    carrierType === 'PROMO_TOWER' ||
    carrierType === 'PROMO_MINITOWER' ||
    carrierType === 'CITYLIGHT' ||
    carrierType === 'BIGBOARD' ||
    carrierType === 'LED_SCREEN' ||
    carrierType === 'FACADE' ||
    carrierType === 'BANNER'
  ) {
    return carrierType;
  }
  return surfaceMediaType || carrierType || 'OTHER';
}

function buildDisplaySurfaceTitle(surfaceName: string | null | undefined, carrierName: string): string {
  const sName = (surfaceName || '').trim();
  const cName = (carrierName || '').trim();
  if (!sName || sName.toLowerCase() === 'celý nosič' || sName.toLowerCase() === cName.toLowerCase()) {
    return cName || sName || 'Reklamní plocha';
  }
  if (cName && !sName.toLowerCase().includes(cName.toLowerCase())) {
    return `${cName} — ${sName}`;
  }
  return sName;
}

function buildLocalityAiDescription(carrier: {
  name?: string | null;
  city?: string | null;
  street?: string | null;
  locality?: string | null;
  address?: string | null;
  type?: string | null;
}): string {
  const rawName = (carrier.name || '').trim();
  const city = (carrier.city || '').trim();
  const street = (carrier.street || '').trim();
  const locality = (carrier.locality || '').trim();
  const text = `${rawName} ${street} ${locality} ${carrier.address || ''}`.toLowerCase();

  const locLabel = [
    city,
    locality && locality.toLowerCase() !== city.toLowerCase() ? locality : '',
    street && !rawName.toLowerCase().includes(street.toLowerCase()) ? `ul. ${street}` : '',
  ]
    .filter(Boolean)
    .join(' – ');

  const smerMatch = rawName.match(/sm[ěe]r\s+([^,()]+)/i);
  const smerText = smerMatch ? ` ve směru na ${smerMatch[1].trim()}` : '';

  let formatContext = 'Atraktivní reklamní plocha';
  if (carrier.type === 'PROMO_BENCH') {
    formatContext = 'Reklamní lavička přímo v pěší zóně a u zastávky';
  } else if (carrier.type === 'CITY_POSTER') {
    formatContext = 'Osvětlená vitrína City Poster (CLP) v úrovni očí chodců i řidičů';
  } else if (carrier.type === 'PROMO_HORIZON') {
    formatContext = 'Vyvýšený reklamní horizont s výbornou viditelností z dálky';
  } else if (carrier.type === 'PROMO_TOWER' || carrier.type === 'PROMO_MINITOWER') {
    formatContext = 'Nepřehlédnutelná čtyřstranná reklamní věž (360° zásah)';
  } else if (carrier.type === 'CITYLIGHT') {
    formatContext = 'Prémiová prosvětlená vitrína Citylight (CLV) s 24/7 viditelností';
  } else if (carrier.type === 'BILLBOARD') {
    formatContext = 'Velkoformátový billboard u hlavního dopravního tahu';
  } else if (carrier.type === 'BIGBOARD') {
    formatContext = 'Dominantní bigboard s maximálním dosahem na hlavní tepně';
  }

  const highlights: string[] = [];
  if (/mhd|zast[aá]vk|autobus|tramvaj|podchod|[žz]el\.?\s*st|n[aá]dra[žz]/i.test(text)) {
    highlights.push('vysoká denní frekvence cestujících MHD a pěších');
  }
  if (
    /kaufland|futurum|avion|tesco|lidl|penny|albert|billa|globus|obch\.?\s*d[uů]m|n[aá]kupn|oc\b|koksovna|baumax/i.test(
      text
    )
  ) {
    highlights.push('silný nákupní provoz a přímý zásah zákazníků obchodního centra');
  }
  if (/koupali[šs]t|baz[eé]n|stadion|ar[eé]na|park|zoo|dov|sport|h[aá]zen/i.test(text)) {
    highlights.push('oblíbená volnočasová a návštěvnická zóna s dlouhou dobou kontaktu');
  }
  if (
    /k[řr]i[žz]ovatk|kruhov|most|rudn[aá]|m[ií]steck[aá]|plze[ňn]sk[aá]|v[yý][šs]kovick[aá]|osvobozen[ií]|hlavn[ií]|t[řr]\./i.test(
      text
    )
  ) {
    highlights.push('intenzivní automobilová doprava a zpomalený provoz');
  }
  if (/nemocnic|poliklinik|[uú][řr]ad|po[šs]t|[šs]kol/i.test(text)) {
    highlights.push('spádové místo občanské vybavenosti s celodenním pohybem obyvatel');
  }
  if (highlights.length === 0) {
    highlights.push('stabilní denní pohyb místních obyvatel, chodců i projíždějících vozidel');
  }

  return `${formatContext} v lokalitě ${locLabel || city}${smerText}. Lokalitu charakterizuje ${highlights
    .slice(0, 2)
    .join(' a ')}.`;
}

type SystemPriceListItem = {
  id: string;
  name: string;
  carrierType: CarrierType | null;
  carrierTypeId: string | null;
  mediaType: MediaType | null;
  rentalMonths: number;
  minQuantity: number;
  rentalPrice: unknown;
  productionPrice: unknown;
};

type SystemOfferPriceRule = {
  id: string;
  code: string;
  label: string;
  category: string;
  mediaType: MediaType | null;
  carrierTypeId: string | null;
  city: string | null;
  unitPrice: unknown;
};

function resolveSystemSurfacePricing(
  surface: {
    price: unknown;
    mediaType: string;
    carrierTypeId?: string | null;
    carrier: {
      name: string;
      code: string;
      city: string;
      type: string;
      carrierTypeId?: string | null;
    };
  },
  priceListItems: SystemPriceListItem[],
  priceRules: SystemOfferPriceRule[]
) {
  const effectiveMediaType = resolveEffectiveMediaType(surface.mediaType, surface.carrier.type);
  const carrierNameLower = `${surface.carrier.code} ${surface.carrier.name}`.toLowerCase();

  // 1. Match candidates from PriceListItem (Nastavení -> Ceník nosičů)
  const candidates = priceListItems.filter((item) => {
    const itemNameLower = item.name.toLowerCase();
    // Skip election-only surcharges in standard commercial catalog
    if (itemNameLower.includes('volby')) return false;

    if (
      item.carrierTypeId &&
      (item.carrierTypeId === surface.carrierTypeId ||
        item.carrierTypeId === surface.carrier.carrierTypeId)
    ) {
      return true;
    }
    if (item.mediaType && item.mediaType === effectiveMediaType) {
      return true;
    }
    if (item.carrierType && item.carrierType === surface.carrier.type) {
      return true;
    }
    // Name fallback for items where mediaType/carrierType is null in DB
    if (!item.mediaType && !item.carrierType) {
      if (effectiveMediaType === 'BILLBOARD' && itemNameLower.includes('billboard')) return true;
      if (effectiveMediaType === 'BIGBOARD' && itemNameLower.includes('bigboard')) return true;
      if (effectiveMediaType === 'LED_SCREEN' && itemNameLower.includes('led')) return true;
    }
    return false;
  });

  let matchedItem: SystemPriceListItem | undefined;
  if (candidates.length > 0) {
    if (effectiveMediaType === 'PROMO_TOWER' || effectiveMediaType === 'PROMO_MINITOWER') {
      const isMini =
        effectiveMediaType === 'PROMO_MINITOWER' || carrierNameLower.includes('mini');
      matchedItem =
        candidates.find((c) =>
          isMini
            ? c.name.toLowerCase().includes('mini')
            : c.name.toLowerCase().includes('komerce')
        ) ||
        candidates.find((c) => !c.name.toLowerCase().includes('kultura')) ||
        candidates[0];
    } else if (effectiveMediaType === 'CITYLIGHT') {
      const isGallery = carrierNameLower.includes('gallery');
      matchedItem =
        candidates.find((c) =>
          isGallery
            ? c.name.toLowerCase().includes('gallery') && c.name.toLowerCase().includes('komerce')
            : c.name.toUpperCase() === 'CLV'
        ) ||
        candidates.find((c) => !c.name.toLowerCase().includes('kultura')) ||
        candidates[0];
    } else {
      matchedItem =
        candidates.find(
          (c) =>
            !c.name.toLowerCase().includes('komerce') &&
            !c.name.toLowerCase().includes('kultura')
        ) ||
        candidates.find((c) => c.name.toLowerCase().includes('komerce')) ||
        candidates[0];
    }
  }

  // Monthly rental price: explicit surface price -> PriceListItem.rentalPrice -> OfferPriceRule(RENTAL) -> default
  let monthlyPrice = surface.price && Number(surface.price) > 0 ? Number(surface.price) : 0;
  if (monthlyPrice <= 0 && matchedItem && Number(matchedItem.rentalPrice) > 0) {
    monthlyPrice = Number(matchedItem.rentalPrice);
  }
  if (monthlyPrice <= 0) {
    const cityNorm = (surface.carrier.city || '').trim().toLowerCase();
    const rentalRule = priceRules.find((r) => {
      if (r.category !== 'RENTAL') return false;
      const mediaOk = !r.mediaType || r.mediaType === effectiveMediaType;
      const cityOk = !r.city || r.city.trim().toLowerCase() === cityNorm;
      return mediaOk && cityOk;
    });
    if (rentalRule && Number(rentalRule.unitPrice) > 0) {
      monthlyPrice = Number(rentalRule.unitPrice);
    } else {
      monthlyPrice = DEFAULT_MEDIA_PRICES[effectiveMediaType] || DEFAULT_MEDIA_PRICES.OTHER;
    }
  }

  // Print & Installation price: PriceListItem.productionPrice -> OfferPriceRule(PRINT) -> default
  let printInstallPrice = -1;
  if (matchedItem && Number(matchedItem.productionPrice) >= 0) {
    printInstallPrice = Number(matchedItem.productionPrice);
  } else {
    const printRule = priceRules.find(
      (r) => r.category === 'PRINT' && r.mediaType === effectiveMediaType
    );
    if (printRule && Number(printRule.unitPrice) >= 0) {
      printInstallPrice = Number(printRule.unitPrice);
    }
  }
  if (printInstallPrice < 0) {
    printInstallPrice =
      PRINT_INSTALL_UNIT_PRICE[effectiveMediaType] ?? PRINT_INSTALL_UNIT_PRICE.OTHER;
  }

  const minQuantity =
    matchedItem && matchedItem.minQuantity > 0
      ? matchedItem.minQuantity
      : DEFAULT_MIN_QUANTITY[effectiveMediaType] || 1;

  return {
    effectiveMediaType,
    monthlyPrice,
    printInstallPrice,
    minQuantity,
    priceListName: matchedItem?.name || null,
  };
}

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

    const [surfaces, priceListItems, priceRules] = await Promise.all([
      prisma.advertisingSurface.findMany({
        where: {
          organizationId,
          status: { not: 'OUT_OF_SERVICE' },
          mediaType: { not: 'NAVIGATION_SIGN' },
          carrier: {
            organizationId,
            archivedAt: null,
            status: { not: 'MAINTENANCE' },
            type: { not: 'NAVIGATION' },
          },
        },
        include: {
          carrier: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              carrierTypeId: true,
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
        take: 5000,
      }),
      prisma.priceListItem.findMany({
        where: {
          organizationId,
          isActive: true,
          validTo: null,
        },
        orderBy: [{ validFrom: 'desc' }],
      }),
      prisma.offerPriceRule.findMany({
        where: {
          organizationId,
          active: true,
        },
        orderBy: [{ sortOrder: 'asc' }],
      }),
    ]);

    const catalogItems = surfaces
      .filter((s) => isValidCityName(s.carrier.city))
      .map((s) => {
        const pricing = resolveSystemSurfacePricing(s, priceListItems, priceRules);

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

        const aiOrStoredDescription =
          s.directionDescription ||
          s.carrier.placementDescription ||
          s.carrier.description ||
          buildLocalityAiDescription(s.carrier);

        const defaultSizeLabel =
          pricing.effectiveMediaType === 'BILLBOARD'
            ? '5,1 × 2,4 m (Eurobillboard)'
            : pricing.effectiveMediaType === 'BIGBOARD'
              ? '9,6 × 3,6 m (Bigboard)'
              : pricing.effectiveMediaType === 'CITYLIGHT' || pricing.effectiveMediaType === 'CITY_POSTER'
                ? '118,5 × 175 cm (CLV / CLP)'
                : pricing.effectiveMediaType === 'PROMO_BENCH'
                  ? 'Reklamní lavička (opěradlo)'
                  : pricing.effectiveMediaType === 'PROMO_HORIZON'
                    ? 'Reklamní horizont (oboustranný)'
                    : pricing.effectiveMediaType === 'PROMO_TOWER' ||
                        pricing.effectiveMediaType === 'PROMO_MINITOWER'
                      ? 'Reklamní věž (4 strany)'
                      : 'Standardní formát';

        return {
          surfaceId: s.id,
          surfaceName: buildDisplaySurfaceTitle(s.name, s.carrier.name),
          carrierId: s.carrier.id,
          carrierCode: s.carrier.code,
          carrierName: s.carrier.name,
          carrierType: String(s.carrier.type),
          mediaType: pricing.effectiveMediaType,
          city: s.carrier.city.trim(),
          street: s.carrier.street || s.carrier.locality || s.carrier.address || '',
          region: s.carrier.region || '',
          latitude: s.carrier.latitude,
          longitude: s.carrier.longitude,
          size: s.size || defaultSizeLabel,
          orientation: s.orientation || s.sidePosition || '',
          directionDescription: aiOrStoredDescription,
          monthlyPrice: pricing.monthlyPrice,
          printInstallPrice: pricing.printInstallPrice,
          minQuantity: pricing.minQuantity,
          priceListName: pricing.priceListName,
          photoUrl,
          isAvailable,
          occupiedUntil,
          nextAvailableFrom,
        };
      });

    const cities = Array.from(new Set(catalogItems.map((i) => i.city).filter(isValidCityName))).sort(
      (a, b) => a.localeCompare(b, 'cs')
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
      ? Array.from(
          new Set(
            body.surfaceIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          )
        )
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

    // Load selected surfaces and system price lists
    const [surfaces, priceListItems, priceRules, orgMember] = await Promise.all([
      prisma.advertisingSurface.findMany({
        where: {
          id: { in: surfaceIds },
          organizationId,
          mediaType: { not: 'NAVIGATION_SIGN' },
          carrier: {
            organizationId,
            archivedAt: null,
            type: { not: 'NAVIGATION' },
          },
        },
        include: {
          carrier: {
            select: {
              code: true,
              name: true,
              city: true,
              street: true,
              address: true,
              locality: true,
              type: true,
              carrierTypeId: true,
            },
          },
        },
      }),
      prisma.priceListItem.findMany({
        where: {
          organizationId,
          isActive: true,
          validTo: null,
        },
        orderBy: [{ validFrom: 'desc' }],
      }),
      prisma.offerPriceRule.findMany({
        where: {
          organizationId,
          active: true,
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

    // 2. Build Offer items with system catalog prices
    let printInstallTotal = 0;
    const offerItems = surfaces.map((s) => {
      const pricing = resolveSystemSurfacePricing(s, priceListItems, priceRules);

      if (body.includePrintAndInstall) {
        printInstallTotal += pricing.printInstallPrice;
      }

      const displayTitle = buildDisplaySurfaceTitle(s.name, s.carrier.name);

      return {
        surfaceId: s.id,
        dateFrom: dateFromStr,
        dateTo: dateToStr,
        quantity: String(monthsCount),
        unit: 'měsíc',
        unitPrice: String(pricing.monthlyPrice),
        discountPercent: '0',
        discountAmount: '0',
        groupLabel: 'Vybrané reklamní plochy z Katalogu',
        customTitle: `${s.carrier.code} · ${displayTitle} (${s.carrier.city})`,
        clientDescription: [
          s.carrier.street || s.carrier.address,
          s.size,
          body.includePrintAndInstall
            ? `vč. výroby a instalace (${pricing.printInstallPrice.toLocaleString('cs-CZ')} Kč)`
            : '',
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
        ? `\nSoučástí Vaší poptávky je také kompletní výroba a instalace reklamních plachet/plakátů dle ceníku (${printInstallTotal.toLocaleString('cs-CZ')} Kč bez DPH).`
        : ''
    }\n\nNáš obchodní tým nyní prověří finální harmonogram výlepů a obratem Vám potvrdí závaznou rezervaci ploch.\n\nS přátelským pozdravem,\n${org.name}`;

    const internalNote = [
      `🛒 SAMOOBSLUŽNÁ REZERVACE Z KATALOGU PLOCH (/client/catalog)`,
      `Klient: ${companyName}${cleanIco ? ` (IČO: ${cleanIco})` : ''}`,
      `Kontakt: ${contactName}, ${contactEmail}, ${contactPhone}`,
      `Termín: ${dateFromStr} – ${dateToStr} (${monthsCount} měs.)`,
      body.includePrintAndInstall
        ? `Požaduje tisk a instalaci: ANO (kalkulace výroby a montáže dle ceníku: ${printInstallTotal.toLocaleString('cs-CZ')} Kč bez DPH)`
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
            : 'Odeslání rezervace a vytvoření nabídky se nezdařilo.',
      },
      { status: 500 }
    );
  }
}
