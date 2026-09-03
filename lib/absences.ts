import type { AbsenceStatus, AbsenceType, Role } from '@prisma/client';

export const absenceTypes: AbsenceType[] = ['VACATION', 'SICK_LEAVE', 'PERSONAL_LEAVE', 'HOME_OFFICE'];
export const absenceStatuses: AbsenceStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export function canManageAbsences(role: Role | string) {
  return role === 'ADMIN' || role === 'MANAGER';
}

export function canCreateAbsenceFor(role: Role | string, actorEmployeeId: string | null | undefined, targetEmployeeId: string) {
  return canManageAbsences(role) || Boolean(actorEmployeeId && actorEmployeeId === targetEmployeeId);
}

export function canDeleteAbsence(
  role: Role | string,
  actorEmployeeId: string | null | undefined,
  absence: { employeeId: string; status: AbsenceStatus },
) {
  if (canManageAbsences(role)) return true;
  return absence.status === 'PENDING' && Boolean(actorEmployeeId && actorEmployeeId === absence.employeeId);
}

export function canViewAbsenceNote(
  role: Role | string,
  actorEmployeeId: string | null | undefined,
  absenceEmployeeId: string,
) {
  return canManageAbsences(role) || Boolean(actorEmployeeId && actorEmployeeId === absenceEmployeeId);
}

export function parseAbsenceDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function canReviewAbsence(status: AbsenceStatus, nextStatus: AbsenceStatus) {
  return status === 'PENDING' && (nextStatus === 'APPROVED' || nextStatus === 'REJECTED');
}
