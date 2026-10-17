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

    // 1. Ruční nastavení stavu z PC (manažer / dispečer)
    if (body.status === 'COMPLETED' || body.status === 'PENDING') {
      const targetStatus = body.status;
      const now = new Date();

      const point = await prisma.electionRemovalPoint.findFirst({
        where: { id, organizationId: auth.organizationId },
        select: { id: true, campaignId: true },
      });
      if (!point) throw new Error('Bod nebyl nalezen.');

      if (targetStatus === 'COMPLETED') {
        await prisma.electionRemovalPoint.update({
          where: { id, organizationId: auth.organizationId },
          data: { status: 'COMPLETED', completedAt: now, completedByUserId: auth.user.id },
        });
        const steps = await prisma.fieldWorkStep.findMany({ where: { pointId: id, organizationId: auth.organizationId } });
        for (const s of steps) {
          await prisma.fieldWorkStep.update({ where: { id: s.id }, data: { status: 'COMPLETED', completedQuantity: s.quantity, completedAt: now } });
        }
      } else {
        await prisma.electionRemovalPoint.update({
          where: { id, organizationId: auth.organizationId },
          data: { status: 'PENDING', completedAt: null, completedByUserId: null },
        });
        const steps = await prisma.fieldWorkStep.findMany({ where: { pointId: id, organizationId: auth.organizationId } });
        for (const s of steps) {
          await prisma.fieldWorkStep.update({ where: { id: s.id }, data: { status: s.assignedFieldPlanId ? 'ASSIGNED' : 'PENDING', completedQuantity: 0, completedAt: null } });
        }
      }

      const completedCount = await prisma.electionRemovalPoint.count({
        where: { campaignId: point.campaignId, organizationId: auth.organizationId, status: 'COMPLETED' },
      });
      await prisma.electionCampaign.update({
        where: { id: point.campaignId, organizationId: auth.organizationId },
        data: { completedPoints: completedCount },
      });

      return NextResponse.json({ success: true, point: await prisma.electionRemovalPoint.findFirst({ where: { id, organizationId: auth.organizationId } }) });
    }

    // 2. Mobilní realizace kroků v terénu (Moje trasa)
    if (typeof body.stepId !== 'string' || !body.stepId) throw new Error('Otevřete aktuální trasu a zvolte konkrétní krok práce.');
    const step = await prisma.fieldWorkStep.findFirst({ where: { organizationId: auth.organizationId, pointId: id, ...(body.stepId ? { id: body.stepId } : { status: { not: 'COMPLETED' } }) }, orderBy: { sequence: 'asc' } });
    if (!step?.assignedFieldPlanId) throw new Error('Práce nemá aktuálně přiřazený krok. Otevřete Moje trasa.');
    const action = ({ START: 'start', COMPLETE: 'complete', REPORT_ISSUE: 'problem' } as Record<string, string>)[body.action];
    const result = await executeStop({ ...body, planId: step.assignedFieldPlanId, workOrderId: '', jobId: 'field-step:' + step.id, action,
      problemType: body.issueType, note: body.issueNote }, auth.user);
    return NextResponse.json({ ...result, point: await prisma.electionRemovalPoint.findFirst({ where: { id, organizationId: auth.organizationId } }) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Změna selhala.' }, { status: 409 }); }
}
