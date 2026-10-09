import type { ElectionRemovalMediaType } from '@prisma/client';
export type { ElectionRemovalMediaType };

export type ElectionRemovalOperationType =
  | 'FULL_REMOVAL'
  | 'BANNER_CHANGE'
  | 'RELOCATION'
  | 'OTHER';

export const ELECTION_REMOVAL_OPERATION_LABELS: Record<ElectionRemovalOperationType, string> = {
  FULL_REMOVAL: 'Kompletní demontáž a svoz',
  BANNER_CHANGE: 'Pouze výměna / sundání plachty',
  RELOCATION: 'Přímý převoz na jiné místo',
  OTHER: 'Jiná operace',
};

export const DEFAULT_VEHICLE_CAPACITY_SLOTS = 30; // 30 Áček = 5 MiniTowerů (á 6) = 1 Velká věž (30)
export const DEFAULT_WAREHOUSE_UNLOAD_MINUTES = 15; // Standardní čas vykládky plného vozíku na skladě

/**
 * Počet ložných jednotek (slotů) pro jednotlivá média.
 * 1 standardní vozík / dodávka pojme 30 slotů:
 * - 30× Áčko (1 slot)
 * - 5× MiniTower (6 slotů)
 * - 1× Velká věž (30 slotů)
 */
export const DEFAULT_MEDIA_LOAD_SLOTS: Record<ElectionRemovalMediaType, number> = {
  ACKO: 1,
  BENCH: 2,
  CITY_POSTER: 2,
  MINI_TOWER: 6,
  BANNER: 0,
  PLOT: 2,
  TOWER: 30,
  OTHER: 2,
};

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

export const DEFAULT_BANNER_CHANGE_SERVICE_MINUTES: Record<ElectionRemovalMediaType, number> = {
  ACKO: 4,
  BENCH: 4,
  CITY_POSTER: 5,
  MINI_TOWER: 5,
  BANNER: 8,
  PLOT: 8,
  TOWER: 7,
  OTHER: 6,
};

export const DEFAULT_RELOCATION_SERVICE_MINUTES: Record<ElectionRemovalMediaType, number> = {
  ACKO: 8,
  BENCH: 8,
  CITY_POSTER: 12,
  MINI_TOWER: 15,
  BANNER: 12,
  PLOT: 12,
  TOWER: 25,
  OTHER: 15,
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
 * Vypočítá obsazené ložné sloty na vozíku / autě.
 * Výměna plachty neobsazuje ložnou plochu konstrukce (0 slotů).
 */
export function calculateMediaLoadSlots(
  mediaType: ElectionRemovalMediaType,
  operationType: ElectionRemovalOperationType = 'FULL_REMOVAL',
  quantity = 1
): number {
  if (operationType === 'BANNER_CHANGE') {
    return 0;
  }
  const safeQty = Math.max(1, Math.floor(quantity || 1));
  const baseSlots = DEFAULT_MEDIA_LOAD_SLOTS[mediaType] ?? DEFAULT_MEDIA_LOAD_SLOTS.OTHER;
  return baseSlots * safeQty;
}

/**
 * Calculates total planned service minutes for an election removal item.
 * Zohledňuje rozdíl mezi kompletní demontáží konstrukce a pouhou výměnou plachty.
 */
export function calculateServiceMinutes(
  mediaType: ElectionRemovalMediaType,
  quantity = 1,
  overrides?: Partial<Record<ElectionRemovalMediaType, number>> | null,
  operationType: ElectionRemovalOperationType = 'FULL_REMOVAL'
): { baseMinutes: number; totalMinutes: number } {
  const safeQuantity = Math.max(1, Math.floor(quantity || 1));
  const table =
    operationType === 'BANNER_CHANGE'
      ? DEFAULT_BANNER_CHANGE_SERVICE_MINUTES
      : operationType === 'RELOCATION'
      ? DEFAULT_RELOCATION_SERVICE_MINUTES
      : DEFAULT_MEDIA_SERVICE_MINUTES;

  const baseMinutes = overrides?.[mediaType] ?? table[mediaType] ?? table.OTHER;
  return {
    baseMinutes,
    totalMinutes: baseMinutes * safeQuantity,
  };
}
