import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.navigationOrder.findUnique({
      where: { id },
      include: {
        crmOrder: {
          include: {
            client: true,
          },
        },
        installerUser: {
          select: { id: true, name: true, email: true },
        },
        surveyRoutes: {
          orderBy: { routeOrder: 'asc' },
        },
        candidatePoints: {
          include: {
            surveyRoute: true,
            createdByUser: { select: { id: true, name: true, email: true } },
            supervisionByUser: { select: { id: true, name: true, email: true } },
            carrier: {
              select: {
                id: true,
                code: true,
                name: true,
                city: true,
                street: true,
                latitude: true,
                longitude: true,
              },
            },
            surface: {
              select: {
                id: true,
                name: true,
                status: true,
                sidePosition: true,
              },
            },
            photos: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                url: true,
                driveFileId: true,
                fileName: true,
                storageProvider: true,
                type: true,
                capturedLatitude: true,
                capturedLongitude: true,
                capturedAccuracyMeters: true,
                capturedByWorkerName: true,
                createdAt: true,
              },
            },
            convertedNavigationPoint: {
              select: { id: true, label: true, status: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      const offer = await prisma.offer.findUnique({
        where: { id },
        include: {
          client: true,
          navigationOffer: {
            include: {
              points: true,
            },
          },
        },
      });

      if (offer && offer.navigationOffer) {
        const nav = offer.navigationOffer;
        const offerPoints = await prisma.navigationPoint.findMany({
          where: { navigationOfferId: nav.id },
          include: { sitePhoto: true },
        });

        const pointIds = offerPoints.map((p) => p.id);
        const photosInDb = pointIds.length > 0
          ? await prisma.photo.findMany({
              where: { surveyCandidatePointId: { in: pointIds } },
              orderBy: { createdAt: 'desc' },
              select: { id: true, url: true, surveyCandidatePointId: true, createdAt: true },
            })
          : [];

        const candidatePoints = offerPoints.map((p) => {
          const matchedPhotos: Array<{ id: string; url: string; createdAt: string | Date }> = photosInDb
            .filter((ph) => ph.surveyCandidatePointId === p.id)
            .map((ph) => ({
              id: ph.id,
              url: ph.url || `/api/photos/${ph.id}/file`,
              createdAt: ph.createdAt,
            }));

          if (p.sitePhoto?.id && !matchedPhotos.some((ph) => ph.id === p.sitePhoto!.id)) {
            matchedPhotos.unshift({
              id: p.sitePhoto.id,
              url: p.sitePhoto.url || `/api/photos/${p.sitePhoto.id}/file`,
              createdAt: p.createdAt,
            });
          }

          return {
            id: p.id,
            label: p.label,
            latitude: p.latitude,
            longitude: p.longitude,
            address: p.address,
            placementType: p.navigationType || 'Směrová tabule',
            ownershipType: 'SEEPOINT',
            visibilityTowardTarget: 'GOOD',
            permitStatus: 'GRANTED',
            surveyStatus: 'COMPLETED',
            supervisionStatus: 'APPROVED',
            photos: matchedPhotos,
            sitePhotoUrl: p.sitePhoto?.url || matchedPhotos[0]?.url || null,
            createdAt: p.createdAt,
          };
        });

        return NextResponse.json({
          survey: {
            id: offer.id,
            crmOrderId: offer.id,
            client: offer.client,
            targetName: nav.targetName || offer.title,
            targetAddress: nav.targetAddress || null,
            targetLatitude: nav.targetLatitude,
            targetLongitude: nav.targetLongitude,
            targetNote: nav.targetNote || null,
            status: offer.status,
            crmOrder: {
              client: offer.client,
            },
            surveyRoutes: [],
            candidatePoints,
            nearbyCarriers: [],
          },
        });
      }

      return NextResponse.json({ error: 'Projekt průzkumu nebo nabídka nebyla nalezena.' }, { status: 404 });
    }

    type NearbyCarrier = Prisma.AdvertisingCarrierGetPayload<{
      include: { surfaces: { include: { occupancies: true } } };
    }> & { distanceKm: number };
    let nearbyCarriers: NearbyCarrier[] = [];
    if (order.targetLatitude && order.targetLongitude) {
      const allCarriers = await prisma.advertisingCarrier.findMany({
        where: {
          latitude: { not: null },
          longitude: { not: null },
          status: 'ACTIVE',
        },
        include: {
          surfaces: {
            include: {
              occupancies: {
                where: {
                  status: { in: ['RESERVED', 'OCCUPIED', 'NEGOTIATION'] },
                },
              },
            },
          },
        },
        take: 300,
      });

      nearbyCarriers = allCarriers
        .map((carrier) => {
          const latDiff = (carrier.latitude! - order.targetLatitude) * 111.32;
          const lngDiff =
            (carrier.longitude! - order.targetLongitude) *
            111.32 *
            Math.cos((order.targetLatitude * Math.PI) / 180);
          const distanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          return {
            ...carrier,
            distanceKm: Math.round(distanceKm * 100) / 100,
          };
        })
        .filter((carrier) => carrier.distanceKm <= 10.0)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 50);
    }

    return NextResponse.json({
      survey: {
        id: order.id,
        crmOrderId: order.crmOrderId,
        client: order.crmOrder?.client,
        targetName: order.targetName,
        targetAddress: order.targetAddress,
        targetLatitude: order.targetLatitude,
        targetLongitude: order.targetLongitude,
        targetNote: order.targetNote,
        rentStart: order.rentStart,
        rentEnd: order.rentEnd,
        status: order.status,
        blockStatus: order.blockStatus,
        surveyRoutes: order.surveyRoutes,
        candidatePoints: order.candidatePoints,
        nearbyCarriers,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching survey detail:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chyba při načítání detailu průzkumu.' },
      { status: 500 }
    );
  }
}
