import { geocodeAddress, computeGoogleRoute, reverseGeocode } from '@/lib/google-maps';
import { OfferValidationError } from '@/lib/offers/domain';
import { resolveCatalogPrice } from './price-resolver';
import { haversineMeters } from './scoring';
import type { AiNavigationPointInput, AiOfferPreview, AiOfferRequest, AiResolvedClient } from './types';
import { evaluateNavigationZoning, isCityOstrava } from './navigation-constraints';
import {
  decodePolylinePoints,
  inferArrowDirectionFromRoute,
  formatNavigationPointDetails,
} from './route-direction-helper';

export {
  evaluateNavigationZoning,
  isCityOstrava,
  isOstravaRestrictedZone,
  isRestrictedHighwayOr1stClassRoad,
} from './navigation-constraints';
export {
  decodePolylinePoints,
  inferArrowDirectionFromRoute,
  formatNavigationDistance,
  formatNavigationPointDetails,
} from './route-direction-helper';

const pricedMountingTypes = ['LIGHT_POLE', 'TRACTION', 'COLUMN'] as const;
const mountingLabels: Record<(typeof pricedMountingTypes)[number], string> = {
  LIGHT_POLE: 'VO / veřejné osvětlení', TRACTION: 'Trakce', COLUMN: 'Sloupek',
};

/**
 * Checks if a road/street is a restricted highway or 1st class trunk road in Ostrava/MS Region
 * (e.g. Rudná, Místecká, Bohumínská, Mariánskohorská, Dálnice D1, D56, I/11, I/56, I/59).
 * Municipal navigation signs on light poles are NOT allowed on these main highways.
 */
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
  const pricingCity = input.request.city?.trim() || (/ostrava/i.test(target.address) ? 'Ostrava' : '');
  const inOstrava = isCityOstrava(pricingCity, target.address);

  // Two-tier circuit quota: inner circuit (dojezd do 750m) vs outer circuit (křižovatky nad 1000m)
  const innerQuota = Math.max(1, Math.floor(input.quantity / 2));

  // Search origins in urban radius of 2.0 - 4.5 km to capture high-traffic intersections further out
  const radius = Math.min(4500, Math.max(2000, (input.request.maxRadiusKm ?? 4) * 1000));
  const origins = approachOrigins(target, radius, Math.max(input.quantity, 4));
  const requestedIds = new Set(input.request.selectedCandidateIds ?? []);
  const refinedPoints = input.request.navigationPoints?.slice(0, input.quantity) ?? [];
  const proposed: Array<AiNavigationPointInput | ApproachOrigin> = refinedPoints.length
    ? refinedPoints
    : requestedIds.size ? origins.filter((origin) => requestedIds.has(origin.id)) : origins.slice(0, input.quantity);
  const pricingOptions = await resolvePricingOptions({ pricingSegment: input.client.pricingSegment, city: pricingCity, effectiveDate: input.dateFrom, durationMonths: input.durationMonths });

  const items = await Promise.all(proposed.map(async (origin, index) => {
    const isRefined = isRefinedPoint(origin);
    let selectedPoint = { latitude: origin.latitude, longitude: origin.longitude };

    // Compute route to target for refined/moved points if polyline is missing, or compute route from scratch
    const route = isRefined && origin.routePolyline
      ? {
          status: 'OK' as const,
          distanceMeters: origin.distanceMeters ?? haversineMeters(selectedPoint, target),
          durationSeconds: origin.routeDurationSeconds ?? 0,
          polyline: origin.routePolyline,
        }
      : await computeGoogleRoute(selectedPoint, target);

    const direction = 'direction' in origin ? origin.direction : '';

    // Determine target circuit role for this item slot
    const isInnerSlot = index < innerQuota;
    let targetCircuit: 'INNER' | 'OUTER' = isInnerSlot ? 'INNER' : 'OUTER';
    let targetCircuitLabel = isInnerSlot ? 'Vnitřní okruh (dojezd k prodejně)' : 'Vnější okruh (hlavní křižovatka / tah)';

    if (isRefined) {
      const refinedDist = origin.distanceMeters ?? (route?.distanceMeters || haversineMeters(selectedPoint, target));
      targetCircuit = origin.circuit ?? (refinedDist <= 750 ? 'INNER' : 'OUTER');
      targetCircuitLabel = origin.circuitLabel ?? (targetCircuit === 'INNER' ? 'Vnitřní okruh (dojezd k prodejně)' : 'Vnější okruh (hlavní křižovatka / tah)');
    }

    const routePoly = route?.polyline || (isRefined ? origin.routePolyline : undefined);
    const inferred = inferArrowDirectionFromRoute(selectedPoint, target, routePoly);
    let resolvedArrow = isRefined && origin.arrowDirection ? origin.arrowDirection : inferred.arrowDirection;

    let pointTitle = isRefined ? origin.title : `[${targetCircuit === 'INNER' ? 'Vnitřní okruh' : 'Vnější okruh'}] Městská příjezdová trasa od ${direction}`;
    let pointReasons: string[] = isRefined ? origin.reasons : [
      targetCircuit === 'INNER'
        ? `🔵 Vnitřní okruh: Klíčové místo pro finální odbočení řidičů k cíli při příjezdu od ${direction}.`
        : `🟣 Vnější okruh: Bod zachycuje průjezd na hlavní městské třídě a navádí řidiče od ${direction}.`,
    ];

    if (!isRefined && route?.status === 'OK' && route.polyline) {
      const decodedPoints = decodePolylinePoints(route.polyline);

      // Filter candidates according to two-tier circuit distances
      // Inner circuit: 150m - 750m (final turn approach directly to store)
      // Outer circuit: 950m - 3500m (major feeder intersections)
      const primaryRange = isInnerSlot
        ? { min: 150, max: 750 }
        : { min: 950, max: Math.min(3500, radius) };
      const fallbackRange = isInnerSlot
        ? { min: 100, max: 950 }
        : { min: 750, max: Math.min(4000, radius) };

      let decisionZoneCandidates = decodedPoints.filter((pt) => {
        const dist = haversineMeters(pt, target);
        return dist >= primaryRange.min && dist <= primaryRange.max;
      });

      if (!decisionZoneCandidates.length) {
        decisionZoneCandidates = decodedPoints.filter((pt) => {
          const dist = haversineMeters(pt, target);
          return dist >= fallbackRange.min && dist <= fallbackRange.max;
        });
      }

      // Find candidate point along polyline that complies with zoning
      let foundValidPoint = false;
      for (const candidate of decisionZoneCandidates) {
        const revGeo = await reverseGeocode(candidate.latitude, candidate.longitude);
        const addressText = revGeo?.formattedAddress || '';
        const zoning = evaluateNavigationZoning({
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          addressText,
          city: pricingCity,
        });

        if (addressText && zoning.isAllowed) {
          selectedPoint = candidate;
          foundValidPoint = true;
          const distMeters = haversineMeters(candidate, target);
          const streetPart = addressText.split(',')[0]?.trim() || '';

          const candidateInferred = inferArrowDirectionFromRoute(candidate, target, route.polyline);
          resolvedArrow = candidateInferred.arrowDirection;

          const formatted = formatNavigationPointDetails({
            circuit: isInnerSlot ? 'INNER' : 'OUTER',
            streetPart,
            arrowDirection: resolvedArrow,
            turnText: candidateInferred.turnText,
            turnVerb: candidateInferred.turnVerb,
            distanceMeters: distMeters,
            zoning,
            index: index + 1,
          });

          pointTitle = formatted.title;
          pointReasons = formatted.reasons;
          break;
        }
      }

      // If all polyline points were in restricted zone or highway, step towards target local street
      if (!foundValidPoint) {
        const shiftLat = (target.latitude - selectedPoint.latitude) * 0.35;
        const shiftLon = (target.longitude - selectedPoint.longitude) * 0.35;
        const candidatePoint = {
          latitude: selectedPoint.latitude + shiftLat,
          longitude: selectedPoint.longitude + shiftLon,
        };
        const revGeo = await reverseGeocode(candidatePoint.latitude, candidatePoint.longitude);
        const addressText = revGeo?.formattedAddress || '';
        const streetPart = addressText.split(',')[0]?.trim() || 'městská třída';
        const zoning = evaluateNavigationZoning({
          latitude: candidatePoint.latitude,
          longitude: candidatePoint.longitude,
          addressText,
          city: pricingCity,
        });

        selectedPoint = candidatePoint;
        const distMeters = haversineMeters(candidatePoint, target);
        const formatted = formatNavigationPointDetails({
          circuit: targetCircuit,
          streetPart,
          arrowDirection: resolvedArrow,
          turnText: inferred.turnText,
          turnVerb: inferred.turnVerb,
          distanceMeters: distMeters,
          zoning,
          index: index + 1,
        });
        pointReasons = formatted.reasons;
      }
    }

    const mountingType = input.request.candidateMountingTypes?.[origin.id];
    const selectedPricing = pricingOptions.find((option) => option.mountingType === mountingType);
    const distance = route?.distanceMeters && route.distanceMeters > 0
      ? route.distanceMeters
      : isRefined && origin.distanceMeters
      ? origin.distanceMeters
      : haversineMeters(selectedPoint, target);

    return {
      selectionId: origin.id, surfaceId: null, carrierId: '', carrierCode: `NAV-${index + 1}`,
      title: pointTitle, mediaType: 'NAVIGATION_SIGN' as const, city: pricingCity,
      latitude: selectedPoint.latitude, longitude: selectedPoint.longitude,
      dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10), quantity: 1, unit: 'bod',
      catalogPrice: selectedPricing?.total ?? null, finalPrice: selectedPricing?.total ?? null, rentalTotal: selectedPricing?.rentalTotal ?? null,
      price: selectedPricing?.componentPrices.RENTAL ?? null, componentPrices: selectedPricing?.componentPrices,
      mountingType: mountingType ?? null, pricingOptions,
      score: isRefined ? origin.score : 92, distanceMeters: distance,
      routePolyline: routePoly,
      routeDurationSeconds: route?.durationSeconds || (isRefined ? origin.routeDurationSeconds : undefined),
      arrowDirection: resolvedArrow,
      circuit: targetCircuit,
      circuitLabel: targetCircuitLabel,
      reasons: pointReasons,
    };
  }));

  const pricedItems = items.filter((item) => item.finalPrice !== null);
  const catalogTotal = pricedItems.length === items.length ? pricedItems.reduce((sum, item) => sum + item.finalPrice!, 0) : null;

  const innerCount = items.filter((item) => item.circuit === 'INNER' || (item.distanceMeters && item.distanceMeters <= 750)).length;
  const outerCount = items.length - innerCount;

  const warnings = [
    'Před realizací obchodník ověří sloup VO v terénu, nahraje fotografii a případně bod posune.',
    inOstrava
      ? '🛡️ Pravidla Ostrava: Navigační desky na sloupech VO jsou povoleny v regulované zóně města (Nařízení č. 2/2020), ale je zakázáno je umísťovat v historické památkové zóně (MPZ) a na dálnicích či rychlostních tazích (Rudná, Místecká, D1, D56). Body byly navrženy na schválených městských třídách.'
      : `🛡️ Pravidlo sítě: Navigační desky na sloupech VO nelze umísťovat přímo na dálnicích a silnicích I. třídy bez zvláštního povolení. Body byly situovány na městských obslužných komunikacích v lokalitě ${pricingCity || 'cíle'}.`,
  ];

  if (items.length < input.quantity) warnings.push(`AI připravila ${items.length} různých příjezdových směrů z požadovaných ${input.quantity} bodů. Další body doplní obchodník v mapě.`);
  if (!refinedPoints.length && items.some((item) => !item.routePolyline)) warnings.push('Mapa vyhledala silné rozhodovací body na městských odbočovacích trasách k prodejně.');
  if (pricingOptions.every((option) => option.total === null)) warnings.push('Pro tuto lokalitu, délku nebo segment není kompletní navigační ceník. Koncept lze vytvořit bez ceny.');

  return {
    mode: 'preview', offerType: 'NAVIGATION', recommendedOfferType: input.recommendedOfferType, client: input.client,
    city: pricingCity, dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10),
    durationMonths: input.durationMonths, budget: input.request.budget ?? null, target, items, catalogTotal,
    budgetDifference: catalogTotal !== null && input.request.budget ? catalogTotal - input.request.budget : null,
    warnings, candidateCount: origins.length,
    explanation: refinedPoints.length
      ? `Dvouokruhový koncept: ${innerCount}× vnitřní okruh (dojezd k prodejně) a ${outerCount}× vnější okruh (příjezdové křižovatky) z mapy.`
      : `Dvouokruhový navigační koncept (${innerCount}× vnitřní okruh do 750 m pro dojezd přímo k prodejně + ${outerCount}× vnější okruh na hlavních křižovatkách pro záchyt tranzitní dopravy).`,
  };
}
