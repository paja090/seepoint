import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { resolveWorkEntryRate } from '@/lib/work-entry-rates';
import { Prisma, RateSource } from '@prisma/client';
import {
  assertCalculatedAmountFits,
  parseDateOnly,
  parseId,
  parseMoney,
  parseNote,
  parseQuantity,
  parseRateType,
  parseReason,
  parseUnit,
  parseWorkEntryStatus,
  parseWorkType,
  WORK_ENTRY_PAGE_LIMIT,
  WorkEntryValidationError,
} from '@/lib/work-entry-policy';

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

  try {
    if (status) where.status = parseWorkEntryStatus(status);
    if (workOrderId) where.workOrderId = parseId(workOrderId, 'Zakázka');
    if (workType) where.workType = parseWorkType(workType);
    if (dateFrom || dateTo) {
      const from = dateFrom ? parseDateOnly(dateFrom, 'Datum od') : undefined;
      const to = dateTo ? parseDateOnly(dateTo, 'Datum do') : undefined;
      if (from && to && from > to) throw new WorkEntryValidationError('Datum od nesmí být později než datum do.');
      where.workDate = { gte: from, lte: to ? new Date(to.getTime() + 86_400_000 - 1) : undefined };
    }
  } catch (error) {
    if (error instanceof WorkEntryValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  if (hasGlobalAccess) {
    if (employeeId) {
      try { where.employeeId = parseId(employeeId, 'Pracovník'); }
      catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Pracovník není platný.' }, { status: 400 });
      }
    }
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

  const entries = await prisma.workEntry.findMany({
    where,
    include: {
      employee: true,
      workTask: true,
      workOrder: true,
      client: true,
    },
    orderBy: { workDate: 'desc' },
    take: WORK_ENTRY_PAGE_LIMIT,
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
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
  }

  const {
    employeeId,
    workTaskId,
    workDate,
    workType,
    remunerationMethod,
    quantity,
    unit,
    note,
    allowAdditionalEntry,
    additionalEntryReason,
    manualRate,
    manualOverride,
  } = input;

  if (!employeeId || !workTaskId || !workDate || !workType || !remunerationMethod || quantity === undefined) {
    return NextResponse.json({ error: 'Chybí povinná pole.' }, { status: 400 });
  }

  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  if (!canAccess(user.role, 'workEntries') && !canAccess(user.role, 'myWorkEntries')) {
    return NextResponse.json({ error: 'Nemáte oprávnění vytvářet výkazy práce.' }, { status: 403 });
  }

  let cleanEmployeeId: string;
  let cleanWorkTaskId: string;
  let dateObj: Date;
  let cleanWorkType: ReturnType<typeof parseWorkType>;
  let cleanRemunerationMethod: ReturnType<typeof parseRateType>;
  let qtyDecimal: Prisma.Decimal;
  let cleanUnit: string | undefined;
  let cleanNote: string | undefined;
  let cleanAdditionalReason: string | undefined;
  let cleanManualRate: Prisma.Decimal | null = null;
  try {
    cleanEmployeeId = parseId(employeeId, 'Pracovník');
    cleanWorkTaskId = parseId(workTaskId, 'Úkol');
    dateObj = parseDateOnly(workDate, 'Datum práce');
    cleanWorkType = parseWorkType(workType);
    cleanRemunerationMethod = parseRateType(remunerationMethod);
    qtyDecimal = parseQuantity(quantity);
    cleanUnit = parseUnit(unit);
    cleanNote = parseNote(note);
    cleanAdditionalReason = parseReason(additionalEntryReason, 'Důvod dodatečného zápisu');
    if (manualRate !== undefined && manualRate !== null && manualRate !== '') cleanManualRate = parseMoney(manualRate, 'Ruční sazba');
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Neplatná data výkazu.' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate employee
      const targetEmployee = await tx.employee.findUnique({ where: { id: cleanEmployeeId } });
      if (!targetEmployee) {
        throw new Error('Zaměstnanec nebyl nalezen.');
      }

      const isOwnRecord = targetEmployee.userId === user.id || targetEmployee.email === user.email;
      if (!isOwnRecord && !isManagerOrAdmin) {
        throw new Error('Nemáte oprávnění vytvářet záznamy pro jiného pracovníka.');
      }

      // 2. Validate WorkTask and WorkOrder
      const workTask = await tx.workTask.findUnique({
        where: { id: cleanWorkTaskId },
        include: { workOrder: true }
      });
      if (!workTask) {
        throw new Error('Přiřazený úkol nebyl nalezen.');
      }

      const workOrderId = workTask.workOrderId;
      const clientId = workTask.workOrder?.clientId || null;
      const clientName = workTask.workOrder?.clientName || null;

      // WORKER and TECHNICIAN validation
      if (!isManagerOrAdmin) {
        if (workTask.assignedToEmployeeId !== cleanEmployeeId) {
          throw new Error('Tento úkol není přiřazen vám.');
        }
        if (workTask.status !== 'DONE') {
          throw new Error('Práci lze vykazovat pouze u dokončených úkolů (DONE).');
        }
      }

      // Remuneration Rules
      let finalQuantity = qtyDecimal;
      let finalUnit = cleanUnit || 'ks';
      if (cleanRemunerationMethod === 'HOURLY') {
        finalUnit = 'hod';
      } else if (cleanRemunerationMethod === 'FIXED') {
        finalQuantity = new Prisma.Decimal(1);
        finalUnit = 'ks';
      }

      // 4. Duplicate prevention INSIDE the transaction
      const startOfDay = new Date(dateObj);
      const endOfDay = new Date(dateObj.getTime() + 86_400_000 - 1);

      const existingDuplicate = await tx.workEntry.findFirst({
        where: {
          workTaskId: cleanWorkTaskId,
          employeeId: cleanEmployeeId,
          workType: cleanWorkType,
          workDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      if (existingDuplicate) {
        const canBypass = isManagerOrAdmin && allowAdditionalEntry === true && Boolean(cleanAdditionalReason);
        if (!canBypass) {
          if (isManagerOrAdmin) {
            throw new Error('DUPLICATE_CHECK_FAILED_MANAGER');
          } else {
            throw new Error('Záznam práce pro tento úkol, den a druh práce již existuje.');
          }
        }
      }

      // 5. Rate Resolution
      let finalRate: Prisma.Decimal | null = null;
      let finalSource: RateSource | null = null;

      const resolved = await resolveWorkEntryRate({
        employeeId: cleanEmployeeId,
        workType: cleanWorkType,
        workDate: dateObj,
        remunerationMethod: cleanRemunerationMethod,
        workOrderId,
      }, tx);

      if (cleanManualRate) {
        if (!isManagerOrAdmin) {
          throw new Error('Pouze manažer nebo administrátor může zadat sazbu ručně.');
        }
        if (resolved) {
          if (manualOverride !== true || !cleanNote) {
            throw new Error('RUČNÍ_PŘEPSÁNÍ_VYŽADOVÁNO');
          }
        }
        finalRate = cleanManualRate;
        finalSource = 'MANUAL';
      } else {
        if (resolved) {
          finalRate = resolved.amount;
          finalSource = resolved.source;
          if (cleanRemunerationMethod === 'TASK' && resolved.unit) {
            finalUnit = resolved.unit;
          }
        }
      }

      assertCalculatedAmountFits(finalQuantity, finalRate);
      const calculatedAmount = finalRate ? finalQuantity.mul(finalRate) : new Prisma.Decimal(0);

      const finalNote = allowAdditionalEntry && cleanAdditionalReason
        ? `[Dodatečný zápis: ${cleanAdditionalReason}] ${cleanNote || ''}`.trim()
        : cleanNote;

      const finalCreationSource = isManagerOrAdmin ? 'MANUAL' : 'AUTOMATIC';

      const entry = await tx.workEntry.create({
        data: {
          employeeId: cleanEmployeeId,
          workDate: dateObj,
          workTaskId: cleanWorkTaskId,
          workOrderId,
          clientId,
          clientName,
          workType: cleanWorkType,
          remunerationMethod: cleanRemunerationMethod,
          quantity: finalQuantity,
          unit: finalUnit,
          appliedUnitRate: finalRate,
          calculatedAmount,
          rateSource: finalSource,
          note: finalNote,
          status: 'DRAFT',
          creationSource: finalCreationSource,
        },
      });

      return entry;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      id: result.id,
      status: result.status,
      quantity: result.quantity.toString(),
      appliedUnitRate: result.appliedUnitRate?.toString() ?? null,
      calculatedAmount: result.calculatedAmount.toString(),
    }, { status: 201 });

  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === 'DUPLICATE_CHECK_FAILED_MANAGER') {
      return NextResponse.json({
        error: 'ZÁPIS_DUPLICITNÍ',
        message: 'Záznam práce se stejnými parametry již existuje. Chcete přesto vytvořit další zápis s odůvodněním?',
      }, { status: 409 });
    }
    if (err.message === 'RUČNÍ_PŘEPSÁNÍ_VYŽADOVÁNO') {
      return NextResponse.json({
        error: 'RUČNÍ_PŘEPSÁNÍ_VYŽADOVÁNO',
        message: 'Pro přepsání automatické sazby musíte zaškrtnout souhlas a vyplnit důvod v poznámce.',
      }, { status: 400 });
    }
    if (err instanceof WorkEntryValidationError || !('code' in (err as Error & { code?: string }))) {
      return NextResponse.json({ error: err.message || 'Neplatná data výkazu.' }, { status: 400 });
    }
    console.error('Create work entry failed', error);
    return NextResponse.json({ error: 'Záznam práce se nepodařilo vytvořit.' }, { status: 500 });
  }
}
