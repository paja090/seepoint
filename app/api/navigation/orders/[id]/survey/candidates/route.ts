import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
      photoIds, // optional array of newly uploaded photo IDs to link
      surveyStatus = 'COMPLETED',
    } = body;

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'GPS souřadnice (lat/lng) jsou povinné.' }, { status: 400 });
    }

    const order = await prisma.navigationOrder.findUnique({
      where: { id: navigationOrderId },
    });

    if (!order) {
      return NextResponse.json({ error: 'Zakázka nebyla nalezena.' }, { status: 404 });
    }

    // Auto-calculate direct distance in km to target if distance not provided
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

    // Link uploaded photos if photoIds provided
    if (Array.isArray(photoIds) && photoIds.length > 0) {
      await prisma.photo.updateMany({
        where: { id: { in: photoIds } },
        data: {
          surveyCandidatePointId: candidate.id,
          type: 'SURVEY',
        },
      });
    }

    return NextResponse.json({ candidate });
  } catch (error: any) {
    console.error('Error creating survey candidate point:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při vytváření kandidátního místa.' },
      { status: 500 }
    );
  }
}
