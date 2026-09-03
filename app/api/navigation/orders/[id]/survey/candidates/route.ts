import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { id: navigationOrderId } = await params;
    const body = await request.json();

    const {
      surveyRouteId,
      label,
      latitude,
      longitude,
      address,
      campaignType,
      placementType,
      approachDirection,
      arrowDirection,
      distanceValue,
      distanceUnit,
      ownershipType,
      ownerName,
      visibilityTowardTarget,
      permitStatus,
      internalNote,
      carrierId,
      surfaceId,
      photoIds,
      surveyStatus = 'COMPLETED',
    } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'GPS souřadnice (lat/lng) jsou povinné.' }, { status: 400 });
    }

    const order = await prisma.navigationOrder.findUnique({
      where: { id: navigationOrderId },
    });

    if (!order) {
      const offer = await prisma.offer.findUnique({
        where: { id: navigationOrderId },
        include: { navigationOffer: { include: { points: true } } },
      });

      if (offer && offer.navigationOffer) {
        const nav = offer.navigationOffer;
        const nextSortOrder = (nav.points?.length || 0) + 1;
        const newPoint = await prisma.navigationPoint.create({
          data: {
            navigationOfferId: nav.id,
            label: label?.trim() || `Navigační bod ${nextSortOrder}`,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            address: address?.trim() || null,
            navigationType: placementType || 'Směrová tabule',
            variant: '120x80 cm',
            orientation: 'Obousměrný (A/B)',
            arrowDirectionEnum: arrowDirection || 'STRAIGHT',
            quantity: 1,
            unitPrice: 1500,
            productionPrice: 1200,
            installationPrice: 800,
            removalPrice: 400,
            sortOrder: nextSortOrder,
            internalNote: internalNote?.trim() || null,
          },
        });

        if (Array.isArray(photoIds) && photoIds.length > 0) {
          await prisma.photo.updateMany({
            where: { id: { in: photoIds } },
            data: {
              surveyCandidatePointId: newPoint.id,
              type: 'SURVEY',
            },
          });
          const firstPhoto = await prisma.photo.findFirst({ where: { id: { in: photoIds } } });
          if (firstPhoto) {
            await prisma.navigationPoint.update({
              where: { id: newPoint.id },
              data: { sitePhotoId: firstPhoto.id },
            });
          }
        }

        return NextResponse.json({
          candidate: {
            id: newPoint.id,
            label: newPoint.label,
            latitude: newPoint.latitude,
            longitude: newPoint.longitude,
            address: newPoint.address,
            placementType: newPoint.navigationType,
            supervisionStatus: 'APPROVED',
            createdAt: newPoint.createdAt,
          },
        });
      }

      return NextResponse.json({ error: 'Zakázka ani nabídka nebyla nalezena.' }, { status: 404 });
    }

    let calculatedDistance = distanceValue ? parseFloat(distanceValue) : null;
    if (!calculatedDistance && order.targetLatitude && order.targetLongitude) {
      const latDiff = (parseFloat(latitude) - order.targetLatitude) * 111.32;
      const lngDiff =
        (parseFloat(longitude) - order.targetLongitude) *
        111.32 *
        Math.cos((order.targetLatitude * Math.PI) / 180);
      calculatedDistance = Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 10) / 10;
    }

    const candidate = await prisma.navigationCandidatePoint.create({
      data: {
        navigationOrderId,
        surveyRouteId: surveyRouteId || null,
        label: label?.trim() || `Kandidátní místo (${parseFloat(latitude).toFixed(4)}, ${parseFloat(longitude).toFixed(4)})`,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address?.trim() || null,
        campaignType: campaignType || 'Dlouhodobá navigace',
        placementType: placementType || 'NAVIGATION',
        approachDirection: approachDirection?.trim() || null,
        arrowDirection: arrowDirection || 'STRAIGHT',
        distanceValue: calculatedDistance,
        distanceUnit: distanceUnit || 'KILOMETERS',
        distanceSource: distanceValue ? 'MANUAL' : 'CALCULATED',
        ownershipType: ownershipType || 'UNKNOWN',
        ownerName: ownerName?.trim() || null,
        visibilityTowardTarget: visibilityTowardTarget || 'GOOD',
        permitStatus: permitStatus || 'UNKNOWN',
        internalNote: internalNote?.trim() || null,
        createdByUserId: currentUser.id,
        surveyStatus: surveyStatus || 'COMPLETED',
        supervisionStatus: 'PENDING_REVIEW',
        carrierId: carrierId || null,
        surfaceId: surfaceId || null,
      },
    });

    if (Array.isArray(photoIds) && photoIds.length > 0) {
      await prisma.photo.updateMany({
        where: { id: { in: photoIds } },
        data: {
          surveyCandidatePointId: candidate.id,
          ...(candidate.carrierId ? { carrierId: candidate.carrierId } : {}),
          type: 'SURVEY',
        },
      });
    }

    return NextResponse.json({ candidate });
  } catch (error: unknown) {
    console.error('Error creating survey candidate point:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chyba při vytváření kandidátního místa.' },
      { status: 500 }
    );
  }
}
