import type { ElectionRemovalMediaType } from '@prisma/client';

export const DEFAULT_MEDIA_SERVICE_MINUTES: Record<ElectionRemovalMediaType, number> = {
  ACKO: 5,
  BENCH: 5,
  CITY_POSTER: 7,
  MINI_TOWER: 10,
  BANNER: 10,
  PLOT: 10,
  TOWER: 15,
  OTHER: 10,
};

export const ELECTION_REMOVAL_MEDIA_LABELS: Record<ElectionRemovalMediaType, string> = {
  ACKO: 'Áčko',
  BENCH: 'Lavička',
  CITY_POSTER: 'City Poster',
  MINI_TOWER: 'Mini Tower',
  BANNER: 'Banner',
  PLOT: 'Plotová reklama',
  TOWER: 'Tower',
  OTHER: 'Jiné médium',
};

/**
 * Calculates total planned service minutes for an election removal item.
 * Default quantity is strictly 1 unless explicitly overridden.
 */
export function calculateServiceMinutes(
  mediaType: ElectionRemovalMediaType,
  quantity = 1,
  overrides?: Partial<Record<ElectionRemovalMediaType, number>> | null
): { baseMinutes: number; totalMinutes: number } {
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));
  const baseMinutes = overrides?.[mediaType] ?? DEFAULT_MEDIA_SERVICE_MINUTES[mediaType] ?? DEFAULT_MEDIA_SERVICE_MINUTES.OTHER;
  return {
    baseMinutes,
    totalMinutes: baseMinutes * safeQuantity,
  };
}
