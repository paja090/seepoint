import { AbsenceType } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const absences = await prisma.employeeAbsence.findMany({
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
          role: true,
        },
      },
    },
    orderBy: { dateFrom: 'asc' },
  });

  return NextResponse.json(absences);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    employeeId?: string;
    type?: AbsenceType;
    dateFrom?: string;
    dateTo?: string;
    note?: string;
  } | null;

  if (!body || !body.dateFrom || !body.dateTo) {
    return NextResponse.json({ error: 'Vyberte datum od a datum do.' }, { status: 400 });
  }

  const targetEmployeeId = body.employeeId || user.employee?.id;
  if (!targetEmployeeId) {
    return NextResponse.json({ error: 'Zaměstnanec nebyl nalezen.' }, { status: 400 });
  }

  const dateFrom = new Date(body.dateFrom);
  const dateTo = new Date(body.dateTo);

  if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
    return NextResponse.json({ error: 'Zadané datum není platné.' }, { status: 400 });
  }

  if (dateTo < dateFrom) {
    return NextResponse.json({ error: 'Datum do nemůže být před datem od.' }, { status: 400 });
  }

  const absence = await prisma.employeeAbsence.create({
    data: {
      employeeId: targetEmployeeId,
      type: body.type || AbsenceType.VACATION,
      dateFrom,
      dateTo,
      note: body.note?.trim() || null,
      status: 'APPROVED',
    },
    include: {
      employee: true,
    },
  });

  return NextResponse.json(absence, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Chybí ID záznamu.' }, { status: 400 });
  }

  await prisma.employeeAbsence.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
