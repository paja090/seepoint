import type { MountingType } from '@prisma/client';
import { geocodeAddress, computeGoogleRoute, reverseGeocode } from '@/lib/google-maps';
import { OfferValidationError } from '@/lib/offers/domain';
import { resolveCatalogPrice } from './price-resolver';
import { haversineMeters } from './scoring';
import type { AiNavigationPointInput, AiOfferPreview, AiOfferRequest, AiResolvedClient } from './types';

const pricedMountingTypes = ['LIGHT_POLE', 'TRACTION', 'COLUMN'] as const;
const mountingLabels: Record<(typeof pricedMountingTypes)[number], string> = {
  LIGHT_POLE: 'VO / veřejné osvětlení', TRACTION: 'Trakce', COLUMN: 'Sloupek',
};

/**
 * Checks if a road/street is a restricted highway or 1st class trunk road in Ostrava
 * (e.g. Rudná, Místecká, Bohumínská, Dálnice D1, D56, I/11).
 * Municipal navigation signs on light poles are NOT allowed on these main highways.
 */
export function isRestrictedHighwayOr1stClassRoad(text: string): boolean {
  if (!text) return false;
  const norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const forbiddenKeywords = [
    'rudna',
    'mistecka',
    'bohuminska',
    'opavska',
    'slovenska',
    'dalnice',
    'dalnici',
    'd1',
    'd56',
    'i/11',
    'i/56',
    'i/59',
    'silnice 1',
    'silnici 1',
  ];

  return forbiddenKeywords.some((keyword) => {
    if (keyword.length <= 3) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(norm);
    }
    return norm.includes(keyword);
  });
}

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

type ApproachOrigin = ReturnType<typeof approachOrigins>[number];

function isRefinedPoint(point: AiNavigationPointInput | ApproachOrigin): point is AiNavigationPointInput {
  return 'title' in point && typeof point.title === 'string' && point.title.length > 0;
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
  const origins = approachOrigins(target, radius, Math.max(input.quantity, 4));
  const requestedIds = new Set(input.request.selectedCandidateIds ?? []);
  const refinedPoints = input.request.navigationPoints?.slice(0, input.quantity) ?? [];
  const proposed: Array<AiNavigationPointInput | ApproachOrigin> = refinedPoints.length
    ? refinedPoints
    : requestedIds.size ? origins.filter((origin) => requestedIds.has(origin.id)) : origins.slice(0, input.quantity);
  const pricingCity = input.request.city?.trim() || (/ostrava/i.test(target.address) ? 'Ostrava' : '');
  const pricingOptions = await resolvePricingOptions({ pricingSegment: input.client.pricingSegment, city: pricingCity, effectiveDate: input.dateFrom, durationMonths: input.durationMonths });

  const items = await Promise.all(proposed.map(async (origin, index) => {
    const isRefined = isRefinedPoint(origin);
    const route = isRefined ? null : await computeGoogleRoute(origin, target);
    let routeStart = isRefined ? origin : firstPolylinePoint(route!.polyline) ?? origin;
    const pointTitle = isRefined ? origin.title : '';

    // Check street name via reverseGeocode to verify if GPS coordinates fall on a restricted 1st class road/highway
    let resolvedAddress = pointTitle;
    if (!isRefined) {
      const revGeo = await reverseGeocode(routeStart.latitude, routeStart.longitude);
      if (revGeo?.formattedAddress) {
        resolvedAddress = `${pointTitle} ${revGeo.formattedAddress}`;
      }
    }

    let isHighway = isRestrictedHighwayOr1stClassRoad(resolvedAddress);
    let wasShiftedOffHighway = false;

    // If point lands on a restricted highway (Rudná, Místecká, D1, D56, I/11), shift towards target onto municipal street
    if (isHighway && !isRefined) {
      for (let step = 1; step <= 3; step++) {
        const shiftLat = (target.latitude - routeStart.latitude) * (0.25 * step);
        const shiftLon = (target.longitude - routeStart.longitude) * (0.25 * step);
        const candidatePoint = {
          latitude: routeStart.latitude + shiftLat,
          longitude: routeStart.longitude + shiftLon,
        };
        const revGeo = await reverseGeocode(candidatePoint.latitude, candidatePoint.longitude);
        const candidateAddress = revGeo?.formattedAddress || '';
        if (!isRestrictedHighwayOr1stClassRoad(candidateAddress)) {
          routeStart = candidatePoint;
          resolvedAddress = candidateAddress;
          isHighway = false;
          wasShiftedOffHighway = true;
          break;
        }
      }
    }

    const mountingType = input.request.candidateMountingTypes?.[origin.id];
    const selectedPricing = pricingOptions.find((option) => option.mountingType === mountingType);
    const distance = isRefined ? origin.distanceMeters ?? haversineMeters(origin, target) : route!.status === 'OK' ? route!.distanceMeters : haversineMeters(origin, target);
    const direction = 'direction' in origin ? origin.direction : '';

    const reasons = isRefined ? origin.reasons : [
      `Dočasný výchozí bod pro příjezd od ${direction}.`,
      route!.status === 'OK' ? 'Trasa byla ověřena přes Google Routes.' : 'Google trasu zatím neověřil; počkejte na analýzu mapy v náhledu.',
    ];

    if (wasShiftedOffHighway || isHighway) {
      reasons.push('🛡️ Omezení sítě: Desky VO se neumísťují na dálnicích a I. třídě (Rudná, Místecká). Bod byl AI automaticky posunut na městskou odbočovací trusu.');
    }

    return {
      selectionId: origin.id, surfaceId: null, carrierId: '', carrierCode: `NAV-${index + 1}`,
      title: isRefined ? origin.title : `Orientační směr od ${direction}`, mediaType: 'NAVIGATION_SIGN' as const, city: pricingCity,
      latitude: routeStart.latitude, longitude: routeStart.longitude,
      dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10), quantity: 1, unit: 'bod',
      catalogPrice: selectedPricing?.total ?? null, finalPrice: selectedPricing?.total ?? null, rentalTotal: selectedPricing?.rentalTotal ?? null,
      price: selectedPricing?.componentPrices.RENTAL ?? null, componentPrices: selectedPricing?.componentPrices,
      mountingType: mountingType ?? null, pricingOptions,
      score: isRefined ? origin.score : route!.status === 'OK' ? 82 : 35, distanceMeters: distance,
      routePolyline: isRefined ? origin.routePolyline : route!.polyline || undefined,
      routeDurationSeconds: isRefined ? origin.routeDurationSeconds : route!.durationSeconds || undefined,
      arrowDirection: isRefined ? origin.arrowDirection ?? 'STRAIGHT' as const : 'STRAIGHT' as const,
      reasons,
    };
  }));

  const pricedItems = items.filter((item) => item.finalPrice !== null);
  const catalogTotal = pricedItems.length === items.length ? pricedItems.reduce((sum, item) => sum + item.finalPrice!, 0) : null;
  const warnings = [
    'Před realizací obchodník ověří sloup v terénu, nahraje fotografii a případně bod posune.',
    '🛡️ Omezení sítě: Navigační desky na sloupech VO nelze z legislativních a bezpečnostních důvodů umísťovat přímo na dálnicích a silnicích I. třídy (Rudná, Místecká, D1, D56). AI navrhuje body výhradně na odbočovacích křižovatkách a městských třídách.',
  ];

  if (items.length < input.quantity) warnings.push(`AI připravila ${items.length} různých příjezdových směrů z požadovaných ${input.quantity} bodů. Další body doplní obchodník v mapě.`);
  if (!refinedPoints.length && items.some((item) => !item.routePolyline)) warnings.push('Mapa ještě hledá silné body na reálných příjezdových trasách. Pokud Google trasu nenajde, body upraví obchodník v editoru.');
  if (pricingOptions.every((option) => option.total === null)) warnings.push('Pro tuto lokalitu, délku nebo segment není kompletní navigační ceník. Koncept lze vytvořit bez ceny.');
  return {
    mode: 'preview', offerType: 'NAVIGATION', recommendedOfferType: input.recommendedOfferType, client: input.client,
    city: pricingCity, dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10),
    durationMonths: input.durationMonths, budget: input.request.budget ?? null, target, items, catalogTotal,
    budgetDifference: catalogTotal !== null && input.request.budget ? catalogTotal - input.request.budget : null,
    warnings, candidateCount: origins.length,
    explanation: refinedPoints.length
      ? `Vybráno ${items.length} rozhodovacích míst na reálných příjezdových trasách mimo dálnice a I. třídy.`
      : `Připraveny výchozí směry na městských třídách a odbočkách (mimo dálnice a I. třídy).`,
  };
}
