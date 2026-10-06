import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';

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
    const campaign = await prisma.electionCampaign.findFirst({
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

    if (!campaign) {
      return NextResponse.json(
        { error: 'Kampaň nebyla nalezena.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
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
    const campaign = await prisma.electionCampaign.findFirst({
      where: {
        id,
        organizationId: auth.organizationId,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: 'Kampaň nebyla nalezena.' },
        { status: 404 }
      );
    }

    await prisma.electionCampaign.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Chyba při mazání volební kampaně:', error);
    return NextResponse.json(
      { error: error?.message || 'Nepodařilo se smazat kampaň.' },
      { status: 500 }
    );
  }
}
