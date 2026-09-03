import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { resolveWorkEntryRate } from '@/lib/work-entry-rates';
import { canAccess } from '@/lib/rbac';
import { Prisma } from '@prisma/client';
import {
  assertCalculatedAmountFits,
  parseDateOnly,
  parseMoney,
  parseNote,
  parseQuantity,
  parseRateType,
  parseUnit,
  parseWorkType,
  WorkEntryValidationError,
} from '@/lib/work-entry-policy';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id } = await params;
  const entry = await prisma.workEntry.findUnique({
    where: { id },
    include: {
      employee: true,
      workTask: true,
      workOrder: true,
      client: true,
    },
  });

  if (!entry) {
    return NextResponse.json({ error: 'Záznam práce nebyl nalezen.' }, { status: 404 });
  }

  // Auth: Managers/Admins can see any, employee can see only own
  const hasGlobalAccess = canAccess(user.role, 'workEntries');
  const hasOwnAccess = canAccess(user.role, 'myWorkEntries');
  const isOwnRecord = entry.employee.userId === user.id || entry.employee.email === user.email;

  if (!hasGlobalAccess && !(hasOwnAccess && isOwnRecord)) {
    return NextResponse.json({ error: 'Nemáte oprávnění k prohlížení tohoto záznamu.' }, { status: 403 });
  }

  return NextResponse.json({
    ...entry,
    quantity: entry.quantity.toString(),
    appliedUnitRate: entry.appliedUnitRate?.toString() ?? null,
    calculatedAmount: entry.calculatedAmount.toString(),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id } = await params;
  const entry = await prisma.workEntry.findUnique({
    where: { id },
    include: { employee: true },
  });

  if (!entry) {
    return NextResponse.json({ error: 'Záznam práce nebyl nalezen.' }, { status: 404 });
  }

  // 1. Strict Immutability for SUBMITTED/APPROVED entries
  if (entry.status === 'SUBMITTED' || entry.status === 'APPROVED') {
    return NextResponse.json({ error: 'Schválený nebo odeslaný záznam práce nelze upravovat.' }, { status: 400 });
  }

  // 2. Authorization
  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  const isOwnRecord = entry.employee.userId === user.id || entry.employee.email === user.email;

  if (!isOwnRecord && !isManagerOrAdmin) {
    return NextResponse.json({ error: 'Nemáte oprávnění k úpravě tohoto záznamu.' }, { status: 403 });
  }

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
  }

  const {
    workDate,
    workType,
    remunerationMethod,
    quantity,
    unit,
    note,
    manualRate,
    manualOverride,
  } = input;

  let qtyDecimal: Prisma.Decimal;
  let targetDate: Date;
  let targetType: ReturnType<typeof parseWorkType>;
  let targetMethod: ReturnType<typeof parseRateType>;
  let cleanUnit: string | undefined;
  let cleanNote: string | undefined;
  let cleanManualRate: Prisma.Decimal | null = null;
  try {
    qtyDecimal = quantity !== undefined ? parseQuantity(quantity) : entry.quantity;
    targetDate = workDate !== undefined ? parseDateOnly(workDate, 'Datum práce') : entry.workDate;
    targetType = workType !== undefined ? parseWorkType(workType) : entry.workType;
    targetMethod = remunerationMethod !== undefined ? parseRateType(remunerationMethod) : entry.remunerationMethod;
    cleanUnit = unit !== undefined ? parseUnit(unit) : entry.unit;
    cleanNote = note !== undefined ? parseNote(note) : undefined;
    if (manualRate !== undefined && manualRate !== null && manualRate !== '') cleanManualRate = parseMoney(manualRate, 'Ruční sazba');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Neplatná data výkazu.' }, { status: 400 });
  }

  // 4. Rate recalculation / update
  let finalRate = entry.appliedUnitRate;
  let finalSource = entry.rateSource;

  // Enforce unit rules based on remunerationMethod
  let finalUnit = cleanUnit || entry.unit;
  if (targetMethod === 'HOURLY') {
    finalUnit = 'hod';
  } else if (targetMethod === 'FIXED') {
    qtyDecimal = new Prisma.Decimal(1);
    finalUnit = 'ks';
  }

  const resolved = await resolveWorkEntryRate({
    employeeId: entry.employeeId,
    workType: targetType,
    workDate: targetDate,
    remunerationMethod: targetMethod,
    workOrderId: entry.workOrderId, // CRITICAL FIX: Pass the existing entry.workOrderId!
  });

  if (cleanManualRate) {
    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: 'Pouze manažer nebo administrátor může zadat sazbu ručně.' }, { status: 403 });
    }
    if (resolved) {
      if (manualOverride !== true || !cleanNote) {
        return NextResponse.json({
          error: 'RUČNÍ_PŘEPSÁNÍ_VYŽADOVÁNO',
          message: 'Pro přepsání automatické sazby musíte zaškrtnout souhlas a vyplnit důvod v poznámce.',
        }, { status: 400 });
      }
    }
    finalRate = cleanManualRate;
    finalSource = 'MANUAL';
  } else if (finalSource === 'MANUAL' && (workDate || workType || remunerationMethod)) {
    // Keep manual rate
  } else if (workDate || workType || remunerationMethod) {
    if (resolved) {
      finalRate = resolved.amount;
      finalSource = resolved.source;
      if (targetMethod === 'TASK' && resolved.unit) {
        finalUnit = resolved.unit;
      }
    } else {
      finalRate = null;
      finalSource = null;
    }
  }

  try { assertCalculatedAmountFits(qtyDecimal, finalRate); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const calculatedAmount = finalRate ? qtyDecimal.mul(finalRate) : new Prisma.Decimal(0);

  // 5. Update in database
  let updated;
  try {
    updated = await prisma.workEntry.update({
      where: { id, status: { in: ['DRAFT', 'RETURNED'] } },
      data: {
        workDate: targetDate,
        workType: targetType,
        remunerationMethod: targetMethod,
        quantity: qtyDecimal,
        unit: finalUnit,
        appliedUnitRate: finalRate,
        calculatedAmount,
        rateSource: finalSource,
        note: note !== undefined ? cleanNote ?? null : undefined,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Výkaz byl mezitím změněn nebo odeslán. Obnovte stránku.' }, { status: 409 });
    }
    if (error instanceof WorkEntryValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Update work entry failed', error);
    return NextResponse.json({ error: 'Záznam práce se nepodařilo upravit.' }, { status: 500 });
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    quantity: updated.quantity.toString(),
    appliedUnitRate: updated.appliedUnitRate?.toString() ?? null,
    calculatedAmount: updated.calculatedAmount.toString(),
  });
}
