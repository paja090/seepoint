import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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

    const { candidateId } = await params;
    const body = await request.json();

    const { action, supervisionNote, rejectionReason } = body;

    if (!['APPROVE', 'NEEDS_RECHECK', 'REJECT'].includes(action)) {
      return NextResponse.json(
        { error: 'Neplatná akce supervize. Povolené: APPROVE, NEEDS_RECHECK, REJECT.' },
        { status: 400 }
      );
    }

    if ((action === 'NEEDS_RECHECK' || action === 'REJECT') && (!supervisionNote && !rejectionReason)) {
      return NextResponse.json(
        { error: 'Při vrácení k prověření nebo zamítnutí je vyžadována poznámka nebo důvod.' },
        { status: 400 }
      );
    }

    const supervisionStatus =
      action === 'APPROVE'
        ? 'APPROVED'
        : action === 'NEEDS_RECHECK'
        ? 'NEEDS_RECHECK'
        : 'REJECTED';

    const candidate = await prisma.navigationCandidatePoint.update({
      where: { id: candidateId },
      data: {
        supervisionStatus,
        supervisionNote: supervisionNote?.trim() || null,
        rejectionReason: rejectionReason?.trim() || supervisionNote?.trim() || null,
        supervisionByUserId: currentUser.id,
        supervisionAt: new Date(),
        selectedForOffer: action === 'APPROVE',
      },
    });

    return NextResponse.json({ candidate });
  } catch (error: any) {
    console.error('Error supervising candidate point:', error);
    return NextResponse.json(
      { error: error.message || 'Chyba při provádění supervize.' },
      { status: 500 }
    );
  }
}
