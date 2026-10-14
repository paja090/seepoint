import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import { approveFieldDraft } from '@/lib/election-removal/approval';
import type { PlanningInput, PlanningResult } from '@/lib/field-planning/contracts';

export const runtime = 'nodejs';

/**
 * POST /api/election-removal/campaigns/[id]/plan/approve
 * Schválí a trvale uloží vygenerovaný plán do FieldPlan a přiřadí body posádkám.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireElectionRemovalAccess(true);
  if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });

  const { id } = await params;

  try {
    const body = (await req.json()) as {
      draftPlanId?: string;
      planningInput: PlanningInput;
      planningResult: PlanningResult;
    };

    if (!body.planningInput || !body.planningResult) {
      return NextResponse.json(
        { error: 'Chybí vstupní data plánu nebo výsledek optimalizace.' },
        { status: 400 }
      );
    }

    const fieldPlan = await approveFieldDraft(
      id,
      body.planningInput,
      auth.user,
      body.draftPlanId
    );

    return NextResponse.json({
      success: true,
      fieldPlanId: fieldPlan.id,
    });
  } catch (error: unknown) {
    console.error('Chyba při schvalování plánu:', error);
    const message =
      error instanceof Error ? error.message : 'Nepodařilo se uložit a schválit plán.';
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
