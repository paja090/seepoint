import 'server-only';
import { prisma } from '@/lib/db';
import type { OrganizationRadarProfileData } from './types';

const DEFAULT_EVENT_TYPES = [
  'NEW_BRANCH',
  'STORE_OPENING',
  'RETAIL_PARK',
  'EXPANSION',
  'RELOCATION',
  'MARKETING_EVENT',
  'SEASONAL_CAMPAIGN',
];

const DEFAULT_MEDIA_TYPES = [
  'BILLBOARD',
  'BIGBOARD',
  'CITYLIGHT',
  'BANNER',
  'CITY_POSTER',
  'PROMO_BENCH',
  'NAVIGATION_SIGN',
];

export async function getOrganizationRadarProfile(organizationId: string): Promise<OrganizationRadarProfileData> {
  const existing = await prisma.organizationRadarProfile.findUnique({
    where: { organizationId },
  });

  if (existing) {
    return {
      id: existing.id,
      organizationId: existing.organizationId,
      enabled: existing.enabled,
      targetRegions: existing.targetRegions,
      targetCities: existing.targetCities,
      focusEventTypes: existing.focusEventTypes.length ? existing.focusEventTypes : DEFAULT_EVENT_TYPES,
      preferredMediaTypes: existing.preferredMediaTypes.length ? existing.preferredMediaTypes : DEFAULT_MEDIA_TYPES,
      customKeywords: existing.customKeywords,
      customRssSources: existing.customRssSources,
      minScoreThreshold: existing.minScoreThreshold,
      scoringWeights: existing.scoringWeights as Record<string, number> | null,
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
    },
    take: 500,
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
  }

  const topCities = [...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([city]) => city)
    .slice(0, 10);

  const detectedRegions = [...regionSet];
  const detectedMediaTypes = mediaTypeSet.size > 0 ? [...mediaTypeSet] : DEFAULT_MEDIA_TYPES;

  return {
    organizationId,
    enabled: true,
    targetRegions: detectedRegions,
    targetCities: topCities,
    focusEventTypes: DEFAULT_EVENT_TYPES,
    preferredMediaTypes: detectedMediaTypes,
    customKeywords: [],
    customRssSources: [],
    minScoreThreshold: 40,
    scoringWeights: null,
  };
}

export async function saveOrganizationRadarProfile(
  organizationId: string,
  input: {
    enabled?: boolean;
    targetRegions?: string[];
    targetCities?: string[];
    focusEventTypes?: string[];
    preferredMediaTypes?: string[];
    customKeywords?: string[];
    customRssSources?: string[];
    minScoreThreshold?: number;
    scoringWeights?: Record<string, number> | null;
  }
): Promise<OrganizationRadarProfileData> {
  const cleanRegions = (input.targetRegions || []).map((r) => r.trim()).filter(Boolean);
  const cleanCities = (input.targetCities || []).map((c) => c.trim()).filter(Boolean);
  const cleanEventTypes = (input.focusEventTypes || []).map((e) => e.trim()).filter(Boolean);
  const cleanMediaTypes = (input.preferredMediaTypes || []).map((m) => m.trim()).filter(Boolean);
  const cleanKeywords = (input.customKeywords || []).map((k) => k.trim()).filter(Boolean);
  const cleanSources = (input.customRssSources || []).map((s) => s.trim()).filter(Boolean);

  const saved = await prisma.organizationRadarProfile.upsert({
    where: { organizationId },
    create: {
      organizationId,
      enabled: input.enabled ?? true,
      targetRegions: cleanRegions,
      targetCities: cleanCities,
      focusEventTypes: cleanEventTypes.length ? cleanEventTypes : DEFAULT_EVENT_TYPES,
      preferredMediaTypes: cleanMediaTypes.length ? cleanMediaTypes : DEFAULT_MEDIA_TYPES,
      customKeywords: cleanKeywords,
      customRssSources: cleanSources,
      minScoreThreshold: typeof input.minScoreThreshold === 'number' ? Math.max(0, Math.min(100, input.minScoreThreshold)) : 40,
      scoringWeights: input.scoringWeights || undefined,
    },
    update: {
      enabled: input.enabled,
      targetRegions: cleanRegions,
      targetCities: cleanCities,
      focusEventTypes: cleanEventTypes.length ? cleanEventTypes : undefined,
      preferredMediaTypes: cleanMediaTypes.length ? cleanMediaTypes : undefined,
      customKeywords: cleanKeywords,
      customRssSources: cleanSources,
      minScoreThreshold: typeof input.minScoreThreshold === 'number' ? Math.max(0, Math.min(100, input.minScoreThreshold)) : undefined,
      scoringWeights: input.scoringWeights || undefined,
    },
  });

  return {
    id: saved.id,
    organizationId: saved.organizationId,
    enabled: saved.enabled,
    targetRegions: saved.targetRegions,
    targetCities: saved.targetCities,
    focusEventTypes: saved.focusEventTypes,
    preferredMediaTypes: saved.preferredMediaTypes,
    customKeywords: saved.customKeywords,
    customRssSources: saved.customRssSources,
    minScoreThreshold: saved.minScoreThreshold,
    scoringWeights: saved.scoringWeights as Record<string, number> | null,
  };
}
