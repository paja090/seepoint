import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import { runWithTenantContext } from '@/lib/tenant-context';

export const runtime = 'nodejs';

/**
 * GET /api/election-removal/campaigns/[id]
 * Detail kampaně včetně všech bodů a souvisejících tras/plánů.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  const { id } = await params;

  try {
    const campaign = await runWithTenantContext(
      { organizationId: auth.organizationId, source: 'session' },
      async () => {
        return prisma.electionCampaign.findFirst({
          where: {
            id,
            organizationId: auth.organizationId,
          },
          include: {
            points: {
              orderBy: [{ layerName: 'asc' }, { label: 'asc' }],
            },
            fieldPlans: {
              select: {
                id: true,
                date: true,
                version: true,
                status: true,
                planningSummary: true,
              },
              orderBy: { date: 'asc' },
            },
          },
        });
      }
    );

    if (!campaign) {
      return NextResponse.json(
        { error: 'Kampaň nebyla nalezena.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error: unknown) {
    console.error('Chyba při načítání detailu volební kampaně:', error);
    return NextResponse.json(
      { error: 'Nepodařilo se načíst detail kampaně.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/election-removal/campaigns/[id]
 * Odstranění volební kampaně a všech jejích bodů.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  const { id } = await params;

  try {
    await runWithTenantContext(
      { organizationId: auth.organizationId, source: 'session' },
      async () => {
        const campaign = await prisma.electionCampaign.findFirst({
          where: {
            id,
            organizationId: auth.organizationId,
          },
        });

        if (!campaign) {
          throw new Error('NOT_FOUND');
        }

        // 1. Clean up photos associated with this campaign's points
        await prisma.photo.deleteMany({
          where: {
            organizationId: auth.organizationId,
            electionRemovalPoint: {
              campaignId: id,
            },
          },
        });

        // 2. Clean up field plans associated with this campaign
        await prisma.fieldPlan.deleteMany({
          where: {
            organizationId: auth.organizationId,
            electionCampaignId: id,
          },
        });

        // 3. Delete campaign (cascades to ElectionRemovalPoint)
        await prisma.electionCampaign.delete({
          where: { id },
        });
      }
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Kampaň nebyla nalezena.' },
        { status: 404 }
      );
    }

    console.error('Chyba při mazání volební kampaně:', error);
    const message =
      error instanceof Error ? error.message : 'Nepodařilo se smazat kampaň.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
