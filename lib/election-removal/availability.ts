import { zonedTime } from '../field-planning/profile';
import type { Prisma } from '@prisma/client';
import type { PlanningInput, PlanningResult } from '../field-planning/contracts';

/** Conservatively reserves the calendar day for legacy reservations and work tasks. */
export async function fieldAvailability(tx: Prisma.TransactionClient, organizationId: string, date: string, excludedPlanId?: string, timezone = 'Europe/Prague') {
  const day = new Date(zonedTime(date, '00:00', timezone));
  const nextDay = new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0,10);
  const end = new Date(zonedTime(nextDay, '00:00', timezone));
  const [employees, vehicles, absences, reservations, plans, tasks, plannerBlocks] = await Promise.all([
    tx.employee.findMany({ where: { organizationId, isActive: true } }),
    tx.vehicle.findMany({ where: { organizationId } }),
    tx.employeeAbsence.findMany({ where: { organizationId, status: 'APPROVED', dateFrom: { lt: end }, dateTo: { gte: day } } }),
    tx.vehicleReservation.findMany({ where: { organizationId, status: { in: ['RESERVED', 'ACTIVE'] }, dateFrom: { lt: end }, dateTo: { gte: day } } }),
    tx.fieldPlan.findMany({ where: { organizationId, status: { in: ['APPROVED', 'ACTIVE'] }, ...(excludedPlanId ? { id: { not: excludedPlanId } } : {}) } }),
    tx.workTask.findMany({ where: { organizationId, status: { in: ['TODO', 'IN_PROGRESS'] }, scheduledDate: { gte: day, lt: end } } }),
    tx.plannerBlock.findMany({ where: { organizationId, startAt: { lt: end }, endAt: { gt: day } }, select: { userId: true } }),
  ]);
  const busyUserIds = new Set(plannerBlocks.map(b => b.userId));
  const crews = plans.flatMap(p => (p.planningSummary as unknown as PlanningResult).crews.filter(c => p.date === date || (Date.parse(c.departureAt) < end.getTime() && Date.parse(c.endAt) >= day.getTime())));
  const excluded = excludedPlanId ? await tx.fieldPlan.findFirst({ where: { id: excludedPlanId, organizationId } }) : null;
  const reusable = (excluded?.approvalSnapshot as { reservationIds?: string[] } | null)?.reservationIds ?? [];
  return {
    employees: employees.map(e => ({ id: e.id, organizationId, name: `${e.firstName} ${e.lastName}`.trim(), userId: e.userId, isActive: e.isActive,
      roles: [e.role, ...e.roles], positions: [...e.positions, ...(e.position ? [e.position] : [])],
      available: !absences.some(a => a.employeeId === e.id) && !tasks.some(t => t.assignedToEmployeeId === e.id) && !crews.some(c => c.employeeIds.includes(e.id))
        && (!e.userId || !busyUserIds.has(e.userId))
        && (!e.startDate || e.startDate < end) && (!e.endDate || e.endDate >= day) })),
    vehicles: vehicles.map(v => ({ id: v.id, organizationId, name: v.name, status: v.status, capacitySlots: v.capacitySlots, equipment: v.equipment,
      reserved: crews.some(c => c.vehicleId === v.id) || reservations.some(r => r.vehicleId === v.id && !reusable.includes(r.id)) })),
  } satisfies Pick<PlanningInput, 'employees' | 'vehicles'>;
}
