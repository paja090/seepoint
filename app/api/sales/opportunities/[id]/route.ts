import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { getOpportunityById, updateOpportunityStatus } from '@/lib/opportunities/service';
import type { OpportunityStatus } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const { id } = await params;
    const item = await getOpportunityById(id);
    if (!item) {
      return NextResponse.json({ error: 'Příležitost nebyla nalezena.' }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch (error) {
    console.error('Failed to fetch opportunity by ID', error);
    return NextResponse.json({ error: 'Příležitost se nepodařilo načíst.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const { id } = await params;
    const body = await request.json();
    const status = body.status as OpportunityStatus | undefined;
    const dismissedReason = typeof body.dismissedReason === 'string' ? body.dismissedReason : undefined;
    const assignedToUserId = typeof body.assignedToUserId === 'string' ? body.assignedToUserId : undefined;

    if (!status) {
      return NextResponse.json({ error: 'Chybí nový stav příležitosti.' }, { status: 400 });
    }

    const updated = await updateOpportunityStatus(id, status, dismissedReason, assignedToUserId);
    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Failed to update opportunity', error);
    return NextResponse.json({ error: 'Stav příležitosti se nepodařilo upravit.' }, { status: 500 });
  }
}
