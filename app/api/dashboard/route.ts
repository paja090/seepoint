import { NextResponse } from 'next/server';
import { getCarriers } from '@/lib/db';

export async function GET() {
  const carriers = await getCarriers();
  const surfaces = carriers.flatMap((carrier) => carrier.surfaces);
  const occupied = surfaces.filter((surface) => surface.status === 'OCCUPIED').length;
  const reserved = surfaces.filter((surface) => surface.status === 'RESERVED').length;
  const available = surfaces.filter((surface) => surface.status === 'AVAILABLE').length;
  const month = new Date().toISOString().slice(0, 7);
  return NextResponse.json({
    totalCarriers: carriers.length,
    activeCarriers: carriers.filter((carrier) => carrier.status === 'ACTIVE').length,
    availableSurfaces: available,
    occupiedSurfaces: occupied,
    reservedSurfaces: reserved,
    occupancyPercent: Math.round((occupied / Math.max(surfaces.length, 1)) * 100),
    campaignsEndingThisMonth: surfaces.flatMap((surface) => surface.occupancies).filter((occupancy) => occupancy.dateTo.startsWith(month)),
  });
}
