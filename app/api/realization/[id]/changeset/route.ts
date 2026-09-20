import { NextResponse } from 'next/server';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import {
  applyNavigationChangeSetInTransaction,
  rejectNavigationChangeSetInTransaction,
} from '@/lib/ai-realization/navigation-sync';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('work');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const changeSets = await prisma.navigationChangeSet.findMany({
      where: {
        organizationId: auth.organizationId!,
        OR: [{ crmOrderId: id }, { navigationOrderId: id }, { offerId: id }],
      },
      include: {
        reviewedByUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ changeSets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chyba při načítání změn.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('work');
  if (isApiDenied(auth)) return auth;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: 'apply' | 'reject';
      changeSetId?: string;
    };

    const action = body.action;
    const changeSetId = body.changeSetId;

    if (!changeSetId || !action || !['apply', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Parametry changeSetId a action (apply/reject) jsou povinné.' },
        { status: 400 }
      );
    }

    const changeSet = await prisma.navigationChangeSet.findFirst({
      where: {
        id: changeSetId,
        organizationId: auth.organizationId!,
        OR: [{ crmOrderId: id }, { navigationOrderId: id }, { offerId: id }],
      },
    });

    if (!changeSet) {
      return NextResponse.json({ error: 'Změnový balíček nebyl nalezen.' }, { status: 404 });
    }

    if (action === 'apply') {
      const result = await prisma.$transaction(async (tx) => {
        return applyNavigationChangeSetInTransaction(tx, changeSetId, {
          id: auth.id,
          name: auth.name,
          email: auth.email,
        });
      });
      return NextResponse.json({ success: true, action: 'applied', result });
    } else {
      await prisma.$transaction(async (tx) => {
        return rejectNavigationChangeSetInTransaction(tx, changeSetId);
      });
      return NextResponse.json({ success: true, action: 'rejected' });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Chyba při zpracování změny.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
