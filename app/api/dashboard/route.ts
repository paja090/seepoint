import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const activeCarrierWhere = { archivedAt: null };
  const activeSurfaceWhere = { carrier: activeCarrierWhere };
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [
    totalCarriers,
    activeCarriers,
    archivedCarriers,
    carriersWithGps,
    carriersMissingGps,
    totalSurfaces,
    availableSurfaces,
    occupiedSurfaces,
    reservedSurfaces,
    campaignsEndingThisMonth,
  ] = await Promise.all([
    prisma.advertisingCarrier.count(),
    prisma.advertisingCarrier.count({ where: activeCarrierWhere }),
    prisma.advertisingCarrier.count({ where: { archivedAt: { not: null } } }),
    prisma.advertisingCarrier.count({ where: { ...activeCarrierWhere, latitude: { not: null }, longitude: { not: null } } }),
    prisma.advertisingCarrier.count({
      where: {
        ...activeCarrierWhere,
        OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }],
      },
    }),
    prisma.advertisingSurface.count({ where: activeSurfaceWhere }),
    prisma.advertisingSurface.count({ where: { ...activeSurfaceWhere, status: 'AVAILABLE' } }),
    prisma.advertisingSurface.count({ where: { ...activeSurfaceWhere, status: 'OCCUPIED' } }),
    prisma.advertisingSurface.count({ where: { ...activeSurfaceWhere, status: 'RESERVED' } }),
    prisma.occupancy.findMany({
      where: {
        dateTo: { gte: monthStart, lt: nextMonthStart },
        surface: { carrier: activeCarrierWhere },
      },
      orderBy: { dateTo: 'asc' },
      take: 20,
    }),
  ]);

  return NextResponse.json({
    totalCarriers,
    activeCarriers,
    archivedCarriers,
    carriersWithGps,
    carriersMissingGps,
    availableSurfaces,
    occupiedSurfaces,
    reservedSurfaces,
    occupancyPercent: Math.round((occupiedSurfaces / Math.max(totalSurfaces, 1)) * 100),
    campaignsEndingThisMonth: campaignsEndingThisMonth.map((occupancy) => ({
      ...occupancy,
      dateFrom: occupancy.dateFrom.toISOString(),
      dateTo: occupancy.dateTo.toISOString(),
      createdAt: occupancy.createdAt.toISOString(),
      updatedAt: occupancy.updatedAt.toISOString(),
    })),
  });
}
