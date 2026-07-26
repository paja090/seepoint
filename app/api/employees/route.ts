import { EmploymentType, Prisma, Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser, hashPassword, validatePassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type EmployeeInput = Record<string, unknown>;

function text(input: EmployeeInput, key: string) {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalDate(input: EmployeeInput, key: string) {
  const value = text(input, key);
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalEmail(input: EmployeeInput) {
  const value = text(input, 'email')?.toLowerCase();
  if (!value) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

function positions(input: EmployeeInput) {
  const raw = text(input, 'positions') ?? text(input, 'position') ?? '';
  return [...new Set(raw.split(',').map((value) => value.trim()).filter(Boolean))].slice(0, 12);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Zaměstnance může vytvářet jen admin nebo manažer.' }, { status: 403 });
  }

  const input = await request.json().catch(() => null) as EmployeeInput | null;
  if (!input) return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });

  const firstName = text(input, 'firstName');
  const lastName = text(input, 'lastName');
  if (!firstName || !lastName) return NextResponse.json({ error: 'Vyplňte jméno a příjmení zaměstnance.' }, { status: 400 });

  const email = optionalEmail(input);
  if (email === null) return NextResponse.json({ error: 'E-mail nemá platný formát.' }, { status: 400 });

  const roleInput = text(input, 'role');
  const role = roleInput && Object.values(Role).includes(roleInput as Role) ? roleInput as Role : Role.WORKER;
  if (user.role === 'MANAGER' && role === Role.ADMIN) return NextResponse.json({ error: 'Manažer nemůže vytvářet administrátory.' }, { status: 403 });
  const allowAccess = text(input, 'allowAccess') === 'true';
  if (allowAccess && !email) return NextResponse.json({ error: 'Pro přístup do aplikace je e-mail povinný.' }, { status: 400 });
  const temporaryPassword = text(input, 'temporaryPassword');
  if (allowAccess && (!temporaryPassword || !validatePassword(temporaryPassword))) {
    return NextResponse.json({ error: 'Dočasné heslo musí mít alespoň 12 znaků a obsahovat písmeno i číslo.' }, { status: 400 });
  }
  const employmentTypeInput = text(input, 'employmentType');
  const employmentType = employmentTypeInput && Object.values(EmploymentType).includes(employmentTypeInput as EmploymentType) ? employmentTypeInput as EmploymentType : EmploymentType.EMPLOYEE;
  const employeePositions = positions(input);

  const dateOfBirth = optionalDate(input, 'dateOfBirth');
  const startDate = optionalDate(input, 'startDate');
  const endDate = optionalDate(input, 'endDate');
  if (dateOfBirth === null || startDate === null || endDate === null) return NextResponse.json({ error: 'Některé datum není platné.' }, { status: 400 });
  if (startDate && endDate && endDate < startDate) return NextResponse.json({ error: 'Datum ukončení nemůže být před datem nástupu.' }, { status: 400 });

  const [existingEmployee, existingUser] = email ? await Promise.all([
    prisma.employee.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, include: { employee: { select: { id: true } } } }),
  ]) : [null, null];
  if (existingEmployee) return NextResponse.json({ error: 'Zaměstnanec s tímto e-mailem už existuje.' }, { status: 409 });
  if (allowAccess && existingUser?.employee) return NextResponse.json({ error: 'Tento e-mail je už propojený s jiným zaměstnancem.' }, { status: 409 });
  if (allowAccess && existingUser) return NextResponse.json({ error: 'Účet s tímto e-mailem už existuje. Propojte ho v detailu zaměstnance.' }, { status: 409 });

  try {
    const passwordHash = allowAccess ? await hashPassword(temporaryPassword!) : undefined;
    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({ data: {
        firstName,
        lastName,
        email,
        phone: text(input, 'phone'),
        position: employeePositions[0],
        positions: employeePositions,
        role,
        employmentType,
        ico: text(input, 'ico'),
        dateOfBirth,
        startDate,
        endDate,
        isActive: true,
        note: text(input, 'note'),
        ...(allowAccess && email ? {
          user: { create: { name: `${firstName} ${lastName}`, email, role, status: 'ACTIVE', passwordHash, mustChangePassword: true } },
        } : {}),
      }, select: { id: true, userId: true, email: true } });
      if (created.userId) {
        await tx.userAuditLog.create({ data: { action: 'ACCOUNT_CREATED', targetUserId: created.userId, actorUserId: user.id } });
      }
      return created;
    });

    return NextResponse.json({ id: employee.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'Zaměstnanec nebo účet se stejným e-mailem už existuje.' }, { status: 409 });
    }
    console.error('Employee creation failed', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Zaměstnance se nepodařilo uložit.' }, { status: 500 });
  }
}
