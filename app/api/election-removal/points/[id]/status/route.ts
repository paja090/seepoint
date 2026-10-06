import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';

export const runtime = 'nodejs';

/**
 * PATCH /api/election-removal/points/[id]/status
 * Aktualizace stavu realizace demontáže konkrétního bodu / média.
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
    const action = body.action as 'START' | 'COMPLETE' | 'REPORT_ISSUE' | 'RESET';

    if (!['START', 'COMPLETE', 'REPORT_ISSUE', 'RESET'].includes(action)) {
      return NextResponse.json(
        {
          error:
            'Neplatná akce. Povolené akce: START, COMPLETE, REPORT_ISSUE, RESET.',
        },
        { status: 400 }
      );
    }

    const updatedPoint = await prisma.$transaction(async (tx) => {
      const point = await tx.electionRemovalPoint.findFirst({
        where: { id, organizationId: auth.organizationId },
        include: { campaign: true },
      });

      if (!point) {
        throw new Error('Bod demontáže nebyl nalezen.');
      }

      const now = new Date();
      const wasCompleted = point.status === 'COMPLETED';

      let newStatus = point.status;
      let updateData: any = {};

      if (action === 'START') {
        newStatus = 'IN_PROGRESS';
        updateData = {
          status: newStatus,
          startedAt: point.startedAt ?? now,
        };
      } else if (action === 'COMPLETE') {
        newStatus = 'COMPLETED';
        updateData = {
          status: newStatus,
          completedAt: now,
          completedByUserId: auth.user.id,
          issueType: null,
          issueNote: null,
        };

        if (!wasCompleted) {
          await tx.electionCampaign.update({
            where: {
              id: point.campaignId,
              organizationId: auth.organizationId,
            },
            data: {
              completedPoints: { increment: 1 },
            },
          });
        }
      } else if (action === 'REPORT_ISSUE') {
        newStatus = 'ISSUE';
        updateData = {
          status: newStatus,
          issueType: body.issueType || 'OTHER',
          issueNote: body.issueNote?.trim() || null,
          issueReportedAt: now,
          issueReportedByUserId: auth.user.id,
        };

        if (wasCompleted) {
          await tx.electionCampaign.update({
            where: {
              id: point.campaignId,
              organizationId: auth.organizationId,
            },
            data: {
              completedPoints: { decrement: 1 },
            },
          });
        }
      } else if (action === 'RESET') {
        newStatus = point.assignedFieldPlanId ? 'ASSIGNED' : 'PENDING';
        updateData = {
          status: newStatus,
          completedAt: null,
          completedByUserId: null,
          issueType: null,
          issueNote: null,
        };

        if (wasCompleted) {
          await tx.electionCampaign.update({
            where: {
              id: point.campaignId,
              organizationId: auth.organizationId,
            },
            data: {
              completedPoints: { decrement: 1 },
            },
          });
        }
      }

      return await tx.electionRemovalPoint.update({
        where: { id: point.id, organizationId: auth.organizationId },
        data: updateData,
      });
    });

    return NextResponse.json({ success: true, point: updatedPoint });
  } catch (error: any) {
    console.error('Chyba při aktualizaci stavu bodu:', error);
    return NextResponse.json(
      { error: error?.message || 'Chyba při změně stavu bodu.' },
      { status: 500 }
    );
  }
}
