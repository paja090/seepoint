import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isSurfaceDetailClientCurrent } from '@/lib/mobile-photo-nearby';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';

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
  const auth = await requireApiAccess('navigationProjects');
  if (isApiDenied(auth)) return auth;
  try {
    const requestUrl = new URL(req.url);
    const latParam = requestUrl.searchParams.get('lat');
    const lngParam = requestUrl.searchParams.get('lng');
    const lat = latParam === null ? Number.NaN : Number(latParam);
    const lng = lngParam === null ? Number.NaN : Number(lngParam);
    const requestedRadius = Number(requestUrl.searchParams.get('radius') || '2');
    const radiusKm = Number.isFinite(requestedRadius) && requestedRadius > 0 ? Math.min(requestedRadius, 100) : 2;
    const query = (requestUrl.searchParams.get('q') || '').trim().slice(0, 80);
    const requestedLimit = Number(requestUrl.searchParams.get('limit') || '100');
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 200) : 100;
    const hasCoordinates = Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
    const now = new Date();

    const where: Prisma.AdvertisingCarrierWhereInput = {
      archivedAt: null,
      ...(query ? {
        OR: [
          { code: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { city: { contains: query, mode: 'insensitive' } },
          { street: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } },
        ],
      } : {}),
    };

    if (hasCoordinates) {
      const latitudeDelta = radiusKm / 111.32;
      const longitudeScale = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
      const longitudeDelta = Math.min(radiusKm / (111.32 * longitudeScale), 180);
      where.latitude = { gte: Math.max(-90, lat - latitudeDelta), lte: Math.min(90, lat + latitudeDelta) };
      where.longitude = { gte: Math.max(-180, lng - longitudeDelta), lte: Math.min(180, lng + longitudeDelta) };
    }

    const [carriers, matchingCount] = await Promise.all([
      prisma.advertisingCarrier.findMany({
        where,
        orderBy: [{ city: 'asc' }, { code: 'asc' }],
        ...(!hasCoordinates ? { take: limit } : {}),
        select: {
          id: true, code: true, name: true, city: true, street: true, address: true,
          latitude: true, longitude: true, structureCode: true,
          surfaces: {
            select: {
              id: true, name: true, status: true, artworkUrl: true, sidePosition: true, sourcePosition: true,
              currentRentStart: true, currentRentEnd: true,
              currentClient: { select: { id: true, name: true } },
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
      }),
      hasCoordinates ? Promise.resolve(null) : prisma.advertisingCarrier.count({ where }),
    ]);

    let result = carriers.map((carrier) => {
      const distanceKm = hasCoordinates && carrier.latitude != null && carrier.longitude != null
        ? calculateDistanceKm(lat, lng, carrier.latitude, carrier.longitude) : null;
      const carrierLatestPhoto = carrier.photos[0]?.url || null;
      const surfaces = carrier.surfaces.map((surface) => {
        const occupancy = surface.occupancies[0] || null;
        const safelyResolved = occupancy?.clientResolutionStatus !== 'UNRESOLVED';
        const clientName = occupancy?.client?.name || occupancy?.clientName || null;
        // The carrier detail currently allows assigning a client without changing
        // the default AVAILABLE status. Treat that explicit assignment as current
        // when its optional rental interval includes today, but never when expired.
        const detailClientIsCurrent = isSurfaceDetailClientCurrent({
          hasCurrentClient: Boolean(surface.currentClient),
          status: surface.status,
          currentRentStart: surface.currentRentStart,
          currentRentEnd: surface.currentRentEnd,
        }, now);
        const currentClient = occupancy && safelyResolved && clientName
          ? { id: occupancy.client?.id || null, name: clientName }
          : detailClientIsCurrent && surface.currentClient
            ? surface.currentClient
            : null;
        return {
          id: surface.id,
          name: surface.name,
          side: surfaceSide(surface),
          status: occupancy?.status || surface.status,
          currentClient,
          clientSource: occupancy ? 'OCCUPANCY' : currentClient ? 'SURFACE_DETAIL' : null,
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
    const total = hasCoordinates ? result.length : matchingCount ?? result.length;
    const limitedResult = result.slice(0, limit);
    return NextResponse.json({
      success: true,
      count: limitedResult.length,
      total,
      limited: total > limitedResult.length,
      carriers: limitedResult,
    });
  } catch (error) {
    console.error('[mobile-photos/nearby]', error);
    return NextResponse.json({ success: false, code: 'NEARBY_ERROR', error: 'Nosiče v okolí se nepodařilo načíst.' }, { status: 500 });
  }
}
