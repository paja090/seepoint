import { executeFieldStep, type FieldExecutionInput } from '../election-removal/step-execution';
import { taskInstructions } from '../election-removal/task-spec';
import { resolvePointClientName } from '../election-removal/point-metadata';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { loadProfile } from './data';
import { dayInZone } from './profile';
import { auditPlan, getPlan, hash, plannerTransaction, type PlannerActor } from './service';
import { executeItem } from './item-execution';
import { itemStatus, usesItemExecution } from './item-jobs';
import { navigationAvailable } from './capabilities';
import { stopId, fieldProblemTypes } from './contracts';
import { attachPointInstallationPhotos, type StoredInstallationPhoto } from '../navigation/navigation-service';
import { reportNavigationPointIssue } from '../navigation/point-issue';
import type { PlanningInput, PlanningResult, MyRouteDTO, MyRouteStop } from './contracts';
import { computeRouteLiveETA } from './live-eta';
import { loadPlanCrewLocations } from './live-location';

export async function myRoute(userId: string, dateOrNow?: string | Date, db = prisma): Promise<MyRouteDTO> {
  const { organizationId } = requireTenantContext();
  const profile = await loadProfile(db); if (!profile?.enabled) return { timezone: 'Europe/Prague', routes: [] };
  const employee = await db.employee.findFirst({ where: { organizationId, userId, isActive: true }, select: { id: true } });
  if (!employee) return { timezone: profile.timezone, routes: [] };

  let targetDate: string;
  if (typeof dateOrNow === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrNow)) {
    targetDate = dateOrNow;
  } else if (dateOrNow instanceof Date) {
    targetDate = dayInZone(dateOrNow, profile.timezone);
  } else {
    targetDate = dayInZone(new Date(), profile.timezone);
  }

  const plans = await db.fieldPlan.findMany({ where: { organizationId, date: targetDate, status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED'] } }, orderBy: { version: 'desc' } });

  const effectivePlans = plans;
  const navigation = await navigationAvailable(db);
  const routes: MyRouteDTO['routes'] = [];
  for (const plan of effectivePlans) {
    const result = plan.planningSummary as unknown as PlanningResult;
    const planLocations = await loadPlanCrewLocations(plan.id, organizationId, db);
    for (const crew of result.crews.filter(c => c.employeeIds.includes(employee.id))) {
      const orders = await db.workOrder.findMany({
        where: {
          organizationId,
          id: { in: crew.stops.map(s => s.workOrderId) },
          OR: [
            { workTasks: { some: { organizationId, assignedToEmployeeId: { in: crew.employeeIds } } } },
            { workTasks: { none: {} } },
          ],
        },
        select: { id: true, title: true, description: true, clientName: true, status: true, workType: true, navigationOrderId: true,
          crmRealizations: { where: { organizationId }, select: { id: true, claimNote: true, status: true } },
          workTasks: { where: { organizationId, assignedToEmployeeId: { in: crew.employeeIds } }, select: { id: true } },
          items: { where: { organizationId }, include: { crmRealization: true, photos: { where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } }, carrier: { include: { photos: { where: { organizationId, workOrderItemId: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } } }, surface: { include: { carrier: { include: { photos: { where: { organizationId, workOrderItemId: null }, orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } } } } } } } } });
      const points = navigation ? await db.navigationPoint.findMany({ where: { organizationId, id: { in: crew.stops.flatMap(s => s.navigationPointId ? [s.navigationPointId] : []) } },
        select: { id: true, navigationOrderId: true, label: true, address: true, status: true, issueReported: true, issueType: true, issueNote: true, installedPhotoId: true, sitePhotoId: true, isSelectedByClient: true, installerUserId: true, clientNote: true } }) : [];
      const electionPoints = await db.electionRemovalPoint.findMany({
        where: { organizationId, id: { in: crew.stops.flatMap(s => s.electionRemovalPointId ? [s.electionRemovalPointId] : []) } },
        include: {
          steps: true,
          campaign: { select: { id: true, name: true, description: true, clientName: true } },
          photos: {
            where: { organizationId, isPrivate: false },
            select: { id: true, url: true, type: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
          }
        }
      });
      const crewUsers = await db.employee.findMany({ where: { organizationId, id: { in: crew.employeeIds }, isActive: true }, select: { userId: true } });
      const starts = await db.crmAuditLog.findMany({ where: { organizationId, entityType: 'NavigationPoint', entityId: { in: points.map(p => p.id) }, action: 'FIELD_POINT_STARTED' }, select: { entityId: true, createdAt: true } });
      const pointCompletions = await db.crmAuditLog.findMany({ where: { organizationId, entityType: 'NavigationPoint', entityId: { in: points.map(p => p.id) }, action: 'FIELD_POINT_COMPLETED' }, select: { entityId: true, createdAt: true } });
      const orderStarts = await db.crmAuditLog.findMany({ where: { organizationId, entityType: 'WorkOrder', entityId: { in: orders.map(o => o.id) }, action: 'FIELD_WORK_STARTED' }, select: { entityId: true, createdAt: true } });
      const orderCompletions = await db.crmAuditLog.findMany({ where: { organizationId, entityType: 'WorkOrder', entityId: { in: orders.map(o => o.id) }, action: 'FIELD_WORK_COMPLETED' }, select: { entityId: true, createdAt: true } });
      const orderLogs = await db.crmAuditLog.findMany({
        where: { organizationId, entityType: 'WorkOrder', entityId: { in: orders.map(o => o.id) }, action: { in: ['FIELD_EXECUTION_BLOCKED', 'FIELD_EXECUTION_RESOLVED'] } },
        orderBy: { createdAt: 'desc' },
        select: { entityId: true, action: true, detailsJson: true }
      });
      const pitstopStarts = await db.crmAuditLog.findMany({ where: { organizationId, entityType: 'WarehousePitstop', id: { in: crew.stops.filter(s => s.isWarehousePitstop).map(s => `fp-pitstop-${plan.id}-${stopId(s)}-FIELD_POINT_STARTED`) }, action: 'FIELD_POINT_STARTED' }, select: { entityId: true, createdAt: true } });
      const pitstopCompletions = await db.crmAuditLog.findMany({ where: { organizationId, entityType: 'WarehousePitstop', id: { in: crew.stops.filter(s => s.isWarehousePitstop).map(s => `fp-pitstop-${plan.id}-${stopId(s)}-FIELD_POINT_COMPLETED`) }, action: 'FIELD_POINT_COMPLETED' }, select: { entityId: true, createdAt: true } });
      const tripLogs = await db.crmAuditLog.findMany({
        where: { organizationId, entityType: 'FieldPlanCrew', entityId: `${plan.id}-${crew.id}`, action: { in: ['FIELD_TRIP_STARTED', 'FIELD_TRIP_COMPLETED'] } },
        orderBy: { createdAt: 'asc' },
        select: { action: true, createdAt: true }
      });
      const tripStart = tripLogs.find(l => l.action === 'FIELD_TRIP_STARTED');
      const tripEnd = tripLogs.find(l => l.action === 'FIELD_TRIP_COMPLETED');
      const tripStartedAt = tripStart ? tripStart.createdAt.toISOString() : null;
      const tripCompletedAt = tripEnd ? tripEnd.createdAt.toISOString() : null;
      const actualTripMinutes = tripStart && tripEnd
        ? Math.max(1, Math.round((tripEnd.createdAt.getTime() - tripStart.createdAt.getTime()) / 60000))
        : null;

      const rawStops = crew.stops.flatMap((s): MyRouteStop[] => {
          if (s.electionRemovalPointId) {
            const ep = electionPoints.find(e => e.id === s.electionRemovalPointId);
            if (!ep) return [];
            const step = ep.steps.find(step => step.id === s.fieldWorkStepId);
            if (step ? step.assignedFieldPlanId !== plan.id || step.assignedCrewId !== crew.id : ep.assignedFieldPlanId !== plan.id || ep.assignedCrewId !== crew.id) return [];
            const startedAt = step ? step.startedAt : ep.startedAt;
            const completedAt = step ? step.completedAt : ep.completedAt;

            const resolvedClient = resolvePointClientName({
              layerName: ep.layerName,
              description: ep.description,
              campaignClientName: ep.campaign?.clientName,
              campaignName: ep.campaign?.name,
            });

            const stopPhotos = ep.photos?.map(ph => ({
              id: ph.id,
              url: `/api/photos/${encodeURIComponent(ph.id)}/file`,
              type: ph.type,
              createdAt: ph.createdAt.toISOString(),
            })) ?? [];

            return [{
              fieldWorkStepId: step?.id, quantity: step?.quantity ?? ep.quantity, completedQuantity: step?.completedQuantity ?? 0,
              referenceUrl: ep.referenceUrl, photoType: step?.photoType, fieldWorkStepKind: step?.kind,
              jobId: stopId(s),
              workOrderItemId: null,
              navigationPointId: null,
              electionRemovalPointId: ep.id,
              address: null,
              pointPhotoUrl: stopPhotos[0]?.url ?? null,
              photos: stopPhotos,
              workOrderId: ep.campaignId,
              orderTitle: ep.campaign?.name ? `Akce: ${ep.campaign.name}` : 'Terénní práce',
              campaignName: ep.campaign?.name ?? 'Terénní práce',
              title: step?.label ?? ep.label,
              clientName: resolvedClient || ep.campaign?.clientName || ep.campaign?.name || 'Terénní práce',
              layerName: ep.layerName,
              instructions: taskInstructions({ ...ep, clientName: resolvedClient }) + (ep.campaign?.description ? '. Společné instrukce: ' + ep.campaign.description : '') + ep.steps.filter(x => x.custodyNote).map(x => '. Materiál: ' + x.custodyNote).join(''),
              status: (step?.status ?? ep.status) === 'COMPLETED' ? 'DONE' : (step?.status ?? ep.status) === 'ISSUE' ? 'ISSUE' : (step?.status ?? ep.status) === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PLANNED',
              issueType: ep.status === 'ISSUE' ? ep.issueType : null,
              issueNote: step?.issueNote ?? (ep.status === 'ISSUE' ? ep.issueNote : null),
              workType: s.workType,
              startAt: s.startAt,
              endAt: s.endAt,
              location: s.location,
              taskId: null,
              navigationOrderId: null,
              carrier: null,
              serviceMinutes: s.serviceMinutes,
              travelMinutes: s.travel ? Math.round(s.travel.durationSeconds / 60) : undefined,
              startedAt: startedAt?.toISOString() ?? null,
              completedAt: completedAt?.toISOString() ?? null,
              actualDurationMinutes: (() => {
                if (!startedAt || !completedAt) return null;
                const diffMs = completedAt.getTime() - startedAt.getTime();
                if (diffMs < 60000) return null; // Ignored if under 1 minute (forgot to click Zahájit)
                return Math.max(1, Math.round(diffMs / 60000));
              })(),
              isInstantCompletion: Boolean(
                startedAt &&
                completedAt &&
                completedAt.getTime() - startedAt.getTime() < 60000
              ),
            }];
          }
          if (s.isWarehousePitstop) {
            const pStart = pitstopStarts.find(c => c.entityId === stopId(s));
            const pComp = pitstopCompletions.find(c => c.entityId === stopId(s));
            const pDiffMs = pStart && pComp ? pComp.createdAt.getTime() - pStart.createdAt.getTime() : null;
            const pIsInstant = pDiffMs != null && pDiffMs < 60000;
            const pActualMins = pDiffMs != null && !pIsInstant ? Math.max(1, Math.round(pDiffMs / 60000)) : null;

            return [{
              jobId: stopId(s),
              workOrderItemId: null,
              navigationPointId: null,
              electionRemovalPointId: null,
              address: null,
              pointPhotoUrl: null,
              workOrderId: 'warehouse',
              orderTitle: 'Skladový mezistav',
              title: s.title,
              clientName: 'Sklad',
              instructions: '',
              status: pComp ? 'DONE' : pStart ? 'IN_PROGRESS' : 'PLANNED',
              issueType: null,
              issueNote: null,
              workType: s.workType,
              startAt: s.startAt,
              endAt: s.endAt,
              location: s.location,
              taskId: null,
              navigationOrderId: null,
              carrier: null,
              serviceMinutes: s.serviceMinutes,
              travelMinutes: s.travel ? Math.round(s.travel.durationSeconds / 60) : undefined,
              startedAt: pStart?.createdAt.toISOString() ?? null,
              completedAt: pComp?.createdAt.toISOString() ?? null,
              actualDurationMinutes: pActualMins,
              isInstantCompletion: pIsInstant,
            }];
          }
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

          const isItemIssue = Boolean(item?.issueNote || item?.crmRealization?.claimNote || item?.crmRealization?.status === 'CLAIM');
          const isPointIssue = Boolean(point?.issueReported);
          const latestOrderIssue = order ? orderLogs.find(l => l.entityId === order.id) : null;
          const orderClaim = order?.crmRealizations.find(r => r.claimNote || r.status === 'CLAIM');
          const isOrderIssue = Boolean(order && !item && !point && (orderClaim || latestOrderIssue?.action === 'FIELD_EXECUTION_BLOCKED'));

          const stopStatus = point
            ? !point.isSelectedByClient || ['CANCELLED', 'REMOVED'].includes(point.status)
              ? 'CANCELLED'
              : isPointIssue
              ? 'ISSUE'
              : point.status === 'INSTALLED'
              ? 'DONE'
              : starts.some(a => a.entityId === point.id)
              ? 'IN_PROGRESS'
              : 'PLANNED'
            : item
            ? isItemIssue
              ? 'ISSUE'
              : itemStatus(item)
            : isOrderIssue
            ? 'ISSUE'
            : order!.status;

          let stopIssueType: string | null = null;
          let stopIssueNote: string | null = null;

          if (isPointIssue) {
            stopIssueType = point?.issueType ?? 'Provozní zádrhel';
            stopIssueNote = point?.issueNote ?? null;
          } else if (isItemIssue) {
            stopIssueType = 'Reklamace / Problém';
            stopIssueNote = item?.crmRealization?.claimNote ?? item?.issueNote ?? null;
          } else if (isOrderIssue) {
            if (latestOrderIssue?.detailsJson) {
              try {
                const parsed = JSON.parse(latestOrderIssue.detailsJson);
                stopIssueType = parsed.problemType ?? 'Problém na zakázce';
                stopIssueNote = parsed.note ?? null;
              } catch {
                stopIssueType = 'Problém na zakázce';
              }
            } else if (orderClaim?.claimNote) {
              stopIssueType = 'Reklamace / Problém';
              stopIssueNote = orderClaim.claimNote;
            } else {
              stopIssueType = 'Problém na zakázce';
            }
          }

          const rawStart = item?.startedAt?.toISOString()
            ?? (point ? starts.find(a => a.entityId === point.id)?.createdAt.toISOString() : orderStarts.find(a => a.entityId === order?.id)?.createdAt.toISOString())
            ?? null;
          const rawComp = item?.completedAt?.toISOString()
            ?? (point ? pointCompletions.find(a => a.entityId === point.id)?.createdAt.toISOString() : orderCompletions.find(a => a.entityId === order?.id)?.createdAt.toISOString())
            ?? null;
          const rawDiffMs = rawStart && rawComp ? new Date(rawComp).getTime() - new Date(rawStart).getTime() : null;
          const rawIsInstant = rawDiffMs != null && rawDiffMs < 60000;
          const rawActualMins = rawDiffMs != null && !rawIsInstant ? Math.max(1, Math.round(rawDiffMs / 60000)) : null;

          return [{
            jobId: stopId(s),
            workOrderItemId: item?.id ?? null,
            navigationPointId: point?.id ?? null,
            electionRemovalPointId: null,
            address: point?.address ?? null,
            pointPhotoUrl: item?.photos[0] ? `/api/photos/${item.photos[0].id}/file` : point?.installedPhotoId || point?.sitePhotoId ? `/api/photos/${point.installedPhotoId ?? point.sitePhotoId}/file` : null,
            workOrderId: order?.id ?? '',
            orderTitle: order?.title ? `Zakázka: ${order.title}` : s.clientName ? `Klient: ${s.clientName}` : null,
            title: point?.label ?? (item ? s.title : order!.title),
            clientName: order?.clientName ?? s.clientName ?? null,
            instructions: point ? point.clientNote : item?.description ?? order!.description,
            status: stopStatus,
            issueType: stopIssueType,
            issueNote: stopIssueNote,
            workType: s.workType,
            startAt: s.startAt,
            endAt: s.endAt,
            location: s.location,
            taskId: order?.workTasks[0]?.id ?? null,
            navigationOrderId: point?.navigationOrderId ?? order?.navigationOrderId ?? null,
            carrier: carrier ? { id: carrier.id, name: carrier.name, code: carrier.code, city: carrier.city, address: carrier.address, photoUrl: carrier.photos[0] ? `/api/photos/${carrier.photos[0].id}/file` : null } : null,
            serviceMinutes: s.serviceMinutes,
            travelMinutes: s.travel ? Math.round(s.travel.durationSeconds / 60) : undefined,
            startedAt: rawStart,
            completedAt: rawComp,
            actualDurationMinutes: rawActualMins,
            isInstantCompletion: rawIsInstant,
          }];
        });

      const liveEtaResult = computeRouteLiveETA(
        {
          departureAt: crew.departureAt,
          endAt: crew.endAt,
          tripStartedAt,
          tripCompletedAt,
          stops: rawStops,
        },
        { targetDate }
      );

      routes.push({
        planId: plan.id,
        crewName: crew.names?.length ? crew.names.join(', ') : null,
        vehicleName: crew.vehicleName,
        departureAt: crew.departureAt,
        endAt: crew.endAt,
        travelMinutes: Math.round((crew.travelSeconds ?? 0) / 60),
        serviceMinutes: crew.serviceMinutes ?? 0,
        distanceKm: Number(((crew.distanceMeters ?? 0) / 1000).toFixed(1)),
        tripStartedAt,
        tripCompletedAt,
        actualTripMinutes,
        liveEstimatedEndAt: liveEtaResult.liveEstimatedEndAt,
        totalDelayMinutes: liveEtaResult.totalDelayMinutes,
        liveLocation: planLocations[crew.id] ?? null,
        stops: liveEtaResult.stops,
      });
    }
  }
  return { timezone: profile.timezone, date: targetDate, routes: routes.filter(r => r.stops.length) };
}
export { fieldProblemTypes, type MyRouteDTO, type MyRouteStop, type MyRouteCarrier } from './contracts';

/** Authenticated worker operations over canonical work; no billing/FTD/payroll state is inferred. */
export async function executeStop(input: FieldExecutionInput & { planId: string; workOrderId: string; jobId?: string }, actor: PlannerActor, db = prisma, installationPhotos?: StoredInstallationPhoto[]) {
  if (!['WORKER', 'TECHNICIAN', 'ADMIN', 'MANAGER'].includes(actor.role)) throw new Error('FORBIDDEN');
  return plannerTransaction(async tx => {
    const { organizationId } = requireTenantContext(); const plan = await getPlan(input.planId, tx);
    const employee = await tx.employee.findFirst({ where: { organizationId, userId: actor.id, isActive: true } });
    const result = plan.planningSummary as unknown as PlanningResult;
    const crew = result.crews.find(c => employee && c.employeeIds.includes(employee.id) && (['start_trip', 'complete_trip'].includes(input.action) || c.stops.some(s => stopId(s) === (input.jobId ?? input.workOrderId))));
    if (!crew || !employee || !['APPROVED', 'ACTIVE', 'COMPLETED'].includes(plan.status)) throw new Error('FORBIDDEN: pouze vlastní schválená trasa.');
    const profile = (plan.planningInputSnapshot as unknown as PlanningInput).profile;
    const today = dayInZone(new Date(), profile.timezone);
    if (plan.date < today && !['ADMIN', 'MANAGER'].includes(actor.role)) {
      throw new Error('Nelze realizovat trasu z minulosti; kontaktujte dispečera.');
    }
    if (input.action === 'start_trip' || input.action === 'complete_trip') {
      if (input.action === 'complete_trip' && crew.stops.some(s => s.fieldWorkStepId) && await tx.fieldWorkStep.count({ where: { organizationId, assignedFieldPlanId: plan.id, assignedCrewId: crew.id, status: { notIn: ['COMPLETED','CANCELLED'] } } })) throw new Error('Nejprve dokončete všechny kroky včetně doručení materiálu.');
      const actionStr = input.action === 'start_trip' ? 'FIELD_TRIP_STARTED' : 'FIELD_TRIP_COMPLETED';
      const eventId = `fp-trip-${plan.id}-${crew.id}-${actionStr}`;
      const existing = await tx.crmAuditLog.findUnique({ where: { id: eventId, organizationId } });
      if (existing) return { ok: true };
      await tx.crmAuditLog.create({
        data: {
          id: eventId,
          organizationId,
          entityType: 'FieldPlanCrew',
          entityId: `${plan.id}-${crew.id}`,
          userId: actor.id,
          userEmail: actor.email,
          action: actionStr,
          detailsJson: JSON.stringify({ planId: plan.id, crewId: crew.id, crewName: crew.names?.join(', ') })
        }
      });
      return { ok: true };
    }
    const stop = crew.stops.find(s => stopId(s) === (input.jobId ?? input.workOrderId));
    if (!stop) throw new Error('Zastávka nebyla v trase nalezena.');

    if (stop.workOrderItemId) {
      const members = await tx.employee.findMany({ where: { organizationId, id: { in: crew.employeeIds }, isActive: true }, select: { userId: true } });
      const response = await executeItem(tx, stop, plan.id, input, actor, installationPhotos, members.flatMap(m => m.userId ? [m.userId] : []));
      if (input.action !== 'inspect') await refreshExecutionPlan(tx, plan.id, result);
      return response;
    }

    if (stop.isWarehousePitstop) {
      if (input.action === 'inspect') return { ok: true };
      if (!['start', 'complete'].includes(input.action)) throw new Error('Neplatná akce.');
      const actionStr = input.action === 'start' ? 'FIELD_POINT_STARTED' : 'FIELD_POINT_COMPLETED';
      const eventId = `fp-pitstop-${plan.id}-${stop.jobId!}-${actionStr}`;
      const existing = await tx.crmAuditLog.findUnique({ where: { id: eventId, organizationId } });
      if (existing) return { ok: true };
      await tx.crmAuditLog.create({ data: { id: eventId, organizationId, entityType: 'WarehousePitstop', entityId: stop.jobId!, userId: actor.id, userEmail: actor.email, action: actionStr, detailsJson: '{}' } });
      await refreshExecutionPlan(tx, plan.id, result);
      return { ok: true };
    }

    if (stop.electionRemovalPointId) {
      const response = await executeFieldStep(tx, stop, plan.id, crew.id, input, actor);
      if (input.action !== 'inspect') await refreshExecutionPlan(tx, plan.id, result);
      return response;
    }

    const orderId = stop.workOrderId || input.workOrderId;
    const order = orderId ? await tx.workOrder.findUnique({ where: { id: orderId, organizationId }, include: { items: true, workTasks: true, crmRealizations: true, navigationOrder: { include: { points: true } } } }) : null;
    if (orderId && (!order || (order.workTasks.length > 0 && !order.workTasks.some(t => t.organizationId === organizationId && (t.assignedToEmployeeId === employee.id || crew.employeeIds.includes(t.assignedToEmployeeId ?? '')))))) throw new Error('FORBIDDEN: pracovní přiřazení se změnilo.');
    if (order && [...order.crmRealizations, ...order.workTasks, ...(order.navigationOrder ? [order.navigationOrder, ...order.navigationOrder.points] : [])].some(r => r.organizationId !== organizationId)) throw new Error('Cross-tenant reference rejected.');
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
  const remainingOrders = await tx.workOrder.count({ where: { organizationId, id: { in: stops.filter(s => !s.navigationPointId && !s.workOrderItemId && !s.electionRemovalPointId).map(s => s.workOrderId) }, status: { notIn: ['DONE', 'CANCELLED'] } } });
  const remainingPoints = await tx.navigationPoint.count({ where: { organizationId, id: { in: stops.flatMap(s => s.navigationPointId ? [s.navigationPointId] : []) }, OR: [{ status: { notIn: ['INSTALLED', 'CANCELLED'] } }, { issueReported: true }] } });
  const items = await tx.workOrderItem.findMany({ where: { organizationId, id: { in: stops.flatMap(s => s.workOrderItemId ? [s.workOrderItemId] : []) } }, include: { crmRealization: true } });
  const remainingItems = items.filter(i => i.issueNote || !['DONE', 'CANCELLED'].includes(itemStatus(i))).length;
  const remainingElections = await tx.electionRemovalPoint.count({ where: { organizationId, id: { in: stops.flatMap(s => s.electionRemovalPointId && !s.fieldWorkStepId ? [s.electionRemovalPointId] : []) }, assignedFieldPlanId: planId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } });
  const remainingSteps = await tx.fieldWorkStep.count({ where: { organizationId, assignedFieldPlanId: planId, status: { notIn: ['COMPLETED','CANCELLED'] } } });
  const warehouseIds = stops.filter(s => s.isWarehousePitstop).map(s => `fp-pitstop-${planId}-${stopId(s)}-FIELD_POINT_COMPLETED`);
  const warehouseDone = warehouseIds.length ? await tx.crmAuditLog.count({ where: { organizationId, id: { in: warehouseIds } } }) : 0;
  await tx.fieldPlan.update({ where: { id: planId, organizationId }, data: { status: remainingOrders + remainingPoints + remainingItems + remainingElections + remainingSteps + warehouseIds.length - warehouseDone ? 'ACTIVE' : 'COMPLETED' } });
}
