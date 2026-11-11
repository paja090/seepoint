import 'server-only';
import { prisma } from '@/lib/db';
import { hasModuleAccess } from '@/lib/module-policy';
import type { AuthenticatedPlannerActor } from './auth';
import { PlannerError, type PlannerItem } from './domain';
import { activeMembers, preferencesFor, tasksFor } from './repository';
import { canSeeTeam, projectEvent } from './permissions';
import { dateInZone, dayRange, localInstant, plusDays, validDate } from './time';
import { capacity, findSlots, overlaps } from './scheduling';
import {
  buildPlannerAttentionItems,
  projectWorkTaskToTimelineItem,
  sortPlannerTasks,
} from './work-projection';

export async function userTimeline(actor: AuthenticatedPlannerActor, userId: string, from: Date, to: Date, shared = false): Promise<PlannerItem[]> {
  const organizationId = actor.organizationId;
  const members = await activeMembers(organizationId);
  if (!members.some(m => m.userId === userId) || (userId !== actor.id && !canSeeTeam(actor))) throw new PlannerError('Člen týmu není dostupný.', 403);
  const memberIds = members.map(m => m.userId);
  const fromDateStr = from.toISOString().slice(0, 10);
  const toDateStr = to.toISOString().slice(0, 10);
  const workWindowFrom = new Date(+from - 86400000);
  const workWindowTo = new Date(+to + 86400000);
  const canWork = hasModuleAccess(actor, 'work');
  const [blocks, calendars, absences, employee, fieldPlans] = await Promise.all([
    prisma.plannerBlock.findMany({ where: { organizationId, userId, startAt: { lt: to }, endAt: { gt: from } }, orderBy: { startAt: 'asc' } }),
    hasModuleAccess(actor, 'googleCalendar', 'planner') ? prisma.externalCalendar.findMany({ where: { organizationId, selected: true, connection: { organizationId, status: 'CONNECTED', userId: { in: memberIds } }, OR: [{ connection: { userId } }, ...(shared ? [{ kind: 'COMPANY' }] : [])] }, include: { connection: { select: { userId: true } }, events: { where: { organizationId, startAt: { lt: to }, endAt: { gt: from } } } } }) : Promise.resolve([]),
    prisma.employeeAbsence.findMany({ where: { organizationId, employee: { userId, organizationId, isActive: true }, status: 'APPROVED', dateFrom: { lt: to }, dateTo: { gte: new Date(+from - 86400000) } }, select: { id: true, dateFrom: true, dateTo: true } }),
    prisma.employee.findFirst({ where: { organizationId, userId, isActive: true }, select: { id: true } }),
    prisma.fieldPlan.findMany({
      where: {
        organizationId,
        date: { gte: fromDateStr, lte: toDateStr },
        status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED', 'DRAFT'] },
      },
      select: {
        id: true,
        date: true,
        status: true,
        planningSummary: true,
        electionCampaignId: true,
        electionCampaign: { select: { id: true, name: true } },
      },
    }),
  ]);
  const [p, scheduledWorkTasks] = await Promise.all([
    preferencesFor(organizationId, userId, actor.organization?.plannerDefaults),
    employee
      ? prisma.workTask.findMany({
          where: {
            organizationId,
            assignedToEmployeeId: employee.id,
            status: { in: ['TODO', 'IN_PROGRESS'] },
            OR: [
              { dueDate: { gte: workWindowFrom, lt: workWindowTo } },
              { scheduledDate: { gte: workWindowFrom, lt: workWindowTo } },
              { workOrder: { scheduledAt: { gte: workWindowFrom, lt: workWindowTo } } },
            ],
          },
          select: {
            id: true,
            title: true,
            priority: true,
            dueDate: true,
            scheduledDate: true,
            plannedTimeHours: true,
            workOrderId: true,
            workOrder: { select: { id: true, scheduledAt: true, locationNote: true, clientName: true } },
          },
          take: 100,
        })
      : Promise.resolve([]),
  ]);
  const result: PlannerItem[] = blocks.map(b => ({ id: b.id, title: userId === actor.id ? b.title : 'Pracovní blok', startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString(), source: 'INTERNAL', busy: true, editable: userId === actor.id, ...(userId === actor.id ? { version: b.version, category: b.category } : {}) }));
  for (const c of calendars) for (const event of c.events) {
    const safe = projectEvent(actor, event, { organizationId, ownerId: c.connection.userId, visibility: c.visibility, kind: c.kind }, true);
    if (safe) result.push({ ...safe, busy: safe.busy && c.connection.userId === userId });
  }
  for (const a of absences) result.push({ id: a.id, title: 'Nepřítomnost', startAt: localInstant(a.dateFrom.toISOString().slice(0, 10), '00:00', p.timezone).toISOString(), endAt: localInstant(plusDays(a.dateTo.toISOString().slice(0, 10), 1), '00:00', p.timezone).toISOString(), source: 'ABSENCE', busy: true, allDay: true });
  for (const wt of scheduledWorkTasks) {
    const projected = projectWorkTaskToTimelineItem(
      { ...wt, plannedTimeHours: wt.plannedTimeHours ? Number(wt.plannedTimeHours) : null },
      p.timezone,
      canWork,
      userId !== actor.id && !canSeeTeam(actor)
    );
    if (projected && overlaps(projected, { startAt: from.toISOString(), endAt: to.toISOString() })) {
      result.push(projected);
    }
  }
  if (employee) {
    for (const plan of fieldPlans) {
      const isDraft = plan.status === 'DRAFT';
      const summary = plan.planningSummary as unknown as { crews?: import('@/lib/field-planning/contracts').PlannedCrew[] };
      if (Array.isArray(summary?.crews)) {
        for (const crew of summary.crews) {
          if (crew.employeeIds?.includes(employee.id) && crew.departureAt && crew.endAt) {
            const stopCount = crew.stops?.length ?? 0;
            if (stopCount > 0 && new Date(crew.endAt).getTime() > new Date(crew.departureAt).getTime()) {
              const stopLabel = stopCount === 1 ? '1 zastávka' : stopCount < 5 ? `${stopCount} zastávky` : `${stopCount} zastávek`;
              const prefix = isDraft ? 'Návrh výjezdu' : 'Výjezd';
              const title = plan.electionCampaign?.name
                ? (userId === actor.id || canSeeTeam(actor) ? `${prefix}: ${plan.electionCampaign.name}` : 'Terénní výjezd')
                : (userId === actor.id || canSeeTeam(actor) ? `${prefix} v terénu (${stopLabel})` : 'Terénní výjezd');
              const location = crew.vehicleName
                ? `Vozidlo: ${crew.vehicleName} · ${stopLabel}`
                : `${stopLabel} na trase`;
              const href = plan.electionCampaignId
                ? `/election-removal/${plan.electionCampaignId}/route`
                : isDraft
                ? `/work/dispatch?date=${plan.date}&plan=${plan.id}#planner`
                : '/my-route';
              result.push({
                id: `field-plan:${plan.id}:${crew.id}`,
                title,
                startAt: crew.departureAt,
                endAt: crew.endAt,
                source: 'FIELD_TRIP',
                busy: !isDraft,
                isDraft,
                location,
                href,
              });
            }
          }
        }
      }
    }
  }
  return result.sort((a, b) => a.startAt.localeCompare(b.startAt));
}
export async function readPlanner(actor: AuthenticatedPlannerActor, date: string, view: string) {
  validDate(date);
  if (!['today', 'week', 'team'].includes(view)) throw new PlannerError('Neplatný pohled.');
  if (view === 'team' && !canSeeTeam(actor)) throw new PlannerError('Týmový přehled je dostupný vedoucím.', 403);
  const preferences = await preferencesFor(actor.organizationId, actor.id, actor.organization?.plannerDefaults);
  const from = dayRange(date, preferences.timezone).start;
  const to = dayRange(plusDays(date, 6), preferences.timezone).end;
  const dayEnd = dayRange(date, preferences.timezone).end;
  const tomorrowDate = plusDays(date, 1);
  const tomorrowEnd = dayRange(tomorrowDate, preferences.timezone).end;
  const canSeeUnassigned = canSeeTeam(actor) && hasModuleAccess(actor, 'work');
  const [items, rawTasks, connections, calendarEventsCount, unassignedOrdersCount] = await Promise.all([
    userTimeline(actor, actor.id, from, to, true), tasksFor(actor),
    prisma.calendarConnection.findMany({ where: { organizationId: actor.organizationId, userId: actor.id }, select: { id: true, status: true, syncStatus: true, lastSyncAt: true, errorCode: true } }),
    hasModuleAccess(actor, 'googleCalendar', 'planner')
      ? prisma.externalCalendarEvent.count({ where: { organizationId: actor.organizationId, calendar: { organizationId: actor.organizationId, selected: true, connection: { organizationId: actor.organizationId, userId: actor.id, status: 'CONNECTED' } } } })
      : Promise.resolve(0),
    canSeeUnassigned
      ? prisma.workOrder.count({
          where: {
            organizationId: actor.organizationId,
            status: { notIn: ['DONE', 'CANCELLED'] },
            scheduledAt: { gte: from, lte: tomorrowEnd },
            assignments: { none: {} },
          },
        })
      : Promise.resolve(0),
  ]);
  const tasks = sortPlannerTasks(rawTasks, date, preferences.timezone);
  const today = items.filter(i => overlaps(i, { startAt: from.toISOString(), endAt: dayEnd.toISOString() }));
  const collision = today.some((a, index) => a.busy && today.slice(index + 1).some(b => b.busy && overlaps(a, b)));
  const attention = buildPlannerAttentionItems({
    tasks,
    todayDate: date,
    tomorrowDate,
    timezone: preferences.timezone,
    hasCollision: collision,
    unassignedOrdersCount,
  });
  const team = [];
  if (view === 'team') for (const member of await activeMembers(actor.organizationId)) {
    const [p, schedule, rawMemberTasks] = await Promise.all([preferencesFor(actor.organizationId, member.userId, actor.organization?.plannerDefaults), userTimeline(actor, member.userId, from, to), tasksFor(actor, member.userId)]);
    const memberTasks = sortPlannerTasks(rawMemberTasks, date, p.timezone);
    const days = Array.from({ length: 7 }, (_, n) => capacity(plusDays(date, n), p, schedule.filter(i => i.busy)));
    const plannedTaskMinutes = memberTasks.filter(t => t.dueAt && Date.parse(t.dueAt) <= +to).reduce((sum, t) => sum + (t.plannedMinutes || 0), 0);
    const weekFreeMinutes = days.reduce((s, d) => s + d.freeMinutes, 0);
    team.push({
      id: member.userId,
      name: member.user.name,
      today: capacity(date, p, schedule.filter(i => i.busy)),
      weekFreeMinutes,
      importantTasks: memberTasks.filter(t => ['HIGH', 'URGENT'].includes(t.priority)).length,
      deadlines: memberTasks.filter(t => t.dueAt && Date.parse(t.dueAt) <= +to).length,
      todayWorkCount: memberTasks.filter(t => t.dueAt && dateInZone(new Date(t.dueAt), p.timezone) === date).length,
      weekWorkCount: memberTasks.filter(t => t.dueAt && dateInZone(new Date(t.dueAt), p.timezone) >= date && Date.parse(t.dueAt) <= +to).length,
      overCapacity: plannedTaskMinutes > weekFreeMinutes,
    });
  }
  const slots = findSlots({ from: new Date(Math.max(+from, Date.now())), to: dayEnd, durationMinutes: 60, participants: [{ preferences, busy: items.filter(i => i.busy) }], focus: true, limit: 3 });
  const sheetMeta = (actor.organization?.plannerDefaults as { googleSheetPlanSync?: { lastSyncAt?: unknown } } | null)?.googleSheetPlanSync;
  const sheetSyncAt = typeof sheetMeta?.lastSyncAt === 'string' ? sheetMeta.lastSyncAt : null;
  const connectedSyncTimes = connections
    .filter(c => c.status === 'CONNECTED' && c.lastSyncAt)
    .map(c => c.lastSyncAt!.toISOString())
    .sort();
  const calendarLastSyncAt = connectedSyncTimes.length ? connectedSyncTimes[connectedSyncTimes.length - 1] : null;
  const todayScheduledWorkCount = tasks.filter(t => t.dueAt && dateInZone(new Date(t.dueAt), preferences.timezone) === date).length;
  return {
    date,
    view,
    preferences,
    items,
    tasks,
    attention,
    capacity: capacity(date, preferences, items.filter(i => i.busy)),
    slots,
    team,
    connections,
    canSeeTeam: canSeeTeam(actor),
    aiAvailable: false,
    googleEnabled: hasModuleAccess(actor, 'googleCalendar', 'planner'),
    refreshedAt: new Date().toISOString(),
    sheetSyncAt,
    calendarLastSyncAt,
    calendarEventsCount,
    todayScheduledWorkCount,
  };
}
export type PlannerReadModel = Awaited<ReturnType<typeof readPlanner>>;
