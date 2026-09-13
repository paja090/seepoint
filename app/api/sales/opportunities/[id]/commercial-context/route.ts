import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import {
  buildCommercialOpportunityContextFromRadar,
  buildCommercialRequestFromRadar,
} from '@/lib/ai-commercial/adapters/radar-adapter';
import { determineCommercialNextBestActions } from '@/lib/ai-commercial/next-best-action';
import { updateOpportunityStatus } from '@/lib/opportunities/service';
import { OpportunityValidationError, parseOpportunityStatusInput } from '@/lib/opportunities/policy';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;

  const params = await props.params;
  const organizationId = user.organizationId;

  const opportunity = await prisma.salesOpportunity.findFirst({
    where: { id: params.id, organizationId },
    include: {
      client: true,
      createdOffer: true,
      assignedTo: {
        select: { id: true, name: true, email: true },
      },
      radarSignal: true,
    },
  });

  if (!opportunity) {
    return NextResponse.json({ error: 'Příležitost nebyla nalezena.' }, { status: 404 });
  }

  const commercialOpportunityContext = buildCommercialOpportunityContextFromRadar(opportunity);
  const commercialRequest = buildCommercialRequestFromRadar(opportunity);
  const actions = determineCommercialNextBestActions({
    request: commercialRequest,
    opportunityContext: commercialOpportunityContext,
  });

  return NextResponse.json({
    opportunity,
    commercialOpportunityContext,
    commercialRequest,
    nextBestAction: actions[0] || null,
    actions,
  });
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess('clients', 'salesRadar');
  if (isApiDenied(user)) return user;

  const params = await props.params;
  const organizationId = user.organizationId;

  try {
    const body = await request.json().catch(() => null);
    const { status, dismissedReason, assignedToUserId } = parseOpportunityStatusInput(body);

    const updated = await updateOpportunityStatus(
      params.id,
      status,
      organizationId,
      dismissedReason,
      assignedToUserId
    );

    return NextResponse.json({ item: updated });
  } catch (error) {
    if (error instanceof OpportunityValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to update commercial context opportunity', error);
    return NextResponse.json({ error: 'Příležitost se nepodařilo aktualizovat.' }, { status: 500 });
  }
}
