import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { getOpportunityById, updateOpportunityStatus } from '@/lib/opportunities/service';
import { OpportunityValidationError, parseOpportunityStatusInput } from '@/lib/opportunities/policy';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const { id } = await params;
    const item = await getOpportunityById(id, user.organizationId);
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
    const { status, dismissedReason, assignedToUserId } = parseOpportunityStatusInput(await request.json().catch(() => null));
    const updated = await updateOpportunityStatus(id, status, user.organizationId, dismissedReason, assignedToUserId);
    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof OpportunityValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Failed to update opportunity', error);
    return NextResponse.json({ error: 'Stav příležitosti se nepodařilo upravit.' }, { status: 500 });
  }
}
