import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { candidateId } = await params;
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
      surveyStatus,
      photoIds,
    } = body;

    const existingCandidate = await prisma.navigationCandidatePoint.findUnique({
      where: { id: candidateId },
    });

    if (!existingCandidate) {
      const existingOfferPoint = await prisma.navigationPoint.findUnique({
        where: { id: candidateId },
      });

      if (existingOfferPoint) {
        const updatedPoint = await prisma.navigationPoint.update({
          where: { id: candidateId },
          data: {
            ...(label && { label: label.trim() }),
            ...(latitude && { latitude: parseFloat(latitude) }),
            ...(longitude && { longitude: parseFloat(longitude) }),
            ...(address !== undefined && { address: address?.trim() || null }),
            ...(placementType && { navigationType: placementType }),
            ...(arrowDirection && { arrowDirectionEnum: arrowDirection }),
            ...(internalNote !== undefined && { internalNote: internalNote?.trim() || null }),
          },
        });

        if (Array.isArray(photoIds) && photoIds.length > 0) {
          await prisma.photo.updateMany({
            where: { id: { in: photoIds } },
            data: {
              surveyCandidatePointId: updatedPoint.id,
              type: 'SURVEY',
            },
          });
          const firstPhoto = await prisma.photo.findFirst({ where: { id: { in: photoIds } } });
          if (firstPhoto) {
            await prisma.navigationPoint.update({
              where: { id: updatedPoint.id },
              data: { sitePhotoId: firstPhoto.id },
            });
          }
        }

        return NextResponse.json({
          candidate: {
            id: updatedPoint.id,
            label: updatedPoint.label,
            latitude: updatedPoint.latitude,
            longitude: updatedPoint.longitude,
            address: updatedPoint.address,
            placementType: updatedPoint.navigationType,
            supervisionStatus: 'APPROVED',
            createdAt: updatedPoint.createdAt,
          },
        });
      }

      return NextResponse.json({ error: 'Kandidátní místo ani navigační bod nebyly nalezeny.' }, { status: 404 });
    }

    const updated = await prisma.navigationCandidatePoint.update({
      where: { id: candidateId },
      data: {
        ...(surveyRouteId !== undefined && { surveyRouteId }),
        ...(label && { label: label.trim() }),
        ...(latitude && { latitude: parseFloat(latitude) }),
        ...(longitude && { longitude: parseFloat(longitude) }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(campaignType && { campaignType }),
        ...(placementType && { placementType }),
        ...(approachDirection !== undefined && { approachDirection: approachDirection?.trim() || null }),
        ...(arrowDirection && { arrowDirection }),
        ...(distanceValue !== undefined && { distanceValue: distanceValue ? parseFloat(distanceValue) : null }),
        ...(distanceUnit && { distanceUnit }),
        ...(ownershipType && { ownershipType }),
        ...(ownerName !== undefined && { ownerName: ownerName?.trim() || null }),
        ...(visibilityTowardTarget && { visibilityTowardTarget }),
        ...(permitStatus && { permitStatus }),
        ...(internalNote !== undefined && { internalNote: internalNote?.trim() || null }),
        ...(carrierId !== undefined && { carrierId }),
        ...(surfaceId !== undefined && { surfaceId }),
        ...(surveyStatus && { surveyStatus }),
      },
    });

    if (Array.isArray(photoIds) && photoIds.length > 0) {
      await prisma.photo.updateMany({
        where: { id: { in: photoIds } },
        data: {
          surveyCandidatePointId: updated.id,
          type: 'SURVEY',
        },
      });
    }

    return NextResponse.json({ candidate: updated });
  } catch (error: any) {
    console.error('Error updating candidate point:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při úpravě kandidátního místa.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { candidateId } = await params;

    await prisma.navigationCandidatePoint.delete({
      where: { id: candidateId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting candidate point:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při mazání kandidátního místa.' },
      { status: 500 }
    );
  }
}
