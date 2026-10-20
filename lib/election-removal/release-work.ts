import type { Prisma } from '@prisma/client';
import { requireTenantContext } from '../tenant-context';
import { hash, requirePlannerManager, type PlannerActor } from '../field-planning/service';

export async function releaseFieldWork(tx: Prisma.TransactionClient, input: { pointId: string; note: string; requestKey: string; confirmed: boolean }, actor: PlannerActor) {
  requirePlannerManager(actor);
  const { organizationId } = requireTenantContext();
  if (typeof input.pointId !== 'string' || !input.pointId || typeof input.note !== 'string' || !input.note.trim() || input.note.length > 4000 || input.confirmed !== true || typeof input.requestKey !== 'string' || !/^[\w-]{8,100}$/.test(input.requestKey)) throw new Error('Popište stav práce a potvrďte, že původní posádka už na bodu nepracuje.');
  const eventId = 'release-work-' + hash([organizationId, input.pointId, input.requestKey]).slice(0, 32);
  const fingerprint = hash(input);
  const prior = await tx.crmAuditLog.findUnique({ where: { id: eventId, organizationId } });
  if (prior) {
    if (JSON.parse(prior.detailsJson || '{}').fingerprint !== fingerprint) throw new Error('Požadavek již patří jinému předání.');
    return { ok: true };
  }
  const point = await tx.electionRemovalPoint.findFirst({ where: { id: input.pointId, organizationId }, include: { steps: { orderBy: { sequence: 'asc' } } } });
  if (!point || ['COMPLETED', 'CANCELLED'].includes(point.status)) throw new Error('Tato práce už není otevřená.');
  const pending = point.steps.filter(s => !['COMPLETED', 'CANCELLED'].includes(s.status));
  // Material already picked up needs a new physical handoff, not a reset to its original GPS.
  if (!pending.length || pending[0].kind === 'DELIVERY' || pending[0].kind === 'HANDOFF' || point.steps.some(s => s.loadDelta > 0 && s.completedQuantity > 0)) throw new Error('Materiál už byl naložen. Použijte předání naloženého materiálu a potvrďte jeho aktuální polohu.');
  const note = input.note.trim();
  for (const step of pending) {
    const changed = await tx.fieldWorkStep.updateMany({ where: { id: step.id, organizationId, version: step.version }, data: {
      status: 'PENDING', assignedFieldPlanId: null, assignedCrewId: null, issueNote: null,
      custodyNote: [step.custodyNote, 'Pokračování práce: ' + note].filter(Boolean).join('\n'), version: { increment: 1 },
    } });
    if (changed.count !== 1) throw new Error('Práce se mezitím změnila. Obnovte stránku.');
  }
  await tx.electionRemovalPoint.update({ where: { id: point.id, organizationId }, data: { status: 'PENDING', assignedFieldPlanId: null, assignedCrewId: null, issueType: null, issueNote: null, plannedArrivalAt: null, plannedOrder: null } });
  if (point.assignedFieldPlanId && !await tx.fieldWorkStep.count({ where: { organizationId, assignedFieldPlanId: point.assignedFieldPlanId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } })) {
    const oldPlan = await tx.fieldPlan.findFirst({ where: { id: point.assignedFieldPlanId, organizationId, electionCampaignId: point.campaignId, status: { in: ['APPROVED', 'ACTIVE'] } } });
    if (oldPlan) {
      await tx.fieldPlan.update({ where: { id: oldPlan.id, organizationId }, data: { status: 'COMPLETED' } });
      const reservationIds = (oldPlan.approvalSnapshot as { reservationIds?: string[] } | null)?.reservationIds ?? [];
      await tx.vehicleReservation.updateMany({ where: { organizationId, id: { in: reservationIds } }, data: { status: 'CANCELLED' } });
    }
  }
  await tx.crmAuditLog.create({ data: { id: eventId, organizationId, entityType: 'ElectionRemovalPoint', entityId: point.id, userId: actor.id, userEmail: actor.email, action: 'FIELD_WORK_RELEASED', detailsJson: JSON.stringify({ fingerprint, note, previousPlanId: point.assignedFieldPlanId, previousCrewId: point.assignedCrewId, previousIssueType: point.issueType, previousIssueNote: point.issueNote, steps: pending.map(s => ({ id: s.id, status: s.status, completedQuantity: s.completedQuantity, issueNote: s.issueNote })) }) } });
  return { ok: true };
}
