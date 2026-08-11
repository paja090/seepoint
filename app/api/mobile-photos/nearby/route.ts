import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const radiusKm = parseFloat(searchParams.get('radius') || '2.0'); // default 2km

    const carriers = await prisma.advertisingCarrier.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        street: true,
        address: true,
        latitude: true,
        longitude: true,
        structureCode: true,
        surfaces: {
          select: {
            id: true,
            name: true,
            status: true,
            artworkUrl: true,
            currentClient: { select: { name: true } },
          },
        },
        photos: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            url: true,
            storageProvider: true,
            capturedLatitude: true,
            capturedLongitude: true,
            capturedByWorkerName: true,
            createdAt: true,
            aiStatus: true,
            aiConfidence: true,
          },
        },
      },
    });

    let result = carriers.map((c) => {
      let distanceKm: number | null = null;
      if (!isNaN(lat) && !isNaN(lng) && c.latitude && c.longitude) {
        distanceKm = calculateDistanceKm(lat, lng, c.latitude, c.longitude);
      }
      return { ...c, distanceKm };
    });

    if (!isNaN(lat) && !isNaN(lng)) {
      result = result
        .filter((c) => c.distanceKm !== null && c.distanceKm <= radiusKm)
        .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0));
    }

    return NextResponse.json({ success: true, count: result.length, carriers: result });
  } catch (error) {
    console.error('Nearby carriers query error:', error);
    return NextResponse.json({ error: 'Chyba při načítání nosičů v okolí' }, { status: 500 });
  }
}
