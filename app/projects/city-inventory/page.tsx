import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { CityInventoryModuleClient } from '@/components/city-inventory/CityInventoryModuleClient';
import { summarizeCityInventoryTypes, type CityInventorySummary } from '@/lib/city-inventory';
import type { CarrierStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const PREVIEW_LIMIT_PER_CATEGORY = 60;

const carrierPreviewSelect = {
  id: true,
  code: true,
  name: true,
  city: true,
  type: true,
  status: true,
  address: true,
} as const;

export default async function CityInventoryProjectsPage() {
  const user = await requirePageAccess('carriers');
  if (!user.organizationId) throw new Error('Není vybraná aktivní organizace.');

  const where = { organizationId: user.organizationId, archivedAt: null } as const;
  const [posterRows, benchRows, navigationRows, otherRows, typeGroups, statusGroups, total] = await Promise.all([
    prisma.advertisingCarrier.findMany({
      where: { ...where, type: 'CITY_POSTER' },
      select: carrierPreviewSelect,
      orderBy: { code: 'asc' },
      take: PREVIEW_LIMIT_PER_CATEGORY,
    }),
    prisma.advertisingCarrier.findMany({
      where: { ...where, type: 'PROMO_BENCH' },
      select: carrierPreviewSelect,
      orderBy: { code: 'asc' },
      take: PREVIEW_LIMIT_PER_CATEGORY,
    }),
    prisma.advertisingCarrier.findMany({
      where: { ...where, type: 'NAVIGATION' },
      select: carrierPreviewSelect,
      orderBy: { code: 'asc' },
      take: PREVIEW_LIMIT_PER_CATEGORY,
    }),
    prisma.advertisingCarrier.findMany({
      where: { ...where, type: { notIn: ['CITY_POSTER', 'PROMO_BENCH', 'NAVIGATION'] } },
      select: carrierPreviewSelect,
      orderBy: { code: 'asc' },
      take: PREVIEW_LIMIT_PER_CATEGORY,
    }),
    prisma.advertisingCarrier.groupBy({
      by: ['type'],
      where,
      _count: { _all: true },
    }),
    prisma.advertisingCarrier.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.advertisingCarrier.count({ where }),
  ]);

  const carriersRaw = [...posterRows, ...benchRows, ...navigationRows, ...otherRows]
    .sort((left, right) => left.code.localeCompare(right.code, 'cs'));

  const carriers = carriersRaw.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    city: c.city,
    type: c.type,
    status: c.status,
    address: c.address,
  }));

  const statuses: CityInventorySummary['statuses'] = { ACTIVE: 0, INACTIVE: 0, MAINTENANCE: 0 };
  for (const group of statusGroups) statuses[group.status as CarrierStatus] = group._count._all;
  const summary: CityInventorySummary = {
    total,
    displayed: carriers.length,
    categories: summarizeCityInventoryTypes(typeGroups.map((group) => ({ type: group.type, count: group._count._all }))),
    statuses,
  };

  return (
    <AppShell>
      <CityInventoryModuleClient carriers={carriers} summary={summary} />
    </AppShell>
  );
}
