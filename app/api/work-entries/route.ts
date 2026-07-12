import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { resolveWorkEntryRate } from '@/lib/work-entry-rates';
import { Prisma, RateType, WorkType, WorkEntryStatus, RateSource } from '@prisma/client';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  // Administrators and Managers can view all entries.
  // Employees (Workers, Technicians) can only view their own.
  const hasGlobalAccess = canAccess(user.role, 'workEntries');
  const hasMyAccess = canAccess(user.role, 'myWorkEntries');

  if (!hasGlobalAccess && !hasMyAccess) {
    return NextResponse.json({ error: 'Nemáte oprávnění.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get('employeeId') || undefined;
  const status = searchParams.get('status') || undefined;
  const workOrderId = searchParams.get('workOrderId') || undefined;
  const workType = searchParams.get('workType') || undefined;
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;

  const where: Prisma.WorkEntryWhereInput = {};

  if (hasGlobalAccess) {
    if (employeeId) where.employeeId = employeeId;
  } else {
    // Restrict employee to their own records
    const employee = await prisma.employee.findFirst({
      where: { OR: [{ userId: user.id }, { email: user.email }] }
    });
    if (!employee) {
      return NextResponse.json({ error: 'Zaměstnanecký profil nebyl nalezen.' }, { status: 404 });
    }
    where.employeeId = employee.id;
  }

  if (status) where.status = status as WorkEntryStatus;
  if (workOrderId) where.workOrderId = workOrderId;
  if (workType) where.workType = workType as WorkType;

  if (dateFrom || dateTo) {
    where.workDate = {};
    if (dateFrom) where.workDate.gte = new Date(dateFrom);
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      where.workDate.lte = toDate;
    }
  }

  const entries = await prisma.workEntry.findMany({
    where,
    include: {
      employee: true,
      workTask: true,
      workOrder: true,
      client: true,
    },
    orderBy: { workDate: 'desc' },
  });

  // Map Decimal values to strings for JSON safety
  const formatted = entries.map(entry => ({
    ...entry,
    quantity: entry.quantity.toString(),
    appliedUnitRate: entry.appliedUnitRate?.toString() ?? null,
    calculatedAmount: entry.calculatedAmount.toString(),
  }));

  return NextResponse.json(formatted);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const input = await request.json().catch(() => null);
  if (!input) {
    return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
  }

  const {
    employeeId,
    workTaskId,
    workDate,
    workType,
    remunerationMethod,
    quantity, // can be a string like "2.50" or "2:30"
    unit,
    note,
    creationSource,
    allowAdditionalEntry,
    additionalEntryReason,
    manualRate, // optional manually entered rate
  } = input;

  if (!employeeId || !workTaskId || !workDate || !workType || !remunerationMethod || quantity === undefined || !unit) {
    return NextResponse.json({ error: 'Chybí povinná pole.' }, { status: 400 });
  }

  // 1. Authorization checks
  const targetEmployee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!targetEmployee) {
    return NextResponse.json({ error: 'Pracovník nebyl nalezen.' }, { status: 404 });
  }

  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  const isOwnRecord = targetEmployee.userId === user.id || targetEmployee.email === user.email;

  if (!isOwnRecord && !isManagerOrAdmin) {
    return NextResponse.json({ error: 'Nemáte oprávnění vytvářet záznamy pro jiného pracovníka.' }, { status: 403 });
  }

  // 2. Validate WorkTask and WorkOrder link
  const workTask = await prisma.workTask.findUnique({
    where: { id: workTaskId },
    include: { workOrder: true }
  });
  if (!workTask) {
    return NextResponse.json({ error: 'Přiřazený úkol nebyl nalezen.' }, { status: 400 });
  }

  const workOrderId = workTask.workOrderId;
  const clientId = workTask.workOrder?.clientId || null;
  const clientName = workTask.workOrder?.clientName || null;

  // 3. Decimal quantity parsing
  let qtyDecimal: Prisma.Decimal;
  try {
    const qtyStr = String(quantity).trim();
    if (qtyStr.includes(':')) {
      const parts = qtyStr.split(':');
      if (parts.length !== 2) throw new Error();
      const hrs = parseInt(parts[0], 10);
      const mins = parseInt(parts[1], 10);
      if (isNaN(hrs) || isNaN(mins) || mins < 0 || mins >= 60 || hrs < 0) throw new Error();
      const totalHrs = hrs + mins / 60;
      qtyDecimal = new Prisma.Decimal(totalHrs.toFixed(2));
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

  // 4. Duplicate prevention
  const dateObj = new Date(workDate);
  const startOfDay = new Date(dateObj);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateObj);
  endOfDay.setHours(23, 59, 59, 999);

  const existingDuplicate = await prisma.workEntry.findFirst({
    where: {
      workTaskId,
      employeeId,
      workType: workType as WorkType,
      workDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  if (existingDuplicate) {
    const canBypass = isManagerOrAdmin && allowAdditionalEntry === true && String(additionalEntryReason || '').trim().length > 0;
    if (!canBypass) {
      if (isManagerOrAdmin) {
        return NextResponse.json({
          error: 'ZÁPIS_DUPLICITNÍ',
          message: 'Záznam práce se stejnými parametry již existuje. Chcete přesto vytvořit další zápis s odůvodněním?',
        }, { status: 409 });
      } else {
        return NextResponse.json({
          error: 'Záznam práce pro tento úkol, den a druh práce již existuje.',
        }, { status: 400 });
      }
    }
  }

  // 5. Rate Resolution
  let finalRate: Prisma.Decimal | null = null;
  let finalSource: RateSource | null = null;

  if (manualRate !== undefined && manualRate !== null) {
    if (!isManagerOrAdmin) {
      return NextResponse.json({ error: 'Pouze manažer nebo administrátor může zadat sazbu ručně.' }, { status: 403 });
    }
    try {
      finalRate = new Prisma.Decimal(String(manualRate).replace(',', '.'));
      if (finalRate.lt(0)) throw new Error();
      finalSource = 'MANUAL';
    } catch {
      return NextResponse.json({ error: 'Neplatná hodnota ruční sazby.' }, { status: 400 });
    }
  } else {
    const resolved = await resolveWorkEntryRate({
      employeeId,
      workType: workType as WorkType,
      workDate: dateObj,
      remunerationMethod: remunerationMethod as RateType,
    });
    if (resolved) {
      finalRate = resolved.amount;
      finalSource = resolved.source;
    }
  }

  const calculatedAmount = finalRate ? qtyDecimal.mul(finalRate) : new Prisma.Decimal(0);

  // 6. Create the WorkEntry as DRAFT
  const finalNote = allowAdditionalEntry && additionalEntryReason
    ? `[Dodatečný zápis: ${additionalEntryReason}] ${note || ''}`.trim()
    : note;

  const entry = await prisma.workEntry.create({
    data: {
      employeeId,
      workDate: dateObj,
      workTaskId,
      workOrderId,
      clientId,
      clientName,
      workType: workType as WorkType,
      remunerationMethod: remunerationMethod as RateType,
      quantity: qtyDecimal,
      unit,
      appliedUnitRate: finalRate,
      calculatedAmount,
      rateSource: finalSource,
      note: finalNote,
      status: 'DRAFT',
      creationSource: creationSource === 'AUTOMATIC' ? 'AUTOMATIC' : 'MANUAL',
    },
  });

  return NextResponse.json({
    id: entry.id,
    status: entry.status,
    quantity: entry.quantity.toString(),
    appliedUnitRate: entry.appliedUnitRate?.toString() ?? null,
    calculatedAmount: entry.calculatedAmount.toString(),
  }, { status: 201 });
}
