import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { loadProfile } from './data';
import { dayInZone } from './profile';
import { auditPlan, getPlan, hash, plannerTransaction, type PlannerActor } from './service';
import { executeItem } from './item-execution';
import { itemStatus, usesItemExecution } from './item-jobs';
import { navigationAvailable } from './capabilities';
import { stopId } from './contracts';
import { attachPointInstallationPhotos, type StoredInstallationPhoto } from '../navigation/navigation-service';
import { reportNavigationPointIssue } from '../navigation/point-issue';
import type { PlanningInput, PlanningResult } from './contracts';

export async function myRoute(userId: string, now = new Date()) {
  const { organizationId } = requireTenantContext();
  const profile = await loadProfile(); if (!profile?.enabled) return { timezone: 'Europe/Prague', routes: [] };
  const employee = await prisma.employee.findFirst({ where: { organizationId, userId, isActive: true }, select: { id: true } });
  if (!employee) return { timezone: profile.timezone, routes: [] };
  const plans = await prisma.fieldPlan.findMany({ where: { organizationId, date: dayInZone(now, profile.timezone), status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED'] } }, orderBy: { version: 'desc' } });
  const navigation = await navigationAvailable();
  const routes = [];
  for (const plan of plans) {
    const result = plan.planningSummary as unknown as PlanningResult;
    for (const crew of result.crews.filter(c => c.employeeIds.includes(employee.id))) {
      const orders = await prisma.workOrder.findMany({ where: { organizationId, id: { in: crew.stops.map(s => s.workOrderId) }, workTasks: { some: { organizationId, assignedToEmployeeId: employee.id } } },
        select: { id: true, title: true, description: true, clientName: true, status: true, workType: true, navigationOrderId: true,
          workTasks: { where: { organizationId, assignedToEmployeeId: employee.id }, select: { id: true } },
          items: { where: { organizationId }, include: { crmRealization: true, photos: { where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } }, carrier: { include: { photos: { where: { organizationId, workOrderItemId: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } } }, surface: { include: { carrier: { include: { photos: { where: { organizationId, workOrderItemId: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } } } } } } } } });
      const points = navigation ? await prisma.navigationPoint.findMany({ where: { organizationId, id: { in: crew.stops.flatMap(s => s.navigationPointId ? [s.navigationPointId] : []) } },
        select: { id: true, navigationOrderId: true, label: true, address: true, status: true, issueReported: true, installedPhotoId: true, sitePhotoId: true, isSelectedByClient: true, installerUserId: true, clientNote: true } }) : [];
      const crewUsers = await prisma.employee.findMany({ where: { organizationId, id: { in: crew.employeeIds }, isActive: true }, select: { userId: true } });
      const starts = await prisma.crmAuditLog.findMany({ where: { organizationId, entityType: 'NavigationPoint', entityId: { in: points.map(p => p.id) }, action: 'FIELD_POINT_STARTED' }, select: { entityId: true } });
      routes.push({ planId: plan.id, vehicleName: crew.vehicleName, departureAt: crew.departureAt, endAt: crew.endAt,
        stops: crew.stops.flatMap(s => {
          const order = orders.find(o => o.id === s.workOrderId); if (s.workOrderId && !order) return [];
          if (s.navigationPointId && !navigation) return [];
          const item = s.workOrderItemId ? order?.items.find(i => i.id === s.workOrderItemId) : null;
          if (s.workOrderItemId && !item) return [];
          if (item?.crmRealization?.assignedUserId && !crewUsers.some(e => e.userId === item.crmRealization!.assignedUserId)) return [];
          const point = s.navigationPointId ? points.find(p => p.id === s.navigationPointId && p.navigationOrderId === s.navigationOrderId) : null;
          if (s.navigationPointId && (!point || (!point.installerUserId || !crewUsers.some(e => e.userId === point.installerUserId)))) return [];
          if (!point && !order) return [];
          const carrier = item ? item.carrier ?? item.surface?.carrier : order?.items.find(i => i.carrier?.organizationId === organizationId)?.carrier;
          if (carrier && carrier.organizationId !== organizationId) return [];
          return [{ jobId: stopId(s), workOrderItemId: item?.id ?? null, navigationPointId: point?.id ?? null, address: point?.address ?? null, pointPhotoUrl: item?.photos[0] ? `/api/photos/${item.photos[0].id}/file` : point?.installedPhotoId || point?.sitePhotoId ? `/api/photos/${point.installedPhotoId ?? point.sitePhotoId}/file` : null, workOrderId: order?.id ?? '', title: point?.label ?? (item ? s.title : order!.title), clientName: order?.clientName ?? s.clientName ?? null, instructions: point ? point.clientNote : item?.description ?? order!.description, status: point ? !point.isSelectedByClient || ['CANCELLED', 'REMOVED'].includes(point.status) ? 'CANCELLED' : point.status === 'INSTALLED' ? 'DONE' : starts.some(a => a.entityId === point.id) ? 'IN_PROGRESS' : 'PLANNED' : item ? itemStatus(item) : order!.status, workType: s.workType,
            startAt: s.startAt, endAt: s.endAt, location: s.location, taskId: order?.workTasks[0]?.id ?? null,
            navigationOrderId: point?.navigationOrderId ?? order?.navigationOrderId ?? null,
            carrier: carrier ? { id: carrier.id, name: carrier.name, code: carrier.code, city: carrier.city, address: carrier.address, photoUrl: carrier.photos[0] ? `/api/photos/${carrier.photos[0].id}/file` : null } : null }];
        }) });
    }
  }
  return { timezone: profile.timezone, routes: routes.filter(r => r.stops.length) };
}
export type MyRouteDTO = Awaited<ReturnType<typeof myRoute>>;
export const fieldProblemTypes = ['Technický problém', 'Nedostupný nosič', 'Nemožnost instalace', 'Poškození', 'Chybějící materiál', 'Jiné'] as const;

/** Authenticated worker operations over canonical work; no billing/FTD/payroll state is inferred. */
export async function executeStop(input: { planId: string; workOrderId: string; jobId?: string; action: string; problemType?: string; note?: string; requestKey?: string }, actor: PlannerActor, db = prisma, installationPhotos?: StoredInstallationPhoto[]) {
  if (!['WORKER', 'TECHNICIAN', 'ADMIN', 'MANAGER'].includes(actor.role)) throw new Error('FORBIDDEN');
  return plannerTransaction(async tx => {
    const { organizationId } = requireTenantContext(); const plan = await getPlan(input.planId, tx);
    const employee = await tx.employee.findFirst({ where: { organizationId, userId: actor.id, isActive: true } });
    const result = plan.planningSummary as unknown as PlanningResult;
    const crew = result.crews.find(c => employee && c.employeeIds.includes(employee.id) && c.stops.some(s => s.workOrderId === input.workOrderId && stopId(s) === (input.jobId ?? input.workOrderId)));
    if (!crew || !employee || !['APPROVED', 'ACTIVE', 'COMPLETED'].includes(plan.status)) throw new Error('FORBIDDEN: pouze vlastní schválená trasa.');
    const profile = (plan.planningInputSnapshot as unknown as PlanningInput).profile;
    if (dayInZone(new Date(), profile.timezone) !== plan.date) throw new Error('Realizovat lze pouze dnešní trasu.');
    const order = input.workOrderId ? await tx.workOrder.findUnique({ where: { id: input.workOrderId, organizationId }, include: { items: true, workTasks: true, crmRealizations: true, navigationOrder: { include: { points: true } } } }) : null;
    if (input.workOrderId && (!order || !order.workTasks.some(t => t.organizationId === organizationId && t.assignedToEmployeeId === employee.id))) throw new Error('FORBIDDEN: pracovní přiřazení se změnilo.');
    if (order && [...order.crmRealizations, ...order.workTasks, ...(order.navigationOrder ? [order.navigationOrder, ...order.navigationOrder.points] : [])].some(r => r.organizationId !== organizationId)) throw new Error('Cross-tenant reference rejected.');
    const stop = crew.stops.find(s => stopId(s) === (input.jobId ?? input.workOrderId))!;
    if (stop.workOrderItemId) {
      const members = await tx.employee.findMany({ where: { organizationId, id: { in: crew.employeeIds }, isActive: true }, select: { userId: true } });
      const response = await executeItem(tx, stop, plan.id, input, actor, installationPhotos, members.flatMap(m => m.userId ? [m.userId] : []));
      if (input.action !== 'inspect') await refreshExecutionPlan(tx, plan.id, result);
      return response;
    }
    if (stop.navigationPointId) {
      if (!await navigationAvailable(tx)) throw new Error('FORBIDDEN: Navigation není aktivní.');
      const point = await tx.navigationPoint.findFirst({ where: { organizationId, id: stop.navigationPointId, navigationOrderId: stop.navigationOrderId, navigationOrder: { organizationId } } });
      const installers = await tx.employee.findMany({ where: { organizationId, id: { in: crew.employeeIds }, isActive: true }, select: { userId: true } });
      if (!point?.installerUserId || !installers.some(e => e.userId === point.installerUserId)) throw new Error('FORBIDDEN: instalátor bodu se změnil.');
      if (!point || !point.isSelectedByClient || ['CANCELLED', 'REMOVED'].includes(point.status) || order?.status === 'CANCELLED') throw new Error('Bod již není dostupný.');
      if (input.action === 'inspect') return { ok: true, navigationOrderId: point.navigationOrderId!, navigationPointId: point.id };
      if (!['start', 'complete', 'photo', 'problem'].includes(input.action)) throw new Error('Neplatná akce.');
      const action = input.action === 'start' ? 'FIELD_POINT_STARTED' : input.action === 'problem' ? 'FIELD_EXECUTION_BLOCKED' : 'FIELD_POINT_COMPLETED';
      const eventId = 'fp-point-' + hash([organizationId, plan.id, point.id, action, input.action === 'problem' ? input.requestKey : '']).slice(0, 32);
      if (await tx.crmAuditLog.findUnique({ where: { id: eventId, organizationId } })) { if (input.action === 'photo') throw new Error('Bod je již dokončen; obnovte trasu.'); return { ok: true }; }
      if (input.action === 'problem') {
        if (!fieldProblemTypes.includes(input.problemType as typeof fieldProblemTypes[number]) || !input.note?.trim() || input.note.length > 1000 || !input.requestKey || !/^[\w-]{8,100}$/.test(input.requestKey)) throw new Error('Vyberte typ problému, popis a platný klíč požadavku.');
        await reportNavigationPointIssue(tx, point.navigationOrderId!, point.id, 'Jiný provozní problém', input.problemType + ': ' + input.note.trim());
      } else {
        if (point.issueReported) throw new Error('Nejprve vyřešte problém bodu v Navigation.');
        if (input.action === 'photo') {
          if (!installationPhotos?.length) throw new Error('Použijte nahrání montážní fotografie.');
          if (point.status === 'INSTALLED') throw new Error('Bod je již dokončen; obnovte trasu.');
          await attachPointInstallationPhotos(point.navigationOrderId!, point.id, installationPhotos, { userId: actor.id, userName: actor.email }, tx);
        }
        if (input.action === 'complete' && point.status !== 'INSTALLED') throw new Error('Dokončete montáž nahráním fotografie po instalaci.');
        // NavigationPoint has no IN_PROGRESS status. Start is an audit event, not a parallel business state.
        if (input.action === 'start' && order && order.status !== 'DONE') await tx.workOrder.update({ where: { id: order.id, organizationId }, data: { status: 'IN_PROGRESS' } });
        if (input.action !== 'start') {
          const pending = await tx.navigationPoint.count({ where: { organizationId, navigationOrderId: point.navigationOrderId, isSelectedByClient: true, OR: [{ status: { notIn: ['INSTALLED', 'CANCELLED'] } }, { issueReported: true }] } });
          if (!pending && order) {
            await tx.workOrder.update({ where: { id: order.id, organizationId }, data: { status: 'DONE' } });
            await tx.workTask.updateMany({ where: { organizationId, workOrderId: order.id }, data: { status: 'DONE' } });
          }
        }
      }
      await tx.crmAuditLog.create({ data: { id: eventId, organizationId, entityType: 'NavigationPoint', entityId: point.id, userId: actor.id, userEmail: actor.email, action,
        detailsJson: JSON.stringify({ planId: plan.id, workOrderId: order?.id ?? null, navigationOrderId: point.navigationOrderId, note: input.note, problemType: input.problemType }) } });
      await refreshExecutionPlan(tx, plan.id, result);
      return { ok: true };
    }
    if (!order) throw new Error('Zakázka nebyla nalezena.');
    if (usesItemExecution(order.items)) throw new Error('Zakázka má samostatné položky; manažer musí přepočítat trasu.');
    if (input.action === 'problem') {
      if (!fieldProblemTypes.includes(input.problemType as typeof fieldProblemTypes[number]) || !input.note?.trim() || input.note.length > 1000 || !input.requestKey || !/^[\w-]{8,100}$/.test(input.requestKey)) throw new Error('Vyberte typ problému, popis a platný klíč požadavku.');
      const eventId = `fp-issue-${hash([organizationId, input.planId, order.id, actor.id, input.requestKey]).slice(0, 32)}`;
      const existing = await tx.crmAuditLog.findUnique({ where: { id: eventId, organizationId } });
      if (existing) return { ok: true };
      const note = `${input.problemType}: ${input.note.trim()}`;
      for (const realization of order.crmRealizations) await tx.crmRealization.update({ where: { id: realization.id, organizationId }, data: { claimNote: [realization.claimNote, note].filter(Boolean).join('\n') } });
      if (order.navigationOrder) for (const point of order.navigationOrder.points.filter(p => p.isSelectedByClient && p.status !== 'INSTALLED')) {
        await tx.navigationPoint.update({ where: { id: point.id, organizationId }, data: { issueReported: true, issueType: 'Jiný provozní problém', issueNote: [point.issueNote, note].filter(Boolean).join('\n') } });
      }
      await tx.crmAuditLog.create({ data: { id: eventId, organizationId, entityType: 'WorkOrder', entityId: order.id, userId: actor.id, userEmail: actor.email,
        action: 'FIELD_EXECUTION_BLOCKED', detailsJson: JSON.stringify({ planId: plan.id, problemType: input.problemType, note, fingerprint: eventId }) } });
      return { ok: true };
    }
    if (!['start', 'complete'].includes(input.action)) throw new Error('Neplatná akce.');
    if (order.status === 'CANCELLED') throw new Error('Zakázka je zrušená.');
    if (order.status === 'DONE') return { ok: true };
    if (input.action === 'complete' && order.navigationOrder) {
      const selected = order.navigationOrder.points.filter(p => p.isSelectedByClient);
      if (!selected.length || selected.some(p => p.status !== 'INSTALLED' || p.issueReported)) throw new Error('Nejprve dokončete body v autoritativním Navigation workflow.');
    }
    if (input.action === 'complete' && order.crmRealizations.some(r => r.claimNote)) throw new Error('Realizace má nevyřešený problém.');
    const lastProblem = await tx.crmAuditLog.findFirst({ where: { organizationId, entityType: 'WorkOrder', entityId: order.id, action: { in: ['FIELD_EXECUTION_BLOCKED', 'FIELD_EXECUTION_RESOLVED'] } }, orderBy: { createdAt: 'desc' } });
    if (input.action === 'complete' && !order.crmRealizations.length && !order.navigationOrder && lastProblem?.action === 'FIELD_EXECUTION_BLOCKED') throw new Error('Manažer musí nejprve vyřešit hlášený problém.');
    if (input.action === 'complete' && order.status !== 'IN_PROGRESS') throw new Error('Nejprve zahajte práci.');
    if (input.action === 'start' && order.status === 'IN_PROGRESS') return { ok: true };
    await tx.workOrder.update({ where: { id: order.id, organizationId }, data: { status: input.action === 'start' ? 'IN_PROGRESS' : 'DONE' } });
    await tx.workTask.updateMany({ where: { organizationId, workOrderId: order.id }, data: { status: input.action === 'start' ? 'IN_PROGRESS' : 'DONE' } });
    await refreshExecutionPlan(tx, plan.id, result);
    await auditPlan(tx, plan.id, actor, input.action === 'start' ? 'FIELD_WORK_STARTED' : 'FIELD_WORK_COMPLETED', { workOrderId: order.id });
    return { ok: true };
  }, db);
}

async function refreshExecutionPlan(tx: Prisma.TransactionClient, planId: string, result: PlanningResult) {
  const { organizationId } = requireTenantContext();
  const stops = result.crews.flatMap(c => c.stops);
  const remainingOrders = await tx.workOrder.count({ where: { organizationId, id: { in: stops.filter(s => !s.navigationPointId && !s.workOrderItemId).map(s => s.workOrderId) }, status: { notIn: ['DONE', 'CANCELLED'] } } });
  const remainingPoints = await tx.navigationPoint.count({ where: { organizationId, id: { in: stops.flatMap(s => s.navigationPointId ? [s.navigationPointId] : []) }, OR: [{ status: { notIn: ['INSTALLED', 'CANCELLED'] } }, { issueReported: true }] } });
  const items = await tx.workOrderItem.findMany({ where: { organizationId, id: { in: stops.flatMap(s => s.workOrderItemId ? [s.workOrderItemId] : []) } }, include: { crmRealization: true } });
  const remainingItems = items.filter(i => i.issueNote || !['DONE', 'CANCELLED'].includes(itemStatus(i))).length;
  await tx.fieldPlan.update({ where: { id: planId, organizationId }, data: { status: remainingOrders + remainingPoints + remainingItems ? 'ACTIVE' : 'COMPLETED' } });
}
