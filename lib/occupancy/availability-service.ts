import { prisma } from '@/lib/db';
import { OccupancyStatus, SurfaceStatus, CarrierStatus, OfferStatus } from '@prisma/client';

export type DateLike = Date | string;

export const BLOCKING_OCCUPANCY_STATUSES: readonly OccupancyStatus[] = ['OCCUPIED', 'RESERVED'];
export const WARNING_OCCUPANCY_STATUSES: readonly OccupancyStatus[] = ['NEGOTIATION'];
export const INACTIVE_OCCUPANCY_STATUSES: readonly OccupancyStatus[] = ['AVAILABLE', 'FINISHED', 'CANCELLED'];

export const BLOCKING_OFFER_STATUSES: readonly OfferStatus[] = ['SENT', 'ACCEPTED'];
export const NON_BLOCKING_OFFER_STATUSES: readonly OfferStatus[] = ['DRAFT', 'REJECTED', 'EXPIRED'];

export type OccupancyConflictDetail = {
  occupancyId: string;
  surfaceId: string;
  surfaceName: string;
  carrierCode: string;
  carrierCity: string;
  carrierName: string;
  status: OccupancyStatus;
  clientName: string;
  campaignName: string;
  dateFrom: string;
  dateTo: string;
  severity: 'block' | 'warning' | 'info';
  overlapDays: number;
};

export type OfferConflictDetail = {
  offerId: string;
  offerItemId: string;
  surfaceId: string;
  surfaceName: string;
  carrierCode: string;
  offerTitle: string;
  clientName: string;
  offerStatus: OfferStatus;
  dateFrom: string;
  dateTo: string;
  severity: 'warning' | 'block';
};

export type SurfaceTechnicalStatus = {
  isAvailable: boolean;
  reason?: string;
};

export type SurfaceAvailabilityResult = {
  surfaceId: string;
  isAvailable: boolean;
  isTechnicallyAvailable: boolean;
  hasHardConflict: boolean;
  hasSoftConflict: boolean;
  hasOfferConflict: boolean;
  technicalReason?: string;
  hardConflicts: OccupancyConflictDetail[];
  softConflicts: OccupancyConflictDetail[];
  offerConflicts: OfferConflictDetail[];
};

export type AvailableSurfacesQuery = {
  dateFrom: DateLike;
  dateTo: DateLike;
  city?: string;
  region?: string;
  mediaType?: string;
  maxPrice?: number;
  excludeOccupancyId?: string;
  excludeOfferId?: string;
  checkPendingOffers?: boolean;
  limit?: number;
};

/**
 * Normalizes a date to start of day in UTC/local timezone consistently.
 */
export function normalizeDateOnly(input: DateLike): Date {
  if (typeof input === 'string') {
    // If format is YYYY-MM-DD
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(input.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    }
  }
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Standard OOH inclusive period overlap:
 * Two campaigns or reservations overlap if:
 * aStart <= bEnd AND aEnd >= bStart
 * 
 * Example 1: 1.10.–15.10. and 15.10.–20.10. -> Overlap on 15.10 (inclusive) -> true
 * Example 2: 1.10.–15.10. and 16.10.–20.10. -> 15.10 < 16.10 -> false
 */
export function periodsOverlap(
  aStart: DateLike,
  aEnd: DateLike,
  bStart: DateLike,
  bEnd: DateLike
): boolean {
  const normAStart = normalizeDateOnly(aStart).getTime();
  const normAEnd = normalizeDateOnly(aEnd).getTime();
  const normBStart = normalizeDateOnly(bStart).getTime();
  const normBEnd = normalizeDateOnly(bEnd).getTime();

  if (normAStart > normAEnd || normBStart > normBEnd) {
    return false;
  }

  return normAStart <= normBEnd && normAEnd >= normBStart;
}

/**
 * Calculates number of overlapping days between two periods (inclusive).
 */
export function getOverlapDaysCount(
  aStart: DateLike,
  aEnd: DateLike,
  bStart: DateLike,
  bEnd: DateLike
): number {
  const normAStart = normalizeDateOnly(aStart).getTime();
  const normAEnd = normalizeDateOnly(aEnd).getTime();
  const normBStart = normalizeDateOnly(bStart).getTime();
  const normBEnd = normalizeDateOnly(bEnd).getTime();

  const start = Math.max(normAStart, normBStart);
  const end = Math.min(normAEnd, normBEnd);

  if (start > end) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Validates technical availability of a surface and its carrier.
 */
export function isSurfaceTechnicallyAvailable(surface: {
  status: SurfaceStatus | string;
  carrier?: {
    status: CarrierStatus | string;
    archivedAt: Date | null;
  } | null;
}): SurfaceTechnicalStatus {
  if (surface.status === 'OUT_OF_SERVICE') {
    return { isAvailable: false, reason: 'Plocha je ve stavu mimo provoz (OUT_OF_SERVICE).' };
  }
  if (surface.carrier) {
    if (surface.carrier.archivedAt !== null) {
      return { isAvailable: false, reason: 'Nosič byl archivován nebo demontován.' };
    }
    if (surface.carrier.status === 'INACTIVE') {
      return { isAvailable: false, reason: 'Nosič je neaktivní.' };
    }
    if (surface.carrier.status === 'MAINTENANCE') {
      return { isAvailable: false, reason: 'Nosič je v technické údržbě.' };
    }
  }
  return { isAvailable: true };
}

/**
 * Canonical check for a single surface's availability over a date period.
 */
export async function checkSurfaceAvailability(
  surfaceId: string,
  dateFrom: DateLike,
  dateTo: DateLike,
  options: {
    excludeOccupancyId?: string;
    excludeOfferId?: string;
    checkPendingOffers?: boolean;
  } = {}
): Promise<SurfaceAvailabilityResult> {
  const results = await findSurfaceConflicts([surfaceId], dateFrom, dateTo, options);
  return results.get(surfaceId) || {
    surfaceId,
    isAvailable: false,
    isTechnicallyAvailable: false,
    hasHardConflict: false,
    hasSoftConflict: false,
    hasOfferConflict: false,
    technicalReason: 'Plocha nebyla nalezena.',
    hardConflicts: [],
    softConflicts: [],
    offerConflicts: [],
  };
}

/**
 * Canonical batch conflict finder for multiple surfaces.
 * Loads all occupancies (and pending offers if requested) in a single database query.
 */
export async function findSurfaceConflicts(
  surfaceIds: string[],
  dateFrom: DateLike,
  dateTo: DateLike,
  options: {
    excludeOccupancyId?: string;
    excludeOfferId?: string;
    checkPendingOffers?: boolean;
  } = {}
): Promise<Map<string, SurfaceAvailabilityResult>> {
  const resultMap = new Map<string, SurfaceAvailabilityResult>();
  if (!surfaceIds.length) return resultMap;

  const normFrom = normalizeDateOnly(dateFrom);
  const normTo = normalizeDateOnly(dateTo);

  if (normFrom > normTo) {
    for (const id of surfaceIds) {
      resultMap.set(id, {
        surfaceId: id,
        isAvailable: false,
        isTechnicallyAvailable: false,
        hasHardConflict: false,
        hasSoftConflict: false,
        hasOfferConflict: false,
        technicalReason: 'Počáteční datum je po koncovém datu.',
        hardConflicts: [],
        softConflicts: [],
        offerConflicts: [],
      });
    }
    return resultMap;
  }

  // 1. Fetch surfaces with carrier info for technical availability
  const surfaces = await prisma.advertisingSurface.findMany({
    where: { id: { in: surfaceIds } },
    select: {
      id: true,
      name: true,
      status: true,
      carrier: {
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          status: true,
          archivedAt: true,
        },
      },
    },
  });

  const surfaceLookup = new Map(surfaces.map((s) => [s.id, s]));

  // Initialize resultMap with technical statuses
  for (const id of surfaceIds) {
    const s = surfaceLookup.get(id);
    if (!s) {
      resultMap.set(id, {
        surfaceId: id,
        isAvailable: false,
        isTechnicallyAvailable: false,
        hasHardConflict: false,
        hasSoftConflict: false,
        hasOfferConflict: false,
        technicalReason: 'Plocha nebyla nalezena v databázi.',
        hardConflicts: [],
        softConflicts: [],
        offerConflicts: [],
      });
      continue;
    }

    const tech = isSurfaceTechnicallyAvailable(s);
    resultMap.set(id, {
      surfaceId: id,
      isAvailable: tech.isAvailable,
      isTechnicallyAvailable: tech.isAvailable,
      hasHardConflict: false,
      hasSoftConflict: false,
      hasOfferConflict: false,
      technicalReason: tech.reason,
      hardConflicts: [],
      softConflicts: [],
      offerConflicts: [],
    });
  }

  // 2. Fetch all overlapping occupancies in one query
  const occupancies = await prisma.occupancy.findMany({
    where: {
      surfaceId: { in: surfaceIds },
      id: options.excludeOccupancyId ? { not: options.excludeOccupancyId } : undefined,
      offerId: options.excludeOfferId ? { not: options.excludeOfferId } : undefined,
      status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] },
      dateFrom: { lte: normTo },
      dateTo: { gte: normFrom },
    },
    include: {
      surface: {
        include: {
          carrier: true,
        },
      },
    },
    orderBy: { dateFrom: 'asc' },
  });

  for (const occ of occupancies) {
    const res = resultMap.get(occ.surfaceId);
    if (!res) continue;

    const overlapDays = getOverlapDaysCount(normFrom, normTo, occ.dateFrom, occ.dateTo);
    const detail: OccupancyConflictDetail = {
      occupancyId: occ.id,
      surfaceId: occ.surfaceId,
      surfaceName: occ.surface?.name || '',
      carrierCode: occ.surface?.carrier?.code || '',
      carrierCity: occ.surface?.carrier?.city || '',
      carrierName: occ.surface?.carrier?.name || '',
      status: occ.status,
      clientName: occ.clientName,
      campaignName: occ.campaignName,
      dateFrom: normalizeDateOnly(occ.dateFrom).toISOString().slice(0, 10),
      dateTo: normalizeDateOnly(occ.dateTo).toISOString().slice(0, 10),
      severity: occ.status === 'NEGOTIATION' ? 'warning' : 'block',
      overlapDays,
    };

    if (occ.status === 'OCCUPIED' || occ.status === 'RESERVED') {
      res.hasHardConflict = true;
      res.isAvailable = false;
      res.hardConflicts.push(detail);
    } else if (occ.status === 'NEGOTIATION') {
      res.hasSoftConflict = true;
      res.softConflicts.push(detail);
    }
  }

  // 3. Optionally check pending offers (offers in SENT or ACCEPTED without Occupancy yet)
  if (options.checkPendingOffers) {
    const pendingOfferItems = await prisma.offerItem.findMany({
      where: {
        surfaceId: { in: surfaceIds },
        offerId: options.excludeOfferId ? { not: options.excludeOfferId } : undefined,
        offer: {
          status: { in: ['SENT', 'ACCEPTED'] },
          archivedAt: null,
        },
        dateFrom: { lte: normTo },
        dateTo: { gte: normFrom },
      },
      include: {
        offer: {
          include: {
            client: true,
          },
        },
        surface: {
          include: {
            carrier: true,
          },
        },
      },
    });

    // Don't duplicate if the offer already created an Occupancy record that was caught above
    const existingOfferIds = new Set(occupancies.map((o) => o.offerId).filter(Boolean));

    for (const item of pendingOfferItems) {
      if (existingOfferIds.has(item.offerId)) continue;
      const res = resultMap.get(item.surfaceId);
      if (!res) continue;

      const offerConflict: OfferConflictDetail = {
        offerId: item.offerId,
        offerItemId: item.id,
        surfaceId: item.surfaceId,
        surfaceName: item.surface?.name || '',
        carrierCode: item.surface?.carrier?.code || '',
        offerTitle: item.offer.title,
        clientName: item.offer.client?.name || '',
        offerStatus: item.offer.status,
        dateFrom: normalizeDateOnly(item.dateFrom).toISOString().slice(0, 10),
        dateTo: normalizeDateOnly(item.dateTo).toISOString().slice(0, 10),
        severity: item.offer.status === 'ACCEPTED' ? 'block' : 'warning',
      };

      res.hasOfferConflict = true;
      if (item.offer.status === 'ACCEPTED') {
        res.isAvailable = false;
      }
      res.offerConflicts.push(offerConflict);
    }
  }

  return resultMap;
}

/**
 * Finds all actually available surfaces in an organization matching specific criteria.
 * Filters out inactive/archived carriers, OUT_OF_SERVICE surfaces, and surfaces with blocking occupancies.
 */
export async function findAvailableSurfaces(
  organizationId: string,
  criteria: AvailableSurfacesQuery
) {
  const normFrom = normalizeDateOnly(criteria.dateFrom);
  const normTo = normalizeDateOnly(criteria.dateTo);

  // 1. Find all candidate surfaces that meet technical criteria
  const candidateSurfaces = await prisma.advertisingSurface.findMany({
    where: {
      organizationId,
      status: { not: 'OUT_OF_SERVICE' },
      carrier: {
        archivedAt: null,
        status: 'ACTIVE',
        city: criteria.city ? { contains: criteria.city, mode: 'insensitive' } : undefined,
        region: criteria.region ? { contains: criteria.region, mode: 'insensitive' } : undefined,
      },
      mediaType: criteria.mediaType ? (criteria.mediaType as any) : undefined,
      price: criteria.maxPrice ? { lte: criteria.maxPrice } : undefined,
    },
    include: {
      carrier: {
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          region: true,
          street: true,
          latitude: true,
          longitude: true,
        },
      },
      photos: {
        take: 1,
        select: { id: true, url: true },
      },
    },
    take: 1000,
  });

  if (!candidateSurfaces.length) return [];

  const candidateIds = candidateSurfaces.map((s) => s.id);

  // 2. Batch check conflicts for all candidate surfaces
  const conflictMap = await findSurfaceConflicts(candidateIds, normFrom, normTo, {
    excludeOccupancyId: criteria.excludeOccupancyId,
    excludeOfferId: criteria.excludeOfferId,
    checkPendingOffers: criteria.checkPendingOffers ?? true,
  });

  // 3. Filter to only those with isAvailable === true
  const available = candidateSurfaces.filter((s) => {
    const conf = conflictMap.get(s.id);
    return conf && conf.isAvailable && !conf.hasHardConflict;
  });

  if (criteria.limit && criteria.limit > 0) {
    return available.slice(0, criteria.limit);
  }

  return available;
}

export type BasicOccupancyRecord = {
  id: string;
  clientId: string | null;
  status: OccupancyStatus;
  dateFrom: Date | string;
  dateTo: Date | string;
};

/**
 * Derives the real-time surface occupancy status snapshot at a reference date.
 * Replaces and formalizes old deriveSurfaceOccupancyState.
 */
export function getSurfaceAvailabilityState(
  occupancies: BasicOccupancyRecord[],
  referenceDate: Date = new Date()
): {
  status: SurfaceStatus;
  currentClientId: string | null;
  currentRentStart: Date | null;
  currentRentEnd: Date | null;
  activeOccupancyId: string | null;
} {
  const refTime = referenceDate.getTime();

  const active = occupancies.filter((occ) => {
    if (occ.status === 'FINISHED' || occ.status === 'CANCELLED') return false;
    const fromTime = new Date(occ.dateFrom).getTime();
    const toTime = new Date(occ.dateTo).getTime();
    return fromTime <= refTime && toTime >= refTime;
  });

  if (active.length === 0) {
    return {
      status: 'AVAILABLE',
      currentClientId: null,
      currentRentStart: null,
      currentRentEnd: null,
      activeOccupancyId: null,
    };
  }

  const priorityMap: Record<OccupancyStatus, number> = {
    OUT_OF_SERVICE: 5,
    OCCUPIED: 4,
    RESERVED: 3,
    NEGOTIATION: 2,
    AVAILABLE: 1,
    FINISHED: 0,
    CANCELLED: 0,
  };

  const sorted = [...active].sort(
    (a, b) => (priorityMap[b.status] || 0) - (priorityMap[a.status] || 0)
  );

  const topMatch = sorted[0];

  const surfaceStatusMap: Partial<Record<OccupancyStatus, SurfaceStatus>> = {
    OUT_OF_SERVICE: 'OUT_OF_SERVICE',
    OCCUPIED: 'OCCUPIED',
    RESERVED: 'RESERVED',
    NEGOTIATION: 'NEGOTIATION',
    AVAILABLE: 'AVAILABLE',
  };

  return {
    status: surfaceStatusMap[topMatch.status] ?? 'AVAILABLE',
    currentClientId: topMatch.clientId ?? null,
    currentRentStart: new Date(topMatch.dateFrom),
    currentRentEnd: new Date(topMatch.dateTo),
    activeOccupancyId: topMatch.id,
  };
}
