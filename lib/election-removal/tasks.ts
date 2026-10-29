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
    const hasAssignedPlan = Boolean(previous && (previous.assignedFieldPlanId || previous.steps.some(s => s.assignedFieldPlanId)));
    if (previous && (previous.startedAt || ['COMPLETED', 'CANCELLED'].includes(previous.status) || previous.steps.some(s => s.startedAt))) {
      throw new Error('Již zahájené nebo dokončené zadání nelze přepsat.');
    }
    const { deliveryMinutes: _delivery, gpsConfirmed: _gps, destinationGpsConfirmed: _destGps, ...fields } = spec;
    void _delivery; void _gps; void _destGps; // Step durations and validation flags belong to runtime/steps only.
    const data = { ...fields, layerName: spec.layerName ?? previous?.layerName ?? null, ...(legacyReview ? { assignedFieldPlanId: null, assignedCrewId: null, status: 'PENDING' as const } : {}), reviewRequired: false, baseServiceMinutes: Math.max(1, Math.ceil(spec.serviceMinutes / spec.quantity)) };
    
    let point;
    if (previous && hasAssignedPlan && !legacyReview) {
      point = await tx.electionRemovalPoint.update({
        where: { id: previous.id, organizationId },
        data: {
          label: data.label,
          description: data.description,
          contact: data.contact,
          accessInstructions: data.accessInstructions,
          materialInstructions: data.materialInstructions,
          deadlineAt: data.deadlineAt,
          windowStart: data.windowStart,
          windowEnd: data.windowEnd,
          objectType: data.objectType,
          requiredEquipment: data.requiredEquipment,
          requiredPositions: data.requiredPositions,
          referenceUrl: data.referenceUrl,
          cadastralArea: data.cadastralArea,
          cadastralAreaCode: data.cadastralAreaCode,
          parcelNumber: data.parcelNumber,
          parcelId: data.parcelId,
          landArea: data.landArea,
          landType: data.landType,
          landOwnership: data.landOwnership,
          landownerName: data.landownerName,
          landownerIco: data.landownerIco,
          landownerContact: data.landownerContact,
          landownerNote: data.landownerNote,
          monthlyRent: data.monthlyRent,
          permitStatus: data.permitStatus,
          permitNote: data.permitNote,
          permitValidUntil: data.permitValidUntil,
          serviceMinutes: data.serviceMinutes,
          baseServiceMinutes: data.baseServiceMinutes,
        },
      });
      await tx.fieldWorkStep.updateMany({
        where: { organizationId, pointId: point.id },
        data: { label: data.label },
      });
    } else if (previous) {
      point = await tx.electionRemovalPoint.update({ where: { id: previous.id, organizationId }, data });
      await tx.fieldWorkStep.deleteMany({ where: { organizationId, pointId: point.id } });
      for (const step of taskSteps(spec)) await tx.fieldWorkStep.create({ data: { ...step, organizationId, pointId: point.id } });
    } else {
      point = await tx.electionRemovalPoint.create({ data: { ...data, organizationId, campaignId } });
      for (const step of taskSteps(spec)) await tx.fieldWorkStep.create({ data: { ...step, organizationId, pointId: point.id } });
    }
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
