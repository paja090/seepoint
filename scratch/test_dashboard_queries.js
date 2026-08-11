require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59);

  const [
    totalCarriers,
    activeCarriers,
    archivedCarriers,
    missingGps,
    surfaces,
    activeOccupancies,
    waitingOffers,
  ] = await Promise.all([
    prisma.advertisingCarrier.count(),
    prisma.advertisingCarrier.count({ where: { archivedAt: null, status: 'ACTIVE' } }),
    prisma.advertisingCarrier.count({ where: { archivedAt: { not: null } } }),
    prisma.advertisingCarrier.count({ where: { archivedAt: null, OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }] } }),
    prisma.advertisingSurface.findMany({
      where: { carrier: { archivedAt: null } },
      select: {
        id: true,
        mediaType: true,
        price: true,
        carrier: { select: { city: true } },
      },
    }),
    prisma.occupancy.findMany({
      where: {
        status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] },
        dateTo: { gte: today },
      },
      include: {
        surface: {
          select: {
            id: true,
            mediaType: true,
            price: true,
            carrier: { select: { city: true } },
          },
        },
      },
    }),
    prisma.offer.count({ where: { status: 'SENT' } }),
  ]);

  const occupiedSurfaceIds = new Set(activeOccupancies.map((o) => o.surfaceId));
  const totalSurfaces = surfaces.length;
  const occupiedSurfaces = occupiedSurfaceIds.size;
  const availableSurfaces = Math.max(0, totalSurfaces - occupiedSurfaces);
  const reservedCount = activeOccupancies.filter((o) => o.status === 'RESERVED').length;

  const defaultRates = {
    NAVIGATION_SIGN: 1800,
    PROMO_BENCH: 2500,
    CITY_POSTER: 3200,
    PROMO_HORIZON: 2200,
    PROMO_TOWER: 3500,
    BILLBOARD: 4500,
    CITYLIGHT: 5000,
    OTHER: 2000,
  };

  const mrrAmount = activeOccupancies.reduce((acc, curr) => {
    const val = curr.price
      ? Number(curr.price)
      : (curr.surface?.price ? Number(curr.surface.price) : (defaultRates[curr.surface?.mediaType] || 2000));
    return acc + val;
  }, 0);

  const arrAmount = mrrAmount * 12;
  const occupancyPercent = totalSurfaces > 0 ? Math.round((occupiedSurfaces / totalSurfaces) * 100) : 0;

  console.log({
    totalCarriers,
    activeCarriers,
    archivedCarriers,
    missingGps,
    totalSurfaces,
    occupiedSurfaces,
    availableSurfaces,
    reservedCount,
    mrrAmount,
    arrAmount,
    occupancyPercent,
    waitingOffers,
  });

  // Calculate REAL City Breakdown
  const cityStatsMap = new Map();
  surfaces.forEach((s) => {
    const city = s.carrier.city?.trim() || 'Neuvedeno';
    if (!cityStatsMap.has(city)) {
      cityStatsMap.set(city, { city, total: 0, occupiedSet: new Set() });
    }
    const stat = cityStatsMap.get(city);
    stat.total += 1;
    if (occupiedSurfaceIds.has(s.id)) {
      stat.occupiedSet.add(s.id);
    }
  });

  const cityLeaderboard = Array.from(cityStatsMap.values())
    .map((c) => ({
      city: c.city,
      total: c.total,
      occupied: c.occupiedSet.size,
      percent: c.total > 0 ? Math.round((c.occupiedSet.size / c.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  console.log('REAL City Leaderboard:', cityLeaderboard);

  // Calculate REAL Media Type Breakdown
  const mediaMap = new Map();
  surfaces.forEach((s) => {
    if (!mediaMap.has(s.mediaType)) {
      mediaMap.set(s.mediaType, { count: 0, occupiedSet: new Set(), revenue: 0 });
    }
    mediaMap.get(s.mediaType).count += 1;
  });

  activeOccupancies.forEach((occ) => {
    const mt = occ.surface.mediaType;
    if (mediaMap.has(mt)) {
      const item = mediaMap.get(mt);
      item.occupiedSet.add(occ.surfaceId);
      const val = occ.price
        ? Number(occ.price)
        : (occ.surface?.price ? Number(occ.surface.price) : (defaultRates[mt] || 2000));
      item.revenue += val;
    }
  });

  const mediaBreakdown = Array.from(mediaMap.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    occupiedCount: data.occupiedSet.size,
    occupancyPercent: data.count > 0 ? Math.round((data.occupiedSet.size / data.count) * 100) : 0,
    revenue: data.revenue,
  })).sort((a, b) => b.revenue - a.revenue);

  console.log('REAL Media Breakdown:', mediaBreakdown);

  // REAL Seasonality 12 Months
  const allYearOccupancies = await prisma.occupancy.findMany({
    where: {
      status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] },
      dateFrom: { gte: startOfYear },
      dateTo: { lte: endOfYear },
    },
    select: { dateFrom: true, dateTo: true, surfaceId: true },
  });

  const monthOccupancyCounts = Array(12).fill(0);
  allYearOccupancies.forEach((occ) => {
    const m = new Date(occ.dateFrom).getMonth();
    if (m >= 0 && m < 12) monthOccupancyCounts[m] += 1;
  });

  console.log('REAL Seasonality Monthly Counts (Jan..Dec):', monthOccupancyCounts);

  await prisma.$disconnect();
}

main().catch(console.error);
