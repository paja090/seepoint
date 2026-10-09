import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import {
  setPointOperationTypeInDescription,
  detectOperationTypeFromText,
} from '@/lib/election-removal/kml-parser';
import {
  calculateServiceMinutes,
  type ElectionRemovalOperationType,
} from '@/lib/election-removal/constants';

export const runtime = 'nodejs';

/**
 * PATCH /api/election-removal/points/[id]
 * Úprava bodu demontáže – zejména změna typu operace (Odvoz na sklad vs. Přímý převoz vs. Pouze plachta).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  const { id } = await params;

  try {
    const body = await req.json();
    const { operationType, relocationDestination, serviceMinutes } = body as {
      operationType?: ElectionRemovalOperationType;
      relocationDestination?: string | null;
      serviceMinutes?: number;
    };

    const point = await prisma.electionRemovalPoint.findFirst({
      where: { id, organizationId: auth.organizationId },
    });

    if (!point) {
      return NextResponse.json({ error: 'Bod demontáže nebyl nalezen.' }, { status: 404 });
    }

    let updatedDescription = point.description || '';
    let newServiceMinutes = point.serviceMinutes;

    if (operationType) {
      updatedDescription = setPointOperationTypeInDescription(
        point.description,
        operationType,
        relocationDestination
      );

      const calculated = calculateServiceMinutes(
        point.mediaType,
        point.quantity,
        null,
        operationType
      );
      newServiceMinutes = calculated.totalMinutes;
    }

    if (typeof serviceMinutes === 'number' && serviceMinutes > 0) {
      newServiceMinutes = Math.round(serviceMinutes);
    }

    const updatedPoint = await prisma.electionRemovalPoint.update({
      where: { id },
      data: {
        description: updatedDescription || null,
        serviceMinutes: newServiceMinutes,
      },
    });

    return NextResponse.json({
      success: true,
      point: updatedPoint,
      operationType: detectOperationTypeFromText(updatedPoint.description),
    });
  } catch (error: unknown) {
    console.error('Chyba při aktualizaci bodu:', error);
    const message =
      error instanceof Error ? error.message : 'Nepodařilo se aktualizovat bod demontáže.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/election-removal/points/[id]
 * Smazání konkrétního bodu demontáže z volební kampaně (např. při chybné duplicitě v mapě).
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  const { id } = await params;

  try {
    await prisma.$transaction(async (tx) => {
      const point = await tx.electionRemovalPoint.findFirst({
        where: { id, organizationId: auth.organizationId },
      });

      if (!point) {
        throw new Error('Bod demontáže nebyl nalezen.');
      }

      await tx.electionRemovalPoint.delete({
        where: { id },
      });

      // Recalculate campaign counters
      const remainingCount = await tx.electionRemovalPoint.count({
        where: { campaignId: point.campaignId, organizationId: auth.organizationId },
      });
      const completedCount = await tx.electionRemovalPoint.count({
        where: {
          campaignId: point.campaignId,
          organizationId: auth.organizationId,
          status: 'COMPLETED',
        },
      });

      await tx.electionCampaign.update({
        where: { id: point.campaignId },
        data: {
          totalPoints: remainingCount,
          completedPoints: completedCount,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Chyba při mazání bodu:', error);
    const message =
      error instanceof Error ? error.message : 'Nepodařilo se smazat bod demontáže.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
