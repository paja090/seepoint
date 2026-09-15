import type { Prisma } from '@prisma/client';
import { requireTenantContext } from './tenant-context';
import { derivedVehicleStatus, reservationCoversDay } from './vehicle-reservations';

export async function synchronizeVehicleStatus(transaction: Prisma.TransactionClient, vehicleId: string, releaseOperationalStatus = false) {
  const { organizationId } = requireTenantContext();
  const [vehicle, reservations] = await Promise.all([
    transaction.vehicle.findUnique({ where: { id: vehicleId, organizationId }, select: { status: true } }),
    transaction.vehicleReservation.findMany({ where: { organizationId, vehicleId, status: { in: ['RESERVED', 'ACTIVE'] } }, select: { status: true, dateFrom: true, dateTo: true } }),
  ]);
  if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
  const status = derivedVehicleStatus(vehicle.status, reservations, new Date(), releaseOperationalStatus);
  if (status !== vehicle.status) await transaction.vehicle.update({ where: { id: vehicleId, organizationId }, data: { status } });
}
/** Caller must use a Serializable transaction. Day-level reservation policy shared by planner and fleet API. */
export async function createVehicleReservation(transaction: Prisma.TransactionClient, input: {
  id?: string; vehicleId: string; employeeId: string; dateFrom: Date; dateTo: Date; purpose: string; note?: string | null;
}) {
  const { organizationId } = requireTenantContext();
  const [vehicle, employee] = await Promise.all([
    transaction.vehicle.findUnique({ where: { id: input.vehicleId, organizationId }, select: { id: true, status: true } }),
    transaction.employee.findUnique({ where: { id: input.employeeId, organizationId }, select: { id: true } }),
  ]);
  if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
  if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
  if (vehicle.status === 'SERVICE' || vehicle.status === 'OUT_OF_SERVICE' || (vehicle.status === 'IN_USE' && reservationCoversDay(input.dateFrom, input.dateTo))) throw new Error('VEHICLE_UNAVAILABLE');
  if (await transaction.vehicleReservation.findFirst({ where: { organizationId, vehicleId: vehicle.id, status: { in: ['RESERVED', 'ACTIVE'] }, dateFrom: { lte: input.dateTo }, dateTo: { gte: input.dateFrom } }, select: { id: true } })) throw new Error('RESERVATION_CONFLICT');
  const created = await transaction.vehicleReservation.create({ data: { ...input, organizationId, status: 'RESERVED' }, include: { vehicle: true, employee: true } });
  await synchronizeVehicleStatus(transaction, vehicle.id);
  return created;
}
