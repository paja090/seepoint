import type { MediaType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isSurfaceAvailable } from './availability';
import { resolveCatalogPrice } from './price-resolver';
import { scoreStandardSurface } from './scoring';
import type { AiOfferPreview, AiOfferRequest, AiResolvedClient } from './types';

export async function generateStandardMediaPreview(input: {
  request: AiOfferRequest;
  client: AiResolvedClient;
  recommendedOfferType: AiOfferPreview['recommendedOfferType'];
  dateFrom: Date;
  dateTo: Date;
  durationMonths: number;
  quantity: number;
  mediaType?: MediaType;
}): Promise<AiOfferPreview> {
  const city = input.request.city?.trim() ?? '';
  const candidates = await prisma.advertisingSurface.findMany({
    where: {
      status: { not: 'OUT_OF_SERVICE' },
      ...(input.mediaType ? { mediaType: input.mediaType } : { mediaType: { not: 'NAVIGATION_SIGN' } }),
      carrier: {
        archivedAt: null,
        status: 'ACTIVE',
        ...(city ? { OR: [{ city: { contains: city, mode: 'insensitive' } }, { address: { contains: city, mode: 'insensitive' } }, { name: { contains: city, mode: 'insensitive' } }] } : {}),
      },
    },
    include: {
      carrier: true,
      occupancies: { where: { status: { in: ['RESERVED', 'OCCUPIED'] }, dateFrom: { lte: input.dateTo }, dateTo: { gte: input.dateFrom } } },
    },
    take: 500,
  });

  const available = candidates.filter((surface) => isSurfaceAvailable({
    surfaceStatus: surface.status,
    carrierActive: surface.carrier.status === 'ACTIVE',
    carrierArchived: Boolean(surface.carrier.archivedAt),
    occupancies: surface.occupancies,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  }));
  const priceCache = new Map<MediaType, Awaited<ReturnType<typeof resolveCatalogPrice>>>();
  for (const mediaType of new Set(available.map((surface) => surface.mediaType))) {
    priceCache.set(mediaType, await resolveCatalogPrice({
      pricingSegment: input.client.pricingSegment, mediaType, category: 'RENTAL', city,
      effectiveDate: input.dateFrom, durationMonths: input.durationMonths,
    }));
  }
  const budgetPerItem = input.request.budget && input.quantity ? input.request.budget / input.quantity : null;
  const ranked = available.map((surface) => {
    const price = priceCache.get(surface.mediaType) ?? null;
    const priceQuantity = price && /měs|mes|month/i.test(price.unit) ? input.durationMonths : 1;
    const totalPrice = price ? price.unitPrice * priceQuantity : null;
    const scoring = scoreStandardSurface({
      cityMatch: !city || surface.carrier.city.toLocaleLowerCase('cs').includes(city.toLocaleLowerCase('cs')),
      mediaMatch: !input.mediaType || surface.mediaType === input.mediaType,
      price: totalPrice, budgetPerItem,
      hasGps: surface.carrier.latitude != null && surface.carrier.longitude != null,
    });
    return { surface, price, totalPrice, ...scoring };
  }).sort((a, b) => b.score - a.score || (a.totalPrice ?? Number.MAX_SAFE_INTEGER) - (b.totalPrice ?? Number.MAX_SAFE_INTEGER));

  const requestedIds = new Set(input.request.selectedSurfaceIds ?? []);
  let selected: typeof ranked = [];

  if (requestedIds.size) {
    selected = ranked.filter((row) => requestedIds.has(row.surface.id));
  } else if (!input.mediaType) {
    // Interleave media types to build a balanced mix (lavičky/babičky, city postery, citylighty, billboardy...)
    const byType = new Map<MediaType, typeof ranked>();
    for (const row of ranked) {
      const list = byType.get(row.surface.mediaType) ?? [];
      list.push(row);
      byType.set(row.surface.mediaType, list);
    }
    const typeLists = Array.from(byType.values());
    const maxLen = Math.max(...typeLists.map((l) => l.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const list of typeLists) {
        if (list[i]) {
          selected.push(list[i]);
          if (selected.length === input.quantity) break;
        }
      }
      if (selected.length === input.quantity) break;
    }
  } else {
    selected = ranked.slice(0, input.quantity);
  }

  if (!requestedIds.size && input.request.budget && selected.some((row) => row.totalPrice !== null)) {
    const affordable: typeof selected = [];
    let running = 0;
    for (const row of (input.mediaType ? ranked : selected)) {
      if (row.totalPrice === null || running + row.totalPrice > input.request.budget) continue;
      affordable.push(row); running += row.totalPrice;
      if (affordable.length === input.quantity) break;
    }
    if (affordable.length) selected = affordable;
  }
  const items = selected.map(({ surface, price, totalPrice, score, reasons }) => ({
    selectionId: surface.id, surfaceId: surface.id, carrierId: surface.carrierId, carrierCode: surface.carrier.code,
    title: `${surface.carrier.name} – ${surface.name}`, mediaType: surface.mediaType, city: surface.carrier.city,
    latitude: surface.carrier.latitude, longitude: surface.carrier.longitude,
    dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10),
    quantity: price && /měs|mes|month/i.test(price.unit) ? input.durationMonths : 1, unit: price?.unit ?? 'neuvedeno', catalogPrice: totalPrice, finalPrice: totalPrice,
    price, score, reasons,
  }));
  const missingPrices = items.filter((item) => !item.price).length;
  const catalogTotal = missingPrices ? null : items.reduce((sum, item) => sum + (item.finalPrice ?? 0), 0);
  const warnings: string[] = [];
  if (available.length < input.quantity) warnings.push(`V období je dostupných pouze ${available.length} vyhovujících ploch z požadovaných ${input.quantity}.`);
  if (missingPrices) warnings.push(`Pro ${missingPrices} položek není nastavena cena pro segment ${input.client.pricingSegment}. Nabídka zůstane bez těchto cen.`);
  if (input.request.budget && items.length < input.quantity) warnings.push(`Požadovaný rozsah nelze při aktuálním ceníku splnit do ${input.request.budget.toLocaleString('cs-CZ')} Kč. Nebyla vytvořena automatická sleva.`);
  return {
    mode: 'preview', offerType: 'STANDARD_MEDIA', recommendedOfferType: input.recommendedOfferType, client: input.client,
    city, dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10), durationMonths: input.durationMonths,
    budget: input.request.budget ?? null, items, catalogTotal,
    budgetDifference: catalogTotal !== null && input.request.budget ? catalogTotal - input.request.budget : null,
    warnings, candidateCount: available.length,
    explanation: `Vybráno ${items.length} konkrétních dostupných reklamních ploch podle lokality, typu média, ceny a mapové použitelnosti. Každá strana nosiče byla posouzena samostatně.`,
  };
}
