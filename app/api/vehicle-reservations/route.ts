import { NextResponse } from 'next/server';
import { Prisma, type ReservationStatus } from '@prisma/client';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma, ensureVehicleSchema } from '@/lib/db';
import {
  canAssignReservationToOthers,
  canChangeReservation,
  canTransitionReservation,
  derivedVehicleStatus,
  parseReservationDate,
  reservationCoversDay,
  reservationStatuses,
} from '@/lib/vehicle-reservations';

export const runtime = 'nodejs';

async function synchronizeVehicleStatus(transaction: Prisma.TransactionClient, vehicleId: string, releaseOperationalStatus = false) {
  const [vehicle, reservations] = await Promise.all([
    transaction.vehicle.findUnique({ where: { id: vehicleId }, select: { status: true } }),
    transaction.vehicleReservation.findMany({
      where: { vehicleId, status: { in: ['RESERVED', 'ACTIVE'] } },
      select: { status: true, dateFrom: true, dateTo: true },
    }),
  ]);
  if (!vehicle) return;
  const status = derivedVehicleStatus(vehicle.status, reservations, new Date(), releaseOperationalStatus);
  if (status !== vehicle.status) await transaction.vehicle.update({ where: { id: vehicleId }, data: { status } });
}

export async function GET(request: Request) {
  const user = await requireApiAccess('vehicles');
  if (isApiDenied(user)) return user;
  await ensureVehicleSchema();

  const { searchParams } = new URL(request.url);
  const vehicleId = searchParams.get('vehicleId')?.trim();
  const employeeId = searchParams.get('employeeId')?.trim();
  const where: Prisma.VehicleReservationWhereInput = {};
  if (vehicleId) where.vehicleId = vehicleId;
  if (employeeId) where.employeeId = employeeId;

  try {
    const reservations = await prisma.vehicleReservation.findMany({
      where,
      include: { vehicle: true, employee: true },
      orderBy: { dateFrom: 'desc' },
      take: 200,
    });
    return NextResponse.json(reservations);
  } catch (error) {
    console.error('Fetch reservations error:', error);
    return NextResponse.json({ error: 'Načtení rezervací selhalo.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireApiAccess('vehicles');
  if (isApiDenied(user)) return user;
  await ensureVehicleSchema();

  try {
    const body = await request.json() as Record<string, unknown>;
    const vehicleId = typeof body.vehicleId === 'string' ? body.vehicleId.trim() : '';
    const requestedEmployeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
    const purpose = typeof body.purpose === 'string' ? body.purpose.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const start = parseReservationDate(body.dateFrom);
    const end = parseReservationDate(body.dateTo);

    if (!vehicleId) return NextResponse.json({ error: 'Vyberte vozidlo nebo vozík k rezervaci.' }, { status: 400 });
    if (!start || !end) return NextResponse.json({ error: 'Zadejte platné datum začátku a konce rezervace.' }, { status: 400 });
    if (start > end) return NextResponse.json({ error: 'Datum začátku nemůže být po datu konce.' }, { status: 400 });
    if ((end.getTime() - start.getTime()) / 86_400_000 > 366) return NextResponse.json({ error: 'Rezervace může trvat nejvýše 366 dní.' }, { status: 400 });
    if (!purpose || purpose.length > 300) return NextResponse.json({ error: 'Účel rezervace musí obsahovat 1 až 300 znaků.' }, { status: 400 });
    if (note.length > 1000) return NextResponse.json({ error: 'Poznámka může obsahovat nejvýše 1000 znaků.' }, { status: 400 });

    const ownEmployeeId = user.employee?.id ?? null;
    if (!canAssignReservationToOthers(user.role) && requestedEmployeeId && requestedEmployeeId !== ownEmployeeId) {
      return NextResponse.json({ error: 'Rezervaci můžete vytvořit pouze pro sebe.' }, { status: 403 });
    }
    const assignedEmployeeId = canAssignReservationToOthers(user.role) ? (requestedEmployeeId || ownEmployeeId) : ownEmployeeId;
    if (!assignedEmployeeId) return NextResponse.json({ error: 'K účtu není přiřazen platný pracovník.' }, { status: 400 });

    const reservation = await prisma.$transaction(async (transaction) => {
      const [vehicle, employee] = await Promise.all([
        transaction.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true, status: true } }),
        transaction.employee.findUnique({ where: { id: assignedEmployeeId }, select: { id: true } }),
      ]);
      if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
      if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
      if (vehicle.status === 'SERVICE' || vehicle.status === 'OUT_OF_SERVICE') throw new Error('VEHICLE_UNAVAILABLE');
      if (vehicle.status === 'IN_USE' && reservationCoversDay(start, end)) throw new Error('VEHICLE_UNAVAILABLE');

      const conflict = await transaction.vehicleReservation.findFirst({
        where: {
          vehicleId,
          status: { in: ['RESERVED', 'ACTIVE'] },
          dateFrom: { lte: end },
          dateTo: { gte: start },
        },
        select: { id: true },
      });
      if (conflict) throw new Error('RESERVATION_CONFLICT');

      const created = await transaction.vehicleReservation.create({
        data: {
          vehicleId,
          employeeId: assignedEmployeeId,
          dateFrom: start,
          dateTo: end,
          purpose,
          note: note || null,
          status: 'RESERVED',
        },
        include: { vehicle: true, employee: true },
      });
      await synchronizeVehicleStatus(transaction, vehicleId);
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'VEHICLE_NOT_FOUND') return NextResponse.json({ error: 'Vozidlo nebylo nalezeno.' }, { status: 404 });
    if (message === 'EMPLOYEE_NOT_FOUND') return NextResponse.json({ error: 'Pracovník nebyl nalezen.' }, { status: 404 });
    if (message === 'VEHICLE_UNAVAILABLE') return NextResponse.json({ error: 'Vozidlo je v servisu nebo vyřazené z provozu.' }, { status: 409 });
    if (message === 'RESERVATION_CONFLICT' || (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034')) {
      return NextResponse.json({ error: 'Vozidlo už je v tomto termínu rezervované.' }, { status: 409 });
    }
    console.error('Reservation create error:', error);
    return NextResponse.json({ error: 'Vytvoření rezervace selhalo.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireApiAccess('vehicles');
  if (isApiDenied(user)) return user;
  await ensureVehicleSchema();

  try {
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const status = typeof body.status === 'string' && reservationStatuses.includes(body.status as ReservationStatus)
      ? body.status as ReservationStatus
      : null;
    if (!id || !status) return NextResponse.json({ error: 'Zadejte platnou rezervaci a nový stav.' }, { status: 400 });

    const reservation = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.vehicleReservation.findUnique({ where: { id } });
      if (!existing) throw new Error('RESERVATION_NOT_FOUND');
      if (!canChangeReservation(user.role, user.employee?.id, existing.employeeId)) throw new Error('RESERVATION_FORBIDDEN');
      if (!canTransitionReservation(existing.status, status)) throw new Error('INVALID_TRANSITION');

      const updated = await transaction.vehicleReservation.update({
        where: { id },
        data: { status },
        include: { vehicle: true, employee: true },
      });
      const releaseOperationalStatus = existing.status === 'ACTIVE'
        || (existing.status === 'RESERVED' && reservationCoversDay(existing.dateFrom, existing.dateTo));
      await synchronizeVehicleStatus(transaction, existing.vehicleId, releaseOperationalStatus);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(reservation);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'RESERVATION_NOT_FOUND') return NextResponse.json({ error: 'Rezervace nebyla nalezena.' }, { status: 404 });
    if (message === 'RESERVATION_FORBIDDEN') return NextResponse.json({ error: 'Tuto rezervaci nemůžete měnit.' }, { status: 403 });
    if (message === 'INVALID_TRANSITION') return NextResponse.json({ error: 'Tento přechod stavu rezervace není povolený.' }, { status: 409 });
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034') {
      return NextResponse.json({ error: 'Rezervaci mezitím změnil jiný uživatel. Obnovte stránku.' }, { status: 409 });
    }
    console.error('Reservation update error:', error);
    return NextResponse.json({ error: 'Změna stavu rezervace selhala.' }, { status: 500 });
  }
}
