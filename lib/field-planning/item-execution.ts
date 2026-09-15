import type { Prisma } from '@prisma/client';
import { requireTenantContext } from '../tenant-context';
import { itemStatus } from './item-jobs';
import { hash, type PlannerActor } from './service';
import type { PlannedStop } from './contracts';
import type { StoredInstallationPhoto } from '../navigation/navigation-service';

export async function executeItem(tx: Prisma.TransactionClient, stop: PlannedStop, planId: string,
  input: { action: string; problemType?: string; note?: string; requestKey?: string }, actor: PlannerActor, photos?: StoredInstallationPhoto[], crewUserIds: string[] = [actor.id]) {
  const { organizationId } = requireTenantContext();
  const item = await tx.workOrderItem.findFirst({ where: { id: stop.workOrderItemId, organizationId, workOrderId: stop.workOrderId },
    include: { carrier: true, surface: { include: { carrier: true } }, crmRealization: { include: { crmOrder: true } }, workOrder: { include: { crmOrder: true } } } });
  if (!item || item.workOrder.organizationId !== organizationId || item.workOrder.navigationOrderId || item.workOrder.status === 'CANCELLED') throw new Error('Položka již není dostupná.');
  if (item.crmRealizationId && !['INSTALLATION', 'REINSTALLATION'].includes(item.workOrder.workType)) throw new Error('Typ práce již neodpovídá propojené montážní realizaci.');
  if ((item.workOrder.crmOrderId && (!item.workOrder.crmOrder || item.workOrder.crmOrder.organizationId !== organizationId)) || (item.crmRealization && (item.crmRealization.crmOrder.organizationId !== organizationId || item.crmRealization.crmOrderId !== item.workOrder.crmOrderId))) throw new Error('Cross-tenant CrmOrder rejected.');
  const carrier = item.carrier ?? item.surface?.carrier;
  if ([carrier, item.surface, item.surface?.carrier, item.crmRealization].some(r => r && r.organizationId !== organizationId)
    || (item.carrierId && !item.carrier) || (item.surfaceId && !item.surface) || (item.crmRealizationId && !item.crmRealization)
    || carrier?.id !== stop.carrierId || item.surfaceId !== stop.surfaceId || item.crmRealizationId !== stop.crmRealizationId
    || carrier?.latitude !== stop.location.latitude || carrier?.longitude !== stop.location.longitude
    || (item.crmRealization && (item.crmRealization.workOrderId !== item.workOrderId || item.crmRealization.carrierId !== carrier?.id || item.crmRealization.surfaceId !== item.surfaceId))) throw new Error('Vazba nebo lokalita položky se změnila; kontaktujte manažera.');
  if (item.crmRealization?.assignedUserId && !crewUserIds.includes(item.crmRealization.assignedUserId)) throw new Error('FORBIDDEN: přiřazení realizace se změnilo.');
  if (input.action === 'problem' && ['DONE', 'CANCELLED'].includes(itemStatus(item))) throw new Error('Hotovou položku řeší manažer přes servisní práci nebo reklamaci.');
  if (input.action === 'inspect') return { ok: true, workOrderItemId: item.id };
  if (!['start', 'complete', 'photo', 'problem'].includes(input.action)) throw new Error('Neplatná akce.');
  const action = input.action === 'problem' ? 'FIELD_EXECUTION_BLOCKED' : input.action === 'start' ? 'FIELD_ITEM_STARTED' : 'FIELD_ITEM_COMPLETED';
  const eventId = 'fp-item-' + hash([organizationId, planId, item.id, action, input.action === 'problem' ? input.requestKey : '']).slice(0, 32);
  if (await tx.crmAuditLog.findUnique({ where: { id: eventId, organizationId } })) {
    if (input.action === 'photo') throw new Error('Fotografie už byla uložena. Obnovte trasu.');
    return { ok: true };
  }
  if (input.action === 'problem') {
    if (!['Technický problém', 'Nedostupný nosič', 'Nemožnost instalace', 'Poškození', 'Chybějící materiál', 'Jiné'].includes(input.problemType ?? '') || !input.note?.trim() || input.note.length > 1000 || !input.requestKey || !/^[\w-]{8,100}$/.test(input.requestKey)) throw new Error('Vyplňte typ problému, popis a klíč požadavku.');
    const note = `${input.problemType}: ${input.note.trim()}`;
    if (item.crmRealization) await tx.crmRealization.update({ where: { id: item.crmRealization.id, organizationId }, data: { claimNote: note } });
    else await tx.workOrderItem.update({ where: { id: item.id, organizationId }, data: { issueType: input.problemType, issueNote: note } });
  } else {
    if (item.issueNote || item.crmRealization?.claimNote || item.crmRealization?.status === 'CLAIM') throw new Error('Manažer musí nejprve vyřešit problém položky.');
    if (itemStatus(item) === 'CANCELLED') throw new Error('Položka je zrušená.');
    if (itemStatus(item) === 'DONE') { if (input.action === 'photo') throw new Error('Položka je již hotová.'); return { ok: true }; }
    if (input.action !== 'start' && itemStatus(item) !== 'IN_PROGRESS') throw new Error('Nejprve zahajte práci na této položce.');
    if (input.action === 'photo') {
      if (!photos?.some(p => p.type === 'AFTER_INSTALLATION')) throw new Error('Chybí fotografie dokončené práce.');
      for (const stored of photos) await tx.photo.create({ data: {
        ...stored, content: stored.content ? Buffer.from(stored.content) : undefined,
        organizationId, url: `/api/photos/${stored.id}/file`, workOrderItemId: item.id,
        carrierId: carrier!.id, surfaceId: item.surfaceId, crmRealizationId: item.crmRealizationId,
        isClientVisible: false, capturedByWorkerUserId: actor.id, capturedByWorkerName: actor.email,
        type: stored.type === 'AFTER_INSTALLATION' && !['INSTALLATION', 'REINSTALLATION'].includes(item.workOrder.workType) ? 'CONTROL' : stored.type,
      } });
    }
    if (input.action !== 'start' && !await tx.photo.count({ where: { organizationId, workOrderItemId: item.id, type: { in: ['INSTALLATION', 'AFTER_INSTALLATION', 'CONTROL'] } } })) throw new Error('Doložte práci fotografií této položky.');
    if (item.crmRealization) await tx.crmRealization.update({ where: { id: item.crmRealization.id, organizationId }, data: input.action === 'start'
      ? { status: 'INSTALLATION_IN_PROGRESS' } : { status: 'PHOTOGRAPHED', actualDate: new Date() } });
    await tx.workOrderItem.update({ where: { id: item.id, organizationId }, data: {
      ...(!item.crmRealization ? { executionStatus: input.action === 'start' ? 'IN_PROGRESS' : 'DONE' } : {}),
      ...(input.action === 'start' ? { startedAt: new Date() } : { completedAt: new Date() }),
    } });
    const siblings = await tx.workOrderItem.findMany({ where: { organizationId, workOrderId: item.workOrderId }, include: { crmRealization: true } });
    const done = siblings.every(i => !i.issueNote && !i.crmRealization?.claimNote && ['DONE', 'CANCELLED'].includes(itemStatus(i)));
    await tx.workOrder.update({ where: { id: item.workOrderId, organizationId }, data: { status: done ? 'DONE' : 'IN_PROGRESS' } });
    await tx.workTask.updateMany({ where: { organizationId, workOrderId: item.workOrderId }, data: { status: done ? 'DONE' : 'IN_PROGRESS' } });
  }
  await tx.crmAuditLog.create({ data: { id: eventId, organizationId, entityType: 'WorkOrderItem', entityId: item.id, userId: actor.id, userEmail: actor.email, action,
    detailsJson: JSON.stringify({ planId, workOrderId: item.workOrderId, problemType: input.problemType, note: input.note }) } });
  return { ok: true };
}
