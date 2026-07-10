import { EmploymentType, Role } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/rbac';

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

export async function POST(request: Request) {
  const user = getCurrentUser();
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
  const employmentTypeInput = text(input, 'employmentType');
  const employmentType = employmentTypeInput && Object.values(EmploymentType).includes(employmentTypeInput as EmploymentType) ? employmentTypeInput as EmploymentType : EmploymentType.EMPLOYEE;

  const dateOfBirth = optionalDate(input, 'dateOfBirth');
  const startDate = optionalDate(input, 'startDate');
  const endDate = optionalDate(input, 'endDate');
  if (dateOfBirth === null || startDate === null || endDate === null) return NextResponse.json({ error: 'Některé datum není platné.' }, { status: 400 });
  if (startDate && endDate && endDate < startDate) return NextResponse.json({ error: 'Datum ukončení nemůže být před datem nástupu.' }, { status: 400 });

  if (email) {
    const existing = await prisma.employee.findUnique({ where: { email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'Zaměstnanec s tímto e-mailem už existuje.' }, { status: 409 });
  }

  const employee = await prisma.employee.create({
    data: {
      firstName,
      lastName,
      email,
      phone: text(input, 'phone'),
      position: text(input, 'position'),
      role,
      employmentType,
      ico: text(input, 'ico'),
      dateOfBirth,
      startDate,
      endDate,
      isActive: true,
      note: text(input, 'note'),
    },
    select: { id: true },
  });

  return NextResponse.json(employee, { status: 201 });
}
