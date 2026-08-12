import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';

export const dynamic = 'force-dynamic';

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
        price: true,
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
  const typeMap: Record<string, { count: number; occupiedCount: number; revenue: number }> = {};
  const cityMap: Record<string, { carrierCount: number; surfaceCount: number; occupiedCount: number; revenue: number }> = {};

  let totalRevenue = 0;
  let totalSurfacesCount = surfaces.length;
  let occupiedSurfacesCount = 0;

  surfaces.forEach((surface) => {
    const isNavigation = surface.carrier.type === 'NAVIGATION' || surface.mediaType === 'NAVIGATION_SIGN';
    const hasActiveOccupancy = surface.occupancies.length > 0;
    
    // For NAVIGATION: directional graphics stay fixed for contract duration (1-5 years) with continuous monthly rent
    const isOccupied = isNavigation
      ? (hasActiveOccupancy || Boolean(surface.price && Number(surface.price) > 0))
      : hasActiveOccupancy;

    const occPrice = isNavigation
      ? (surface.occupancies[0]?.price ? Number(surface.occupancies[0].price) : (surface.price ? Number(surface.price) : 1000))
      : (surface.occupancies[0]?.price ? Number(surface.occupancies[0].price) : (surface.price ? Number(surface.price) : 0));

    if (isOccupied) {
      occupiedSurfacesCount++;
      totalRevenue += occPrice;
    }

    // By Type
    const typeKey = surface.carrier.type || 'OTHER';
    if (!typeMap[typeKey]) {
      typeMap[typeKey] = { count: 0, occupiedCount: 0, revenue: 0 };
    }
    typeMap[typeKey].count++;
    if (isOccupied) {
      typeMap[typeKey].occupiedCount++;
      typeMap[typeKey].revenue += occPrice;
    }

    // By City
    const cityKey = surface.carrier.city || 'Nespecifikováno';
    if (!cityMap[cityKey]) {
      cityMap[cityKey] = { carrierCount: 0, surfaceCount: 0, occupiedCount: 0, revenue: 0 };
    }
    cityMap[cityKey].surfaceCount++;
    if (isOccupied) {
      cityMap[cityKey].occupiedCount++;
      cityMap[cityKey].revenue += occPrice;
    }
  });

  // Add carrier counts to city map
  carriers.forEach((c) => {
    const cityKey = c.city || 'Nespecifikováno';
    if (!cityMap[cityKey]) {
      cityMap[cityKey] = { carrierCount: 0, surfaceCount: 0, occupiedCount: 0, revenue: 0 };
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
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  const typeList = Object.entries(typeMap).map(([type, data]) => ({
    type,
    surfaceCount: data.count,
    occupiedCount: data.occupiedCount,
    occupancyRate: data.count > 0 ? Math.round((data.occupiedCount / data.count) * 100) : 0,
    revenue: data.revenue,
  }));

  const overallOccupancyRate = totalSurfacesCount > 0 ? Math.round((occupiedSurfacesCount / totalSurfacesCount) * 100) : 0;
  const avgPricePerSurface = occupiedSurfacesCount > 0 ? Math.round(totalRevenue / occupiedSurfacesCount) : 0;

  return (
    <AppShell>
      <AnalyticsDashboard
        metrics={{
          totalRevenue,
          totalCarriers: carriers.length,
          totalSurfaces: totalSurfacesCount,
          occupiedSurfaces: occupiedSurfacesCount,
          overallOccupancyRate,
          avgPricePerSurface,
        }}
        typeList={typeList}
        cityList={cityList}
        recentOccupancies={activeOccupancies.map((o) => ({
          id: o.id,
          clientName: o.clientName || 'Klient',
          campaignName: o.campaignName || 'Kampaň',
          status: o.status,
          price: o.price ? Number(o.price) : 0,
          dateFrom: o.dateFrom.toISOString(),
          dateTo: o.dateTo.toISOString(),
        }))}
      />
    </AppShell>
  );
}
