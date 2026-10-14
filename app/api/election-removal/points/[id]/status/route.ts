import { enterTenantContext } from '@/lib/tenant-context';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireElectionRemovalAccess, isElectionRemovalAccessDenied } from '@/lib/election-removal/guard';
import { executeStop } from '@/lib/field-planning/execution';
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireElectionRemovalAccess(); if (isElectionRemovalAccessDenied(auth)) return auth;
  enterTenantContext({ organizationId: auth.organizationId, userId: auth.user.id, source: 'session' });
  try {
    const { id } = await params; const body = await req.json();
    if (typeof body.stepId !== 'string' || !body.stepId) throw new Error('Otevřete aktuální trasu a zvolte konkrétní krok práce.');
    const step = await prisma.fieldWorkStep.findFirst({ where: { organizationId: auth.organizationId, pointId: id, ...(body.stepId ? { id: body.stepId } : { status: { not: 'COMPLETED' } }) }, orderBy: { sequence: 'asc' } });
    if (!step?.assignedFieldPlanId) throw new Error('Práce nemá aktuálně přiřazený krok. Otevřete Moje trasa.');
    const action = ({ START: 'start', COMPLETE: 'complete', REPORT_ISSUE: 'problem' } as Record<string, string>)[body.action];
    const result = await executeStop({ ...body, planId: step.assignedFieldPlanId, workOrderId: '', jobId: 'field-step:' + step.id, action,
      problemType: body.issueType, note: body.issueNote }, auth.user);
    return NextResponse.json({ ...result, point: await prisma.electionRemovalPoint.findFirst({ where: { id, organizationId: auth.organizationId } }) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Změna selhala.' }, { status: 409 }); }
}
