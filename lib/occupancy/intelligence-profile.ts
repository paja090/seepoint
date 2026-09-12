import { prisma } from '@/lib/db';

export type OrganizationOccupancyAIProfileData = {
  id?: string;
  organizationId: string;
  enabled: boolean;
  automaticChecksEnabled: boolean;
  checkFrequency: 'MANUAL' | 'DAILY' | 'WEEKLY' | string;
  checkReservationConflicts: boolean;
  checkCampaignConflicts: boolean;
  checkStatusMismatch: boolean;
  checkOfferConflicts: boolean;
  checkExpiringCampaigns: boolean;
  checkUnderutilizedMedia: boolean;
  checkMissingData: boolean;
  checkCalendarGaps: boolean;
  reservationHoldDays: number;
  expiringCampaignWarningDays: number;
  underutilizedAfterDays: number;
  calendarGapMaxDays: number;
  offerConflictMode: 'SENT_AND_ACCEPTED' | 'ALL_ACTIVE' | string;
  targetRegions: string[];
  targetCities: string[];
  preferredMediaTypes: string[];
  lastCheckAt?: Date | null;
};

const DEFAULT_PROFILE_CONFIG: Omit<OrganizationOccupancyAIProfileData, 'organizationId' | 'targetRegions' | 'targetCities' | 'preferredMediaTypes'> = {
  enabled: true,
  automaticChecksEnabled: true,
  checkFrequency: 'DAILY',
  checkReservationConflicts: true,
  checkCampaignConflicts: true,
  checkStatusMismatch: true,
  checkOfferConflicts: true,
  checkExpiringCampaigns: true,
  checkUnderutilizedMedia: true,
  checkMissingData: true,
  checkCalendarGaps: true,
  reservationHoldDays: 14,
  expiringCampaignWarningDays: 14,
  underutilizedAfterDays: 60,
  calendarGapMaxDays: 21,
  offerConflictMode: 'SENT_AND_ACCEPTED',
};

/**
 * Retrieves the organization's Occupancy Intelligence profile.
 * If no profile exists yet, it automatically detects defaults directly
 * from the organization's real inventory (top cities, active regions, media types).
 * No hardcoded company assumptions.
 */
export async function getOrganizationOccupancyProfile(
  organizationId: string
): Promise<OrganizationOccupancyAIProfileData> {
  const existing = await prisma.organizationOccupancyAIProfile.findUnique({
    where: { organizationId },
  });

  if (existing) {
    return {
      id: existing.id,
      organizationId: existing.organizationId,
      enabled: existing.enabled,
      automaticChecksEnabled: existing.automaticChecksEnabled,
      checkFrequency: existing.checkFrequency,
      checkReservationConflicts: existing.checkReservationConflicts,
      checkCampaignConflicts: existing.checkCampaignConflicts,
      checkStatusMismatch: existing.checkStatusMismatch,
      checkOfferConflicts: existing.checkOfferConflicts,
      checkExpiringCampaigns: existing.checkExpiringCampaigns,
      checkUnderutilizedMedia: existing.checkUnderutilizedMedia,
      checkMissingData: existing.checkMissingData,
      checkCalendarGaps: existing.checkCalendarGaps,
      reservationHoldDays: existing.reservationHoldDays,
      expiringCampaignWarningDays: existing.expiringCampaignWarningDays,
      underutilizedAfterDays: existing.underutilizedAfterDays,
      calendarGapMaxDays: existing.calendarGapMaxDays,
      offerConflictMode: existing.offerConflictMode,
      targetRegions: existing.targetRegions,
      targetCities: existing.targetCities,
      preferredMediaTypes: existing.preferredMediaTypes,
      lastCheckAt: existing.lastCheckAt,
    };
  }

  // Auto-detect profile from the organization's real inventory
  const carriers = await prisma.advertisingCarrier.findMany({
    where: {
      organizationId,
      archivedAt: null,
      status: 'ACTIVE',
    },
    select: {
      city: true,
      region: true,
      type: true,
      surfaces: {
        select: {
          mediaType: true,
        },
        take: 10,
      },
    },
    take: 1000,
  });

  const cityCounts = new Map<string, number>();
  const regionSet = new Set<string>();
  const mediaTypeSet = new Set<string>();

  for (const c of carriers) {
    if (c.city?.trim()) {
      const city = c.city.trim();
      cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
    }
    if (c.region?.trim()) {
      regionSet.add(c.region.trim());
    }
    if (c.type) {
      mediaTypeSet.add(String(c.type));
    }
    for (const s of c.surfaces) {
      if (s.mediaType) {
        mediaTypeSet.add(String(s.mediaType));
      }
    }
  }

  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([city]) => city)
    .slice(0, 15);

  const detectedRegions = [...regionSet];
  const detectedMediaTypes = [...mediaTypeSet];

  return {
    ...DEFAULT_PROFILE_CONFIG,
    organizationId,
    targetRegions: detectedRegions,
    targetCities: topCities,
    preferredMediaTypes: detectedMediaTypes,
    lastCheckAt: null,
  };
}

/**
 * Saves or updates the organization's Occupancy Intelligence profile.
 */
export async function saveOrganizationOccupancyProfile(
  organizationId: string,
  input: Partial<OrganizationOccupancyAIProfileData>
): Promise<OrganizationOccupancyAIProfileData> {
  const cleanRegions = (input.targetRegions || []).map((r) => r.trim()).filter(Boolean);
  const cleanCities = (input.targetCities || []).map((c) => c.trim()).filter(Boolean);
  const cleanMediaTypes = (input.preferredMediaTypes || []).map((m) => m.trim()).filter(Boolean);

  const saved = await prisma.organizationOccupancyAIProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      enabled: input.enabled ?? DEFAULT_PROFILE_CONFIG.enabled,
      automaticChecksEnabled: input.automaticChecksEnabled ?? DEFAULT_PROFILE_CONFIG.automaticChecksEnabled,
      checkFrequency: input.checkFrequency ?? DEFAULT_PROFILE_CONFIG.checkFrequency,
      checkReservationConflicts: input.checkReservationConflicts ?? DEFAULT_PROFILE_CONFIG.checkReservationConflicts,
      checkCampaignConflicts: input.checkCampaignConflicts ?? DEFAULT_PROFILE_CONFIG.checkCampaignConflicts,
      checkStatusMismatch: input.checkStatusMismatch ?? DEFAULT_PROFILE_CONFIG.checkStatusMismatch,
      checkOfferConflicts: input.checkOfferConflicts ?? DEFAULT_PROFILE_CONFIG.checkOfferConflicts,
      checkExpiringCampaigns: input.checkExpiringCampaigns ?? DEFAULT_PROFILE_CONFIG.checkExpiringCampaigns,
      checkUnderutilizedMedia: input.checkUnderutilizedMedia ?? DEFAULT_PROFILE_CONFIG.checkUnderutilizedMedia,
      checkMissingData: input.checkMissingData ?? DEFAULT_PROFILE_CONFIG.checkMissingData,
      checkCalendarGaps: input.checkCalendarGaps ?? DEFAULT_PROFILE_CONFIG.checkCalendarGaps,
      reservationHoldDays: input.reservationHoldDays ?? DEFAULT_PROFILE_CONFIG.reservationHoldDays,
      expiringCampaignWarningDays: input.expiringCampaignWarningDays ?? DEFAULT_PROFILE_CONFIG.expiringCampaignWarningDays,
      underutilizedAfterDays: input.underutilizedAfterDays ?? DEFAULT_PROFILE_CONFIG.underutilizedAfterDays,
      calendarGapMaxDays: input.calendarGapMaxDays ?? DEFAULT_PROFILE_CONFIG.calendarGapMaxDays,
      offerConflictMode: input.offerConflictMode ?? DEFAULT_PROFILE_CONFIG.offerConflictMode,
      targetRegions: cleanRegions,
      targetCities: cleanCities,
      preferredMediaTypes: cleanMediaTypes,
    },
    update: {
      enabled: input.enabled !== undefined ? input.enabled : undefined,
      automaticChecksEnabled: input.automaticChecksEnabled !== undefined ? input.automaticChecksEnabled : undefined,
      checkFrequency: input.checkFrequency !== undefined ? input.checkFrequency : undefined,
      checkReservationConflicts: input.checkReservationConflicts !== undefined ? input.checkReservationConflicts : undefined,
      checkCampaignConflicts: input.checkCampaignConflicts !== undefined ? input.checkCampaignConflicts : undefined,
      checkStatusMismatch: input.checkStatusMismatch !== undefined ? input.checkStatusMismatch : undefined,
      checkOfferConflicts: input.checkOfferConflicts !== undefined ? input.checkOfferConflicts : undefined,
      checkExpiringCampaigns: input.checkExpiringCampaigns !== undefined ? input.checkExpiringCampaigns : undefined,
      checkUnderutilizedMedia: input.checkUnderutilizedMedia !== undefined ? input.checkUnderutilizedMedia : undefined,
      checkMissingData: input.checkMissingData !== undefined ? input.checkMissingData : undefined,
      checkCalendarGaps: input.checkCalendarGaps !== undefined ? input.checkCalendarGaps : undefined,
      reservationHoldDays: input.reservationHoldDays !== undefined ? input.reservationHoldDays : undefined,
      expiringCampaignWarningDays: input.expiringCampaignWarningDays !== undefined ? input.expiringCampaignWarningDays : undefined,
      underutilizedAfterDays: input.underutilizedAfterDays !== undefined ? input.underutilizedAfterDays : undefined,
      calendarGapMaxDays: input.calendarGapMaxDays !== undefined ? input.calendarGapMaxDays : undefined,
      offerConflictMode: input.offerConflictMode !== undefined ? input.offerConflictMode : undefined,
      targetRegions: input.targetRegions !== undefined ? cleanRegions : undefined,
      targetCities: input.targetCities !== undefined ? cleanCities : undefined,
      preferredMediaTypes: input.preferredMediaTypes !== undefined ? cleanMediaTypes : undefined,
    },
  });

  return {
    id: saved.id,
    organizationId: saved.organizationId,
    enabled: saved.enabled,
    automaticChecksEnabled: saved.automaticChecksEnabled,
    checkFrequency: saved.checkFrequency,
    checkReservationConflicts: saved.checkReservationConflicts,
    checkCampaignConflicts: saved.checkCampaignConflicts,
    checkStatusMismatch: saved.checkStatusMismatch,
    checkOfferConflicts: saved.checkOfferConflicts,
    checkExpiringCampaigns: saved.checkExpiringCampaigns,
    checkUnderutilizedMedia: saved.checkUnderutilizedMedia,
    checkMissingData: saved.checkMissingData,
    checkCalendarGaps: saved.checkCalendarGaps,
    reservationHoldDays: saved.reservationHoldDays,
    expiringCampaignWarningDays: saved.expiringCampaignWarningDays,
    underutilizedAfterDays: saved.underutilizedAfterDays,
    calendarGapMaxDays: saved.calendarGapMaxDays,
    offerConflictMode: saved.offerConflictMode,
    targetRegions: saved.targetRegions,
    targetCities: saved.targetCities,
    preferredMediaTypes: saved.preferredMediaTypes,
    lastCheckAt: saved.lastCheckAt,
  };
}
