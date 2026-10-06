import { NextResponse } from 'next/server';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import { approveAndSaveElectionPlan } from '@/lib/election-removal/planning';
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
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  const { id } = await params;

  try {
    const body = (await req.json()) as {
      planningInput: PlanningInput;
      planningResult: PlanningResult;
    };

    if (!body.planningInput || !body.planningResult) {
      return NextResponse.json(
        { error: 'Chybí vstupní data plánu nebo výsledek optimalizace.' },
        { status: 400 }
      );
    }

    const fieldPlan = await approveAndSaveElectionPlan(
      id,
      body.planningInput,
      body.planningResult,
      auth.user
    );

    return NextResponse.json({
      success: true,
      fieldPlanId: fieldPlan.id,
    });
  } catch (error: any) {
    console.error('Chyba při schvalování plánu:', error);
    return NextResponse.json(
      { error: error?.message || 'Nepodařilo se uložit a schválit plán.' },
      { status: 500 }
    );
  }
}
