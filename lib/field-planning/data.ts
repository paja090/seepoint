import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { requireTenantContext } from '../tenant-context';
import { coordinates, dayInZone, defaultPlanningProfile, parseConstraints, parseProfile, profileForNavigation, zonedTime } from './profile';
import { navigationAvailable } from './capabilities';
import { workItemJobs, usesItemExecution } from './item-jobs';
import { navigationPointJobs } from './navigation-jobs';
import type { PlanningJob, PlanningInput, PlanningProfile, CrewInput } from './contracts';

export async function loadProfile(db: Prisma.TransactionClient = prisma): Promise<PlanningProfile> {
  const { organizationId } = requireTenantContext();
  const row = await db.organizationFieldPlanningProfile.findUnique({ where: { organizationId } });
  if (!row) {
    const org = await db.organization.findUnique({ where: { id: organizationId }, select: { city: true, country: true } });
    const profile = defaultPlanningProfile({ country: org?.country ?? 'CZ' });
    return profileForNavigation(profile, await navigationAvailable(db));
  }
  const profile = parseProfile(row.configuration);
  return profileForNavigation(profile, await navigationAvailable(db));
}
export async function loadPlanningData(date: string, options: {
  crews?: CrewInput[]; jobIds?: string[]; now?: string; reuseReservationIds?: string[]; excludePlanIds?: string[];
} = {}, db: Prisma.TransactionClient = prisma): Promise<PlanningInput> {
  const { organizationId } = requireTenantContext();
  const profile = await loadProfile(db);
  const navigation = await navigationAvailable(db);
  if (!navigation && options.jobIds?.some(id => id.startsWith('navigation-point:'))) throw new Error('FORBIDDEN: Navigation není aktivní.');
  if (!profile.enabled) throw new Error('Plánování výjezdů je v profilu organizace vypnuto.');
  const start = zonedTime(date, '00:00', profile.timezone);
  const nextDay = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const end = zonedTime(nextDay, '00:00', profile.timezone);
  const day = new Date(`${date}T00:00:00Z`);
  const [employees, absences, vehicles, reservations, orders, plans, otherTasks, problems, unlinkedNavigation] = await Promise.all([
    db.employee.findMany({ where: { organizationId }, orderBy: { id: 'asc' } }),
    db.employeeAbsence.findMany({ where: { organizationId, status: 'APPROVED', dateFrom: { lte: day }, dateTo: { gte: day } } }),
    db.vehicle.findMany({ where: { organizationId }, orderBy: { id: 'asc' } }),
    db.vehicleReservation.findMany({ where: { organizationId, status: { in: ['RESERVED', 'ACTIVE'] }, dateFrom: { lte: day }, dateTo: { gte: day } } }),
    db.workOrder.findMany({ where: { organizationId, ...(!navigation ? { navigationOrderId: null } : {}), ...(options.jobIds ? { OR: [{ id: { in: options.jobIds.filter(id => !id.startsWith('navigation-point:') && !id.startsWith('work-item:')) } }, { items: { some: { id: { in: options.jobIds.filter(id => id.startsWith('work-item:')).map(id => id.slice(10)) } } } }, { navigationOrder: { points: { some: { id: { in: options.jobIds.filter(id => id.startsWith('navigation-point:')).map(id => id.slice(17)) } } } } }] } : { scheduledAt: { lt: new Date(end) }, status: { notIn: ['DONE', 'CANCELLED'] } }) },
      include: { assignments: true, items: { include: { carrier: true, surface: { include: { carrier: true } }, crmRealization: true } }, workTasks: true, crmOrder: true, crmRealizations: true,
        navigationOrder: { include: { crmOrder: true, points: { include: { carrier: true, surface: true } } } } }, orderBy: { id: 'asc' }, take: 201 }),
    db.fieldPlan.findMany({ where: { organizationId, date, status: { in: ['APPROVED', 'ACTIVE'] }, id: { notIn: options.excludePlanIds ?? [] } } }),
    db.workTask.findMany({ where: { organizationId, status: { in: ['TODO', 'IN_PROGRESS'] }, scheduledDate: { gte: new Date(start), lt: new Date(end) } }, select: { workOrderId: true, assignedToEmployeeId: true } }),
    db.crmAuditLog.findMany({ where: { organizationId, entityType: 'WorkOrder', action: { in: ['FIELD_EXECUTION_BLOCKED', 'FIELD_EXECUTION_RESOLVED'] } }, orderBy: { createdAt: 'desc' }, select: { entityId: true, action: true } }),
    navigation ? db.navigationOrder.findMany({ where: { organizationId, workOrders: { none: {} }, ...(options.jobIds ? { points: { some: { id: { in: options.jobIds.filter(id => id.startsWith('navigation-point:')).map(id => id.slice(17)) } } } } : { status: { in: ['PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE'] } }) },
      include: { points: { include: { carrier: true, surface: true } }, crmOrder: { include: { client: true } } }, orderBy: { id: 'asc' }, take: 201 }) : Promise.resolve([]),
  ]);
  if (orders.length > 200) throw new Error('V1 podporuje nejvýše 200 úkolů na jeden návrh; omezte výběr.');

  const ids = new Set(orders.map(o => o.id));
  const busyEmployees = new Set(otherTasks.filter(t => !t.workOrderId || !ids.has(t.workOrderId)).map(t => t.assignedToEmployeeId));
  for (const plan of plans) {
    const snapshot = plan.planningInputSnapshot as unknown as PlanningInput;
    snapshot.crews.forEach(c => c.employeeIds.forEach(id => busyEmployees.add(id)));
  }
  // Explicitly validate every canonical relation even though tenant Prisma also scopes queries.
  const assertRows = (rows: Array<{ organizationId: string } | null>) => {
    if (rows.some(row => row && row.organizationId !== organizationId)) throw new Error('Cross-tenant reference rejected.');
  };
  assertRows([...employees, ...vehicles, ...reservations, ...absences]);
  let jobs: PlanningJob[] = orders.flatMap(o => {
    assertRows([o, o.crmOrder, o.navigationOrder, o.navigationOrder?.crmOrder ?? null, ...o.crmRealizations, ...o.items, ...o.assignments, ...o.workTasks,
      ...o.items.flatMap(i => [i.carrier, i.surface]), ...(o.navigationOrder?.points ?? []), ...(o.navigationOrder?.points.flatMap(p => [p.carrier, p.surface]) ?? [])]);
    if ((o.crmOrderId && !o.crmOrder) || (o.navigationOrderId && !o.navigationOrder) || o.items.some(i => (i.carrierId && !i.carrier) || (i.surfaceId && !i.surface))) throw new Error('Neplatná tenantová vazba zakázky.');
    if (o.navigationOrder?.points.some(p => (p.carrierId && !p.carrier) || (p.surfaceId && !p.surface))) throw new Error('Cross-tenant Navigation reference rejected.');
    const isWorkshop = (o.planningConstraints as Record<string, unknown> | null)?.scope === 'WORKSHOP';
    if (isWorkshop && !options.jobIds?.includes(o.id)) return [];

    const constraints = parseConstraints(o.planningConstraints);
    const assignedIds: string[] = [];
    let blockedReason: string | undefined;
    for (const a of o.navigationOrder || usesItemExecution(o.items) ? [] : o.assignments) {
      const matches = employees.filter(e => a.userId ? e.userId === a.userId : `${e.firstName} ${e.lastName}`.trim().toLocaleLowerCase() === a.workerName.trim().toLocaleLowerCase());
      if (matches.length !== 1) blockedReason = 'Původní přiřazení pracovníka není jednoznačné; opravte je v Plánu práce.';
      else assignedIds.push(matches[0].id);
    }
    constraints.requiredEmployeeIds = [...new Set([...(constraints.requiredEmployeeIds ?? []), ...assignedIds])];
    if (constraints.requiredEmployeeIds.some(id => !employees.some(e => e.id === id))) throw new Error('Cross-tenant Worker rejected.');
    const points = o.items.map(i => i.carrier).filter(c => c !== null);
    const distinct = new Map(points.filter(coordinates).map(c => [`${c.latitude},${c.longitude}`, { latitude: c.latitude!, longitude: c.longitude! }]));
    if (!o.navigationOrder && !usesItemExecution(o.items) && (points.length === 0 || points.some(p => !coordinates(p)) || distinct.size !== 1)) {
      if (!o.locationNote) blockedReason = 'Zakázka nemá právě jednu jednoznačnou pracovní lokalitu.';
    }
    if (o.crmRealizations.some(r => r.claimNote && (!usesItemExecution(o.items) || !o.items.some(i => i.crmRealizationId === r.id)))) blockedReason = 'Realizace má nevyřešený provozní problém.';
    if (!o.crmRealizations.length && !o.navigationOrder && problems.find(p => p.entityId === o.id)?.action === 'FIELD_EXECUTION_BLOCKED') blockedReason = 'Práce má nevyřešený provozní problém.';
    const base: PlanningJob = { id: o.id, sourceType: 'WORK_ORDER', sourceId: o.id, organizationId, title: o.title, workType: o.workType, priority: o.priority, status: o.status,
      scheduledAt: o.scheduledAt.toISOString(), deadlineAt: o.deadlineAt?.toISOString(), campaignDateFrom: o.campaignDateFrom?.toISOString() ?? o.navigationOrder?.rentStart?.toISOString() ?? o.navigationOrder?.crmOrder.dateFrom?.toISOString(),
      location: distinct.size === 1 ? [...distinct.values()][0] : null, serviceMinutes: o.estimatedHours == null ? null : Number(o.estimatedHours) * 60,
      constraints, blockedReason, updatedAt: o.updatedAt.toISOString() + (o.navigationOrder ? '/' + o.navigationOrder.updatedAt.toISOString() + '/' + o.navigationOrder.crmOrder.updatedAt.toISOString() : ''), clientName: o.clientName,
      orderNumber: o.navigationOrder?.crmOrder.orderNumber ?? o.crmOrder?.orderNumber ?? null,
      address: o.locationNote || (distinct.size === 1 && points[0] ? [points[0].address, points[0].city].filter(Boolean).join(', ') : null) };
    if (o.navigationOrder) return navigationPointJobs(base, o.navigationOrder, employees, profile.navigationPointMinutes);
    if (usesItemExecution(o.items)) return workItemJobs(base, o.items, profile, employees);
    return [base];
  });
  if (unlinkedNavigation.length > 200) throw new Error('Omezte výběr navigačních zakázek.');
  for (const nav of unlinkedNavigation) {
    assertRows([nav, nav.crmOrder, nav.crmOrder.client, ...nav.points, ...nav.points.flatMap(p => [p.carrier, p.surface])]);
    if (nav.points.some(p => (p.carrierId && !p.carrier) || (p.surfaceId && !p.surface))) throw new Error('Cross-tenant Navigation reference rejected.');
    jobs.push(...navigationPointJobs({ id: '', organizationId, title: nav.targetName, clientName: nav.crmOrder.client.name, orderNumber: nav.crmOrder.orderNumber,
      workType: 'NAVIGATION_INSTALLATION', priority: 'NORMAL', status: nav.crmOrder.status === 'CANCELLED' ? 'CANCELLED' : 'PLANNED',
      scheduledAt: (nav.plannedInstallationAt ?? nav.installationDate ?? nav.createdAt).toISOString(), campaignDateFrom: nav.rentStart?.toISOString() ?? nav.crmOrder.dateFrom?.toISOString(),
      location: null, serviceMinutes: null, constraints: {}, updatedAt: nav.updatedAt.toISOString() + '/' + nav.crmOrder.updatedAt.toISOString() }, nav, employees, profile.navigationPointMinutes));
  }
  if (options.jobIds) {
    // WorkOrder IDs from legacy plans expand into points; new plans carry individual point IDs.
    for (const id of new Set(options.jobIds)) if (!orders.some(o => o.id === id) && !jobs.some(j => j.id === id)) throw new Error('Zakázka nebo bod nebyl nalezen v aktivní organizaci.');
    jobs = jobs.filter(j => options.jobIds!.includes(j.id) || Boolean(j.parentWorkOrderId && options.jobIds!.includes(j.parentWorkOrderId)));
  } else jobs = jobs.filter(j => !['DONE', 'CANCELLED'].includes(j.status));
  for (const plan of plans) {
    const summary = plan.planningSummary as unknown as import('./contracts').PlanningResult;
    const planned = new Set(summary.crews.flatMap(c => c.stops.map(s => s.jobId ?? s.workOrderId)));
    for (const job of jobs) if (planned.has(job.id) || Boolean(job.parentWorkOrderId && planned.has(job.parentWorkOrderId))) job.blockedReason = 'Zastávka již patří jinému schválenému plánu.';
  }
  if (jobs.length > 200) throw new Error('Vyberte nejvýše 200 zastávek.');
  // Validate predecessor references against the same organization, including completed work.
  const predecessorIds = [...new Set(jobs.flatMap(j => j.constraints.predecessorIds ?? []))];
  const predecessors = predecessorIds.length ? await db.workOrder.findMany({ where: { organizationId, id: { in: predecessorIds } }, select: { id: true, status: true } }) : [];
  if (predecessors.length !== predecessorIds.length) throw new Error('Neplatná tenantová vazba povinného pořadí.');
  for (const job of jobs) job.constraints.predecessorIds = job.constraints.predecessorIds?.filter(id => !predecessors.some(p => p.id === id && p.status === 'DONE')).flatMap(id => { const children = jobs.filter(j => j.parentWorkOrderId === id); return children.length ? children.map(j => j.id) : [id]; });
  const mappedEmployees = employees.map(e => ({ id: e.id, organizationId, name: `${e.firstName} ${e.lastName}`.trim(), userId: e.userId, isActive: e.isActive,
    roles: [...new Set([e.role, ...e.roles])], positions: [...new Set([...(e.position ? [e.position] : []), ...e.positions])],
    available: !absences.some(a => a.employeeId === e.id) && !busyEmployees.has(e.id) && (!e.startDate || dayInZone(e.startDate, profile.timezone) <= date) && (!e.endDate || dayInZone(e.endDate, profile.timezone) >= date) }));
  const availableVehicles = vehicles.filter(v => !['SERVICE', 'OUT_OF_SERVICE', 'IN_USE'].includes(v.status) && !reservations.some(r => r.vehicleId === v.id));
  const automaticEmployees = mappedEmployees.filter(e => e.isActive && e.available && e.roles.some(r => ['WORKER', 'TECHNICIAN'].includes(r)));
  return { organizationId, date, now: options.now ?? new Date().toISOString(), profile, jobs,
    employees: mappedEmployees, vehicles: vehicles.map(v => {
      const isReservedByCrew = Boolean(options.crews?.some(c => c.vehicleId === v.id && reservations.some(r => r.vehicleId === v.id && c.employeeIds.includes(r.employeeId))));
      const externalReservations = reservations.filter(r => r.vehicleId === v.id && !(options.reuseReservationIds ?? []).includes(r.id) && !isReservedByCrew);
      return {
        id: v.id,
        organizationId,
        name: v.name,
        status: v.status === 'IN_USE' && reservations.some(r => r.vehicleId === v.id && (options.reuseReservationIds ?? []).includes(r.id) && r.status === 'ACTIVE') ? 'RESERVED' : v.status,
        reserved: externalReservations.length > 0,
      };
    }),
    crews: options.crews ?? automaticEmployees.map((e, i) => ({ id: `crew-${i + 1}`, employeeIds: [e.id], vehicleId: availableVehicles[i]?.id ?? null })) };
}
