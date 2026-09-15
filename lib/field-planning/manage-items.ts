import { requireTenantContext } from '../tenant-context';
import { hash, plannerTransaction, requirePlannerManager, type PlannerActor } from './service';
import { itemStatus } from './item-jobs';

export async function manageWorkItem(workOrderId: string, input: { action: string; id?: string; carrierId?: string; surfaceId?: string; crmRealizationId?: string; description?: string; estimatedMinutes?: number | null; requestKey?: string }, actor: PlannerActor) {
  requirePlannerManager(actor);
  const { organizationId } = requireTenantContext();
  if (!['save', 'cancel', 'resolve'].includes(input.action)) throw new Error('Neplatná akce.');
  if (!input.id && (!input.requestKey || !/^[\w-]{8,100}$/.test(input.requestKey))) throw new Error('Chybí klíč požadavku.');
  if (input.description && (typeof input.description !== 'string' || input.description.length > 2000)) throw new Error('Příliš dlouhý popis.');
  if (input.estimatedMinutes != null && (!Number.isInteger(input.estimatedMinutes) || input.estimatedMinutes < 1 || input.estimatedMinutes > 1440)) throw new Error('Délka musí být 1–1440 minut.');
  return plannerTransaction(async tx => {
    const order = await tx.workOrder.findUnique({ where: { id: workOrderId, organizationId }, include: { crmOrder: true } });
    if (!order || order.navigationOrderId || ['DONE', 'CANCELLED'].includes(order.status)) throw new Error('Zakázka není dostupná pro úpravu položek.');
    if (order.crmOrderId && (!order.crmOrder || order.crmOrder.organizationId !== organizationId)) throw new Error('Cross-tenant CrmOrder rejected.');
    const id = input.id ?? 'field-item-' + hash([organizationId, workOrderId, input.requestKey]).slice(0, 32);
    const existing = await tx.workOrderItem.findUnique({ where: { id, organizationId }, include: { crmRealization: true, photos: { select: { id: true } } } });
    if ((input.id && !existing) || (existing && existing.workOrderId !== workOrderId)) throw new Error('Cross-tenant WorkOrderItem rejected.');
    if (!input.id && existing) return { id: existing.id };
    if (input.action === 'resolve') {
      if (!existing || !input.description?.trim()) throw new Error('Doplňte popis vyřešení.');
      if (existing.crmRealization?.status === 'CLAIM') throw new Error('Formální reklamaci vyřešte v autoritativním workflow realizace.');
      if (existing.crmRealization) await tx.crmRealization.update({ where: { id: existing.crmRealization.id, organizationId }, data: { claimNote: null } });
      await tx.workOrderItem.update({ where: { id, organizationId }, data: { issueNote: null, issueType: null } });
    } else if (input.action === 'cancel') {
      if (!existing || itemStatus(existing) === 'DONE' || existing.crmRealizationId) throw new Error('Hotovou nebo CRM položku nelze zde zrušit.');
      await tx.workOrderItem.update({ where: { id, organizationId }, data: { executionStatus: 'CANCELLED' } });
    } else {
      if (existing && (['DONE', 'IN_PROGRESS', 'CANCELLED'].includes(itemStatus(existing)) || existing.photos.length)) throw new Error('Položka má historii realizace; její zadání nelze přepsat.');
      const surface = input.surfaceId ? await tx.advertisingSurface.findUnique({ where: { id: input.surfaceId, organizationId } }) : null;
      const carrierId = input.carrierId || surface?.carrierId;
      const carrier = carrierId ? await tx.advertisingCarrier.findUnique({ where: { id: carrierId, organizationId } }) : null;
      if (!carrier || (input.surfaceId && !surface) || (surface && surface.carrierId !== carrier.id)) throw new Error('Cross-tenant or inconsistent carrier/surface rejected.');
      if (input.crmRealizationId && !['INSTALLATION', 'REINSTALLATION'].includes(order.workType)) throw new Error('CRM montážní realizaci lze propojit pouze s instalací nebo reinstalací.');
      const realization = input.crmRealizationId ? await tx.crmRealization.findUnique({ where: { id: input.crmRealizationId, organizationId }, include: { crmOrder: true } }) : null;
      if (input.crmRealizationId && (!realization || realization.crmOrder.organizationId !== organizationId || realization.crmOrderId !== order.crmOrderId || realization.carrierId !== carrier.id || realization.surfaceId !== (surface?.id ?? null) || (realization.workOrderId && realization.workOrderId !== workOrderId))) throw new Error('Cross-tenant or inconsistent realization rejected.');
      if (realization && !realization.workOrderId) await tx.crmRealization.update({ where: { id: realization.id, organizationId }, data: { workOrderId } });
      const data = { carrierId: carrier.id, surfaceId: surface?.id ?? null, crmRealizationId: realization?.id ?? null, description: input.description?.trim() || null, estimatedMinutes: input.estimatedMinutes ?? null };
      if (existing) await tx.workOrderItem.update({ where: { id, organizationId }, data: { ...data, executionStatus: realization ? null : 'NEW' } });
      else await tx.workOrderItem.create({ data: { id, organizationId, workOrderId, ...data, executionStatus: realization ? null : 'NEW' } });
    }
    await tx.workOrder.update({ where: { id: workOrderId, organizationId }, data: { updatedAt: new Date() } });
    await tx.crmAuditLog.create({ data: { organizationId, entityType: 'WorkOrderItem', entityId: id, userId: actor.id, userEmail: actor.email,
      action: input.action === 'resolve' ? 'FIELD_EXECUTION_RESOLVED' : 'FIELD_ITEM_UPDATED', detailsJson: JSON.stringify({ workOrderId, action: input.action, note: input.description }) } });
    return { id };
  });
}
