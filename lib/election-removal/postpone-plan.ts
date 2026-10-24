import { isModuleEnabled } from '../organization-modules';
import { loadPlanningData } from '../field-planning/data';
import { syncWorkOrderTasks } from '../work-task-sync';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { auditPlan, hash, json, plannerTransaction, requirePlannerManager, type PlannerActor } from '../field-planning/service';
import { dayInZone, zonedTime } from '../field-planning/profile';
import { stopId, type PlannedCrew, type PlanningInput, type PlanningResult } from '../field-planning/contracts';
import { fieldAvailability } from './availability';
import { createVehicleReservation } from '../vehicle-reservation-service';

export function nextContinuationDay(planDate: string, timezone: string, now = new Date()) {
  const base = [planDate, dayInZone(now, timezone)].sort().at(-1)!;
  return new Date(Date.parse(base + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
}

export function shiftPlanTime(value: string, fromDate: string, toDate: string, timezone: string) {
  const date = new Date(value);
  const localDay = dayInZone(date, timezone);
  const dayOffset = Math.round((Date.parse(localDay + 'T12:00:00Z') - Date.parse(fromDate + 'T12:00:00Z')) / 86400000);
  const targetDay = new Date(Date.parse(toDate + 'T12:00:00Z') + dayOffset * 86400000).toISOString().slice(0, 10);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  return new Date(zonedTime(targetDay, time, timezone) + date.getUTCSeconds() * 1000 + date.getUTCMilliseconds()).toISOString();
}

/** Continue the same crews and custody; never reset work or require a physical handoff. */
export async function postponeFieldPlan(planId: string, actor: PlannerActor, db = prisma, now = new Date()) {
  requirePlannerManager(actor);
  const { organizationId } = requireTenantContext();
  if (typeof planId !== 'string' || !planId) throw new Error('Chybí trasa.');
  return plannerTransaction(async tx => {
    const requestKey = 'continue-' + hash([organizationId, planId]).slice(0, 40);
    const existing = await tx.fieldPlan.findUnique({ where: { organizationId_requestKey: { organizationId, requestKey } } });
    if (existing) return { id: existing.id, date: existing.date };
    const original = await tx.fieldPlan.findFirst({ where: { id: planId, organizationId } });
    if (!original || !['APPROVED', 'ACTIVE'].includes(original.status)) throw new Error('Přesunout lze schválenou nebo probíhající trasu.');
    const input = original.planningInputSnapshot as unknown as PlanningInput;
    const result = original.planningSummary as unknown as PlanningResult;
    const ordinaryStops=result.crews.flatMap(c=>c.stops.filter(s=>!s.fieldWorkStepId&&!s.isWarehousePitstop));
    if(ordinaryStops.some(s=>s.electionRemovalPointId))throw new Error('Starší terénní body vyžadují doplnění strukturovaných kroků.');
    if (ordinaryStops.length) {
      const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { plan: true, enabledModules: true } });
      if (!isModuleEnabled(organization, 'workRoute')) throw new Error('FORBIDDEN: Plánování výjezdů není aktivní.');
    }
    const timezone = input.profile.timezone;
    const date = nextContinuationDay(original.date, timezone, now);
    const ordinary=ordinaryStops.length ? await loadPlanningData(date,{jobIds:[...new Set(ordinaryStops.map(stopId))],excludePlanIds:[original.id]},tx) : null;
    const ordinaryJobs=new Map(ordinary?.jobs.map(j=>[j.id,j])??[]);
    if (ordinary?.jobs.some(job => job.blockedReason === 'Zastávka již patří jinému schválenému plánu.')) throw new Error('Práce již patří jinému výjezdu. Obnovte plánování.');
    const steps = await tx.fieldWorkStep.findMany({ where: { organizationId, assignedFieldPlanId: original.id, status: { notIn: ['COMPLETED', 'CANCELLED'] } }, include: { point: true } });
    const unfinished = new Map(steps.map(step => [step.id, step]));
    const completedWarehouse = await tx.crmAuditLog.findMany({ where: { organizationId, id: { in: result.crews.flatMap(c => c.stops.filter(s => s.isWarehousePitstop).map(s => 'fp-pitstop-' + original.id + '-' + stopId(s) + '-FIELD_POINT_COMPLETED')) } }, select: { entityId: true } });
    const warehouseDone = new Set(completedWarehouse.map(log => log.entityId));
    const shift = (value: string) => shiftPlanTime(value, original.date, date, timezone);
    const crews: PlannedCrew[] = result.crews.flatMap(crew => {
      const stops = crew.stops.filter(stop => stop.fieldWorkStepId ? unfinished.get(stop.fieldWorkStepId)?.assignedCrewId === crew.id : stop.isWarehousePitstop ? !warehouseDone.has(stopId(stop)) : Boolean(ordinaryJobs.has(stopId(stop))&&!['DONE','CANCELLED'].includes(ordinaryJobs.get(stopId(stop))!.status))).map((stop, index) => {
        const step = stop.fieldWorkStepId ? unfinished.get(stop.fieldWorkStepId) : undefined;
        const startAt = shift(stop.startAt);
        const ordinaryJob=ordinaryJobs.get(stopId(stop));
        if(ordinaryJob && [ordinaryJob.deadlineAt,ordinaryJob.constraints.windowEnd,...(['INSTALLATION','REINSTALLATION','NAVIGATION_INSTALLATION'].includes(ordinaryJob.workType)?[ordinaryJob.campaignDateFrom]:[])].some(end=>end&&Date.parse(shift(stop.endAt))>Date.parse(end)))throw new Error('Práce „'+stop.title+'“ má pevný termín. Upravte jej před přesunem.');
        if (step?.point.deadlineAt && Date.parse(startAt) > step.point.deadlineAt.getTime()) throw new Error('Bod „' + step.point.label + '“ má pevný termín. Upravte jej před přesunem trasy.');
        if (step?.point.windowEnd && Date.parse(shift(stop.endAt)) > step.point.windowEnd.getTime()) throw new Error('Bod „' + step.point.label + '“ má pevné časové okno. Upravte jej před přesunem trasy.');
        return { ...stop, routeOrder: index + 1, arrivalAt: shift(stop.arrivalAt), startAt, endAt: shift(stop.endAt), quantity: step ? step.quantity - step.completedQuantity : stop.quantity };
      });
      if (!stops.length) return [];
      return [{ ...crew, liveLocation: null, stops, departureAt: shift(crew.departureAt), endAt: shift(crew.endAt), serviceMinutes: stops.reduce((sum, stop) => sum + stop.serviceMinutes, 0), travelSeconds: stops.reduce((sum, stop) => sum + stop.travel.durationSeconds, crew.returnLeg.durationSeconds), distanceMeters: stops.reduce((sum, stop) => sum + stop.travel.distanceMeters, crew.returnLeg.distanceMeters) }];
    });
    if (!crews.length) throw new Error('Všechny body této trasy jsou již hotové.');
    const movedIds = crews.flatMap(c => c.stops.flatMap(s => s.fieldWorkStepId ? [s.fieldWorkStepId] : []));
    if (movedIds.length !== steps.length || new Set(movedIds).size !== steps.length) throw new Error('Přiřazení bodů se změnilo. Obnovte trasu.');
    const availability = await fieldAvailability(tx, organizationId, date, undefined, timezone);
    for (const crew of crews) {
      if (crew.employeeIds.some(id => !availability.employees.some(e => e.id === id && e.available))) throw new Error('Posádka má na ' + date + ' jinou práci nebo absenci. Vyberte jiný termín v plánování.');
      const vehicle = availability.vehicles.find(v => v.id === crew.vehicleId);
      if (crew.vehicleId && (!vehicle || vehicle.reserved || ['SERVICE', 'OUT_OF_SERVICE'].includes(vehicle.status))) throw new Error('Vozidlo je na ' + date + ' obsazené nebo v servisu. Vyberte jiný termín v plánování.');
    }
    const summary: PlanningResult = { ...result, crews, conflicts: [], unassigned: [], estimated: true, explanation: 'Pokračování nedokončené práce se stejnými posádkami a vozidly. Pořadí a časy jsou převzaty z původní trasy, přejezdy jsou orientační.', serviceMinutes: crews.reduce((n,c)=>n+c.serviceMinutes,0), travelSeconds: crews.reduce((n,c)=>n+c.travelSeconds,0), distanceMeters: crews.reduce((n,c)=>n+c.distanceMeters,0) };
    const latest = await tx.fieldPlan.findFirst({ where: { organizationId, date }, orderBy: { version: 'desc' } });
    const continuation = await tx.fieldPlan.create({ data: { organizationId, date, version: (latest?.version ?? 0) + 1, requestKey, requestHash: hash([original.id,date]), parentPlanId: original.id, electionCampaignId: original.electionCampaignId, status: 'APPROVED', createdByUserId: actor.id, approvedByUserId: actor.id, approvedAt: now, planningInputSnapshot: json({ ...input, date, now: now.toISOString() }), planningSummary: json(summary) } });
    for (const step of steps) {
      const changed = await tx.fieldWorkStep.updateMany({ where: { id: step.id, organizationId, assignedFieldPlanId: original.id, assignedCrewId: step.assignedCrewId, version: step.version }, data: { assignedFieldPlanId: continuation.id, version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error('Bod se mezitím změnil. Obnovte trasu.');
    }
    for (const crew of crews) for (const stop of crew.stops) if (stop.electionRemovalPointId) {
      await tx.electionRemovalPoint.update({ where: { id: stop.electionRemovalPointId, organizationId }, data: { assignedFieldPlanId: continuation.id, assignedCrewId: crew.id, plannedArrivalAt: new Date(stop.arrivalAt), plannedOrder: stop.routeOrder } });
    }
    const scheduledOrders=new Set<string>();
    for(const crew of crews)for(const stop of crew.stops){
      if(stop.fieldWorkStepId||stop.isWarehousePitstop)continue;
      if(stop.navigationPointId)await tx.navigationPoint.update({where:{id:stop.navigationPointId,organizationId},data:{plannedInstallationAt:new Date(stop.startAt),routeOrder:stop.routeOrder}});
      if(stop.crmRealizationId)await tx.crmRealization.update({where:{id:stop.crmRealizationId,organizationId},data:{plannedDate:new Date(stop.startAt)}});
      if(stop.workOrderId&&!scheduledOrders.has(stop.workOrderId)){
        scheduledOrders.add(stop.workOrderId);
        await tx.workOrder.update({where:{id:stop.workOrderId,organizationId},data:{scheduledAt:new Date(stop.startAt)}});
        await syncWorkOrderTasks(stop.workOrderId,tx);
      }
    }
    const oldReservations = (original.approvalSnapshot as { reservationIds?: string[] } | null)?.reservationIds ?? [];
    await tx.vehicleReservation.updateMany({ where: { organizationId, id: { in: oldReservations } }, data: { status: 'CANCELLED' } });
    const reservationIds: string[] = [];
    for (const crew of crews) if (crew.vehicleId) {
      const reservation = await createVehicleReservation(tx, { id: 'continue-' + hash([continuation.id,crew.id]).slice(0,32), vehicleId: crew.vehicleId, employeeId: crew.employeeIds[0], dateFrom: new Date(date + 'T00:00:00Z'), dateTo: new Date(date + 'T00:00:00Z'), purpose: 'Pokračování výjezdu ' + continuation.id });
      reservationIds.push(reservation.id);
    }
    await tx.fieldPlan.update({ where: { id: continuation.id, organizationId }, data: { approvalSnapshot: json({ reservationIds }) } });
    const movedWarehouse = new Set(crews.flatMap(c=>c.stops.filter(s=>s.isWarehousePitstop).map(stopId)));
    const movedOrdinary=new Set(crews.flatMap(c=>c.stops.filter(s=>!s.fieldWorkStepId&&!s.isWarehousePitstop).map(stopId)));
    await tx.fieldPlan.update({ where: { id: original.id, organizationId }, data: { status: 'COMPLETED', planningSummary: json({ ...result, crews: result.crews.map(c=>({ ...c, stops:c.stops.filter(s=>!movedWarehouse.has(stopId(s))&&!movedOrdinary.has(stopId(s))) })) }) } });
    await auditPlan(tx, original.id, actor, 'FIELD_PLAN_CONTINUED', { continuationPlanId: continuation.id, date, stepIds: movedIds, ordinaryJobIds:[...movedOrdinary], warehouseIds: [...movedWarehouse] });
    await auditPlan(tx, continuation.id, actor, 'FIELD_PLAN_APPROVED', { continuedFromPlanId: original.id, reservationIds });
    return { id: continuation.id, date };
  }, db);
}
