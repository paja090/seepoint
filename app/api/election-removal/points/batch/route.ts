import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import {
  setPointOperationTypeInDescription,
} from '@/lib/election-removal/kml-parser';
import {
  calculateServiceMinutes,
  type ElectionRemovalOperationType,
} from '@/lib/election-removal/constants';

export const runtime = 'nodejs';

/**
 * POST /api/election-removal/points/batch
 * Hromadná změna typu operace pro vybrané body kampaně.
 */
export async function POST(req: Request) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  try {
    const body = await req.json();
    const { pointIds, operationType, relocationDestination } = body as {
      pointIds?: string[];
      operationType?: ElectionRemovalOperationType;
      relocationDestination?: string | null;
    };

    if (!Array.isArray(pointIds) || pointIds.length === 0) {
      return NextResponse.json(
        { error: 'Musí být předán alespoň jeden identifikátor bodu.' },
        { status: 400 }
      );
    }

    if (!operationType) {
      return NextResponse.json(
        { error: 'Typ operace je povinný (FULL_REMOVAL, RELOCATION, BANNER_CHANGE).' },
        { status: 400 }
      );
    }

    const points = await prisma.electionRemovalPoint.findMany({
      where: {
        id: { in: pointIds },
        organizationId: auth.organizationId,
      },
    });

    if (points.length === 0) {
      return NextResponse.json(
        { error: 'Nebyly nalezeny žádné odpovídající body k úpravě.' },
        { status: 404 }
      );
    }

    const updatedPoints = await prisma.$transaction(
      points.map((pt) => {
        const updatedDescription = setPointOperationTypeInDescription(
          pt.description,
          operationType,
          relocationDestination
        );

        const calculated = calculateServiceMinutes(
          pt.mediaType,
          pt.quantity,
          null,
          operationType
        );

        return prisma.electionRemovalPoint.update({
          where: { id: pt.id },
          data: {
            description: updatedDescription || null,
            serviceMinutes: calculated.totalMinutes,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      updatedCount: updatedPoints.length,
      points: updatedPoints,
    });
  } catch (error: unknown) {
    console.error('Chyba při hromadné aktualizaci bodů:', error);
    const message =
      error instanceof Error ? error.message : 'Nepodařilo se hromadně aktualizovat body.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
