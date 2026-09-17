import 'server-only';
import { prisma } from '@/lib/db';
import { hasModuleAccess } from '@/lib/module-policy';
import type { AuthenticatedPlannerActor } from './auth';
import { PlannerError, type PlannerTask } from './domain';
import { canSeeTeam } from './permissions';
import { resolvePreferences } from './preferences';

export async function activeMembers(organizationId: string) {
  const rows = await prisma.organizationMember.findMany({ where: { organizationId, isActive: true, user: { status: 'ACTIVE' }, organization: { isActive: true } }, select: { userId: true, role: true, user: { select: { name: true, employees: { where: { organizationId }, select: { isActive: true } } } } }, orderBy: { userId: 'asc' } });
  return rows.filter(r => !r.user.employees.some(e => !e.isActive));
}
export async function preferencesFor(organizationId: string, userId: string, defaults: unknown) {
  const value = await prisma.plannerPreferences.findUnique({ where: { organizationId_userId: { organizationId, userId } } });
  return resolvePreferences(defaults, value?.configuration);
}
export async function tasksFor(actor: AuthenticatedPlannerActor, userId = actor.id): Promise<PlannerTask[]> {
  if (userId !== actor.id && !canSeeTeam(actor)) throw new PlannerError('Nemáte přístup k agendě kolegy.', 403);
  const organizationId = actor.organizationId;
  const employee = await prisma.employee.findFirst({ where: { organizationId, userId, isActive: true }, select: { id: true } });
  const canTasks = hasModuleAccess(actor, 'myTasks', 'myTasks') || hasModuleAccess(actor, 'tasks', 'tasks');
  const [work, quick, crm] = await Promise.all([
    canTasks && employee ? prisma.workTask.findMany({ where: { organizationId, assignedToEmployeeId: employee.id, status: { in: ['TODO', 'IN_PROGRESS'] } }, select: { id: true, title: true, priority: true, dueDate: true, plannedTimeHours: true }, orderBy: { dueDate: 'asc' }, take: 100 }) : [],
    canTasks && employee ? prisma.quickInternalTask.findMany({ where: { organizationId, assignedToEmployeeId: employee.id, status: { not: 'COMPLETED' } }, select: { id: true, title: true, priority: true, dueDate: true }, orderBy: { dueDate: 'asc' }, take: 100 }) : [],
    hasModuleAccess(actor, 'crm', 'clients') ? prisma.crmTask.findMany({ where: { organizationId, assignedUserId: userId, status: { in: ['TODO', 'IN_PROGRESS'] } }, select: { id: true, title: true, priority: true, dueDate: true, clientId: true }, orderBy: { dueDate: 'asc' }, take: 100 }) : [],
  ]);
  return [
    ...work.map(t => ({ id: t.id, sourceKind: 'WORK_TASK' as const, title: t.title, dueAt: t.dueDate?.toISOString() ?? null, priority: t.priority, href: `/my-tasks?taskId=${encodeURIComponent(t.id)}`, plannedMinutes: t.plannedTimeHours ? Number(t.plannedTimeHours) * 60 : null })),
    ...quick.map(t => ({ id: t.id, sourceKind: 'QUICK_TASK' as const, title: t.title, dueAt: t.dueDate?.toISOString() ?? null, priority: t.priority, href: '/my-tasks', plannedMinutes: null })),
    ...crm.map(t => ({ id: t.id, sourceKind: 'CRM_TASK' as const, title: t.title, dueAt: t.dueDate.toISOString(), priority: t.priority, href: `/clients/${encodeURIComponent(t.clientId)}`, plannedMinutes: null })),
  ].sort((a, b) => (a.dueAt || 'z').localeCompare(b.dueAt || 'z'));
}
export async function assertTaskReference(actor: AuthenticatedPlannerActor, kind: unknown, id: unknown) {
  if (kind == null && id == null) return;
  if (!(await tasksFor(actor)).some(t => t.sourceKind === kind && t.id === id)) throw new PlannerError('Úkol není dostupný nebo už je dokončený.', 403);
}
