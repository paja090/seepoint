import type { ReservationStatus, Role, VehicleStatus } from '@prisma/client';

export const reservationStatuses: ReservationStatus[] = ['RESERVED', 'ACTIVE', 'FINISHED', 'CANCELLED'];

const transitions: Record<ReservationStatus, ReservationStatus[]> = {
  RESERVED: ['ACTIVE', 'FINISHED', 'CANCELLED'],
  ACTIVE: ['FINISHED', 'CANCELLED'],
  FINISHED: [],
  CANCELLED: [],
};

export function parseReservationDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function canAssignReservationToOthers(role: Role | string) {
  return role === 'ADMIN' || role === 'MANAGER';
}

export function canChangeReservation(role: Role | string, actorEmployeeId: string | null | undefined, reservationEmployeeId: string) {
  return canAssignReservationToOthers(role) || Boolean(actorEmployeeId && actorEmployeeId === reservationEmployeeId);
}

export function canTransitionReservation(from: ReservationStatus, to: ReservationStatus) {
  return transitions[from].includes(to);
}

export function reservationCoversDay(dateFrom: Date, dateTo: Date, day = new Date()) {
  const utcDay = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  return dateFrom <= utcDay && dateTo >= utcDay;
}

export function derivedVehicleStatus(
  current: VehicleStatus,
  reservations: Array<{ status: ReservationStatus; dateFrom: Date; dateTo: Date }>,
  day = new Date(),
  releaseOperationalStatus = false,
): VehicleStatus {
  if (current === 'SERVICE' || current === 'OUT_OF_SERVICE') return current;
  if (reservations.some((item) => item.status === 'ACTIVE')) return 'IN_USE';
  if (current === 'IN_USE' && !releaseOperationalStatus) return current;
  if (reservations.some((item) => item.status === 'RESERVED' && reservationCoversDay(item.dateFrom, item.dateTo, day))) return 'RESERVED';
  if (releaseOperationalStatus && (current === 'IN_USE' || current === 'RESERVED')) return 'AVAILABLE';
  return current;
}
