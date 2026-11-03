import { isFieldJobId, requireFieldJobsEnabled } from './field-jobs';
import { validateApprovalSelection } from './approval-rules';
import { createHash } from 'node:crypto';
import { Prisma, type FieldPlan } from '@prisma/client';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { canManageAbsences } from '../absences';
import { syncWorkOrderTasks } from '../work-task-sync';
import { createVehicleReservation } from '../vehicle-reservation-service';
import { loadPlanningData, loadProfile } from './data';
import { dayInZone, parseProfile, coordinates, zonedTime } from './profile';
import { planFieldWork } from './planning-engine';
import { googleTravelProvider } from './travel';
import { navigationAvailable } from './capabilities';
import { itemStatus } from './item-jobs';
import { stopId } from './contracts';
import type { CrewInput, PlannedCrew, PlanningInput, PlanningResult, PlanView } from './contracts';

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
  const result = row.planningSummary as unknown as PlanningResult;
  return { id: row.id, date: row.date, version: row.version, status: row.status, parentPlanId: row.parentPlanId,
    approvedAt: row.approvedAt?.toISOString() ?? null, result,
    profile: (row.planningInputSnapshot as unknown as PlanningInput).profile,
    name: result.planName ?? null };
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
  // Older saved plans can contain only a profile; their persisted stops remain authoritative.
  const jobs = (row.planningInputSnapshot as unknown as Partial<PlanningInput> | null)?.jobs ?? [];
  const stops = (row.planningSummary as unknown as Partial<PlanningResult> | null)?.crews?.flatMap(crew => crew.stops ?? []) ?? [];
  if (row.electionCampaignId || [...jobs, ...stops].some(job => job.fieldWorkStepId || job.electionRemovalPointId)) await requireFieldJobsEnabled(db);
  if (!await navigationAvailable(db) && [...jobs, ...stops].some(job => job.navigationPointId)) throw new Error('FORBIDDEN: Navigation není aktivní.');
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
  const p = value as { date?: string; requestKey?: string; parentPlanId?: string; jobIds?: string[]; crews?: CrewInput[]; startTime?: string; planName?: string };
  if (!p || typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date) || typeof p.requestKey !== 'string' || !/^[\w-]{8,100}$/.test(p.requestKey)) throw new Error('Neplatný den nebo klíč požadavku.');
  if (p.parentPlanId !== undefined && (typeof p.parentPlanId !== 'string' || p.parentPlanId.length > 100)) throw new Error('Neplatný předchozí plán.');
  if (p.planName !== undefined && p.planName !== null && typeof p.planName !== 'string') throw new Error('Neplatný název plánu.');
  if (p.jobIds !== undefined && (!Array.isArray(p.jobIds) || p.jobIds.length > 200 || !p.jobIds.every(id => typeof id === 'string' && id.length < 100))) throw new Error('Neplatný výběr úkolů.');
  if (p.crews !== undefined && (!Array.isArray(p.crews) || p.crews.length > 30 || p.crews.some(c => !c || typeof c.id !== 'string' || c.id.length > 100 || (c.name !== undefined && c.name !== null && typeof c.name !== 'string') || !Array.isArray(c.employeeIds) || c.employeeIds.length > 20 || !c.employeeIds.every(id => typeof id === 'string') || (c.vehicleId !== null && typeof c.vehicleId !== 'string') || (c.startLocation !== undefined && !coordinates(c.startLocation))))) throw new Error('Neplatné posádky.');
  if (p.startTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.startTime)) throw new Error('Neplatný čas odjezdu.');
  return {
    date: p.date,
    requestKey: p.requestKey,
    parentPlanId: p.parentPlanId,
    jobIds: p.jobIds,
    crews: p.crews?.map(c => ({
      ...c,
      name: typeof c.name === 'string' && c.name.trim() ? c.name.trim().slice(0, 100) : null,
    })),
    startTime: p.startTime,
    planName: typeof p.planName === 'string' && p.planName.trim() ? p.planName.trim().slice(0, 100) : undefined,
  };
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
  const profile = await loadProfile();
  if (!profile) throw new Error('Nejdříve nastavte vlastní depo v Nastavení depa.');
  const crews = (request.crews ?? parentCrews)?.map(c => {
    const matchingParentCrew = parentCrews?.find(pc => pc.id === c.id);
    const fallbackLocation = matchingParentCrew?.startLocation ?? profile.depot;
    return {
      ...c,
      startLocation: c.startLocation ?? fallbackLocation,
    };
  });
  if (parent && parent.status !== 'DRAFT' && crews?.some(c => !c.startLocation)) throw new Error('Při přepočtu potvrďte aktuální GPS výchozí bod každé posádky.');
  const now = request.startTime ? new Date(Math.max(Date.now(), zonedTime(request.date, request.startTime, profile.timezone))).toISOString() : undefined;
  const targetJobIds = parent
    ? (request.jobIds && request.jobIds.length > 0 ? request.jobIds : parentInput?.jobs.map(j => j.id))
    : request.jobIds;
  const includeField = Boolean(
    targetJobIds?.some(isFieldJobId) ||
    parentInput?.jobs?.some(j => Boolean(j.electionRemovalPointId || j.fieldWorkStepId))
  );
  const input = await loadPlanningData(request.date, {
    crews,
    now,
    jobIds: targetJobIds,
    includeField,
    reuseReservationIds: reusableReservations(parent),
    excludePlanIds: parent ? [parent.id] : [],
  });
  // Fresh orders selected during replanning are merged into the route. DONE/CANCELLED are removed by the engine.
  const result = await planFieldWork(input, googleTravelProvider(input.profile));
  if (request.planName) {
    result.planName = request.planName;
  }
  return plannerTransaction(async tx => {
    const duplicate = await tx.fieldPlan.findUnique({ where: { organizationId_requestKey: { organizationId, requestKey: request.requestKey } } });
    if (duplicate) { await getPlan(duplicate.id, tx); if (duplicate.requestHash !== requestHash) throw new Error('Klíč požadavku již patří jinému zadání.'); return planView(duplicate); }
    if (parent) { const current = await getPlan(parent.id, tx); if (current.updatedAt.getTime() !== parent.updatedAt.getTime()) throw new Error('Předchozí plán se změnil.'); }
    const latest = await tx.fieldPlan.findFirst({ where: { organizationId, date: request.date }, orderBy: { version: 'desc' } });
    const row = await tx.fieldPlan.create({ data: { organizationId, date: request.date, version: (latest?.version ?? 0) + 1,
      requestKey: request.requestKey, requestHash, parentPlanId: parent?.id, electionCampaignId: parent?.electionCampaignId ?? null, createdByUserId: actor.id,
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
    validateApprovalSelection(input, result);
    if (result.estimated && !acceptEstimated) throw new Error('Odhadované přejezdy vyžadují výslovné potvrzení manažerem.');
    const parent = row.parentPlanId ? await getPlan(row.parentPlanId, tx) : null;
    if (parent && !['DRAFT', 'APPROVED', 'ACTIVE'].includes(parent.status)) throw new Error('Předchozí plán byl již nahrazen nebo uzavřen.');
    const includeField = input.jobs.some(j => Boolean(j.electionRemovalPointId || j.fieldWorkStepId));
    const current = await loadPlanningData(row.date, {
      crews: input.crews,
      jobIds: input.jobs.map(j => j.id),
      includeField,
      now: input.now,
      reuseReservationIds: reusableReservations(parent),
      excludePlanIds: parent ? [parent.id] : [],
    }, tx);
    if (hash(current.profile) !== hash(input.profile)) throw new Error('Nastavení organizace se změnilo; přepočítejte návrh.');
    // Compare all planning-relevant canonical data, including related assignments/navigation blockers.
    if (hash(current.jobs) !== hash(input.jobs)) throw new Error('Zakázky se od návrhu změnily; přepočítejte plán.');
    const accepted = new Map(result.crews.flatMap(c => c.stops.map(s => [stopId(s), s] as const)));
    const todayInTz = dayInZone(new Date(), current.profile.timezone);
    if (row.date < todayInTz) {
      throw new Error('Nelze schválit výjezd do minulého dne; přesuňte trasu na dnešek nebo budoucí den.');
    }
    // Revalidate precisely the approved sequence with fresh availability, without network I/O inside transaction.
    for (const crew of result.crews) {
      const members = current.employees.filter(e => crew.employeeIds.includes(e.id));
      if (members.length !== crew.employeeIds.length || members.some(e => !e.isActive || !e.available)) throw new Error('WORKER_UNAVAILABLE: pracovník již není dostupný.');
      for (const stop of crew.stops) {
        if(stop.isWarehousePitstop)continue;
        const job = current.jobs.find(j => j.id === stopId(stop) || (j.delivery && 'field-step:'+j.delivery.id === stopId(stop)));
        if (!job || (job.constraints.requiredEmployeeIds ?? []).some(id => !crew.employeeIds.includes(id)) || (job.constraints.requiredPositions ?? []).some(position => !members.some(m => m.positions.includes(position)))) throw new Error('Požadavky na posádku již nejsou splněné.');
      }
      const v = current.vehicles.find(v => v.id === crew.vehicleId);
      if (crew.vehicleId && (!v || v.reserved || ['SERVICE', 'OUT_OF_SERVICE', 'IN_USE'].includes(v.status))) throw new Error('VEHICLE_CONFLICT: vozidlo již není dostupné.');
      if(current.jobs.some(j=>j.fieldWorkStepId) && crew.vehicleId && hash(v)!==hash(input.vehicles.find(v=>v.id===crew.vehicleId)))throw new Error('Kapacita nebo vybavení vozidla se změnily; přepočítejte plán.');
    }
    const { organizationId } = requireTenantContext();
    const claimed = await tx.fieldPlan.updateMany({ where: { id, organizationId, status: 'DRAFT' }, data: { status: 'APPROVED', approvedByUserId: actor.id, approvedAt: new Date() } });
    if (claimed.count !== 1) throw new Error('Plán mezitím schválil jiný uživatel.');

    // If replacing an APPROVED or ACTIVE parent plan, release its unstarted ASSIGNED field steps/points so this replacement plan can cleanly claim them.
    if (parent && ['APPROVED', 'ACTIVE'].includes(parent.status)) {
      if (tx.fieldWorkStep?.updateMany) {
        await tx.fieldWorkStep.updateMany({
          where: { organizationId, assignedFieldPlanId: parent.id, status: 'ASSIGNED' },
          data: { status: 'PENDING', assignedFieldPlanId: null, assignedCrewId: null },
        });
      }
      if (tx.electionRemovalPoint?.updateMany) {
        await tx.electionRemovalPoint.updateMany({
          where: { organizationId, assignedFieldPlanId: parent.id, status: 'ASSIGNED' },
          data: { status: 'PENDING', assignedFieldPlanId: null, assignedCrewId: null },
        });
      }
    }

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
          const advanceStatus = ['WAITING_FOR_MATERIALS', 'MATERIALS_APPROVED', 'WAITING_FOR_PRODUCTION', 'PRODUCED'].includes(realization.status);
          await tx.crmRealization.update({
            where: { id: realization.id, organizationId },
            data: {
              plannedDate: new Date(stop.startAt),
              assignedUserId: realization.assignedUserId ?? members.find(m => m.userId)?.userId ?? null,
              ...(advanceStatus ? { status: 'SCHEDULED' } : {}),
            },
          });
        }
        if (stop.isWarehousePitstop) continue;
        if (stop.electionRemovalPointId) {
          if(!stop.fieldWorkStepId || !stop.electionCampaignId)throw new Error('Terénní bod nemá strukturovaný krok.');
          const job=current.jobs.find(j=>j.electionRemovalPointId===stop.electionRemovalPointId);
          if(!job || job.electionCampaignId!==stop.electionCampaignId || ![job.fieldWorkStepId,job.delivery?.id].includes(stop.fieldWorkStepId))throw new Error('Vazba terénního kroku se změnila.');
          const claimed=await tx.fieldWorkStep.updateMany({where:{id:stop.fieldWorkStepId,organizationId,pointId:stop.electionRemovalPointId,status:'PENDING',assignedFieldPlanId:null},data:{assignedFieldPlanId:row.id,assignedCrewId:crew.id,status:'ASSIGNED',version:{increment:1}}});
          if(claimed.count!==1)throw new Error('Krok již přiřadil jiný dispečer. Přepočítejte plán.');
          await tx.electionRemovalPoint.update({where:{id:stop.electionRemovalPointId,organizationId},data:{assignedFieldPlanId:row.id,assignedCrewId:crew.id,plannedArrivalAt:new Date(stop.arrivalAt),plannedOrder:stop.routeOrder,status:'ASSIGNED'}});
          await tx.electionCampaign.update({where:{id:stop.electionCampaignId,organizationId},data:{status:'PLANNED'}});
          continue;
        }
        if (!stop.workOrderId && (stop.navigationPointId || stop.electionRemovalPointId)) continue;
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
    const unusedReservations = previousReservations.filter(rId => !reservationIds.includes(rId));
    if (unusedReservations.length > 0 && tx.vehicleReservation?.updateMany) {
      await tx.vehicleReservation.updateMany({
        where: { organizationId, id: { in: unusedReservations }, status: { in: ['RESERVED', 'ACTIVE'] } },
        data: { status: 'CANCELLED' },
      });
    }
    await tx.fieldPlan.update({ where: { id, organizationId }, data: { approvalSnapshot: json({ reservationIds }) } });
    if (row.electionCampaignId) await tx.electionCampaign.update({ where: { id: row.electionCampaignId, organizationId }, data: { status: 'PLANNED' } });
    if (parent) {
      await tx.fieldPlan.update({
        where: { id: parent.id, organizationId },
        data: { status: parent.status === 'ACTIVE' ? 'SUPERSEDED' : 'CANCELLED' },
      });
    }
    await auditPlan(tx, id, actor, 'FIELD_PLAN_APPROVED', { acceptEstimated, unassigned: result.unassigned, reservationIds, supersededPlanId: parent?.id, navigationPointIds: result.crews.flatMap(c => c.stops.flatMap(s => s.navigationPointId ? [s.navigationPointId] : [])) });
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

/**
 * Renames a crew / route in an existing plan (draft, approved, or active).
 */
export async function renameCrew(
  planId: string,
  crewId: string,
  name: string,
  actor: PlannerActor,
  db = prisma
): Promise<PlanView> {
  requirePlannerManager(actor);
  const cleanName = name.trim().slice(0, 100);
  const { organizationId } = requireTenantContext();
  return plannerTransaction(async tx => {
    const row = await getPlan(planId, tx);
    const summary = row.planningSummary as unknown as PlanningResult;
    const input = row.planningInputSnapshot as unknown as PlanningInput;
    const crew = summary.crews.find(c => c.id === crewId);
    if (!crew) throw new Error('Posádka / trasa nebyla nalezena.');
    crew.name = cleanName || null;
    const inputCrew = input.crews?.find(c => c.id === crewId);
    if (inputCrew) {
      inputCrew.name = cleanName || null;
    }
    await tx.fieldPlan.update({
      where: { id: planId, organizationId },
      data: {
        planningSummary: json(summary),
        planningInputSnapshot: json(input),
      },
    });
    await auditPlan(tx, planId, actor, 'FIELD_ROUTE_RENAMED', { crewId, name: cleanName });
    return planView(await getPlan(planId, tx));
  }, db);
}

/**
 * Reassigns / transfers an entire crew / route to another worker from the team (and optionally changes vehicle).
 * Works across DRAFT, APPROVED, and ACTIVE routes, including mixed/field-work stops.
 */
export async function transferCrew(
  planId: string,
  crewId: string,
  targetEmployeeId: string,
  actor: PlannerActor,
  mode: 'replace_first' | 'replace_all' = 'replace_first',
  db = prisma,
  options?: { vehicleId?: string | null }
): Promise<PlanView> {
  requirePlannerManager(actor);
  const { organizationId } = requireTenantContext();
  return plannerTransaction(async tx => {
    const row = await getPlan(planId, tx);
    if (row.status === 'CANCELLED') throw new Error('Zrušený plán nelze upravovat.');
    const summary = row.planningSummary as unknown as PlanningResult;
    const input = row.planningInputSnapshot as unknown as PlanningInput;
    const crew = summary.crews.find(c => c.id === crewId);
    if (!crew) throw new Error('Posádka / trasa nebyla nalezena.');

    const targetEmployee = await tx.employee.findFirst({
      where: { id: targetEmployeeId, organizationId, isActive: true },
      select: { id: true, firstName: true, lastName: true, userId: true, isActive: true },
    });
    if (!targetEmployee) throw new Error('Cílový pracovník nebyl nalezen nebo není aktivní.');

    const targetName = `${targetEmployee.firstName} ${targetEmployee.lastName}`.trim();

    // Determine old employee IDs being replaced
    const oldEmployeeIds = [...crew.employeeIds];
    let newEmployeeIds: string[];
    if (mode === 'replace_all' || crew.employeeIds.length <= 1) {
      newEmployeeIds = [targetEmployee.id];
    } else {
      // replace first member (lead technician) and preserve assistants
      newEmployeeIds = [targetEmployee.id, ...crew.employeeIds.slice(1).filter(id => id !== targetEmployee.id)];
    }

    // Fetch all members' names for the updated crew
    const allMembers = await tx.employee.findMany({
      where: { id: { in: newEmployeeIds }, organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameMap = new Map(allMembers.map(m => [m.id, `${m.firstName} ${m.lastName}`.trim()]));
    const newNames = newEmployeeIds.map(id => nameMap.get(id) ?? 'Pracovník');

    const oldVehicleId = crew.vehicleId ?? null;
    const changingVehicle = options !== undefined && options.vehicleId !== undefined && (options.vehicleId || null) !== oldVehicleId;
    if (options !== undefined && options.vehicleId !== undefined) {
      if (!options.vehicleId) {
        crew.vehicleId = null;
        crew.vehicleName = null;
      } else {
        const targetVehicle = await tx.vehicle.findFirst({
          where: { id: options.vehicleId, organizationId },
          select: { id: true, name: true, status: true },
        });
        if (!targetVehicle || ['SERVICE', 'OUT_OF_SERVICE'].includes(targetVehicle.status)) {
          throw new Error('Vybrané vozidlo není dostupné nebo je v servisu.');
        }
        crew.vehicleId = targetVehicle.id;
        crew.vehicleName = targetVehicle.name;
      }
    }

    // Update crew in memory
    crew.employeeIds = newEmployeeIds;
    crew.names = newNames;

    const inputCrew = input.crews?.find(c => c.id === crewId);
    if (inputCrew) {
      inputCrew.employeeIds = newEmployeeIds;
      if (options !== undefined && options.vehicleId !== undefined) {
        inputCrew.vehicleId = crew.vehicleId;
      }
    }

    let updatedApprovalSnapshot: ApprovalSnapshot | undefined;

    // If plan is APPROVED or ACTIVE, sync live assignments so new worker sees and owns stops
    if (['APPROVED', 'ACTIVE', 'COMPLETED'].includes(row.status)) {
      for (const stop of crew.stops) {
        // 1. WorkOrder & WorkAssignment (skip synthetic field-step / warehouse stop IDs!)
        if (stop.workOrderId && !stop.electionRemovalPointId && !stop.fieldWorkStepId && !stop.isWarehousePitstop) {
          for (const oldEmpId of oldEmployeeIds) {
            if (!newEmployeeIds.includes(oldEmpId)) {
              const oldAssignId = `fp-${hash([organizationId, stop.workOrderId, oldEmpId]).slice(0, 32)}`;
              await tx.workAssignment.deleteMany({ where: { id: oldAssignId, organizationId } });
            }
          }

          const newAssignId = `fp-${hash([organizationId, stop.workOrderId, targetEmployee.id]).slice(0, 32)}`;
          await tx.workAssignment.upsert({
            where: { id: newAssignId },
            create: {
              id: newAssignId,
              organizationId,
              workOrderId: stop.workOrderId,
              userId: targetEmployee.userId,
              workerName: targetName,
            },
            update: {
              userId: targetEmployee.userId,
              workerName: targetName,
            },
          });

          await syncWorkOrderTasks(stop.workOrderId, tx);
        }

        // 2. NavigationPoint
        if (stop.navigationPointId && targetEmployee.userId && tx.navigationPoint?.updateMany) {
          await tx.navigationPoint.updateMany({
            where: { id: stop.navigationPointId, organizationId },
            data: { installerUserId: targetEmployee.userId },
          });
        }

        // 3. CrmRealization
        if (stop.crmRealizationId && targetEmployee.userId && tx.crmRealization?.updateMany) {
          await tx.crmRealization.updateMany({
            where: { id: stop.crmRealizationId, organizationId },
            data: { assignedUserId: targetEmployee.userId },
          });
        }
      }

      // 4. Vehicle reservation update
      const crewResIds = [
        `fp-${hash([row.id, crew.id]).slice(0, 32)}`,
        `resched-${hash([row.id, crew.id]).slice(0, 32)}`,
        `continue-${hash([row.id, crew.id]).slice(0, 32)}`,
      ];
      if (changingVehicle) {
        const prevSnapshotIds = reusableReservations(row);
        if (tx.vehicleReservation?.updateMany) {
          await tx.vehicleReservation.updateMany({
            where: { organizationId, id: { in: crewResIds }, status: { in: ['RESERVED', 'ACTIVE'] } },
            data: { status: 'CANCELLED' },
          });
        }
        const nextIds = prevSnapshotIds.filter(id => !crewResIds.includes(id));
        if (crew.vehicleId) {
          const newRes = await createVehicleReservation(tx, {
            id: `fp-veh-${hash([row.id, crew.id, crew.vehicleId, targetEmployee.id]).slice(0, 28)}`,
            vehicleId: crew.vehicleId,
            employeeId: targetEmployee.id,
            dateFrom: new Date(`${row.date}T00:00:00Z`),
            dateTo: new Date(`${row.date}T00:00:00Z`),
            purpose: `Field plan ${row.date} / ${crew.id}`,
          });
          nextIds.push(newRes.id);
        }
        updatedApprovalSnapshot = { reservationIds: nextIds };
      } else if (crew.vehicleId && tx.vehicleReservation?.updateMany) {
        const resId = `fp-${hash([row.id, crew.id]).slice(0, 32)}`;
        await tx.vehicleReservation.updateMany({
          where: { organizationId, id: resId },
          data: { employeeId: targetEmployee.id },
        });
      }
    }

    // Persist updated snapshot
    await tx.fieldPlan.update({
      where: { id: planId, organizationId },
      data: {
        planningSummary: json(summary),
        planningInputSnapshot: json(input),
        ...(updatedApprovalSnapshot ? { approvalSnapshot: json(updatedApprovalSnapshot) } : {}),
      },
    });

    await auditPlan(tx, planId, actor, 'FIELD_ROUTE_TRANSFERRED', {
      crewId,
      oldEmployeeIds,
      newEmployeeId: targetEmployee.id,
      newEmployeeName: targetName,
      oldVehicleId,
      newVehicleId: crew.vehicleId ?? null,
    });

    return planView(await getPlan(planId, tx));
  }, db);
}

function shiftIsoToTargetDay(value: string, fromDate: string, toDate: string, timezone: string, extraDeltaMs = 0): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const localDay = dayInZone(parsed, timezone);
  const dayOffset = Math.round((Date.parse(`${localDay}T12:00:00Z`) - Date.parse(`${fromDate}T12:00:00Z`)) / 86400000);
  const shiftedDay = new Date(Date.parse(`${toDate}T12:00:00Z`) + dayOffset * 86400000).toISOString().slice(0, 10);
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(parsed);
  const baseMs = zonedTime(shiftedDay, timeStr, timezone) + parsed.getUTCSeconds() * 1000 + parsed.getUTCMilliseconds();
  return new Date(baseMs + extraDeltaMs).toISOString();
}

/**
 * Moves an entire route (or selected crew) to any chosen calendar day.
 * Supports DRAFT, APPROVED, and ACTIVE routes (including mixed/field-work routes).
 * Completed stops remain on the original day; unfinished stops move cleanly to targetDate.
 */
export async function reschedulePlan(
  planId: string,
  targetDate: string,
  actor: PlannerActor,
  options?: { crewId?: string; startTime?: string },
  db = prisma
): Promise<PlanView> {
  requirePlannerManager(actor);
  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new Error('Vyberte platné cílové datum.');
  }
  const cleanStartTime = options?.startTime?.trim() ? options.startTime.trim() : undefined;
  if (cleanStartTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(cleanStartTime)) {
    throw new Error('Neplatný čas odjezdu.');
  }
  const { organizationId } = requireTenantContext();

  return plannerTransaction(async tx => {
    const original = await getPlan(planId, tx);
    if (!['DRAFT', 'APPROVED', 'ACTIVE'].includes(original.status)) {
      throw new Error('Přesunout lze pouze návrh, schválenou nebo probíhající trasu.');
    }
    if (original.date === targetDate && !cleanStartTime) {
      return planView(original);
    }

    const input = structuredClone(original.planningInputSnapshot as unknown as PlanningInput);
    const result = structuredClone(original.planningSummary as unknown as PlanningResult);
    const timezone = input.profile?.timezone || 'Europe/Prague';
    const targetCrewIds = new Set(options?.crewId ? [options.crewId] : result.crews.map(c => c.id));
    if (options?.crewId && !result.crews.some(c => c.id === options.crewId)) {
      throw new Error('Vybraná posádka nebyla v trase nalezena.');
    }

    const computeCrewDeltaMs = (departureAt: string) => {
      if (!cleanStartTime) return 0;
      const shiftedBase = Date.parse(shiftIsoToTargetDay(departureAt, original.date, targetDate, timezone, 0));
      const desiredStart = zonedTime(targetDate, cleanStartTime, timezone);
      return Number.isFinite(shiftedBase) ? desiredStart - shiftedBase : 0;
    };

    // DRAFT plan: shift timestamps, create new DRAFT on targetDate, cancel old DRAFT
    if (original.status === 'DRAFT') {
      const shiftedCrews: PlannedCrew[] = result.crews
        .filter(c => targetCrewIds.has(c.id))
        .map(crew => {
          const deltaMs = computeCrewDeltaMs(crew.departureAt);
          return {
            ...crew,
            liveLocation: null,
            departureAt: shiftIsoToTargetDay(crew.departureAt, original.date, targetDate, timezone, deltaMs),
            endAt: shiftIsoToTargetDay(crew.endAt, original.date, targetDate, timezone, deltaMs),
            stops: crew.stops.map(stop => ({
              ...stop,
              arrivalAt: shiftIsoToTargetDay(stop.arrivalAt, original.date, targetDate, timezone, deltaMs),
              startAt: shiftIsoToTargetDay(stop.startAt, original.date, targetDate, timezone, deltaMs),
              endAt: shiftIsoToTargetDay(stop.endAt, original.date, targetDate, timezone, deltaMs),
            })),
          };
        });

      const newSummary: PlanningResult = {
        ...result,
        crews: shiftedCrews,
        serviceMinutes: shiftedCrews.reduce((sum, c) => sum + c.serviceMinutes, 0),
        travelSeconds: shiftedCrews.reduce((sum, c) => sum + c.travelSeconds, 0),
        distanceMeters: shiftedCrews.reduce((sum, c) => sum + c.distanceMeters, 0),
      };
      const latest = await tx.fieldPlan.findFirst({ where: { organizationId, date: targetDate }, orderBy: { version: 'desc' } });
      const created = await tx.fieldPlan.create({
        data: {
          organizationId,
          date: targetDate,
          version: (latest?.version ?? 0) + 1,
          requestKey: `resched-${hash([organizationId, original.id, targetDate, Date.now()])}`.slice(0, 60),
          requestHash: hash([original.id, targetDate, cleanStartTime]),
          parentPlanId: original.id,
          electionCampaignId: original.electionCampaignId,
          status: 'DRAFT',
          createdByUserId: actor.id,
          planningInputSnapshot: json({ ...input, date: targetDate }),
          planningSummary: json(newSummary),
        },
      });
      await tx.fieldPlan.update({ where: { id: original.id, organizationId }, data: { status: 'CANCELLED' } });
      await auditPlan(tx, original.id, actor, 'FIELD_PLAN_RESCHEDULED', { targetDate, newPlanId: created.id });
      return planView(await getPlan(created.id, tx));
    }

    // APPROVED or ACTIVE plan: determine unfinished vs completed stops
    const movingStopsAll = result.crews.filter(c => targetCrewIds.has(c.id)).flatMap(c => c.stops);
    const stepIds = movingStopsAll.flatMap(s => (s.fieldWorkStepId ? [s.fieldWorkStepId] : []));
    const navPointIds = movingStopsAll.flatMap(s => (s.navigationPointId ? [s.navigationPointId] : []));
    const workItemIds = movingStopsAll.flatMap(s => (s.workOrderItemId ? [s.workOrderItemId] : []));
    const plainOrderIds = movingStopsAll
      .filter(s => s.workOrderId && !s.fieldWorkStepId && !s.electionRemovalPointId && !s.navigationPointId && !s.workOrderItemId && !s.isWarehousePitstop)
      .map(s => s.workOrderId);
    const pitstopLogIds = movingStopsAll
      .filter(s => s.isWarehousePitstop)
      .map(s => `fp-pitstop-${original.id}-${stopId(s)}-FIELD_POINT_COMPLETED`);

    const [fieldSteps, navPoints, workItems, plainOrders, donePitstops] = await Promise.all([
      stepIds.length > 0 && tx.fieldWorkStep?.findMany
        ? tx.fieldWorkStep.findMany({ where: { organizationId, id: { in: stepIds } } })
        : Promise.resolve([]),
      navPointIds.length > 0 && tx.navigationPoint?.findMany
        ? tx.navigationPoint.findMany({ where: { organizationId, id: { in: navPointIds } }, select: { id: true, status: true } })
        : Promise.resolve([]),
      workItemIds.length > 0 && tx.workOrderItem?.findMany
        ? tx.workOrderItem.findMany({ where: { organizationId, id: { in: workItemIds } }, include: { crmRealization: true } })
        : Promise.resolve([]),
      plainOrderIds.length > 0 && tx.workOrder?.findMany
        ? tx.workOrder.findMany({ where: { organizationId, id: { in: plainOrderIds } }, select: { id: true, status: true } })
        : Promise.resolve([]),
      pitstopLogIds.length > 0 && tx.crmAuditLog?.findMany
        ? tx.crmAuditLog.findMany({ where: { organizationId, id: { in: pitstopLogIds } }, select: { entityId: true } })
        : Promise.resolve([]),
    ]);

    const stepMap = new Map(fieldSteps.map(s => [s.id, s]));
    const navMap = new Map(navPoints.map(p => [p.id, p]));
    const itemMap = new Map(workItems.map(i => [i.id, i]));
    const orderMap = new Map(plainOrders.map(o => [o.id, o]));
    const pitstopDoneSet = new Set(donePitstops.map(p => p.entityId));

    const isStopCompletedOrCancelled = (stop: PlannedCrew['stops'][number]) => {
      if (stop.fieldWorkStepId) {
        const st = stepMap.get(stop.fieldWorkStepId);
        return !st || ['COMPLETED', 'CANCELLED'].includes(st.status);
      }
      if (stop.isWarehousePitstop) {
        return pitstopDoneSet.has(stopId(stop));
      }
      if (stop.navigationPointId) {
        const pt = navMap.get(stop.navigationPointId);
        return !pt || ['INSTALLED', 'CANCELLED', 'REMOVED'].includes(pt.status);
      }
      if (stop.workOrderItemId) {
        const it = itemMap.get(stop.workOrderItemId);
        return !it || ['DONE', 'CANCELLED'].includes(itemStatus(it));
      }
      const ord = orderMap.get(stop.workOrderId);
      return ord ? ['DONE', 'CANCELLED'].includes(ord.status) : false;
    };

    const movedCrews: PlannedCrew[] = [];
    const stayingCrews: PlannedCrew[] = [];

    for (const crew of result.crews) {
      if (!targetCrewIds.has(crew.id)) {
        stayingCrews.push(crew);
        continue;
      }
      const deltaMs = computeCrewDeltaMs(crew.departureAt);
      const unfinishedStops = crew.stops.filter(s => !isStopCompletedOrCancelled(s));
      const completedStops = crew.stops.filter(s => isStopCompletedOrCancelled(s));

      if (completedStops.length > 0) {
        stayingCrews.push({
          ...crew,
          stops: completedStops.map((s, idx) => ({ ...s, routeOrder: idx + 1 })),
          serviceMinutes: completedStops.reduce((sum, s) => sum + s.serviceMinutes, 0),
        });
      }

      if (unfinishedStops.length > 0) {
        const shiftedStops = unfinishedStops.map((stop, idx) => {
          const step = stop.fieldWorkStepId ? stepMap.get(stop.fieldWorkStepId) : undefined;
          return {
            ...stop,
            routeOrder: idx + 1,
            arrivalAt: shiftIsoToTargetDay(stop.arrivalAt, original.date, targetDate, timezone, deltaMs),
            startAt: shiftIsoToTargetDay(stop.startAt, original.date, targetDate, timezone, deltaMs),
            endAt: shiftIsoToTargetDay(stop.endAt, original.date, targetDate, timezone, deltaMs),
            quantity: step ? Math.max(1, step.quantity - step.completedQuantity) : stop.quantity,
          };
        });
        movedCrews.push({
          ...crew,
          liveLocation: null,
          departureAt: shiftIsoToTargetDay(crew.departureAt, original.date, targetDate, timezone, deltaMs),
          endAt: shiftIsoToTargetDay(crew.endAt, original.date, targetDate, timezone, deltaMs),
          stops: shiftedStops,
          serviceMinutes: shiftedStops.reduce((sum, s) => sum + s.serviceMinutes, 0),
          travelSeconds: shiftedStops.reduce((sum, s) => sum + s.travel.durationSeconds, crew.returnLeg.durationSeconds),
          distanceMeters: shiftedStops.reduce((sum, s) => sum + s.travel.distanceMeters, crew.returnLeg.distanceMeters),
        });
      }
    }

    if (movedCrews.length === 0) {
      throw new Error('Všechny zastávky této trasy jsou již dokončené; není co přesouvat.');
    }

    // Cancel reservations of moving crews on original day first (unless kept by an unmoved crew on original day)
    const oldReservationIds = reusableReservations(original);
    const movingCrewReservationIds = movedCrews.flatMap(c => [
      `fp-${hash([original.id, c.id]).slice(0, 32)}`,
      `resched-${hash([original.id, c.id]).slice(0, 32)}`,
      `continue-${hash([original.id, c.id]).slice(0, 32)}`,
    ]);
    const allCrewsMoved = result.crews.every(c => targetCrewIds.has(c.id));
    const reservationsToCancel = allCrewsMoved ? [...new Set([...oldReservationIds, ...movingCrewReservationIds])] : movingCrewReservationIds;
    if (reservationsToCancel.length > 0 && tx.vehicleReservation?.updateMany) {
      await tx.vehicleReservation.updateMany({
        where: { organizationId, id: { in: reservationsToCancel }, status: { in: ['RESERVED', 'ACTIVE'] } },
        data: { status: 'CANCELLED' },
      });
    }

    // Check targetDate absences and vehicle conflicts
    const targetDay = new Date(`${targetDate}T00:00:00Z`);
    const allMovedEmployeeIds = [...new Set(movedCrews.flatMap(c => c.employeeIds))];
    const allMovedVehicleIds = [...new Set(movedCrews.flatMap(c => (c.vehicleId ? [c.vehicleId] : [])))];

    if (allMovedEmployeeIds.length > 0 && tx.employeeAbsence?.findMany) {
      const absences = await tx.employeeAbsence.findMany({
        where: {
          organizationId,
          employeeId: { in: allMovedEmployeeIds },
          status: 'APPROVED',
          dateFrom: { lte: targetDay },
          dateTo: { gte: targetDay },
        },
      });
      if (absences.length > 0) {
        const absentNames = movedCrews
          .flatMap(c => c.employeeIds.map((id, i) => (absences.some(a => a.employeeId === id) ? c.names[i] ?? id : null)))
          .filter(Boolean)
          .join(', ');
        throw new Error(`Pracovník (${absentNames}) má na ${targetDate} schválenou absenci. Předejte trasu jinému pracovníkovi nebo zvolte jiný den.`);
      }
    }

    if (allMovedVehicleIds.length > 0 && tx.vehicle?.findMany) {
      const vehicles = await tx.vehicle.findMany({ where: { organizationId, id: { in: allMovedVehicleIds } } });
      for (const crew of movedCrews) {
        if (!crew.vehicleId) continue;
        const veh = vehicles.find(v => v.id === crew.vehicleId);
        if (!veh || ['SERVICE', 'OUT_OF_SERVICE'].includes(veh.status)) {
          throw new Error(`Vozidlo ${crew.vehicleName ?? ''} je v servisu nebo mimo provoz.`);
        }
        if (tx.vehicleReservation?.findMany) {
          const conflictingRes = await tx.vehicleReservation.findMany({
            where: {
              organizationId,
              vehicleId: crew.vehicleId,
              status: { in: ['RESERVED', 'ACTIVE'] },
              dateFrom: { lte: targetDay },
              dateTo: { gte: targetDay },
            },
          });
          if (conflictingRes.some(r => !crew.employeeIds.includes(r.employeeId))) {
            throw new Error(`Vozidlo ${veh.name} je na ${targetDate} rezervované jinou posádkou. Změňte vozidlo nebo zvolte jiný den.`);
          }
        }
      }
    }

    const newSummary: PlanningResult = {
      ...result,
      crews: movedCrews,
      conflicts: [],
      unassigned: [],
      estimated: true,
      explanation: `Trasa přesunuta z ${original.date} na ${targetDate}.`,
      serviceMinutes: movedCrews.reduce((sum, c) => sum + c.serviceMinutes, 0),
      travelSeconds: movedCrews.reduce((sum, c) => sum + c.travelSeconds, 0),
      distanceMeters: movedCrews.reduce((sum, c) => sum + c.distanceMeters, 0),
    };

    const latest = await tx.fieldPlan.findFirst({ where: { organizationId, date: targetDate }, orderBy: { version: 'desc' } });
    const now = new Date();
    const movedPlan = await tx.fieldPlan.create({
      data: {
        organizationId,
        date: targetDate,
        version: (latest?.version ?? 0) + 1,
        requestKey: `resched-${hash([organizationId, original.id, targetDate, now.getTime()])}`.slice(0, 60),
        requestHash: hash([original.id, targetDate, cleanStartTime]),
        parentPlanId: original.id,
        electionCampaignId: original.electionCampaignId,
        status: 'APPROVED',
        createdByUserId: actor.id,
        approvedByUserId: actor.id,
        approvedAt: now,
        planningInputSnapshot: json({ ...input, date: targetDate, now: now.toISOString() }),
        planningSummary: json(newSummary),
      },
    });

    // Update linked field steps, election points, navigation points, realizations, and work orders
    const scheduledOrders = new Set<string>();
    for (const crew of movedCrews) {
      for (const stop of crew.stops) {
        if (stop.isWarehousePitstop) continue;
        if (stop.fieldWorkStepId && tx.fieldWorkStep?.updateMany) {
          await tx.fieldWorkStep.updateMany({
            where: { id: stop.fieldWorkStepId, organizationId },
            data: { assignedFieldPlanId: movedPlan.id, assignedCrewId: crew.id, version: { increment: 1 } },
          });
        }
        if (stop.electionRemovalPointId && tx.electionRemovalPoint?.update) {
          await tx.electionRemovalPoint.update({
            where: { id: stop.electionRemovalPointId, organizationId },
            data: {
              assignedFieldPlanId: movedPlan.id,
              assignedCrewId: crew.id,
              plannedArrivalAt: new Date(stop.arrivalAt),
              plannedOrder: stop.routeOrder,
            },
          });
        }
        if (stop.fieldWorkStepId || stop.electionRemovalPointId) continue;

        if (stop.navigationPointId && tx.navigationPoint?.update) {
          await tx.navigationPoint.update({
            where: { id: stop.navigationPointId, organizationId },
            data: { plannedInstallationAt: new Date(stop.startAt), routeOrder: stop.routeOrder },
          });
        }
        if (stop.crmRealizationId && tx.crmRealization?.update) {
          await tx.crmRealization.update({
            where: { id: stop.crmRealizationId, organizationId },
            data: { plannedDate: new Date(stop.startAt) },
          });
        }
        if (stop.workOrderId && !scheduledOrders.has(stop.workOrderId)) {
          scheduledOrders.add(stop.workOrderId);
          const earliestStart = Math.min(
            ...movedCrews
              .flatMap(c => c.stops.filter(s => s.workOrderId === stop.workOrderId))
              .map(s => Date.parse(s.startAt))
          );
          if (tx.workOrder?.update) {
            await tx.workOrder.update({
              where: { id: stop.workOrderId, organizationId },
              data: { scheduledAt: new Date(earliestStart) },
            });
          }
          await syncWorkOrderTasks(stop.workOrderId, tx);
        }
      }
    }

    // Create new vehicle reservations on targetDate
    const newReservationIds: string[] = [];
    for (const crew of movedCrews) {
      if (crew.vehicleId) {
        const existingSameEmp = tx.vehicleReservation?.findFirst
          ? await tx.vehicleReservation.findFirst({
              where: {
                organizationId,
                vehicleId: crew.vehicleId,
                employeeId: { in: crew.employeeIds },
                status: { in: ['RESERVED', 'ACTIVE'] },
                dateFrom: { lte: targetDay },
                dateTo: { gte: targetDay },
              },
            })
          : null;
        if (existingSameEmp) {
          newReservationIds.push(existingSameEmp.id);
        } else {
          const reservation = await createVehicleReservation(tx, {
            id: `resched-${hash([movedPlan.id, crew.id]).slice(0, 32)}`,
            vehicleId: crew.vehicleId,
            employeeId: crew.employeeIds[0],
            dateFrom: targetDay,
            dateTo: targetDay,
            purpose: `Přesunutý výjezd ${targetDate} / ${crew.id}`,
          });
          newReservationIds.push(reservation.id);
        }
      }
    }
    await tx.fieldPlan.update({
      where: { id: movedPlan.id, organizationId },
      data: { approvalSnapshot: json({ reservationIds: newReservationIds }) },
    });

    // Update original plan status: CANCELLED if nothing stays on original date, COMPLETED if only done stops stay, or keep status if unmoved crews remain
    const hasUnmovedCrews = result.crews.some(c => !targetCrewIds.has(c.id));
    if (stayingCrews.length === 0) {
      await tx.fieldPlan.update({
        where: { id: original.id, organizationId },
        data: { status: 'CANCELLED' },
      });
    } else {
      await tx.fieldPlan.update({
        where: { id: original.id, organizationId },
        data: {
          status: hasUnmovedCrews ? original.status : 'COMPLETED',
          planningSummary: json({ ...result, crews: stayingCrews }),
        },
      });
    }

    await auditPlan(tx, original.id, actor, 'FIELD_PLAN_RESCHEDULED', {
      fromDate: original.date,
      targetDate,
      newPlanId: movedPlan.id,
      crewIds: [...targetCrewIds],
    });
    await auditPlan(tx, movedPlan.id, actor, 'FIELD_PLAN_APPROVED', {
      rescheduledFromPlanId: original.id,
      fromDate: original.date,
      reservationIds: newReservationIds,
    });

    return planView(await getPlan(movedPlan.id, tx));
  }, db);
}
