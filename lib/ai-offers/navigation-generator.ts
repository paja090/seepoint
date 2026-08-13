import type { MountingType } from '@prisma/client';
import { geocodeAddress, computeGoogleRoute } from '@/lib/google-maps';
import { OfferValidationError } from '@/lib/offers/domain';
import { resolveCatalogPrice } from './price-resolver';
import { haversineMeters } from './scoring';
import type { AiOfferPreview, AiOfferRequest, AiResolvedClient } from './types';

const pricedMountingTypes = ['LIGHT_POLE', 'TRACTION', 'COLUMN'] as const;
const mountingLabels: Record<(typeof pricedMountingTypes)[number], string> = {
  LIGHT_POLE: 'VO / veřejné osvětlení', TRACTION: 'Trakce', COLUMN: 'Sloupek',
};

function rentalQuantity(unit: string, durationMonths: number) {
  if (/rok|year|annual/i.test(unit)) return durationMonths / 12;
  if (/měs|mes|month/i.test(unit)) return durationMonths;
  return 1;
}

async function resolveTarget(request: AiOfferRequest) {
  const name = request.targetName?.trim() ?? '';
  const address = request.targetAddress?.trim() ?? '';
  const latitude = Number(request.targetLatitude);
  const longitude = Number(request.targetLongitude);
  if (!name) throw new OfferValidationError('Navigační návrh vyžaduje název cíle.');
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { name, address, latitude, longitude };
  if (!address) throw new OfferValidationError('Doplňte adresu cíle nebo jeho GPS souřadnice.');
  const geocoded = await geocodeAddress(address);
  if (!geocoded) throw new OfferValidationError('Adresu cíle se nepodařilo najít. Zkontrolujte ji nebo vyberte místo na mapě.');
  return { name, address: geocoded.formattedAddress, latitude: geocoded.latitude, longitude: geocoded.longitude };
}

function approachOrigins(target: { latitude: number; longitude: number }, radiusMeters: number, count: number) {
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta = radiusMeters / (111_320 * Math.max(0.2, Math.cos(target.latitude * Math.PI / 180)));
  return Array.from({ length: Math.min(8, count) }, (_, index) => {
    const angle = index * 2 * Math.PI / Math.min(8, count);
    return {
      id: `approach-${index + 1}`,
      latitude: target.latitude + Math.cos(angle) * latitudeDelta,
      longitude: target.longitude + Math.sin(angle) * longitudeDelta,
      direction: ['severu', 'severovýchodu', 'východu', 'jihovýchodu', 'jihu', 'jihozápadu', 'západu', 'severozápadu'][Math.round(index * 8 / Math.min(8, count)) % 8],
    };
  });
}

function firstPolylinePoint(encoded: string) {
  if (!encoded) return null;
  let index = 0; let latitude = 0; let longitude = 0;
  const decodeValue = () => {
    let result = 0; let shift = 0; let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    return (result & 1) ? ~(result >> 1) : result >> 1;
  };
  try {
    latitude += decodeValue(); longitude += decodeValue();
    return { latitude: latitude / 1e5, longitude: longitude / 1e5 };
  } catch { return null; }
}

async function resolvePricingOptions(input: {
  pricingSegment: AiResolvedClient['pricingSegment']; city: string; effectiveDate: Date; durationMonths: number;
}) {
  return Promise.all(pricedMountingTypes.map(async (mountingType) => {
    const [rental, installation, removal, production, print] = await Promise.all([
      resolveCatalogPrice({ ...input, mediaType: 'NAVIGATION_SIGN', mountingType, category: 'RENTAL' }),
      resolveCatalogPrice({ ...input, mediaType: 'NAVIGATION_SIGN', mountingType, category: 'INSTALLATION' }),
      resolveCatalogPrice({ ...input, mediaType: 'NAVIGATION_SIGN', mountingType, category: 'REMOVAL' }),
      resolveCatalogPrice({ ...input, mediaType: 'NAVIGATION_SIGN', mountingType, category: 'PRODUCTION' }),
      resolveCatalogPrice({ ...input, mediaType: 'NAVIGATION_SIGN', mountingType, category: 'PRINT' }),
    ]);
    const rentalTotal = rental ? rental.unitPrice * rentalQuantity(rental.unit, input.durationMonths) : null;
    const total = rentalTotal !== null && installation && removal && production && print
      ? rentalTotal + installation.unitPrice + removal.unitPrice + production.unitPrice + print.unitPrice
      : null;
    return {
      mountingType, label: mountingLabels[mountingType], rentalTotal, total,
      componentPrices: { RENTAL: rental, INSTALLATION: installation, REMOVAL: removal, PRODUCTION: production, PRINT: print },
    };
  }));
}

export async function generateNavigationPreview(input: {
  request: AiOfferRequest; client: AiResolvedClient; recommendedOfferType: AiOfferPreview['recommendedOfferType'];
  dateFrom: Date; dateTo: Date; durationMonths: number; quantity: number;
}): Promise<AiOfferPreview> {
  const target = await resolveTarget(input.request);
  const radius = Math.max(0.5, input.request.maxRadiusKm ?? 5) * 1000;
  const requestedIds = new Set(input.request.selectedCandidateIds ?? []);
  const origins = approachOrigins(target, radius, Math.max(input.quantity, 4));
  const proposed = requestedIds.size ? origins.filter((origin) => requestedIds.has(origin.id)) : origins.slice(0, input.quantity);
  const pricingCity = input.request.city?.trim() || (/ostrava/i.test(target.address) ? 'Ostrava' : '');
  const pricingOptions = await resolvePricingOptions({ pricingSegment: input.client.pricingSegment, city: pricingCity, effectiveDate: input.dateFrom, durationMonths: input.durationMonths });

  const items = await Promise.all(proposed.map(async (origin, index) => {
    const route = await computeGoogleRoute(origin, target);
    const routeStart = firstPolylinePoint(route.polyline) ?? origin;
    const mountingType = input.request.candidateMountingTypes?.[origin.id];
    const selectedPricing = pricingOptions.find((option) => option.mountingType === mountingType);
    const distance = route.status === 'OK' ? route.distanceMeters : haversineMeters(origin, target);
    return {
      selectionId: origin.id, surfaceId: null, carrierId: '', carrierCode: `AI-TRASA-${index + 1}`,
      title: `Návrhový bod – příjezd od ${origin.direction}`, mediaType: 'NAVIGATION_SIGN' as const, city: pricingCity,
      latitude: routeStart.latitude, longitude: routeStart.longitude,
      dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10), quantity: 1, unit: 'bod',
      catalogPrice: selectedPricing?.total ?? null, finalPrice: selectedPricing?.total ?? null, rentalTotal: selectedPricing?.rentalTotal ?? null,
      price: selectedPricing?.componentPrices.RENTAL ?? null, componentPrices: selectedPricing?.componentPrices,
      mountingType: mountingType ?? null, pricingOptions,
      score: route.status === 'OK' ? 90 : 65, distanceMeters: distance,
      routePolyline: route.polyline || undefined, routeDurationSeconds: route.durationSeconds || undefined, arrowDirection: 'STRAIGHT' as const,
      reasons: [
        `Orientační bod pokrývá příjezd od ${origin.direction}.`,
        route.status === 'OK' ? 'Příjezdová trasa byla navržena přes Google Routes.' : 'Jde o orientační radiální návrh; trasu a přesnou polohu musí zkontrolovat obchodník.',
        'Bod není svázaný s existujícím nosičem. V terénu je nutné najít vhodný sloup, nahrát jeho fotografii a bod případně posunout.',
      ],
    };
  }));
  const pricedItems = items.filter((item) => item.finalPrice !== null);
  const catalogTotal = pricedItems.length === items.length ? pricedItems.reduce((sum, item) => sum + item.finalPrice!, 0) : null;
  const warnings = ['Všechny body jsou pouze AI návrhy. Obchodník musí ověřit reálný sloup, nahrát fotografii a potvrdit nebo upravit polohu.'];
  if (items.length < input.quantity) warnings.push(`AI připravila ${items.length} různých příjezdových směrů z požadovaných ${input.quantity} bodů. Další body doplní obchodník v mapě.`);
  if (items.some((item) => !item.routePolyline)) warnings.push('Google Routes nebyla dostupná pro všechny příjezdy; část bodů je radiální orientační návrh.');
  if (items.some((item) => item.mountingType === null)) warnings.push('Vyberte u každého bodu předpokládaný typ konstrukce. Finální typ se potvrdí podle fotografie z terénu.');
  if (pricingOptions.every((option) => option.total === null)) warnings.push('Pro tuto lokalitu, délku nebo segment není kompletní navigační ceník. Koncept lze vytvořit bez ceny.');
  return {
    mode: 'preview', offerType: 'NAVIGATION', recommendedOfferType: input.recommendedOfferType, client: input.client,
    city: pricingCity, dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10),
    durationMonths: input.durationMonths, budget: input.request.budget ?? null, target, items, catalogTotal,
    budgetDifference: catalogTotal !== null && input.request.budget ? catalogTotal - input.request.budget : null,
    warnings, candidateCount: origins.length,
    explanation: `Navrženo ${items.length} nových orientačních bodů z různých příjezdových směrů. Nejde o existující plochy; přesný sloup, fotografii, typ konstrukce a polohu potvrdí obchodník v terénu.`,
  };
}
