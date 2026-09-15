import type { Prisma } from '@prisma/client';
import type { PlanningJob, PlanningProfile } from './contracts';
import { coordinates } from './profile';

export type FieldItem = Prisma.WorkOrderItemGetPayload<{ include: { carrier: true; surface: { include: { carrier: true } }; crmRealization: true } }>;
export const itemJobId = (id: string) => `work-item:${id}`;
export function itemStatus(item: { executionStatus: string | null; crmRealization?: { status: string; claimNote: string | null } | null }) {
  const realization = item.crmRealization;
  if (!realization) return item.executionStatus ?? 'PLANNED';
  if (realization.claimNote || realization.status === 'CLAIM') return 'IN_PROGRESS';
  if (['INSTALLED', 'PHOTOGRAPHED', 'DELIVERED_TO_CLIENT', 'COMPLETED'].includes(realization.status)) return 'DONE';
  return realization.status === 'INSTALLATION_IN_PROGRESS' ? 'IN_PROGRESS' : 'PLANNED';
}
export function usesItemExecution(items: Array<{ executionStatus: string | null; crmRealizationId: string | null; surfaceId?: string | null }>) {
  return items.length > 1 || items.some(i => i.executionStatus !== null || i.crmRealizationId !== null || Boolean(i.surfaceId));
}
/** Identity is the work item, never its coordinates: two surfaces at one site remain two jobs. */
export function workItemJobs(base: PlanningJob, items: FieldItem[], profile: PlanningProfile, employees: Array<{ id: string; userId: string | null }> = []): PlanningJob[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id)).map(item => {
    const carrier = item.carrier ?? item.surface?.carrier;
    const references = [item, carrier, item.surface, item.surface?.carrier, item.crmRealization];
    if (references.some(r => r && r.organizationId !== base.organizationId) || item.workOrderId !== base.id
      || (item.carrierId && !item.carrier) || (item.surfaceId && !item.surface) || (item.crmRealizationId && !item.crmRealization)
      || (item.carrierId && item.surface && item.surface.carrierId !== item.carrierId)
      || (item.crmRealization && (item.crmRealization.workOrderId !== base.id || item.crmRealization.carrierId !== (carrier?.id ?? null) || item.crmRealization.surfaceId !== item.surfaceId))) {
      throw new Error('Cross-tenant or inconsistent WorkOrderItem reference rejected.');
    }
    let blockedReason = base.blockedReason;
    const requiredEmployeeIds = [...(base.constraints.requiredEmployeeIds ?? [])];
    if (item.crmRealization?.assignedUserId) { const assigned = employees.find(e => e.userId === item.crmRealization!.assignedUserId); if (!assigned) blockedReason = 'Přiřazený realizátor nemá dostupný profil Employee v organizaci.'; else requiredEmployeeIds.push(assigned.id); }
    if (item.crmRealizationId && !['INSTALLATION', 'REINSTALLATION'].includes(base.workType)) blockedReason = 'Typ práce neodpovídá propojené montážní realizaci.';
    if (item.crmRealization && !['PRODUCED', 'SCHEDULED', 'INSTALLATION_IN_PROGRESS', 'INSTALLED', 'PHOTOGRAPHED', 'DELIVERED_TO_CLIENT', 'COMPLETED', 'CLAIM'].includes(item.crmRealization.status)) blockedReason = 'CRM realizace ještě není připravena k práci v terénu.';
    if (!coordinates(carrier)) blockedReason = 'Položka nemá platné GPS nosiče.';
    if (item.issueNote || item.crmRealization?.claimNote || item.crmRealization?.status === 'CLAIM') blockedReason = 'Položka má nevyřešený provozní problém.';
    return { ...base, id: itemJobId(item.id), sourceType: 'WORK_ORDER_ITEM', sourceId: item.id, workOrderItemId: item.id,
      parentWorkOrderId: base.id, carrierId: carrier?.id ?? null, surfaceId: item.surfaceId, crmRealizationId: item.crmRealizationId,
      title: item.surface?.name ?? (item.description ? `${carrier?.name ?? base.title} · ${item.description.slice(0, 80)}` : carrier?.name ?? base.title),
      address: carrier ? [carrier.address, carrier.city].filter(Boolean).join(', ') : null,
      status: ['DONE', 'CANCELLED'].includes(base.status) ? base.status : itemStatus(item),
      location: coordinates(carrier) ? { latitude: carrier.latitude, longitude: carrier.longitude } : null,
      serviceMinutes: item.estimatedMinutes ?? (carrier ? profile.serviceMinutes[`${base.workType}:${carrier.type}`] : undefined) ?? profile.serviceMinutes[base.workType] ?? null,
      constraints: { ...base.constraints, requiredEmployeeIds: [...new Set(requiredEmployeeIds)] }, blockedReason,
      updatedAt: [base.updatedAt, item.updatedAt.toISOString(), carrier?.updatedAt.toISOString(), item.crmRealization?.updatedAt.toISOString(), item.surface?.updatedAt.toISOString()].join('/') };
  });
}
