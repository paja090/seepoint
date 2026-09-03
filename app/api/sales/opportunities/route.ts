import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { createOpportunity, getOpportunities, getOpportunityStats } from '@/lib/opportunities/service';
import { OpportunityValidationError, parseOpportunityCreateInput, parseOpportunityFilters } from '@/lib/opportunities/policy';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const { searchParams } = new URL(request.url);
    const filters = parseOpportunityFilters(searchParams);

    const [data, stats] = await Promise.all([
      getOpportunities(filters, user.organizationId),
      getOpportunityStats(user.organizationId),
    ]);

    return NextResponse.json({ ...data, stats });
  } catch (error) {
    if (error instanceof OpportunityValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Failed to fetch sales opportunities', error);
    return NextResponse.json({ error: 'Příležitosti se nepodařilo načíst.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireApiAccess('clients');
  if (isApiDenied(user)) return user;

  try {
    const input = parseOpportunityCreateInput(await request.json().catch(() => null));
    const result = await createOpportunity({ ...input, assignedToUserId: input.assignedToUserId || user.id }, user.organizationId);

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof OpportunityValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Failed to create sales opportunity', error);
    return NextResponse.json({ error: 'Příležitost se nepodařilo vytvořit.' }, { status: 500 });
  }
}
