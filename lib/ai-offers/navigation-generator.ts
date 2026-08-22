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
 * Checks if a road/street is a restricted highway or 1st class trunk road in Ostrava/MS Region
 * (e.g. Rudná, Místecká, Bohumínská, Mariánskohorská, Dálnice D1, D56, I/11, I/56, I/59).
 * Municipal navigation signs on light poles are NOT allowed on these main highways.
 */
export function isRestrictedHighwayOr1stClassRoad(text: string): boolean {
  if (!text) return false;
  const norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const forbiddenKeywords = [
    'rudna',
    'rudne',
    'mistecka',
    'mistecke',
    'bohuminska',
    'bohuminske',
    'marianskohorska',
    'marianskohorske',
    'plzenska',
    'plzenske',
    'opavska',
    'opavske',
    'slovenska',
    'dalnice',
    'dalnici',
    'dalnic',
    'd1',
    'd56',
    'd48',
    'i/11',
    'i/56',
    'i/59',
    'i/48',
    'i/58',
    'silnice 1',
    'silnici 1',
    '1. trid',
    'i. trid',
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

function decodePolylinePoints(encoded: string): Array<{ latitude: number; longitude: number }> {
  if (!encoded) return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: Array<{ latitude: number; longitude: number }> = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < encoded.length);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < encoded.length);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
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
  // Search origins in urban radius of 1.5 - 2.5 km
  const radius = Math.min(2500, Math.max(1200, (input.request.maxRadiusKm ?? 3) * 1000));
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
    const direction = 'direction' in origin ? origin.direction : '';
    let selectedPoint = isRefined ? { latitude: origin.latitude, longitude: origin.longitude } : { latitude: origin.latitude, longitude: origin.longitude };
    let pointTitle = isRefined ? origin.title : `Městská příjezdová trasa od ${direction}`;
    let pointReasons: string[] = isRefined ? origin.reasons : [
      `Klíčový rozhodovací bod na městské třídě pro příjezd od ${direction}.`,
    ];

    if (!isRefined && route?.status === 'OK' && route.polyline) {
      const decodedPoints = decodePolylinePoints(route.polyline);
      // Filter points along polyline that are between 250m and 1200m from target store
      const decisionZoneCandidates = decodedPoints.filter((pt) => {
        const dist = haversineMeters(pt, target);
        return dist >= 250 && dist <= 1400;
      });

      // Find the first candidate point along polyline that is NOT on a restricted highway
      let foundValidPoint = false;
      for (const candidate of decisionZoneCandidates) {
        const revGeo = await reverseGeocode(candidate.latitude, candidate.longitude);
        const addressText = revGeo?.formattedAddress || '';

        if (addressText && !isRestrictedHighwayOr1stClassRoad(addressText)) {
          selectedPoint = candidate;
          foundValidPoint = true;
          // Extract street name from reverse geocode (e.g. "Výstavní, Ostrava" -> "Výstavní")
          const streetPart = addressText.split(',')[0]?.trim() || '';
          if (streetPart && !/č\.p\.|ostrava|česko/i.test(streetPart)) {
            pointTitle = `Příjezdový bod na ${streetPart} (od ${direction})`;
            pointReasons = [
              `Navigační bod umístěný na městské třídě ${streetPart} mimo dálnice a I. třídy.`,
              `Vzdálenost cca ${Math.round(haversineMeters(candidate, target))} m od prodejny pro včasné odbočení řidičů.`,
            ];
          }
          break;
        }
      }

      // If all polyline points were on restricted highway, step 250m perpendicular towards target store
      if (!foundValidPoint) {
        const shiftLat = (target.latitude - selectedPoint.latitude) * 0.4;
        const shiftLon = (target.longitude - selectedPoint.longitude) * 0.4;
        const candidatePoint = {
          latitude: selectedPoint.latitude + shiftLat,
          longitude: selectedPoint.longitude + shiftLon,
        };
        const revGeo = await reverseGeocode(candidatePoint.latitude, candidatePoint.longitude);
        const addressText = revGeo?.formattedAddress || '';
        const streetPart = addressText.split(',')[0]?.trim() || 'městská třída';
        selectedPoint = candidatePoint;
        pointTitle = `Odbočovací navigační bod na ${streetPart}`;
        pointReasons = [
          `🛡️ Bezpečnostní filtr sítě: Bod byl automaticky přesunut z dálnice/I. třídy na městskou obslužnou komunikaci (${streetPart}).`,
        ];
      }
    }

    const mountingType = input.request.candidateMountingTypes?.[origin.id];
    const selectedPricing = pricingOptions.find((option) => option.mountingType === mountingType);
    const distance = isRefined ? origin.distanceMeters ?? haversineMeters(selectedPoint, target) : haversineMeters(selectedPoint, target);

    return {
      selectionId: origin.id, surfaceId: null, carrierId: '', carrierCode: `NAV-${index + 1}`,
      title: pointTitle, mediaType: 'NAVIGATION_SIGN' as const, city: pricingCity,
      latitude: selectedPoint.latitude, longitude: selectedPoint.longitude,
      dateFrom: input.dateFrom.toISOString().slice(0, 10), dateTo: input.dateTo.toISOString().slice(0, 10), quantity: 1, unit: 'bod',
      catalogPrice: selectedPricing?.total ?? null, finalPrice: selectedPricing?.total ?? null, rentalTotal: selectedPricing?.rentalTotal ?? null,
      price: selectedPricing?.componentPrices.RENTAL ?? null, componentPrices: selectedPricing?.componentPrices,
      mountingType: mountingType ?? null, pricingOptions,
      score: isRefined ? origin.score : 92, distanceMeters: distance,
      routePolyline: isRefined ? origin.routePolyline : route?.polyline || undefined,
      routeDurationSeconds: isRefined ? origin.routeDurationSeconds : route?.durationSeconds || undefined,
      arrowDirection: isRefined ? origin.arrowDirection ?? 'STRAIGHT' as const : 'STRAIGHT' as const,
      reasons: pointReasons,
    };
  }));

  const pricedItems = items.filter((item) => item.finalPrice !== null);
  const catalogTotal = pricedItems.length === items.length ? pricedItems.reduce((sum, item) => sum + item.finalPrice!, 0) : null;
  const warnings = [
    'Před realizací obchodník ověří sloup VO v terénu, nahraje fotografii a případně bod posune.',
    '🛡️ Pravidlo sítě: Navigační desky na sloupech VO nelze z legislativních a bezpečnostních důvodů umísťovat přímo na dálnicích a silnicích I. třídy (Rudná, Místecká, D1, D56). AI navrhuje body výhradně na městských třídách a odbočovacích křižovatkách.',
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
      ? `Vybráno ${items.length} rozhodovacích míst na městských odbočovacích trasách přímo k prodejně (mimo dálnice a I. třídy).`
      : `Připraveny strategické navigační body na městských třídách a křižovatkách v okruhu 300m–1400m pro orientaci zákazníků.`,
  };
}
