import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { resolveWorkEntryRate } from '@/lib/work-entry-rates';
import { Prisma, RateType, WorkType } from '@prisma/client';

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
  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  const isOwnRecord = entry.employee.userId === user.id || entry.employee.email === user.email;

  if (!isOwnRecord && !isManagerOrAdmin) {
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
  if (!input) {
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

  // 3. Decimal quantity parsing (if quantity is updated)
  let qtyDecimal = entry.quantity;
  if (quantity !== undefined) {
    try {
      const qtyStr = String(quantity).trim();
      if (qtyStr.includes(':')) {
        const parts = qtyStr.split(':');
        if (parts.length !== 2) throw new Error();
        const hrs = parseInt(parts[0], 10);
        const mins = parseInt(parts[1], 10);
        if (isNaN(hrs) || isNaN(mins) || mins < 0 || mins >= 60 || hrs < 0) throw new Error();
        const hrsDec = new Prisma.Decimal(hrs);
        const minsDec = new Prisma.Decimal(mins).div(60);
        qtyDecimal = hrsDec.add(minsDec);
      } else {
        const normalized = qtyStr.replace(',', '.');
        qtyDecimal = new Prisma.Decimal(normalized);
      }
      if (qtyDecimal.lte(0)) {
        return NextResponse.json({ error: 'Množství musí být kladné číslo.' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Neplatný formát množství.' }, { status: 400 });
    }
  }

  // 4. Rate recalculation / update
  let finalRate = entry.appliedUnitRate;
  let finalSource = entry.rateSource;

  const targetDate = workDate ? new Date(workDate) : entry.workDate;
  const targetType = workType ? (workType as WorkType) : entry.workType;
  const targetMethod = remunerationMethod ? (remunerationMethod as RateType) : entry.remunerationMethod;

  // Enforce unit rules based on remunerationMethod
  let finalUnit = unit || entry.unit;
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
    carrierType: entry.carrierType,
  });

  if (manualRate !== undefined && manualRate !== null) {
    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: 'Pouze manažer nebo administrátor může zadat sazbu ručně.' }, { status: 403 });
    }
    if (resolved) {
      if (manualOverride !== true || !String(note || '').trim()) {
        return NextResponse.json({
          error: 'RUČNÍ_PŘEPSÁNÍ_VYŽADOVÁNO',
          message: 'Pro přepsání automatické sazby musíte zaškrtnout souhlas a vyplnit důvod v poznámce.',
        }, { status: 400 });
      }
    }
    try {
      finalRate = new Prisma.Decimal(String(manualRate).replace(',', '.'));
      if (finalRate.lt(0)) throw new Error();
      finalSource = 'MANUAL';
    } catch {
      return NextResponse.json({ error: 'Neplatná hodnota ruční sazby.' }, { status: 400 });
    }
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

  const calculatedAmount = finalRate ? qtyDecimal.mul(finalRate) : new Prisma.Decimal(0);

  // 5. Update in database
  const updated = await prisma.workEntry.update({
    where: { id },
    data: {
      workDate: workDate ? new Date(workDate) : undefined,
      workType: workType as WorkType || undefined,
      remunerationMethod: remunerationMethod as RateType || undefined,
      quantity: qtyDecimal,
      unit: finalUnit,
      appliedUnitRate: finalRate,
      calculatedAmount,
      rateSource: finalSource,
      note: note !== undefined ? note : undefined,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    quantity: updated.quantity.toString(),
    appliedUnitRate: updated.appliedUnitRate?.toString() ?? null,
    calculatedAmount: updated.calculatedAmount.toString(),
  });
}
