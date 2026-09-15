import { createHash } from 'node:crypto';
import { Prisma, type FieldPlan } from '@prisma/client';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { canManageAbsences } from '../absences';
import { syncWorkOrderTasks } from '../work-task-sync';
import { createVehicleReservation } from '../vehicle-reservation-service';
import { loadPlanningData, loadProfile } from './data';
import { parseProfile, coordinates, zonedTime } from './profile';
import { planFieldWork } from './planning-engine';
import { googleTravelProvider } from './travel';
import { navigationAvailable } from './capabilities';
import { stopId } from './contracts';
import type { CrewInput, PlanningInput, PlanningResult, PlanView } from './contracts';

export type PlannerActor = { id: string; email: string; role: string };
export function requirePlannerManager(actor: PlannerActor) {
  if (!canManageAbsences(actor.role)) throw new Error('FORBIDDEN: plán může měnit pouze správce nebo manažer.');
}
export function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
export function hash(value: unknown) {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function planView(row: FieldPlan): PlanView {
  return { id: row.id, date: row.date, version: row.version, status: row.status, parentPlanId: row.parentPlanId,
    approvedAt: row.approvedAt?.toISOString() ?? null, result: row.planningSummary as unknown as PlanningResult,
    profile: (row.planningInputSnapshot as unknown as PlanningInput).profile };
}
export async function plannerTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, db = prisma): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }); }
    catch (error) {
      if (i < 5 && error && typeof error === 'object' && 'code' in error && ['P2034', 'P2002'].includes(String(error.code))) { await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))); continue; }
      throw error;
    }
  }
}
export async function auditPlan(tx: Prisma.TransactionClient, id: string, actor: PlannerActor, action: string, details: unknown = {}) {
  await tx.crmAuditLog.create({ data: { organizationId: requireTenantContext().organizationId, entityType: 'FieldPlan', entityId: id,
    userId: actor.id, userEmail: actor.email, action, detailsJson: JSON.stringify(details) } });
}
export async function getPlan(id: string, db: Prisma.TransactionClient = prisma) {
  const row = await db.fieldPlan.findUnique({ where: { id, organizationId: requireTenantContext().organizationId } });
  if (!row) throw new Error('NOT_FOUND: plán nebyl nalezen.');
  if (!await navigationAvailable(db) && (row.planningInputSnapshot as unknown as PlanningInput).jobs.some(j => j.navigationPointId)) throw new Error('FORBIDDEN: Navigation není aktivní.');
  return row;
}
export async function saveProfile(value: unknown, actor: PlannerActor) {
  requirePlannerManager(actor); const configuration = parseProfile(value);
  const { organizationId } = requireTenantContext();
  return plannerTransaction(async tx => {
    const navigation = await navigationAvailable(tx);
    if (!navigation && (Object.keys(configuration.navigationPointMinutes ?? {}).length || Object.keys(configuration.serviceMinutes).some(k => k.startsWith('NAVIGATION_INSTALLATION')))) throw new Error('FORBIDDEN: Navigation není aktivní.');
    const pointIds = Object.keys(configuration.navigationPointMinutes ?? {});
    if (pointIds.length && await tx.navigationPoint.count({ where: { organizationId, id: { in: pointIds } } }) !== pointIds.length) throw new Error('Cross-tenant NavigationPoint rejected.');
    const stored = structuredClone(configuration);
    if (!navigation) { const previous = await tx.organizationFieldPlanningProfile.findUnique({ where: { organizationId } }); if (previous) { const old = parseProfile(previous.configuration); stored.navigationPointMinutes = old.navigationPointMinutes; Object.assign(stored.serviceMinutes, Object.fromEntries(Object.entries(old.serviceMinutes).filter(([k]) => k.startsWith('NAVIGATION_INSTALLATION')))); } }
    const row = await tx.organizationFieldPlanningProfile.upsert({ where: { organizationId }, create: { organizationId, configuration: json(stored) }, update: { configuration: json(stored) } });
    await auditPlan(tx, row.id, actor, 'FIELD_PROFILE_UPDATED', configuration);
    return configuration;
  });
}
export function parseGenerate(value: unknown) {
  const p = value as { date?: string; requestKey?: string; parentPlanId?: string; jobIds?: string[]; crews?: CrewInput[]; startTime?: string };
  if (!p || typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || typeof p.requestKey !== 'string' || !/^[\w-]{8,100}$/.test(p.requestKey)) throw new Error('Neplatný den nebo klíč požadavku.');
  if (p.parentPlanId !== undefined && (typeof p.parentPlanId !== 'string' || p.parentPlanId.length > 100)) throw new Error('Neplatný předchozí plán.');
  if (p.jobIds !== undefined && (!Array.isArray(p.jobIds) || p.jobIds.length > 200 || !p.jobIds.every(id => typeof id === 'string' && id.length < 100))) throw new Error('Neplatný výběr úkolů.');
  if (p.crews !== undefined && (!Array.isArray(p.crews) || p.crews.length > 30 || p.crews.some(c => !c || typeof c.id !== 'string' || c.id.length > 100 || !Array.isArray(c.employeeIds) || c.employeeIds.length > 20 || !c.employeeIds.every(id => typeof id === 'string') || (c.vehicleId !== null && typeof c.vehicleId !== 'string') || (c.startLocation !== undefined && !coordinates(c.startLocation))))) throw new Error('Neplatné posádky.');
  if (p.startTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startTime)) throw new Error('Neplatný čas odjezdu.');
  return { date: p.date, requestKey: p.requestKey, parentPlanId: p.parentPlanId, jobIds: p.jobIds, crews: p.crews, startTime: p.startTime };
}
type ApprovalSnapshot = { reservationIds: string[] };
function reusableReservations(row?: FieldPlan | null) { return ((row?.approvalSnapshot as unknown as ApprovalSnapshot | null)?.reservationIds ?? []); }

export async function generatePlan(raw: unknown, actor: PlannerActor) {
  requirePlannerManager(actor); const request = parseGenerate(raw); const { organizationId } = requireTenantContext();
  const requestHash = hash(request);
  const prior = await prisma.fieldPlan.findUnique({ where: { organizationId_requestKey: { organizationId, requestKey: request.requestKey } } });
  if (prior) { await getPlan(prior.id); if (prior.requestHash !== requestHash) throw new Error('Klíč požadavku již patří jinému zadání.'); return planView(prior); }
  const parent = request.parentPlanId ? await getPlan(request.parentPlanId) : null;
  if (parent && (parent.date !== request.date || !['DRAFT', 'APPROVED', 'ACTIVE'].includes(parent.status))) throw new Error('Tento plán již nelze přepočítat.');
  const parentInput = parent?.planningInputSnapshot as unknown as PlanningInput | undefined;
  const parentCrews = parent && parent.status !== 'DRAFT' ? (parent.planningSummary as unknown as PlanningResult).crews : parentInput?.crews;
  const crews = request.crews ?? parentCrews;
  if (parent && parent.status !== 'DRAFT' && hash(crews?.map(c => [c.id, c.employeeIds, c.vehicleId])) !== hash(parentCrews?.map(c => [c.id, c.employeeIds, c.vehicleId]))) throw new Error('V1 při přepočtu schváleného plánu zachovává posádky a rezervace.');
  if (parent && parent.status !== 'DRAFT' && crews?.some(c => !c.startLocation)) throw new Error('Při přepočtu potvrďte aktuální GPS výchozí bod každé posádky.');
  const profile = await loadProfile();
  const now = request.startTime && profile ? new Date(Math.max(Date.now(), zonedTime(request.date, request.startTime, profile.timezone))).toISOString() : undefined;
  const input = await loadPlanningData(request.date, { crews, now, jobIds: parentInput?.jobs.map(j => j.id) ?? request.jobIds,
    reuseReservationIds: reusableReservations(parent), excludePlanIds: parent ? [parent.id] : [] });
  // No fresh orders are silently added during replanning. DONE/CANCELLED are removed by the engine.
  const result = await planFieldWork(input, googleTravelProvider(input.profile));
  return plannerTransaction(async tx => {
    const duplicate = await tx.fieldPlan.findUnique({ where: { organizationId_requestKey: { organizationId, requestKey: request.requestKey } } });
    if (duplicate) { await getPlan(duplicate.id, tx); if (duplicate.requestHash !== requestHash) throw new Error('Klíč požadavku již patří jinému zadání.'); return planView(duplicate); }
    if (parent) { const current = await getPlan(parent.id, tx); if (current.updatedAt.getTime() !== parent.updatedAt.getTime()) throw new Error('Předchozí plán se změnil.'); }
    const latest = await tx.fieldPlan.findFirst({ where: { organizationId, date: request.date }, orderBy: { version: 'desc' } });
    const row = await tx.fieldPlan.create({ data: { organizationId, date: request.date, version: (latest?.version ?? 0) + 1,
      requestKey: request.requestKey, requestHash, parentPlanId: parent?.id, createdByUserId: actor.id,
      planningInputSnapshot: json(input), planningSummary: json(result) } });
    await auditPlan(tx, row.id, actor, parent ? 'FIELD_PLAN_REPLANNED' : 'FIELD_PLAN_GENERATED', { parentPlanId: parent?.id, unassigned: result.unassigned, conflicts: result.conflicts, navigationPointIds: result.crews.flatMap(c => c.stops.flatMap(s => s.navigationPointId ? [s.navigationPointId] : [])) });
    return planView(row);
  });
}

export async function approvePlan(id: string, actor: PlannerActor, acceptEstimated = false, db = prisma) {
  requirePlannerManager(actor);
  return plannerTransaction(async tx => {
    const row = await getPlan(id, tx);
    if (['APPROVED', 'ACTIVE', 'COMPLETED'].includes(row.status)) return planView(row);
    if (row.status !== 'DRAFT') throw new Error('Schválit lze pouze návrh.');
    const input = row.planningInputSnapshot as unknown as PlanningInput;
    const result = row.planningSummary as unknown as PlanningResult;
    if (!result.crews.length || result.conflicts.length || result.unassigned.length) throw new Error('Nejprve vyřešte konflikty a nepřiřazené úkoly; případně vytvořte návrh pro menší výběr.');
    if (result.estimated && !acceptEstimated) throw new Error('Odhadované přejezdy vyžadují výslovné potvrzení manažerem.');
    const parent = row.parentPlanId ? await getPlan(row.parentPlanId, tx) : null;
    if (parent && !['DRAFT', 'APPROVED', 'ACTIVE'].includes(parent.status)) throw new Error('Předchozí plán byl již nahrazen nebo uzavřen.');
    const current = await loadPlanningData(row.date, { crews: input.crews, jobIds: input.jobs.map(j => j.id), now: input.now,
      reuseReservationIds: reusableReservations(parent), excludePlanIds: parent ? [parent.id] : [] }, tx);
    if (hash(current.profile) !== hash(input.profile)) throw new Error('Nastavení organizace se změnilo; přepočítejte návrh.');
    // Compare all planning-relevant canonical data, including related assignments/navigation blockers.
    if (hash(current.jobs) !== hash(input.jobs)) throw new Error('Zakázky se od návrhu změnily; přepočítejte plán.');
    const accepted = new Map(result.crews.flatMap(c => c.stops.map(s => [stopId(s), s] as const)));
    // Revalidate precisely the approved sequence with fresh availability, without network I/O inside transaction.
    for (const crew of result.crews) {
      const members = current.employees.filter(e => crew.employeeIds.includes(e.id));
      if (members.length !== crew.employeeIds.length || members.some(e => !e.isActive || !e.available)) throw new Error('WORKER_UNAVAILABLE: pracovník již není dostupný.');
      for (const stop of crew.stops) {
        const job = current.jobs.find(j => j.id === stopId(stop));
        if (!job || (job.constraints.requiredEmployeeIds ?? []).some(id => !crew.employeeIds.includes(id)) || (job.constraints.requiredPositions ?? []).some(position => !members.some(m => m.positions.includes(position)))) throw new Error('Požadavky na posádku již nejsou splněné.');
      }
      const v = current.vehicles.find(v => v.id === crew.vehicleId);
      if (crew.vehicleId && (!v || v.reserved || ['SERVICE', 'OUT_OF_SERVICE', 'IN_USE'].includes(v.status))) throw new Error('VEHICLE_CONFLICT: vozidlo již není dostupné.');
      if (new Date(crew.departureAt).getTime() < Date.now() - 60000) throw new Error('Čas odjezdu již uplynul; přepočítejte zbývající plán.');
    }
    const { organizationId } = requireTenantContext();
    const claimed = await tx.fieldPlan.updateMany({ where: { id, organizationId, status: 'DRAFT' }, data: { status: 'APPROVED', approvedByUserId: actor.id, approvedAt: new Date() } });
    if (claimed.count !== 1) throw new Error('Plán mezitím schválil jiný uživatel.');
    const reservationIds: string[] = [];
    const previousReservations = reusableReservations(parent);
    const assignedOrders = new Set<string>();
    for (const crew of result.crews) {
      const members = current.employees.filter(e => crew.employeeIds.includes(e.id));
      // Duplicate display names cannot be represented by the legacy WorkAssignment sync safely.
      if (new Set(members.map(m => m.name)).size !== members.length) throw new Error('Posádka obsahuje shodná jména; upravte jejich rozlišení v Employee.');
      for (const stop of crew.stops) {
        if (stop.navigationPointId) {
          if (!members[0]?.userId) throw new Error('Navigation vyžaduje instalátora s uživatelským účtem.');
          const point = await tx.navigationPoint.findFirst({ where: { id: stop.navigationPointId, organizationId, navigationOrderId: stop.navigationOrderId }, include: { navigationOrder: { select: { installerUserId: true } } } });
          if (!point || !point.isSelectedByClient || ['INSTALLED', 'CANCELLED', 'REMOVED'].includes(point.status) || point.issueReported) throw new Error('Navigační bod se změnil; přepočítejte plán.');
          await tx.navigationPoint.update({ where: { id: point.id, organizationId }, data: { installerUserId: point.installerUserId ?? point.navigationOrder?.installerUserId ?? members[0].userId, plannedInstallationAt: new Date(stop.startAt), routeOrder: stop.routeOrder } });
        }
        if (stop.crmRealizationId) {
          const realization = await tx.crmRealization.findUnique({ where: { id: stop.crmRealizationId, organizationId } });
          if (!realization || realization.workOrderId !== stop.workOrderId) throw new Error('Vazba realizace se změnila.');
          await tx.crmRealization.update({ where: { id: realization.id, organizationId }, data: { plannedDate: new Date(stop.startAt), assignedUserId: realization.assignedUserId ?? members.find(m => m.userId)?.userId ?? null } });
        }
        if (!stop.workOrderId && stop.navigationPointId) continue;
        if (assignedOrders.has(stop.workOrderId)) continue;
        assignedOrders.add(stop.workOrderId);
        const orderMemberIds = new Set(result.crews.filter(c => c.stops.some(s => s.workOrderId === stop.workOrderId)).flatMap(c => c.employeeIds));
        const orderMembers = current.employees.filter(e => orderMemberIds.has(e.id));
        if (new Set(orderMembers.map(m => m.name)).size !== orderMembers.length) throw new Error('Pracovníci zakázky mají shodná jména.');
        const order = await tx.workOrder.findUnique({ where: { id: stop.workOrderId, organizationId }, include: { assignments: true } });
        if (!order || ['DONE', 'CANCELLED'].includes(order.status) || !accepted.has(stopId(stop))) throw new Error('Zakázka již není plánovatelná.');
        for (const member of orderMembers) {
          const existing = order.assignments.find(a => member.userId && a.userId === member.userId || !a.userId && a.workerName === member.name);
          if (existing && member.userId && !existing.userId) await tx.workAssignment.update({ where: { id: existing.id, organizationId }, data: { userId: member.userId } });
          if (!existing) {
            // Stable primary key + Serializable transaction prevent duplicate assignments on retry.
            await tx.workAssignment.create({ data: { id: `fp-${hash([organizationId, order.id, member.id]).slice(0, 32)}`, organizationId, workOrderId: order.id, userId: member.userId, workerName: member.name } });
          }
        }
        await tx.workOrder.update({ where: { id: order.id, organizationId }, data: { scheduledAt: new Date(Math.min(...result.crews.flatMap(c => c.stops.filter(s => s.workOrderId === order.id).map(s => Date.parse(s.startAt))))), ...(order.status === 'NEW' ? { status: 'PLANNED' } : {}) } });
        await syncWorkOrderTasks(order.id, tx);
      }
      if (crew.vehicleId) {
        const old = previousReservations.length ? await tx.vehicleReservation.findFirst({ where: { organizationId, id: { in: previousReservations }, vehicleId: crew.vehicleId, employeeId: { in: crew.employeeIds }, status: { in: ['RESERVED', 'ACTIVE'] } } }) : null;
        if (old) reservationIds.push(old.id);
        else {
          const reservation = await createVehicleReservation(tx, { id: `fp-${hash([row.id, crew.id]).slice(0, 32)}`, vehicleId: crew.vehicleId,
            employeeId: crew.employeeIds[0], dateFrom: new Date(`${row.date}T00:00:00Z`), dateTo: new Date(`${row.date}T00:00:00Z`), purpose: `Field plan ${row.date} / ${crew.id}` });
          reservationIds.push(reservation.id);
        }
      }
    }
    await tx.fieldPlan.update({ where: { id, organizationId }, data: { approvalSnapshot: json({ reservationIds }) } });
    if (parent) await tx.fieldPlan.update({ where: { id: parent.id, organizationId }, data: { status: 'CANCELLED' } });
    await auditPlan(tx, id, actor, 'FIELD_PLAN_APPROVED', { acceptEstimated, reservationIds, supersededPlanId: parent?.id, navigationPointIds: result.crews.flatMap(c => c.stops.flatMap(s => s.navigationPointId ? [s.navigationPointId] : [])) });
    return planView(await getPlan(id, tx));
  }, db);
}
export async function cancelDraft(id: string, actor: PlannerActor) {
  requirePlannerManager(actor);
  return plannerTransaction(async tx => {
    const row = await getPlan(id, tx);
    if (row.status === 'CANCELLED') return planView(row);
    if (row.status !== 'DRAFT') throw new Error('Zrušit lze pouze neschválený návrh.');
    const saved = await tx.fieldPlan.update({ where: { id, organizationId: row.organizationId }, data: { status: 'CANCELLED' } });
    await auditPlan(tx, id, actor, 'FIELD_PLAN_CANCELLED'); return planView(saved);
  });
}
