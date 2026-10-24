import type { Prisma } from '@prisma/client';
import { requireTenantContext } from '../tenant-context';
import { hash, type PlannerActor } from '../field-planning/service';
import type { PlannedStop } from '../field-planning/contracts';

export type FieldExecutionInput = { action: string; requestKey?: string; quantity?: number; problemType?: string; note?: string; custodyNote?: string };
/** Called only within plannerTransaction (SERIALIZABLE + retry). CAS additionally protects each step revision. */
export async function executeFieldStep(tx: Prisma.TransactionClient, stop: PlannedStop, planId: string, crewId: string, input: FieldExecutionInput, actor: PlannerActor) {
  const { organizationId } = requireTenantContext();
  const point = await tx.electionRemovalPoint.findFirst({ where: { id: stop.electionRemovalPointId, organizationId }, include: { steps: { orderBy: { sequence: 'asc' } } } });
  if (!point || point.status === 'CANCELLED') throw new Error('Práce již není dostupná.');
  const step = point.steps.find(s => s.id === stop.fieldWorkStepId);
  if (!step) {
    if (input.action === 'inspect') return { ok: true, fieldWorkStepId: null, electionRemovalPointId: point.id, photoType: 'AFTER_INSTALLATION' };
    // Historic links remain readable; legacy work must be reviewed before new execution.
    throw new Error('Tato starší práce vyžaduje kontrolu a doplnění kroků dispečerem.');
  }
  const isAdminOrManager = ['ADMIN', 'MANAGER'].includes(actor.role);
  if (!isAdminOrManager && (step.assignedFieldPlanId !== planId || step.assignedCrewId !== crewId)) throw new Error('FORBIDDEN: přiřazení kroku se změnilo; obnovte trasu.');
  if (input.action === 'inspect') return { ok: true, fieldWorkStepId: step.id, electionRemovalPointId: point.id, photoType: step.photoType };
  if (input.custodyNote !== undefined && (typeof input.custodyNote !== 'string' || input.custodyNote.length > 4000)) throw new Error('Neplatné potvrzení převzetí materiálu.');
  if (input.problemType !== undefined && (typeof input.problemType !== 'string' || input.problemType.length > 100)) throw new Error('Neplatný typ problému.');
  if (!['start', 'complete', 'problem'].includes(input.action)) throw new Error('Neplatná akce.');
  if (!input.requestKey || !/^[\w-]{8,100}$/.test(input.requestKey)) throw new Error('Chybí platný klíč požadavku.');
  const eventId = 'field-step-' + hash([organizationId, step.id, input.requestKey]).slice(0, 40);
  const fingerprint = hash(input);
  const prior = await tx.crmAuditLog.findUnique({ where: { id: eventId, organizationId } });
  if (prior) {
    if (JSON.parse(prior.detailsJson || '{}').fingerprint !== fingerprint) throw new Error('Klíč požadavku byl použit pro jinou změnu.');
    return { ok: true };
  }
  if (step.status === 'COMPLETED') throw new Error('Krok je již dokončen.');
  const predecessor = point.steps.find(s => s.sequence === step.sequence - 1);
  if (input.action !== 'problem' && !isAdminOrManager && predecessor && predecessor.status !== 'COMPLETED') throw new Error('Nejprve dokončete předchozí krok včetně nakládky.');
  let data: Prisma.FieldWorkStepUpdateManyMutationInput;
  if (input.action === 'start') {
    if (step.status === 'IN_PROGRESS') return { ok: true };
    data = { status: 'IN_PROGRESS', startedAt: step.startedAt ?? new Date(), issueNote: null };
  } else if (input.action === 'problem') {
    if (!input.note?.trim() || input.note.length > 4000) throw new Error('Popište problém a kde zůstává materiál.');
    data = { status: 'ISSUE', issueNote: input.note.trim(), custodyNote: input.custodyNote?.trim() || step.custodyNote };
  } else {
    // Complete action: instant completion support (do not throw if step was not explicitly started first)
    const quantity = input.quantity ?? step.quantity - step.completedQuantity;
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > step.quantity - step.completedQuantity) throw new Error('Množství překračuje zbývající práci.');
    if (['DELIVERY', 'HANDOFF'].includes(step.kind) && !input.custodyNote?.trim()) throw new Error('Uveďte místo uložení nebo jméno příjemce materiálu.');
    const completedQuantity = step.completedQuantity + quantity;
    data = {
      completedQuantity,
      issueNote: null,
      status: completedQuantity === step.quantity ? 'COMPLETED' : 'IN_PROGRESS',
      startedAt: step.startedAt ?? new Date(),
      completedAt: completedQuantity === step.quantity ? new Date() : null,
      custodyNote: input.custodyNote?.trim() || (step.kind === 'PICKUP' ? `Ve vozidle posádky ${crewId}; převzal ${actor.email}` : step.custodyNote)
    };
  }
  const changed = await tx.fieldWorkStep.updateMany({
    where: {
      id: step.id,
      organizationId,
      version: step.version,
      assignedFieldPlanId: planId,
      ...(isAdminOrManager ? {} : { assignedCrewId: crewId })
    },
    data: { ...data, version: { increment: 1 } }
  });
  if (changed.count !== 1) throw new Error('Krok se mezitím změnil. Obnovte trasu.');
  const siblings = await tx.fieldWorkStep.findMany({ where: { organizationId, pointId: point.id } });
  const done = siblings.every(s => s.status === 'COMPLETED');
  await tx.electionRemovalPoint.update({ where: { id: point.id, organizationId }, data: {
    status: done ? 'COMPLETED' : siblings.some(s => s.status === 'ISSUE') ? 'ISSUE' : 'IN_PROGRESS',
    issueType: siblings.some(s => s.status === 'ISSUE') ? (input.action === 'problem' ? input.problemType ?? 'Jiné' : point.issueType) : null,
    issueNote: siblings.find(s => s.status === 'ISSUE')?.issueNote ?? null,
    startedAt: point.startedAt ?? new Date(), completedAt: done ? new Date() : null, completedByUserId: done ? actor.id : null } });
  await tx.electionCampaign.update({ where: { id: point.campaignId, organizationId }, data: {
    completedPoints: await tx.electionRemovalPoint.count({ where: { organizationId, campaignId: point.campaignId, status: 'COMPLETED' } }) } });
  const linkedWorkOrders = await tx.workOrder.findMany({
    where: {
      organizationId,
      planningConstraints: { path: ['electionRemovalPointId'], equals: point.id },
    },
    select: { id: true },
  });
  if (linkedWorkOrders.length > 0) {
    const nextStatus = done ? 'DONE' : 'IN_PROGRESS';
    for (const wo of linkedWorkOrders) {
      await tx.workOrder.update({
        where: { id: wo.id },
        data: { status: nextStatus },
      });
      await tx.workTask.updateMany({
        where: { organizationId, workOrderId: wo.id },
        data: { status: nextStatus },
      });
    }
  }
  await tx.crmAuditLog.create({ data: { id: eventId, organizationId, entityType: 'FieldWorkStep', entityId: step.id,
    userId: actor.id, userEmail: actor.email, action: `FIELD_STEP_${input.action.toUpperCase()}`,
    detailsJson: JSON.stringify({ fingerprint, planId, crewId, beforeQuantity: step.completedQuantity, ...input }) } });
  return { ok: true };
}
