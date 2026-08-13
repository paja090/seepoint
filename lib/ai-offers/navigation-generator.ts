import { prisma } from '@/lib/db';
import { computeGoogleRoute } from '@/lib/google-maps';
import { isSurfaceAvailable } from './availability';
import { resolveCatalogPrice } from './price-resolver';
import { bearingSector, haversineMeters } from './scoring';
import type { AiOfferPreview, AiOfferRequest, AiResolvedClient } from './types';

export async function generateNavigationPreview(input: {
  request: AiOfferRequest; client: AiResolvedClient; recommendedOfferType: AiOfferPreview['recommendedOfferType'];
  dateFrom: Date; dateTo: Date; durationMonths: number; quantity: number;
}): Promise<AiOfferPreview> {
  const target = {
    name: input.request.targetName?.trim() ?? '', address: input.request.targetAddress?.trim() ?? '',
    latitude: Number(input.request.targetLatitude), longitude: Number(input.request.targetLongitude),
  };
  if (!target.name || !Number.isFinite(target.latitude) || !Number.isFinite(target.longitude)) {
    throw new Error('Navigační návrh vyžaduje název cíle a jeho GPS souřadnice.');
  }
  const surfaces = await prisma.advertisingSurface.findMany({
    where: { mediaType: 'NAVIGATION_SIGN', status: { not: 'OUT_OF_SERVICE' }, carrier: { archivedAt: null, status: 'ACTIVE', latitude: { not: null }, longitude: { not: null } } },
    include: { carrier: true, occupancies: { where: { status: { in: ['RESERVED', 'OCCUPIED'] }, dateFrom: { lte: input.dateTo }, dateTo: { gte: input.dateFrom } } } },
    take: 1000,
  });
  const radius = Math.max(0.5, input.request.maxRadiusKm ?? 5) * 1000;
  const candidates = surfaces.map((surface) => ({
    surface,
    distance: haversineMeters({ latitude: surface.carrier.latitude!, longitude: surface.carrier.longitude! }, target),
    sector: bearingSector(target, { latitude: surface.carrier.latitude!, longitude: surface.carrier.longitude! }),
  })).filter(({ surface, distance }) => distance <= radius && isSurfaceAvailable({
    surfaceStatus: surface.status, carrierActive: surface.carrier.status === 'ACTIVE', carrierArchived: Boolean(surface.carrier.archivedAt),
    occupancies: surface.occupancies, dateFrom: input.dateFrom, dateTo: input.dateTo,
  })).sort((a, b) => a.distance - b.distance);

  const requestedIds = new Set(input.request.selectedSurfaceIds ?? []);
  const selected: typeof candidates = requestedIds.size ? candidates.filter((candidate) => requestedIds.has(candidate.surface.id)) : [];
  if (!requestedIds.size) {
    for (let sector = 0; sector < 4 && selected.length < input.quantity; sector++) {
      const point = candidates.find((candidate) => candidate.sector === sector && !selected.includes(candidate));
      if (point) selected.push(point);
    }
    for (const candidate of candidates) {
      if (selected.length >= input.quantity) break;
      if (!selected.includes(candidate)) selected.push(candidate);
    }
  }
  selected.sort((a, b) => b.distance - a.distance);
  const categories = ['RENTAL', 'INSTALLATION', 'REMOVAL', 'PRODUCTION'] as const;
  const componentPrices = Object.fromEntries(await Promise.all(categories.map(async (category) => [category, await resolveCatalogPrice({
    pricingSegment: input.client.pricingSegment, mediaType: 'NAVIGATION_SIGN', category,
    city: input.request.city, effectiveDate: input.dateFrom, durationMonths: input.durationMonths,
  })]))) as Record<(typeof categories)[number], Awaited<ReturnType<typeof resolveCatalogPrice>>>;
  const items = await Promise.all(selected.map(async ({ surface, distance }, index) => {
    const route = await computeGoogleRoute({ latitude: surface.carrier.latitude!, longitude: surface.carrier.longitude! }, target);
    const complete = categories.every((category) => componentPrices[category]);
    const total = complete
      ? componentPrices.RENTAL!.unitPrice * input.durationMonths + componentPrices.INSTALLATION!.unitPrice + componentPrices.REMOVAL!.unitPrice + componentPrices.PRODUCTION!.unitPrice
      : null;
    return {
      surfaceId: surface.id, carrierId: surface.carrierId, carrierCode: surface.carrier.code,
      title: `${surface.carrier.name} – ${surface.name}`, mediaType: surface.mediaType, city: surface.carrier.city,
      latitude: surface.carrier.latitude, longitude: surface.carrier.longitude,
      dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10), quantity: 1, unit: 'bod',
      catalogPrice: total, finalPrice: total, price: componentPrices.RENTAL, componentPrices,
      score: Math.max(40, 100 - Math.round(distance / radius * 40)), distanceMeters: route.status === 'OK' ? route.distanceMeters : distance,
      routePolyline: route.polyline || undefined, routeDurationSeconds: route.durationSeconds || undefined, arrowDirection: 'STRAIGHT' as const,
      reasons: [`Bod leží ${Math.round(distance)} m od cíle.`, `Pokrývá příjezdový směr č. ${index + 1}.`, route.status === 'OK' ? 'Trasa byla ověřena přes Google Routes.' : 'Použita vzdušná vzdálenost; trasu je nutné zkontrolovat.'],
    };
  }));
  const missingCategories = categories.filter((category) => !componentPrices[category]);
  const catalogTotal = missingCategories.length ? null : items.reduce((sum, item) => sum + (item.finalPrice ?? 0), 0);
  const warnings: string[] = [];
  if (selected.length < input.quantity) warnings.push(`V okruhu je dostupných pouze ${selected.length} bodů z požadovaných ${input.quantity}.`);
  if (missingCategories.length) warnings.push(`Chybí ceníkové sazby: ${missingCategories.join(', ')}. AI cenu nedopočítala.`);
  if (items.some((item) => !item.routePolyline)) warnings.push('U části bodů nebyla dostupná Google Routes trasa; před potvrzením zkontrolujte mapu.');
  return {
    mode: 'preview', offerType: 'NAVIGATION', recommendedOfferType: input.recommendedOfferType, client: input.client,
    city: input.request.city?.trim() ?? '', dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10),
    durationMonths: input.durationMonths, budget: input.request.budget ?? null, target, items, catalogTotal,
    budgetDifference: catalogTotal !== null && input.request.budget ? catalogTotal - input.request.budget : null,
    warnings, candidateCount: candidates.length,
    explanation: `Navrženo ${items.length} bodů v logické posloupnosti od vzdálenějších příjezdů k cíli. Výběr kombinuje dostupnost, rádius, různé příjezdové směry a trasová data.`,
  };
}
