export type AvailabilityMatchStatus =
  | 'FULL_MATCH'
  | 'PARTIAL_MATCH'
  | 'NO_MATCH'
  | 'NEEDS_MORE_INFORMATION';

export type AvailabilityRequest = {
  /** Strict multi-tenant isolation */
  organizationId: string;

  /** Period to check availability for */
  dateFrom: Date;
  dateTo: Date;

  /** Geographic filtering */
  cities?: string[];
  regions?: string[];

  /** Filter by requested media types */
  mediaTypes?: string[];

  /** Desired number of surfaces */
  quantity?: number;

  /** Exclude specific surface IDs from availability results (e.g. already selected) */
  excludeSurfaceIds?: string[];
};

export type AvailableSurfaceMatch = {
  surfaceId: string;
  surfaceName: string;
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  carrierCity: string;
  carrierRegion?: string | null;
  mediaType: string;
  price?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  matchScore: number;
  matchReasons: string[];
};

export type AvailabilityResult = {
  /** Strict multi-tenant isolation */
  organizationId: string;

  /** Evaluation status */
  status: AvailabilityMatchStatus;

  /** Requested count */
  requestedQuantity: number;

  /** Number of exactly available matching surfaces */
  exactMatchCount: number;

  /** List of directly matching available surfaces */
  exactMatches: AvailableSurfaceMatch[];

  /** Recommended alternative surfaces (nearby or similar media) if requested count is not met */
  alternatives: AvailableSurfaceMatch[];

  /** Surfaces evaluated that had blocking conflicts or unavailability */
  unavailableSurfaces?: Array<{
    surfaceId: string;
    surfaceName: string;
    code?: string;
    mediaType?: string;
    blockingOccupancies?: Array<{
      id: string;
      status: 'ACTIVE_RENTED' | 'RESERVED' | 'OCCUPIED' | 'OUT_OF_SERVICE' | string;
      dateFrom: Date;
      dateTo: Date;
      clientName?: string;
    }>;
    reason: string;
  }>;

  /** Total count of evaluated surfaces */
  totalSurfacesEvaluated?: number;

  /** Human-readable summary */
  summary?: string;

  /** Explanations of why full match was not achieved or what criteria blocked it */
  missingRequirements: string[];

  /** Deterministic timestamp of the check */
  checkedAt: Date;
};
