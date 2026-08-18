import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma, ensureVehicleSchema } from '@/lib/db';
import { ReservationStatus } from '@prisma/client';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  await ensureVehicleSchema();
  const { searchParams } = new URL(request.url);
  const vehicleId = searchParams.get('vehicleId');
  const employeeId = searchParams.get('employeeId');

  const where: any = {};
  if (vehicleId) where.vehicleId = vehicleId;
  if (employeeId) where.employeeId = employeeId;

  try {
    const reservations = await prisma.vehicleReservation.findMany({
      where,
      include: {
        vehicle: true,
        employee: true,
      },
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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  await ensureVehicleSchema();

  try {
    const body = await request.json();
    const { vehicleId, employeeId, dateFrom, dateTo, purpose, note } = body;

    if (!vehicleId) {
      return NextResponse.json({ error: 'Vyberte vozidlo nebo vozík k rezervaci.' }, { status: 400 });
    }

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'Zadejte datum začátku a konce rezervace.' }, { status: 400 });
    }

    if (!purpose || typeof purpose !== 'string' || !purpose.trim()) {
      return NextResponse.json({ error: 'Zadejte účel rezervace / výjezdu.' }, { status: 400 });
    }

    const start = new Date(dateFrom);
    const end = new Date(dateTo);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Zadejte platné datum rezervace.' }, { status: 400 });
    }

    if (start > end) {
      return NextResponse.json({ error: 'Datum začátku nemůže být po datu konce.' }, { status: 400 });
    }

    // Determine target employee ID
    const targetEmployeeId = employeeId || user.employee?.id;

    if (!targetEmployeeId) {
      // Find first available employee or create fallback
      const emp = await prisma.employee.findFirst();
      if (!emp) {
        return NextResponse.json({ error: 'Zádný zaměstnanec nebyl nalezen pro vytvoření rezervace.' }, { status: 400 });
      }
    }

    const assignedEmpId = targetEmployeeId || (await prisma.employee.findFirst())?.id;

    if (!assignedEmpId) {
      return NextResponse.json({ error: 'Vyberte platného pracovníka k rezervaci.' }, { status: 400 });
    }

    // Check for overlap conflicts
    const conflict = await prisma.vehicleReservation.findFirst({
      where: {
        vehicleId,
        status: { in: ['RESERVED', 'ACTIVE'] },
        OR: [
          {
            dateFrom: { lte: end },
            dateTo: { gte: start },
          },
        ],
      },
      include: {
        employee: true,
      },
    });

    if (conflict) {
      const conflictUser = `${conflict.employee.firstName} ${conflict.employee.lastName}`;
      const conflictDates = `${new Date(conflict.dateFrom).toLocaleDateString('cs-CZ')} - ${new Date(conflict.dateTo).toLocaleDateString('cs-CZ')}`;
      return NextResponse.json(
        { error: `Toto vozidlo je v tomto termínu (${conflictDates}) již rezervováno uživatelem ${conflictUser}.` },
        { status: 409 }
      );
    }

    // Create reservation
    const reservation = await prisma.vehicleReservation.create({
      data: {
        vehicleId,
        employeeId: assignedEmpId,
        dateFrom: start,
        dateTo: end,
        purpose: purpose.trim(),
        note: note ? String(note).trim() : null,
        status: 'RESERVED',
      },
      include: {
        vehicle: true,
        employee: true,
      },
    });

    // Update vehicle status to RESERVED if AVAILABLE
    await prisma.vehicle.updateMany({
      where: { id: vehicleId, status: 'AVAILABLE' },
      data: { status: 'RESERVED' },
    });

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Reservation create error:', error);
    return NextResponse.json({ error: 'Vytvoření rezervace selhalo.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  await ensureVehicleSchema();

  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Zadejte ID rezervace a nový stav.' }, { status: 400 });
    }

    const reservation = await prisma.vehicleReservation.update({
      where: { id },
      data: { status: status as ReservationStatus },
      include: { vehicle: true },
    });

    // If reservation finished or cancelled, restore vehicle status if no active reservations left
    if (['FINISHED', 'CANCELLED'].includes(status)) {
      const activeCount = await prisma.vehicleReservation.count({
        where: {
          vehicleId: reservation.vehicleId,
          status: { in: ['RESERVED', 'ACTIVE'] },
        },
      });

      if (activeCount === 0) {
        await prisma.vehicle.updateMany({
          where: { id: reservation.vehicleId, status: 'RESERVED' },
          data: { status: 'AVAILABLE' },
        });
      }
    }

    return NextResponse.json(reservation);
  } catch (error) {
    console.error('Reservation update error:', error);
    return NextResponse.json({ error: 'Změna stavu rezervace selhalo.' }, { status: 500 });
  }
}
