import type { CarrierStatus, CarrierType } from '@prisma/client';

export type CityInventoryCategory = 'POSTER' | 'BENCH' | 'NAVIGATION' | 'OTHER';

export type CityInventorySummary = {
  total: number;
  displayed: number;
  categories: Record<CityInventoryCategory, number>;
  statuses: Record<CarrierStatus, number>;
};

export function cityInventoryCategory(type: CarrierType): CityInventoryCategory {
  if (type === 'CITY_POSTER') return 'POSTER';
  if (type === 'PROMO_BENCH') return 'BENCH';
  if (type === 'NAVIGATION') return 'NAVIGATION';
  return 'OTHER';
}

export function summarizeCityInventoryTypes(
  groups: Array<{ type: CarrierType; count: number }>,
): Record<CityInventoryCategory, number> {
  const result: Record<CityInventoryCategory, number> = {
    POSTER: 0,
    BENCH: 0,
    NAVIGATION: 0,
    OTHER: 0,
  };

  for (const group of groups) result[cityInventoryCategory(group.type)] += group.count;
  return result;
}

