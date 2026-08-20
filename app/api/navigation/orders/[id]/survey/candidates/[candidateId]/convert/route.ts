import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Neautorizovaný přístup.' }, { status: 401 });
    }

    const { id: navigationOrderId, candidateId } = await params;

    const candidate = await prisma.navigationCandidatePoint.findUnique({
      where: { id: candidateId },
      include: {
        convertedNavigationPoint: true,
        photos: true,
      },
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Kandidátní místo nebylo nalezeno.' }, { status: 404 });
    }

    if (candidate.convertedNavigationPointId || candidate.convertedNavigationPoint) {
      return NextResponse.json(
        {
          error: 'Tento kandidát již byl dříve převeden do nabídky.',
          navigationPointId: candidate.convertedNavigationPointId,
        },
        { status: 400 }
      );
    }

    if (candidate.supervisionStatus !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Převést do nabídky lze pouze schválené kandidátní místo (APPROVED).' },
        { status: 400 }
      );
    }

    // Transactional conversion
    const result = await prisma.$transaction(async (tx) => {
      // Pick first photo as sitePhoto if available
      const sitePhoto = candidate.photos[0];

      const navPoint = await tx.navigationPoint.create({
        data: {
          navigationOrderId,
          carrierId: candidate.carrierId || null,
          surfaceId: candidate.surfaceId || null,
          sitePhotoId: sitePhoto?.id || null,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          address: candidate.address || null,
          label: candidate.label,
          navigationType: candidate.placementType || 'NAVIGATION',
          arrowDirectionEnum: candidate.arrowDirection || 'STRAIGHT',
          distanceValue: candidate.distanceValue || null,
          distanceUnit: candidate.distanceUnit === 'METERS' ? 'm' : 'km',
          distanceSource: candidate.distanceSource || 'CALCULATED',
          internalNote: candidate.internalNote
            ? `[Z Průzkumu] ${candidate.internalNote}`
            : '[Převedeno z mobilního průzkumu lokalit]',
          status: 'APPROVED',
          isSelectedByClient: true,
        },
      });

      const updatedCandidate = await tx.navigationCandidatePoint.update({
        where: { id: candidateId },
        data: {
          convertedNavigationPointId: navPoint.id,
          selectedForOffer: true,
        },
      });

      return { navPoint, candidate: updatedCandidate };
    });

    return NextResponse.json({
      success: true,
      navigationPoint: result.navPoint,
      candidate: result.candidate,
    });
  } catch (error: any) {
    console.error('Error converting candidate point to NavigationPoint:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při převodu kandidáta do nabídky.' },
      { status: 500 }
    );
  }
}
