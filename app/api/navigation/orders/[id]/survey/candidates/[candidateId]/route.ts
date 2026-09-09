import type { Prisma } from '@prisma/client';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deleteStoredPhoto } from '@/lib/storage/photo-storage';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  let photoIdsToClean: string[] = [];
  try {
    const currentUser = await requireApiAccess('navigationProjects');
  if (isApiDenied(currentUser)) return currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { candidateId } = await params;
    const body = await request.json();
    if (Array.isArray(body?.photoIds)) {
      photoIdsToClean = body.photoIds;
    }

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
      pillarNumber,
      pillarType,
      carrierId,
      surfaceId,
      surveyStatus,
      photoIds,
    } = body;

    const existingCandidate = await prisma.navigationCandidatePoint.findUnique({
      where: { id: candidateId },
      include: {
        navigationOrder: {
          include: {
            crmOrder: {
              include: {
                offer: {
                  include: {
                    navigationOffer: {
                      include: {
                        points: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!existingCandidate) {
      const existingOfferPoint = await prisma.navigationPoint.findUnique({
        where: { id: candidateId },
        include: {
          navigationOffer: {
            include: {
              offer: {
                include: {
                  crmOrder: {
                    include: {
                      navigationOrder: {
                        include: {
                          points: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          navigationOrder: {
            include: {
              crmOrder: {
                include: {
                  offer: {
                    include: {
                      navigationOffer: {
                        include: {
                          points: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (existingOfferPoint) {
        const pointUpdateData: Prisma.NavigationPointUncheckedUpdateInput = {
          ...(label && { label: label.trim() }),
          ...(latitude && { latitude: parseFloat(latitude) }),
          ...(longitude && { longitude: parseFloat(longitude) }),
          ...(address !== undefined && { address: address?.trim() || null }),
          ...(placementType && { navigationType: placementType }),
          ...(arrowDirection && {
            arrowDirectionEnum: arrowDirection,
            arrowDirection: arrowDirection,
          }),
          ...(approachDirection !== undefined && {
            orientation: approachDirection?.trim() || null,
            signOrientation: approachDirection?.trim() || null,
          }),
          ...(pillarNumber !== undefined && { pillarNumber: pillarNumber?.trim() || null }),
          ...(pillarType !== undefined && { pillarType: pillarType?.trim() || null }),
          ...(internalNote !== undefined && { internalNote: internalNote?.trim() || null }),
        };

        const updatedPoint = await prisma.navigationPoint.update({
          where: { id: candidateId },
          data: pointUpdateData,
        });

        if (Array.isArray(photoIds) && photoIds.length > 0) {
          await prisma.photo.updateMany({
            where: { id: { in: photoIds } },
            data: {
              surveyNavigationPointId: updatedPoint.id,
              type: 'SURVEY',
            },
          });
          const firstPhoto = await prisma.photo.findFirst({ where: { id: { in: photoIds } } });
          if (firstPhoto) {
            const isOwnedByOther = await prisma.navigationPoint.findFirst({
              where: { sitePhotoId: firstPhoto.id, id: { not: updatedPoint.id } },
              select: { id: true },
            });
            if (!isOwnedByOther) {
              await prisma.navigationPoint.update({
                where: { id: updatedPoint.id },
                data: { sitePhotoId: firstPhoto.id },
              });
            }
          }
        }

        // Bidirectional sync: if this was an offer point, sync to linked order point if any
        if (existingOfferPoint.navigationOffer?.offer?.crmOrder?.navigationOrder) {
          const linkedNavOrder = existingOfferPoint.navigationOffer.offer.crmOrder.navigationOrder;
          const matchingOrderPoint = linkedNavOrder.points.find(
            (p) => p.sortOrder === existingOfferPoint.sortOrder || p.label === existingOfferPoint.label
          );
          if (matchingOrderPoint) {
            await prisma.navigationPoint.update({
              where: { id: matchingOrderPoint.id },
              data: {
                ...pointUpdateData,
              },
            });
          }
        }

        // Bidirectional sync: if this was an order point, sync back to original offer point!
        if (existingOfferPoint.navigationOrder?.crmOrder?.offer?.navigationOffer) {
          const linkedNavOffer = existingOfferPoint.navigationOrder.crmOrder.offer.navigationOffer;
          const matchingOfferPoint = linkedNavOffer.points.find(
            (p) => p.sortOrder === existingOfferPoint.sortOrder || p.label === existingOfferPoint.label
          );
          if (matchingOfferPoint) {
            await prisma.navigationPoint.update({
              where: { id: matchingOfferPoint.id },
              data: {
                ...pointUpdateData,
              },
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
            arrowDirection: updatedPoint.arrowDirectionEnum || updatedPoint.arrowDirection,
            pillarNumber: updatedPoint.pillarNumber,
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

    let uploadedFirstPhotoId: string | null = null;
    if (Array.isArray(photoIds) && photoIds.length > 0) {
      await prisma.photo.updateMany({
        where: { id: { in: photoIds } },
        data: {
          surveyCandidatePointId: updated.id,
          ...(updated.carrierId ? { carrierId: updated.carrierId } : {}),
          type: 'SURVEY',
        },
      });
      const firstPhoto = await prisma.photo.findFirst({ where: { id: { in: photoIds } } });
      if (firstPhoto) uploadedFirstPhotoId = firstPhoto.id;
    }

    // Sync candidate point changes to converted NavigationPoint if already converted
    if (existingCandidate.convertedNavigationPointId) {
      let canSetConvertedSitePhoto = false;
      if (uploadedFirstPhotoId) {
        const isOwnedByOther = await prisma.navigationPoint.findFirst({
          where: { sitePhotoId: uploadedFirstPhotoId, id: { not: existingCandidate.convertedNavigationPointId } },
          select: { id: true },
        });
        canSetConvertedSitePhoto = !isOwnedByOther;
      }

      await prisma.navigationPoint.update({
        where: { id: existingCandidate.convertedNavigationPointId },
        data: {
          ...(label && { label: label.trim() }),
          ...(latitude && { latitude: parseFloat(latitude) }),
          ...(longitude && { longitude: parseFloat(longitude) }),
          ...(address !== undefined && { address: address?.trim() || null }),
          ...(arrowDirection && {
            arrowDirectionEnum: arrowDirection,
            arrowDirection: arrowDirection,
          }),
          ...(approachDirection !== undefined && {
            orientation: approachDirection?.trim() || null,
            signOrientation: approachDirection?.trim() || null,
          }),
          ...(pillarNumber !== undefined && { pillarNumber: pillarNumber?.trim() || null }),
          ...(internalNote !== undefined && { internalNote: internalNote?.trim() || null }),
          ...(canSetConvertedSitePhoto && uploadedFirstPhotoId && { sitePhotoId: uploadedFirstPhotoId }),
        },
      });
    }

    // Also sync to offer's NavigationPoint if this candidate's navigationOrder originated from an offer
    const offerPoints = existingCandidate.navigationOrder?.crmOrder?.offer?.navigationOffer?.points;
    if (offerPoints && offerPoints.length > 0) {
      const matchingOfferPoint = offerPoints.find(
        (p) =>
          p.id === existingCandidate.convertedNavigationPointId ||
          p.label.toLowerCase() === (existingCandidate.label || '').toLowerCase()
      );
      if (matchingOfferPoint) {
        let canSetOfferSitePhoto = false;
        if (uploadedFirstPhotoId) {
          const isOwnedByOther = await prisma.navigationPoint.findFirst({
            where: { sitePhotoId: uploadedFirstPhotoId, id: { not: matchingOfferPoint.id } },
            select: { id: true },
          });
          canSetOfferSitePhoto = !isOwnedByOther;
        }

        await prisma.navigationPoint.update({
          where: { id: matchingOfferPoint.id },
          data: {
            ...(label && { label: label.trim() }),
            ...(latitude && { latitude: parseFloat(latitude) }),
            ...(longitude && { longitude: parseFloat(longitude) }),
            ...(address !== undefined && { address: address?.trim() || null }),
            ...(arrowDirection && {
              arrowDirectionEnum: arrowDirection,
              arrowDirection: arrowDirection,
            }),
            ...(approachDirection !== undefined && {
              orientation: approachDirection?.trim() || null,
              signOrientation: approachDirection?.trim() || null,
            }),
            ...(pillarNumber !== undefined && { pillarNumber: pillarNumber?.trim() || null }),
            ...(internalNote !== undefined && { internalNote: internalNote?.trim() || null }),
            ...(canSetOfferSitePhoto && uploadedFirstPhotoId && { sitePhotoId: uploadedFirstPhotoId }),
          },
        });
      }
    }

    return NextResponse.json({ candidate: updated });
  } catch (error: unknown) {
    console.error('Error updating candidate point:', error);
    try {
      if (Array.isArray(photoIdsToClean) && photoIdsToClean.length > 0) {
        for (const pid of photoIdsToClean) {
          const ph = await prisma.photo.findUnique({ where: { id: pid } });
          if (ph && !ph.surveyCandidatePointId && !ph.surveyNavigationPointId && !ph.carrierId && !ph.surfaceId && !ph.taskId) {
            await prisma.photo.delete({ where: { id: pid } }).catch(() => {});
            await deleteStoredPhoto(ph).catch(() => {});
          }
        }
      }
    } catch (cleanupErr) {
      console.error('Error during photo rollback:', cleanupErr);
    }
    return NextResponse.json(
      { success: false, code: 'SURVEY_POINT_SAVE_FAILED', error: 'Místo se nepodařilo uložit. Zkuste akci zopakovat.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  try {
    const currentUser = await requireApiAccess('navigationProjects');
  if (isApiDenied(currentUser)) return currentUser;
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { candidateId } = await params;

    await prisma.navigationCandidatePoint.delete({
      where: { id: candidateId },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error deleting candidate point:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chyba při mazání kandidátního místa.' },
      { status: 500 }
    );
  }
}
