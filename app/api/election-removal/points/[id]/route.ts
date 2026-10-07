import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';

export const runtime = 'nodejs';

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
