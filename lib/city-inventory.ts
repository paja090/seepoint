import type { CarrierStatus, CarrierType } from '@prisma/client';

export type CityInventoryCategory = 'POSTER' | 'BENCH' | 'HORIZON' | 'TOWER' | 'OTHER';

export type CityInventorySummary = {
  total: number;
  displayed: number;
  categories: Record<CityInventoryCategory, number>;
  statuses: Record<CarrierStatus, number>;
};

export function cityInventoryCategory(type: CarrierType): CityInventoryCategory {
  if (type === 'CITY_POSTER') return 'POSTER';
  if (type === 'PROMO_BENCH') return 'BENCH';
  if (type === 'PROMO_HORIZON') return 'HORIZON';
  if (type === 'PROMO_TOWER' || type === 'PROMO_MINITOWER' || type === 'CITYLIGHT') return 'TOWER';
  return 'OTHER';
}

export function summarizeCityInventoryTypes(
  groups: Array<{ type: CarrierType; count: number }>,
): Record<CityInventoryCategory, number> {
  const result: Record<CityInventoryCategory, number> = {
    POSTER: 0,
    BENCH: 0,
    HORIZON: 0,
    TOWER: 0,
    OTHER: 0,
  };

  for (const group of groups) {
    if (group.type === 'NAVIGATION') continue;
    result[cityInventoryCategory(group.type)] += group.count;
  }
  return result;
}
