import { NextResponse } from 'next/server';
import { Prisma, type AbsenceStatus, type AbsenceType } from '@prisma/client';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';
import {
  absenceStatuses,
  absenceTypes,
  canCreateAbsenceFor,
  canDeleteAbsence,
  canManageAbsences,
  canReviewAbsence,
  canViewAbsenceNote,
  parseAbsenceDate,
} from '@/lib/absences';

export const runtime = 'nodejs';

function isRetryConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

export async function GET() {
  const user = await requireApiAccess('team');
  if (isApiDenied(user)) return user;

  const ownEmployeeId = user.employee?.id ?? null;
  const canManage = canManageAbsences(user.role);
  const oldestVisibleDate = new Date();
  oldestVisibleDate.setUTCFullYear(oldestVisibleDate.getUTCFullYear() - 1);

  const absences = await prisma.employeeAbsence.findMany({
    where: {
      dateTo: { gte: oldestVisibleDate },
      ...(canManage ? {} : {
        OR: [
          { status: 'APPROVED' },
          ...(ownEmployeeId ? [{ employeeId: ownEmployeeId }] : []),
        ],
      }),
    },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, position: true, role: true },
      },
    },
    orderBy: [{ dateFrom: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  });

  return NextResponse.json(absences.map((absence) => ({
    ...absence,
    note: canViewAbsenceNote(user.role, ownEmployeeId, absence.employeeId) ? absence.note : null,
  })));
}

export async function POST(request: Request) {
  const user = await requireApiAccess('team');
  if (isApiDenied(user)) return user;

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Požadavek neobsahuje platná JSON data.' }, { status: 400 });
    const requestedEmployeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
    const targetEmployeeId = requestedEmployeeId || user.employee?.id || '';
    const type = typeof body.type === 'string' && absenceTypes.includes(body.type as AbsenceType)
      ? body.type as AbsenceType
      : null;
    const dateFrom = parseAbsenceDate(body.dateFrom);
    const dateTo = parseAbsenceDate(body.dateTo);
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!targetEmployeeId) return NextResponse.json({ error: 'K účtu není přiřazen zaměstnanec.' }, { status: 400 });
    if (!canCreateAbsenceFor(user.role, user.employee?.id, targetEmployeeId)) {
      return NextResponse.json({ error: 'Žádost o volno můžete podat pouze za sebe.' }, { status: 403 });
    }
    if (!type) return NextResponse.json({ error: 'Vyberte platný typ volna.' }, { status: 400 });
    if (!dateFrom || !dateTo) return NextResponse.json({ error: 'Vyberte platné datum od a datum do.' }, { status: 400 });
    if (dateTo < dateFrom) return NextResponse.json({ error: 'Datum do nemůže být před datem od.' }, { status: 400 });
    if ((dateTo.getTime() - dateFrom.getTime()) / 86_400_000 > 366) {
      return NextResponse.json({ error: 'Jedna žádost může pokrývat nejvýše 366 dní.' }, { status: 400 });
    }
    if (note.length > 500) return NextResponse.json({ error: 'Poznámka může obsahovat nejvýše 500 znaků.' }, { status: 400 });

    const status: AbsenceStatus = canManageAbsences(user.role) ? 'APPROVED' : 'PENDING';
    const absence = await prisma.$transaction(async (transaction) => {
      const employee = await transaction.employee.findUnique({
        where: { id: targetEmployeeId },
        select: { id: true, isActive: true },
      });
      if (!employee?.isActive) throw new Error('EMPLOYEE_NOT_FOUND');

      const conflict = await transaction.employeeAbsence.findFirst({
        where: {
          employeeId: targetEmployeeId,
          status: { in: ['PENDING', 'APPROVED'] },
          dateFrom: { lte: dateTo },
          dateTo: { gte: dateFrom },
        },
        select: { id: true },
      });
      if (conflict) throw new Error('ABSENCE_CONFLICT');

      return transaction.employeeAbsence.create({
        data: { employeeId: targetEmployeeId, type, dateFrom, dateTo, note: note || null, status },
        include: { employee: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json(absence, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'EMPLOYEE_NOT_FOUND') return NextResponse.json({ error: 'Aktivní zaměstnanec nebyl nalezen.' }, { status: 404 });
    if (message === 'ABSENCE_CONFLICT' || isRetryConflict(error)) {
      return NextResponse.json({ error: 'V tomto termínu už existuje čekající nebo schválená absence.' }, { status: 409 });
    }
    console.error('Absence create error:', error);
    return NextResponse.json({ error: 'Žádost o volno se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await requireApiAccess('team');
  if (isApiDenied(user)) return user;
  if (!canManageAbsences(user.role)) {
    return NextResponse.json({ error: 'Žádosti může schvalovat pouze administrátor nebo manažer.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Požadavek neobsahuje platná JSON data.' }, { status: 400 });
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const status = typeof body.status === 'string' && absenceStatuses.includes(body.status as AbsenceStatus)
      ? body.status as AbsenceStatus
      : null;
    if (!id || !status || (status !== 'APPROVED' && status !== 'REJECTED')) {
      return NextResponse.json({ error: 'Zadejte platnou žádost a rozhodnutí.' }, { status: 400 });
    }

    const absence = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.employeeAbsence.findUnique({ where: { id } });
      if (!existing) throw new Error('ABSENCE_NOT_FOUND');
      if (!canReviewAbsence(existing.status, status)) throw new Error('INVALID_TRANSITION');

      if (status === 'APPROVED') {
        const conflict = await transaction.employeeAbsence.findFirst({
          where: {
            id: { not: id },
            employeeId: existing.employeeId,
            status: 'APPROVED',
            dateFrom: { lte: existing.dateTo },
            dateTo: { gte: existing.dateFrom },
          },
          select: { id: true },
        });
        if (conflict) throw new Error('ABSENCE_CONFLICT');
      }

      return transaction.employeeAbsence.update({
        where: { id },
        data: { status },
        include: { employee: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json(absence);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ABSENCE_NOT_FOUND') return NextResponse.json({ error: 'Žádost nebyla nalezena.' }, { status: 404 });
    if (message === 'INVALID_TRANSITION') return NextResponse.json({ error: 'O této žádosti už bylo rozhodnuto.' }, { status: 409 });
    if (message === 'ABSENCE_CONFLICT' || isRetryConflict(error)) {
      return NextResponse.json({ error: 'Schválení koliduje s jinou schválenou absencí.' }, { status: 409 });
    }
    console.error('Absence review error:', error);
    return NextResponse.json({ error: 'Rozhodnutí se nepodařilo uložit.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireApiAccess('team');
  if (isApiDenied(user)) return user;

  const id = new URL(request.url).searchParams.get('id')?.trim();
  if (!id) return NextResponse.json({ error: 'Chybí ID záznamu.' }, { status: 400 });

  try {
    await prisma.$transaction(async (transaction) => {
      const absence = await transaction.employeeAbsence.findUnique({
        where: { id },
        select: { employeeId: true, status: true },
      });
      if (!absence) throw new Error('ABSENCE_NOT_FOUND');
      if (!canDeleteAbsence(user.role, user.employee?.id, absence)) throw new Error('ABSENCE_FORBIDDEN');
      await transaction.employeeAbsence.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ABSENCE_NOT_FOUND') return NextResponse.json({ error: 'Žádost nebyla nalezena.' }, { status: 404 });
    if (message === 'ABSENCE_FORBIDDEN') return NextResponse.json({ error: 'Tuto absenci nemůžete odstranit.' }, { status: 403 });
    if (isRetryConflict(error)) return NextResponse.json({ error: 'Žádost mezitím změnil jiný uživatel.' }, { status: 409 });
    console.error('Absence delete error:', error);
    return NextResponse.json({ error: 'Absenci se nepodařilo odstranit.' }, { status: 500 });
  }
}
