import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
        const candidatePoints = (nav.points || []).map((p) => ({
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
          photos: [],
          createdAt: p.createdAt,
        }));

        return NextResponse.json({
          id: offer.id,
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
        });
      }

      return NextResponse.json({ error: 'Projekt průzkumu nebo nabídka nebyla nalezena.' }, { status: 404 });
    }

    let nearbyCarriers: Array<any> = [];
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
        .map((c: any) => {
          const latDiff = (c.latitude! - order.targetLatitude) * 111.32;
          const lngDiff =
            (c.longitude! - order.targetLongitude) *
            111.32 *
            Math.cos((order.targetLatitude * Math.PI) / 180);
          const distanceKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          return {
            ...c,
            distanceKm: Math.round(distanceKm * 100) / 100,
          };
        })
        .filter((c: any) => c.distanceKm <= 10.0)
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
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
  } catch (error: any) {
    console.error('Error fetching survey detail:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při načítání detailu průzkumu.' },
      { status: 500 }
    );
  }
}
