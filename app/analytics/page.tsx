import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { deriveAnalyticsSurfaceState } from '@/lib/analytics-finance';

export const dynamic = 'force-dynamic';

const analyticsDateFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' });

export default async function AnalyticsPage() {
  await requirePageAccess('clients');

  const now = new Date();

  const [carriers, surfaces, activeOccupancies] = await Promise.all([
    prisma.advertisingCarrier.findMany({
      where: { archivedAt: null, status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        city: true,
      },
    }),
    prisma.advertisingSurface.findMany({
      where: {
        status: { not: 'OUT_OF_SERVICE' },
        carrier: { archivedAt: null, status: 'ACTIVE' },
      },
      select: {
        id: true,
        name: true,
        mediaType: true,
        status: true,
        contract: {
          select: {
            id: true,
            monthlyPrice: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        carrierId: true,
        carrier: {
          select: { city: true, type: true },
        },
        occupancies: {
          where: {
            status: { in: ['OCCUPIED', 'RESERVED'] },
            dateFrom: { lte: now },
            dateTo: { gte: now },
          },
          select: {
            id: true,
            status: true,
            price: true,
            clientName: true,
          },
        },
      },
    }),
    prisma.occupancy.findMany({
      where: {
        status: { in: ['OCCUPIED', 'RESERVED'] },
        dateFrom: { lte: now },
        dateTo: { gte: now },
      },
      select: {
        id: true,
        status: true,
        price: true,
        dateFrom: true,
        dateTo: true,
        clientName: true,
        campaignName: true,
      },
      orderBy: { dateFrom: 'desc' },
      take: 100,
    }),
  ]);

  // Aggregate stats by Carrier Type
  const typeMap: Record<string, { count: number; occupiedCount: number; knownMonthlyRent: number }> = {};
  const cityMap: Record<string, { carrierCount: number; surfaceCount: number; occupiedCount: number; knownMonthlyRent: number }> = {};

  let knownMonthlyRent = 0;
  const totalSurfacesCount = surfaces.length;
  let occupiedSurfacesCount = 0;
  let pricedOccupiedSurfaces = 0;

  surfaces.forEach((surface) => {
    const financialState = deriveAnalyticsSurfaceState({
      surfaceStatus: surface.status,
      contract: surface.contract ? {
        status: surface.contract.status,
        startDate: surface.contract.startDate,
        endDate: surface.contract.endDate,
        monthlyPrice: surface.contract.monthlyPrice ? Number(surface.contract.monthlyPrice) : null,
      } : null,
      occupancies: surface.occupancies.map((item) => ({ status: item.status, price: item.price ? Number(item.price) : null })),
      asOf: now,
    });
    const { isOccupied, monthlyRent } = financialState;

    if (isOccupied) {
      occupiedSurfacesCount++;
      if (monthlyRent !== null) {
        knownMonthlyRent += monthlyRent;
        pricedOccupiedSurfaces++;
      }
    }

    // By Carrier Type
    const typeKey = surface.carrier.type || 'OTHER';
    if (!typeMap[typeKey]) {
      typeMap[typeKey] = { count: 0, occupiedCount: 0, knownMonthlyRent: 0 };
    }
    typeMap[typeKey].count++;
    if (isOccupied) {
      typeMap[typeKey].occupiedCount++;
      typeMap[typeKey].knownMonthlyRent += monthlyRent ?? 0;
    }

    // By City
    const cityKey = surface.carrier.city || 'Nespecifikováno';
    if (!cityMap[cityKey]) {
      cityMap[cityKey] = { carrierCount: 0, surfaceCount: 0, occupiedCount: 0, knownMonthlyRent: 0 };
    }
    cityMap[cityKey].surfaceCount++;
    if (isOccupied) {
      cityMap[cityKey].occupiedCount++;
      cityMap[cityKey].knownMonthlyRent += monthlyRent ?? 0;
    }
  });

  // Add carrier counts to city map
  carriers.forEach((c) => {
    const cityKey = c.city || 'Nespecifikováno';
    if (!cityMap[cityKey]) {
      cityMap[cityKey] = { carrierCount: 0, surfaceCount: 0, occupiedCount: 0, knownMonthlyRent: 0 };
    }
    cityMap[cityKey].carrierCount++;
  });

  const cityList = Object.entries(cityMap)
    .map(([city, data]) => ({
      city,
      carrierCount: data.carrierCount,
      surfaceCount: data.surfaceCount,
      occupiedCount: data.occupiedCount,
      occupancyRate: data.surfaceCount > 0 ? Math.round((data.occupiedCount / data.surfaceCount) * 100) : 0,
      knownMonthlyRent: data.knownMonthlyRent,
    }))
    .sort((a, b) => b.knownMonthlyRent - a.knownMonthlyRent)
    .slice(0, 12);

  const typeList = Object.entries(typeMap).map(([type, data]) => ({
    type,
    surfaceCount: data.count,
    occupiedCount: data.occupiedCount,
    occupancyRate: data.count > 0 ? Math.round((data.occupiedCount / data.count) * 100) : 0,
    knownMonthlyRent: data.knownMonthlyRent,
  }));

  const overallOccupancyRate = totalSurfacesCount > 0 ? Math.round((occupiedSurfacesCount / totalSurfacesCount) * 100) : 0;
  const avgKnownRentPerSurface = pricedOccupiedSurfaces > 0 ? Math.round(knownMonthlyRent / pricedOccupiedSurfaces) : 0;

  return (
    <AppShell>
      <AnalyticsDashboard
        metrics={{
          knownMonthlyRent,
          totalCarriers: carriers.length,
          totalSurfaces: totalSurfacesCount,
          occupiedSurfaces: occupiedSurfacesCount,
          overallOccupancyRate,
          pricedOccupiedSurfaces,
          unpricedOccupiedSurfaces: occupiedSurfacesCount - pricedOccupiedSurfaces,
          avgKnownRentPerSurface,
        }}
        typeList={typeList}
        cityList={cityList}
        recentOccupancies={activeOccupancies.map((o) => ({
          id: o.id,
          clientName: o.clientName || 'Klient',
          campaignName: o.campaignName || 'Kampaň',
          status: o.status,
          price: o.price ? Number(o.price) : 0,
          dateFromLabel: analyticsDateFormatter.format(o.dateFrom),
          dateToLabel: analyticsDateFormatter.format(o.dateTo),
        }))}
      />
    </AppShell>
  );
}
