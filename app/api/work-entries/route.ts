import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { resolveWorkEntryRate } from '@/lib/work-entry-rates';
import { Prisma, RateType, WorkType, WorkEntryStatus, RateSource, CarrierType } from '@prisma/client';

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
    quantity,
    unit,
    note,
    allowAdditionalEntry,
    additionalEntryReason,
    manualRate,
    manualOverride,
    isAdHoc,
    adHocTaskTitle,
    workOrderId,
    carrierType,
  } = input;

  if (!employeeId || (!workTaskId && !isAdHoc) || !workDate || !workType || !remunerationMethod || quantity === undefined) {
    return NextResponse.json({ error: 'Chybí povinná pole.' }, { status: 400 });
  }

  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate employee
      const targetEmployee = await tx.employee.findUnique({ where: { id: employeeId } });
      if (!targetEmployee) {
        throw new Error('Zaměstnanec nebyl nalezen.');
      }

      const isOwnRecord = targetEmployee.userId === user.id || targetEmployee.email === user.email;
      if (!isOwnRecord && !isManagerOrAdmin) {
        throw new Error('Nemáte oprávnění vytvářet záznamy pro jiného pracovníka.');
      }

      const dateObj = new Date(workDate);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Neplatné datum.');
      }

      // 2. Validate or Auto-Create WorkTask
      let targetWorkTaskId = workTaskId;
      let targetWorkOrderId = workOrderId || null;
      let targetClientId = null;
      let targetClientName = null;

      if (isAdHoc) {
        if (!adHocTaskTitle || !adHocTaskTitle.trim()) {
          throw new Error('Pro neplánovanou práci musíte vyplnit název úkolu.');
        }

        if (targetWorkOrderId) {
          const workOrder = await tx.workOrder.findUnique({
            where: { id: targetWorkOrderId }
          });
          if (workOrder) {
            targetClientId = workOrder.clientId || null;
            targetClientName = workOrder.clientName || null;
          }
        }

        const newAdHocTask = await tx.workTask.create({
          data: {
            title: adHocTaskTitle.trim(),
            description: 'Ad-hoc neplánovaný úkol vytvořený pracovníkem',
            assignedToEmployeeId: employeeId,
            createdByEmployeeId: employeeId,
            workOrderId: targetWorkOrderId,
            scheduledDate: dateObj,
            status: 'DONE',
            remunerationMethod: remunerationMethod as RateType,
          }
        });
        targetWorkTaskId = newAdHocTask.id;
      } else {
        const workTask = await tx.workTask.findUnique({
          where: { id: workTaskId },
          include: { workOrder: true }
        });
        if (!workTask) {
          throw new Error('Přiřazený úkol nebyl nalezen.');
        }

        targetWorkOrderId = workTask.workOrderId;
        targetClientId = workTask.workOrder?.clientId || null;
        targetClientName = workTask.workOrder?.clientName || null;

        // WORKER and TECHNICIAN validation
        if (!isManagerOrAdmin) {
          if (workTask.assignedToEmployeeId !== employeeId) {
            throw new Error('Tento úkol není přiřazen vám.');
          }
          if (workTask.status !== 'DONE') {
            throw new Error('Práci lze vykazovat pouze u dokončených úkolů (DONE).');
          }
        }
      }

      // 3. Decimal Quantity Parsing without JS floats
      let qtyDecimal: Prisma.Decimal;
      const qtyStr = String(quantity).trim();
      if (qtyStr.includes(':')) {
        const parts = qtyStr.split(':');
        if (parts.length !== 2) throw new Error('Neplatný formát množství.');
        const hrs = parseInt(parts[0], 10);
        const mins = parseInt(parts[1], 10);
        if (isNaN(hrs) || isNaN(mins) || mins < 0 || mins >= 60 || hrs < 0) {
          throw new Error('Neplatný formát času.');
        }
        const hrsDec = new Prisma.Decimal(hrs);
        const minsDec = new Prisma.Decimal(mins).div(60);
        qtyDecimal = hrsDec.add(minsDec);
      } else {
        const normalized = qtyStr.replace(',', '.');
        qtyDecimal = new Prisma.Decimal(normalized);
      }
      if (qtyDecimal.lte(0)) {
        throw new Error('Množství musí být kladné číslo.');
      }

      // Remuneration Rules
      let finalUnit = unit || 'ks';
      if (remunerationMethod === 'HOURLY') {
        finalUnit = 'hod';
      } else if (remunerationMethod === 'FIXED') {
        qtyDecimal = new Prisma.Decimal(1);
        finalUnit = 'ks';
      }

      // 4. Duplicate prevention INSIDE the transaction
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const existingDuplicate = await tx.workEntry.findFirst({
        where: {
          workTaskId: targetWorkTaskId,
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
            throw new Error('DUPLICATE_CHECK_FAILED_MANAGER');
          } else {
            throw new Error('Záznam práce pro tento úkol, den a druh práce již existuje.');
          }
        }
      }

      // 5. Rate Resolution
      let finalRate: Prisma.Decimal | null = null;
      let finalSource: RateSource | null = null;
      let resolvedCarrierType: CarrierType | null = null;

      if (isAdHoc && carrierType) {
        resolvedCarrierType = carrierType as CarrierType;
      } else if (targetWorkTaskId) {
        const taskObj = await tx.workTask.findUnique({
          where: { id: targetWorkTaskId },
          include: { carrier: true },
        });
        if (taskObj?.carrier?.type) {
          resolvedCarrierType = taskObj.carrier.type;
        }
      }

      const resolved = await resolveWorkEntryRate({
        employeeId,
        workType: workType as WorkType,
        workDate: dateObj,
        remunerationMethod: remunerationMethod as RateType,
        workOrderId: targetWorkOrderId,
        carrierType: resolvedCarrierType,
      }, tx);

      if (manualRate !== undefined && manualRate !== null) {
        if (!isManagerOrAdmin) {
          throw new Error('Pouze manažer nebo administrátor může zadat sazbu ručně.');
        }
        if (resolved) {
          if (manualOverride !== true || !String(note || '').trim()) {
            throw new Error('RUČNÍ_PŘEPSÁNÍ_VYŽADOVÁNO');
          }
        }
        try {
          finalRate = new Prisma.Decimal(String(manualRate).replace(',', '.'));
          if (finalRate.lt(0)) throw new Error();
          finalSource = 'MANUAL';
        } catch {
          throw new Error('Neplatná hodnota ruční sazby.');
        }
      } else {
        if (resolved) {
          finalRate = resolved.amount;
          finalSource = resolved.source;
          if (remunerationMethod === 'TASK' && resolved.unit) {
            finalUnit = resolved.unit;
          }
        }
      }

      const calculatedAmount = finalRate ? qtyDecimal.mul(finalRate) : new Prisma.Decimal(0);

      const finalNote = allowAdditionalEntry && additionalEntryReason
        ? `[Dodatečný zápis: ${additionalEntryReason}] ${note || ''}`.trim()
        : note;

      const finalCreationSource = isManagerOrAdmin ? 'MANUAL' : 'AUTOMATIC';

      const entry = await tx.workEntry.create({
        data: {
          employeeId,
          workDate: dateObj,
          workTaskId: targetWorkTaskId,
          workOrderId: targetWorkOrderId,
          clientId: targetClientId,
          clientName: targetClientName,
          workType: workType as WorkType,
          remunerationMethod: remunerationMethod as RateType,
          carrierType: resolvedCarrierType,
          quantity: qtyDecimal,
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
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
