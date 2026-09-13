import {
  findAvailableSurfaces,
  findSurfaceConflicts,
  type SurfaceAvailabilityResult,
} from '@/lib/occupancy/availability-service';
import type {
  AvailabilityRequest,
  AvailabilityResult,
  AvailableSurfaceMatch,
} from '../contracts/availability';

/**
 * Deterministic commercial availability adapter.
 * Connects high-level AvailabilityRequest to the canonical Occupancy Availability Engine.
 * Does NOT invoke LLMs for mathematical availability truth.
 */
export async function checkCommercialAvailability(
  request: AvailabilityRequest
): Promise<AvailabilityResult> {
  const { organizationId, dateFrom, dateTo, quantity = 1 } = request;
  const now = new Date();

  // Validate date range
  if (dateFrom > dateTo) {
    return {
      organizationId,
      status: 'NEEDS_MORE_INFORMATION',
      requestedQuantity: quantity,
      exactMatchCount: 0,
      exactMatches: [],
      alternatives: [],
      missingRequirements: ['Počáteční datum je po koncovém datu kampaně.'],
      checkedAt: now,
    };
  }

  // 1. Fetch exact matching candidate surfaces
  const primaryCity = request.cities?.[0];
  const primaryMediaType = request.mediaTypes?.[0];

  const allCandidateSurfaces = await findAvailableSurfaces(organizationId, {
    dateFrom,
    dateTo,
    city: primaryCity,
    mediaType: primaryMediaType,
  });

  const availableCandidateSurfaces = request.excludeSurfaceIds?.length
    ? allCandidateSurfaces.filter((s) => !request.excludeSurfaceIds?.includes(s.id))
    : allCandidateSurfaces;

  const exactMatches: AvailableSurfaceMatch[] = availableCandidateSurfaces
    .slice(0, quantity)
    .map((s) => ({
      surfaceId: s.id,
      surfaceName: s.name,
      carrierId: s.carrier.id,
      carrierCode: s.carrier.code,
      carrierName: s.carrier.name,
      carrierCity: s.carrier.city,
      carrierRegion: s.carrier.region,
      mediaType: s.mediaType,
      price: s.price ? Number(s.price) : null,
      latitude: s.carrier.latitude,
      longitude: s.carrier.longitude,
      matchScore: 100,
      matchReasons: [
        'Volná plocha v požadovaném termínu',
        primaryCity ? `Odpovídá lokalitě ${primaryCity}` : 'Odpovídá lokalitě',
      ],
    }));

  const exactMatchCount = exactMatches.length;

  // 2. If we do not have enough exact matches, find alternatives (different city or similar media)
  const alternatives: AvailableSurfaceMatch[] = [];
  if (exactMatchCount < quantity) {
    const neededAlternativesCount = quantity - exactMatchCount;
    const excludeIds = new Set([
      ...(request.excludeSurfaceIds || []),
      ...exactMatches.map((m) => m.surfaceId),
    ]);

    // Find in the same region or all available in the organization
    const rawAlternativeCandidates = await findAvailableSurfaces(organizationId, {
      dateFrom,
      dateTo,
    });
    const alternativeCandidates = rawAlternativeCandidates.filter((s) => !excludeIds.has(s.id));

    for (const alt of alternativeCandidates) {
      if (alternatives.length >= neededAlternativesCount + 3) break;

      const isSameCity = primaryCity && alt.carrier.city.toLowerCase() === primaryCity.toLowerCase();
      const isSameMedia = primaryMediaType && alt.mediaType === primaryMediaType;

      let score = 50;
      const reasons: string[] = ['Volná plocha ve stejném období'];

      if (isSameCity) {
        score += 30;
        reasons.push(`Stejné město (${alt.carrier.city})`);
      } else {
        reasons.push(`Alternativní lokalita (${alt.carrier.city})`);
      }

      if (isSameMedia) {
        score += 20;
        reasons.push('Stejný typ média');
      }

      alternatives.push({
        surfaceId: alt.id,
        surfaceName: alt.name,
        carrierId: alt.carrier.id,
        carrierCode: alt.carrier.code,
        carrierName: alt.carrier.name,
        carrierCity: alt.carrier.city,
        carrierRegion: alt.carrier.region,
        mediaType: alt.mediaType,
        price: alt.price ? Number(alt.price) : null,
        latitude: alt.carrier.latitude,
        longitude: alt.carrier.longitude,
        matchScore: score,
        matchReasons: reasons,
      });
    }

    // Sort alternatives by matchScore descending
    alternatives.sort((a, b) => b.matchScore - a.matchScore);
  }

  // 3. Determine overall match status
  let status: AvailabilityResult['status'] = 'NO_MATCH';
  const missingRequirements: string[] = [];

  if (exactMatchCount >= quantity) {
    status = 'FULL_MATCH';
  } else if (exactMatchCount > 0) {
    status = 'PARTIAL_MATCH';
    missingRequirements.push(
      `Nalezeno pouze ${exactMatchCount} z ${quantity} požadovaných ploch. Doporučeno ${alternatives.length} alternativ.`
    );
  } else if (alternatives.length > 0) {
    status = 'NO_MATCH';
    missingRequirements.push(
      `V zadané lokalitě ${primaryCity || ''} není v termínu volná žádná plocha. K dispozici je ${alternatives.length} alternativních ploch.`
    );
  } else {
    status = 'NO_MATCH';
    missingRequirements.push('V požadovaném období nebyly nalezeny žádné volné ani alternativní plochy.');
  }

  return {
    organizationId,
    status,
    requestedQuantity: quantity,
    exactMatchCount,
    exactMatches,
    alternatives,
    missingRequirements,
    checkedAt: now,
  };
}

/**
 * Verifies that a specific set of surface IDs are available without conflicts.
 */
export async function verifySurfacesAvailability(
  organizationId: string,
  surfaceIds: string[],
  dateFrom: Date,
  dateTo: Date
): Promise<{
  allAvailable: boolean;
  conflictingSurfaceIds: string[];
  results: Map<string, SurfaceAvailabilityResult>;
}> {
  const results = await findSurfaceConflicts(surfaceIds, dateFrom, dateTo, {
    checkPendingOffers: true,
  });

  const conflictingSurfaceIds: string[] = [];
  for (const [id, res] of results.entries()) {
    if (!res.isAvailable || res.hasHardConflict || res.hasOfferConflict) {
      conflictingSurfaceIds.push(id);
    }
  }

  return {
    allAvailable: conflictingSurfaceIds.length === 0,
    conflictingSurfaceIds,
    results,
  };
}
