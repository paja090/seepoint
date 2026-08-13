import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function surfaceSide(surface: { sidePosition: string | null; sourcePosition: string | null; name: string }) {
  const value = `${surface.sidePosition || ''} ${surface.sourcePosition || ''} ${surface.name}`.toUpperCase();
  if (/\b(B|SIDE_B|STRANA B|ZADN[ÍI])\b/.test(value)) return 'SIDE_B';
  if (/\b(A|SIDE_A|STRANA A|PŘEDN[ÍI])\b/.test(value)) return 'SIDE_A';
  return null;
}

export async function GET(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const latParam = requestUrl.searchParams.get('lat');
    const lngParam = requestUrl.searchParams.get('lng');
    const lat = latParam === null ? Number.NaN : Number(latParam);
    const lng = lngParam === null ? Number.NaN : Number(lngParam);
    const requestedRadius = Number(requestUrl.searchParams.get('radius') || '2');
    const radiusKm = Number.isFinite(requestedRadius) && requestedRadius > 0 ? Math.min(requestedRadius, 100) : 2;
    const hasCoordinates = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
    const now = new Date();

    const carriers = await prisma.advertisingCarrier.findMany({
      where: { archivedAt: null },
      select: {
        id: true, code: true, name: true, city: true, street: true, address: true,
        latitude: true, longitude: true, structureCode: true,
        surfaces: {
          select: {
            id: true, name: true, status: true, artworkUrl: true, sidePosition: true, sourcePosition: true,
            occupancies: {
              where: { dateFrom: { lte: now }, dateTo: { gte: now }, status: { in: ['RESERVED', 'OCCUPIED'] } },
              orderBy: [{ status: 'desc' }, { dateFrom: 'desc' }], take: 1,
              select: {
                id: true, status: true, dateFrom: true, dateTo: true, campaignName: true,
                clientName: true, clientResolutionStatus: true,
                client: { select: { id: true, name: true } }, offer: { select: { id: true, campaignName: true, title: true } },
              },
            },
            photos: { orderBy: { createdAt: 'desc' }, take: 1, select: {
              id: true, url: true, storageProvider: true, capturedLatitude: true, capturedLongitude: true,
              capturedByWorkerName: true, createdAt: true, aiStatus: true, aiConfidence: true,
            } },
          },
        },
        photos: { orderBy: { createdAt: 'desc' }, take: 5, select: {
          id: true, url: true, storageProvider: true, capturedLatitude: true, capturedLongitude: true,
          capturedByWorkerName: true, createdAt: true, aiStatus: true, aiConfidence: true,
        } },
      },
    });

    let result = carriers.map((carrier) => {
      const distanceKm = hasCoordinates && carrier.latitude != null && carrier.longitude != null
        ? calculateDistanceKm(lat, lng, carrier.latitude, carrier.longitude) : null;
      const carrierLatestPhoto = carrier.photos[0]?.url || null;
      const surfaces = carrier.surfaces.map((surface) => {
        const occupancy = surface.occupancies[0] || null;
        const safelyResolved = occupancy?.clientResolutionStatus !== 'UNRESOLVED';
        const clientName = occupancy?.client?.name || occupancy?.clientName || null;
        return {
          id: surface.id,
          name: surface.name,
          side: surfaceSide(surface),
          status: occupancy?.status || surface.status,
          currentClient: occupancy && safelyResolved && clientName
            ? { id: occupancy.client?.id || null, name: clientName } : null,
          currentCampaign: occupancy
            ? { id: occupancy.offer?.id || occupancy.id, name: occupancy.campaignName || occupancy.offer?.campaignName || occupancy.offer?.title || 'Kampaň nezjištěna' }
            : null,
          occupiedFrom: occupancy?.dateFrom.toISOString() || null,
          occupiedUntil: occupancy?.dateTo.toISOString() || null,
          latestPhotoUrl: surface.photos[0]?.url || carrierLatestPhoto || surface.artworkUrl || null,
          artworkUrl: surface.artworkUrl,
          photos: surface.photos,
        };
      });
      const allPhotos = [...carrier.photos, ...carrier.surfaces.flatMap((surface) => surface.photos)]
        .filter((photo, index, photos) => photos.findIndex((candidate) => candidate.id === photo.id) === index)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { ...carrier, surfaces, photos: allPhotos, distanceKm };
    });

    if (hasCoordinates) {
      result = result.filter((carrier) => carrier.distanceKm != null && carrier.distanceKm <= radiusKm)
        .sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY));
    }
    return NextResponse.json({ success: true, count: result.length, carriers: result });
  } catch (error) {
    console.error('[mobile-photos/nearby]', error);
    return NextResponse.json({ success: false, code: 'NEARBY_ERROR', error: 'Nosiče v okolí se nepodařilo načíst.' }, { status: 500 });
  }
}
