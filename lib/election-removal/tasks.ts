import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { plannerTransaction, requirePlannerManager, type PlannerActor } from '../field-planning/service';
import { parseTaskSpec, taskSteps } from './task-spec';

export async function saveFieldTask(campaignId: string, raw: unknown, actor: PlannerActor, id?: string) {
  requirePlannerManager(actor);
  return plannerTransaction(tx => saveFieldTaskTx(tx, campaignId, raw, actor, id));
}

export async function saveFieldTaskTx(tx: Prisma.TransactionClient, campaignId: string, raw: unknown, actor: PlannerActor, id?: string) {
    requirePlannerManager(actor);
    const spec = parseTaskSpec(raw);
    const { organizationId } = requireTenantContext();
    if (!await tx.electionCampaign.findFirst({ where: { id: campaignId, organizationId } })) throw new Error('Akce nebyla nalezena.');
    if (spec.carrierId && !await tx.advertisingCarrier.findFirst({ where: { id: spec.carrierId, organizationId } })) throw new Error('Nosič nebyl nalezen v organizaci.');
    if (spec.surfaceId && !await tx.advertisingSurface.findFirst({ where: { id: spec.surfaceId, organizationId, ...(spec.carrierId ? { carrierId: spec.carrierId } : {}) } })) throw new Error('Plocha nebyla nalezena v organizaci.');
    const previous = id ? await tx.electionRemovalPoint.findFirst({ where: { id, campaignId, organizationId }, include: { steps: true } }) : null;
    if (id && !previous) throw new Error('Práce nebyla nalezena.');
    const legacyReview = previous?.reviewRequired && previous.steps.length === 0 && !previous.startedAt;
    if (previous && ((!legacyReview && previous.assignedFieldPlanId) || previous.startedAt || ['COMPLETED', 'CANCELLED'].includes(previous.status) || previous.steps.some(s => s.assignedFieldPlanId || s.startedAt))) throw new Error('Přiřazené nebo zahájené zadání nelze přepsat. Nejprve řešte revizi výjezdu.');
    const { deliveryMinutes: _delivery, ...fields } = spec;
    void _delivery; // Delivery duration belongs to its step only.
    const data = { ...fields, ...(legacyReview ? { assignedFieldPlanId: null, assignedCrewId: null, status: 'PENDING' as const } : {}), reviewRequired: false, baseServiceMinutes: Math.max(1, Math.ceil(spec.serviceMinutes / spec.quantity)) };
    const point = previous ? await tx.electionRemovalPoint.update({ where: { id: previous.id, organizationId }, data })
      : await tx.electionRemovalPoint.create({ data: { ...data, organizationId, campaignId } });
    if (previous) await tx.fieldWorkStep.deleteMany({ where: { organizationId, pointId: point.id } });
    for (const step of taskSteps(spec)) await tx.fieldWorkStep.create({ data: { ...step, organizationId, pointId: point.id } });
    await tx.electionCampaign.update({ where: { id: campaignId, organizationId }, data: { totalPoints: await tx.electionRemovalPoint.count({ where: { organizationId, campaignId } }) } });
    await taskAudit(tx, point.id, actor, previous ? 'FIELD_TASK_UPDATED' : 'FIELD_TASK_CREATED', { before: previous, after: spec });
    return point;
}
export async function taskAudit(tx: Prisma.TransactionClient, id: string, actor: PlannerActor, action: string, details: unknown) {
  await tx.crmAuditLog.create({ data: { organizationId: requireTenantContext().organizationId, entityType: 'ElectionRemovalPoint', entityId: id,
    userId: actor.id, userEmail: actor.email, action, detailsJson: JSON.stringify(details) } });
}

export async function taskForEdit(id: string) {
  return prisma.electionRemovalPoint.findFirst({ where: { id, organizationId: requireTenantContext().organizationId }, include: { steps: { orderBy: { sequence: 'asc' } } } });
}
