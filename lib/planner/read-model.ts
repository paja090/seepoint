import 'server-only';
import { prisma } from '@/lib/db';
import { hasModuleAccess } from '@/lib/module-policy';
import type { AuthenticatedPlannerActor } from './auth';
import { PlannerError, type PlannerItem } from './domain';
import { activeMembers, preferencesFor, tasksFor } from './repository';
import { canSeeTeam, projectEvent } from './permissions';
import { dayRange, localInstant, plusDays, validDate } from './time';
import { capacity, findSlots, overlaps } from './scheduling';

export async function userTimeline(actor: AuthenticatedPlannerActor, userId: string, from: Date, to: Date, shared = false): Promise<PlannerItem[]> {
  const organizationId = actor.organizationId;
  const members = await activeMembers(organizationId);
  if (!members.some(m => m.userId === userId) || (userId !== actor.id && !canSeeTeam(actor))) throw new PlannerError('Člen týmu není dostupný.', 403);
  const memberIds = members.map(m => m.userId);
  const [blocks, calendars, absences] = await Promise.all([
    prisma.plannerBlock.findMany({ where: { organizationId, userId, startAt: { lt: to }, endAt: { gt: from } }, orderBy: { startAt: 'asc' } }),
    hasModuleAccess(actor, 'googleCalendar', 'planner') ? prisma.externalCalendar.findMany({ where: { organizationId, selected: true, connection: { organizationId, status: 'CONNECTED', userId: { in: memberIds } }, OR: [{ connection: { userId } }, ...(shared ? [{ kind: 'COMPANY' }] : [])] }, include: { connection: { select: { userId: true } }, events: { where: { organizationId, startAt: { lt: to }, endAt: { gt: from } } } } }) : Promise.resolve([]),
    prisma.employeeAbsence.findMany({ where: { organizationId, employee: { userId, organizationId, isActive: true }, status: 'APPROVED', dateFrom: { lt: to }, dateTo: { gte: new Date(+from - 86400000) } }, select: { id: true, dateFrom: true, dateTo: true } }),
  ]);
  const p = await preferencesFor(organizationId, userId, actor.organization?.plannerDefaults);
  const result: PlannerItem[] = blocks.map(b => ({ id: b.id, title: userId === actor.id ? b.title : 'Pracovní blok', startAt: b.startAt.toISOString(), endAt: b.endAt.toISOString(), source: 'INTERNAL', busy: true, editable: userId === actor.id, ...(userId === actor.id ? { version: b.version, category: b.category } : {}) }));
  for (const c of calendars) for (const event of c.events) {
    const safe = projectEvent(actor, event, { organizationId, ownerId: c.connection.userId, visibility: c.visibility, kind: c.kind }, true);
    if (safe) result.push({ ...safe, busy: safe.busy && c.connection.userId === userId });
  }
  for (const a of absences) result.push({ id: a.id, title: 'Nepřítomnost', startAt: localInstant(a.dateFrom.toISOString().slice(0, 10), '00:00', p.timezone).toISOString(), endAt: localInstant(plusDays(a.dateTo.toISOString().slice(0, 10), 1), '00:00', p.timezone).toISOString(), source: 'ABSENCE', busy: true, allDay: true });
  return result.sort((a, b) => a.startAt.localeCompare(b.startAt));
}
export async function readPlanner(actor: AuthenticatedPlannerActor, date: string, view: string) {
  validDate(date);
  if (!['today', 'week', 'team'].includes(view)) throw new PlannerError('Neplatný pohled.');
  if (view === 'team' && !canSeeTeam(actor)) throw new PlannerError('Týmový přehled je dostupný vedoucím.', 403);
  const preferences = await preferencesFor(actor.organizationId, actor.id, actor.organization?.plannerDefaults);
  const from = dayRange(date, preferences.timezone).start;
  const to = dayRange(plusDays(date, 6), preferences.timezone).end;
  const [items, tasks, connections] = await Promise.all([
    userTimeline(actor, actor.id, from, to, true), tasksFor(actor),
    prisma.calendarConnection.findMany({ where: { organizationId: actor.organizationId, userId: actor.id }, select: { id: true, status: true, syncStatus: true, lastSyncAt: true, errorCode: true } }),
  ]);
  const dayEnd = dayRange(date, preferences.timezone).end;
  const today = items.filter(i => overlaps(i, { startAt: from.toISOString(), endAt: dayEnd.toISOString() }));
  const attention = tasks.filter(t => t.dueAt && Date.parse(t.dueAt) < +dayEnd + 86400000).slice(0, 5).map(t => ({ title: t.title, reason: Date.parse(t.dueAt!) < +from ? 'Po termínu' : 'Blíží se termín', href: t.href }));
  const collision = today.some((a, index) => a.busy && today.slice(index + 1).some(b => b.busy && overlaps(a, b)));
  if (collision) attention.unshift({ title: 'Časová kolize v plánu', reason: 'Dvě události se překrývají.', href: '/planner' });
  const team = [];
  if (view === 'team') for (const member of await activeMembers(actor.organizationId)) {
    const [p, schedule, memberTasks] = await Promise.all([preferencesFor(actor.organizationId, member.userId, actor.organization?.plannerDefaults), userTimeline(actor, member.userId, from, to), tasksFor(actor, member.userId)]);
    const days = Array.from({ length: 7 }, (_, n) => capacity(plusDays(date, n), p, schedule.filter(i => i.busy)));
    const plannedTaskMinutes = memberTasks.filter(t => t.dueAt && Date.parse(t.dueAt) <= +to).reduce((sum, t) => sum + (t.plannedMinutes || 0), 0);
    const weekFreeMinutes = days.reduce((s, d) => s + d.freeMinutes, 0);
    team.push({ id: member.userId, name: member.user.name, today: capacity(date, p, schedule.filter(i => i.busy)), weekFreeMinutes, importantTasks: memberTasks.filter(t => ['HIGH', 'URGENT'].includes(t.priority)).length, deadlines: memberTasks.filter(t => t.dueAt && Date.parse(t.dueAt) <= +to).length, overCapacity: plannedTaskMinutes > weekFreeMinutes });
  }
  const slots = findSlots({ from: new Date(Math.max(+from, Date.now())), to: dayEnd, durationMinutes: 60, participants: [{ preferences, busy: items.filter(i => i.busy) }], focus: true, limit: 3 });
  return { date, view, preferences, items, tasks, attention: attention.slice(0, 5), capacity: capacity(date, preferences, items.filter(i => i.busy)), slots, team, connections, canSeeTeam: canSeeTeam(actor), aiAvailable: false, googleEnabled: hasModuleAccess(actor, 'googleCalendar', 'planner') };
}
export type PlannerReadModel = Awaited<ReturnType<typeof readPlanner>>;
