import { prisma } from '@/lib/db';

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function findNearbyCarriers(
  organizationId: string,
  latitude: number,
  longitude: number,
  radiusKm = 5
) {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180) || 1);

  const candidates = await prisma.advertisingCarrier.findMany({
    where: {
      organizationId,
      archivedAt: null,
      status: 'ACTIVE',
      latitude: {
        gte: latitude - latDelta,
        lte: latitude + latDelta,
      },
      longitude: {
        gte: longitude - lonDelta,
        lte: longitude + lonDelta,
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      city: true,
      latitude: true,
      longitude: true,
    },
    take: 100,
  });

  return candidates
    .filter((c) => c.latitude !== null && c.longitude !== null)
    .map((c) => {
      const distanceKm = calculateHaversineDistanceKm(latitude, longitude, c.latitude!, c.longitude!);
      return { ...c, distanceKm: Math.round(distanceKm * 10) / 10 };
    })
    .filter((c) => c.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
