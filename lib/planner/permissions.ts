import { PlannerError, type PlannerItem } from './domain';
export type PlannerActor = { id: string; organizationId: string; role: string };
export function canManageConnection(actor: PlannerActor, connection: { organizationId: string; userId: string }) {
  return actor.organizationId === connection.organizationId && actor.id === connection.userId;
}
export function canSeeTeam(actor: PlannerActor) { return actor.role === 'ADMIN' || actor.role === 'MANAGER'; }
export function activeCalendarOwner(member: { isActive: boolean; user: { status: string }; employeeActive?: boolean } | null) { return Boolean(member?.isActive && member.user.status === 'ACTIVE' && member.employeeActive !== false); }
export function projectEvent(actor: PlannerActor, row: { id: string; organizationId: string; title: string; startAt: Date; endAt: Date; allDay: boolean; busy: boolean; isPrivate: boolean; location: string | null }, calendar: { organizationId: string; ownerId: string; visibility: string; kind: string }, ownerActive: boolean): PlannerItem | null {
  if (!ownerActive || actor.organizationId !== row.organizationId || actor.organizationId !== calendar.organizationId) return null;
  const own = actor.id === calendar.ownerId;
  if (!own && calendar.kind !== 'COMPANY' && !canSeeTeam(actor)) return null;
  const details = own || calendar.visibility === 'FULL' || (calendar.visibility === 'WORK_DETAILS' && !row.isPrivate);
  if (!details && !row.busy) return null;
  return { id: row.id, startAt: row.startAt.toISOString(), endAt: row.endAt.toISOString(), title: details ? row.title : 'Obsazeno', source: 'GOOGLE', busy: row.busy, allDay: row.allDay, ...(details && row.location ? { location: row.location } : {}) };
}
export function assertOwner(actor: PlannerActor, connection: { organizationId: string; userId: string } | null) {
  if (!connection || !canManageConnection(actor, connection)) throw new PlannerError('Připojení nebylo nalezeno.', 404);
}
