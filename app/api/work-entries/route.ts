import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { canAccess } from '@/lib/rbac';
import { resolveWorkEntryRate } from '@/lib/work-entry-rates';
import { getOrCreateSettlement, getPragueYearMonth } from '@/lib/settlement-generation';
import { recalculateSettlementTotals } from '@/lib/settlement-recalculation';
import { EDITABLE_SETTLEMENT_STATUSES } from '@/lib/settlement-statuses';
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

const DEFAULT_WORK_TYPE_TITLES: Record<string, string> = {
  INSTALLATION: 'Instalace',
  REINSTALLATION: 'Reinstalace',
  DEINSTALLATION: 'Deinstalace',
  REPAIR: 'Oprava / Servis',
  CHECK: 'Kontrola / Zaměření',
  TRANSPORT: 'Doprava / Převoz',
  OTHER: 'Ostatní práce',
};

export async function GET(request: Request) {
  const user = await requireApiAccess(['workEntries', 'myWorkEntries']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

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
      expenses: true,
    },
    orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    take: WORK_ENTRY_PAGE_LIMIT,
  });

  const formatted = entries.map(entry => ({
    ...entry,
    quantity: entry.quantity.toString(),
    appliedUnitRate: entry.appliedUnitRate?.toString() ?? null,
    calculatedAmount: entry.calculatedAmount.toString(),
    expenses: entry.expenses.map(exp => ({
      id: exp.id,
      type: exp.type,
      description: exp.description,
      amount: exp.amount.toString(),
      status: exp.status,
      rejectionReason: exp.rejectionReason,
      receiptUrl: exp.receiptPhotoId ? `/api/photos/${exp.receiptPhotoId}/file` : null,
    })),
  }));

  return NextResponse.json(formatted);
}

export async function POST(request: Request) {
  const user = await requireApiAccess(['workEntries', 'myWorkEntries']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json({ error: 'Požadavek neobsahuje platná data.' }, { status: 400 });
  }

  const {
    employeeId: rawEmployeeId,
    workTaskId: rawWorkTaskId,
    workOrderId: rawWorkOrderId,
    activityTitle: rawActivityTitle,
    workDate,
    workType = 'INSTALLATION',
    remunerationMethod = 'HOURLY',
    quantity: rawQuantity,
    unit,
    note,
    allowAdditionalEntry,
    additionalEntryReason,
    manualRate,
    unitRate,
    manualOverride,
    requireOverrideConfirmation,
    strictDuplicateCheck,
    autoApprove = true,
  } = input;

  const effectiveManualRate = manualRate !== undefined && manualRate !== '' ? manualRate : unitRate;
  const effectiveQuantity = remunerationMethod === 'FIXED' && (rawQuantity === undefined || rawQuantity === '') ? '1' : rawQuantity;

  if (!workDate || !workType || !remunerationMethod || effectiveQuantity === undefined || effectiveQuantity === '') {
    return NextResponse.json({ error: 'Chybí povinná pole (datum, typ odměny nebo množství).' }, { status: 400 });
  }

  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'ACCOUNTANT';
  if (!canAccess(user.role, 'workEntries') && !canAccess(user.role, 'myWorkEntries')) {
    return NextResponse.json({ error: 'Nemáte oprávnění vytvářet výkazy práce.' }, { status: 403 });
  }

  let cleanEmployeeId: string | undefined;
  let cleanWorkTaskId: string | undefined;
  let cleanWorkOrderId: string | undefined;
  let cleanActivityTitle: string | undefined;
  let dateObj: Date;
  let cleanWorkType: ReturnType<typeof parseWorkType>;
  let cleanRemunerationMethod: ReturnType<typeof parseRateType>;
  let qtyDecimal: Prisma.Decimal;
  let cleanUnit: string | undefined;
  let cleanNote: string | undefined;
  let cleanAdditionalReason: string | undefined;
  let cleanManualRate: Prisma.Decimal | null = null;
  try {
    if (rawEmployeeId) cleanEmployeeId = parseId(rawEmployeeId, 'Pracovník');
    if (rawWorkTaskId && String(rawWorkTaskId).trim()) cleanWorkTaskId = parseId(rawWorkTaskId, 'Úkol');
    if (rawWorkOrderId && String(rawWorkOrderId).trim()) cleanWorkOrderId = parseId(rawWorkOrderId, 'Zakázka');
    if (typeof rawActivityTitle === 'string' && rawActivityTitle.trim()) {
      cleanActivityTitle = rawActivityTitle.trim().slice(0, 160);
    }
    dateObj = parseDateOnly(workDate, 'Datum práce');
    cleanWorkType = parseWorkType(workType);
    cleanRemunerationMethod = parseRateType(remunerationMethod);
    qtyDecimal = parseQuantity(effectiveQuantity);
    cleanUnit = parseUnit(unit);
    cleanNote = parseNote(note);
    cleanAdditionalReason = parseReason(additionalEntryReason, 'Důvod dodatečného zápisu');
    if (effectiveManualRate !== undefined && effectiveManualRate !== null && effectiveManualRate !== '') {
      cleanManualRate = parseMoney(effectiveManualRate, 'Sazba / Cena');
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Neplatná data výkazu.' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate / resolve employee
      const targetEmployee = cleanEmployeeId
        ? await tx.employee.findUnique({ where: { id: cleanEmployeeId } })
        : await tx.employee.findFirst({ where: { OR: [{ userId: user.id }, { email: user.email }] } });

      if (!targetEmployee) {
        throw new Error('Zaměstnanec nebyl nalezen.');
      }
      const resolvedEmployeeId = targetEmployee.id;

      const isOwnRecord = targetEmployee.userId === user.id || targetEmployee.email === user.email;
      if (!isOwnRecord && !isManagerOrAdmin) {
        throw new Error('Nemáte oprávnění vytvářet záznamy pro jiného pracovníka.');
      }

      // 2. Resolve or Auto-create WorkTask & WorkOrder context
      const workOrderInclude = {
        items: {
          include: {
            carrier: {
              include: {
                carrierTypeRef: { select: { id: true, name: true } },
              },
            },
          },
        },
      };

      let workTask = cleanWorkTaskId
        ? await tx.workTask.findUnique({
            where: { id: cleanWorkTaskId },
            include: { workOrder: { include: workOrderInclude } },
          })
        : null;

      if (cleanWorkTaskId && !workTask) {
        throw new Error('Přiřazený úkol nebyl nalezen.');
      }

      if (!workTask) {
        let linkedOrder = null;
        if (cleanWorkOrderId) {
          linkedOrder = await tx.workOrder.findUnique({
            where: { id: cleanWorkOrderId },
            include: workOrderInclude,
          });
          if (!linkedOrder) {
            throw new Error('Vybraná zakázka nebyla nalezena.');
          }
        }

        const desiredTitle =
          cleanActivityTitle ||
          linkedOrder?.title ||
          DEFAULT_WORK_TYPE_TITLES[cleanWorkType] ||
          'Odvedená práce';

        // Find existing task for this employee + order + title, or create one
        const existingTask = await tx.workTask.findFirst({
          where: {
            assignedToEmployeeId: resolvedEmployeeId,
            workOrderId: linkedOrder ? linkedOrder.id : null,
            title: desiredTitle,
          },
          include: { workOrder: { include: workOrderInclude } },
        });

        if (existingTask) {
          workTask = existingTask;
        } else {
          workTask = await tx.workTask.create({
            data: {
              title: desiredTitle,
              description: cleanNote || null,
              status: 'DONE',
              priority: linkedOrder?.priority || 'NORMAL',
              scheduledDate: dateObj,
              assignedToEmployeeId: resolvedEmployeeId,
              workOrderId: linkedOrder ? linkedOrder.id : null,
            },
            include: { workOrder: { include: workOrderInclude } },
          });
        }
      } else if (cleanActivityTitle && workTask.title !== cleanActivityTitle && !cleanWorkTaskId) {
        // Keep custom activity title if needed
      }

      const finalWorkTaskId = workTask.id;
      const workOrderId = workTask.workOrderId || cleanWorkOrderId || null;
      const clientId = workTask.workOrder?.clientId || null;
      const clientName = workTask.workOrder?.clientName || null;
      const carrier = workTask.workOrder?.items?.[0]?.carrier;
      const carrierType = carrier?.type || null;
      const carrierTypeId = carrier?.carrierTypeId || null;
      const carrierTypeLabel =
        cleanActivityTitle ||
        workTask.title ||
        carrier?.carrierTypeRef?.name ||
        carrier?.type ||
        null;

      // Remuneration Rules
      let finalQuantity = qtyDecimal;
      let finalUnit = cleanUnit || 'ks';
      if (cleanRemunerationMethod === 'HOURLY') {
        finalUnit = 'hod';
      } else if (cleanRemunerationMethod === 'FIXED') {
        finalQuantity = new Prisma.Decimal(1);
        finalUnit = cleanUnit || 'ks';
      }

      // Optional Duplicate check (only when explicitly requested or when raw workTaskId was used with strict flag)
      if (strictDuplicateCheck === true) {
        const startOfDay = new Date(dateObj);
        const endOfDay = new Date(dateObj.getTime() + 86_400_000 - 1);

        const existingDuplicate = await tx.workEntry.findFirst({
          where: {
            workTaskId: finalWorkTaskId,
            employeeId: resolvedEmployeeId,
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
      }

      // 5. Rate Resolution
      let finalRate: Prisma.Decimal | null = null;
      let finalSource: RateSource | null = null;

      const resolved = await resolveWorkEntryRate({
        employeeId: resolvedEmployeeId,
        workType: cleanWorkType,
        workDate: dateObj,
        remunerationMethod: cleanRemunerationMethod,
        workOrderId,
        carrierType,
        carrierTypeId,
      }, tx);

      if (cleanManualRate !== null) {
        if (requireOverrideConfirmation === true && resolved && (manualOverride !== true || !cleanNote)) {
          throw new Error('RUČNÍ_PŘEPSÁNÍ_VYŽADOVÁNO');
        }
        finalRate = cleanManualRate;
        finalSource = 'MANUAL';
      } else if (resolved) {
        finalRate = resolved.amount;
        finalSource = resolved.source;
        if (cleanRemunerationMethod === 'TASK' && resolved.unit && !cleanUnit) {
          finalUnit = resolved.unit;
        }
      } else if (workTask.workOrder?.price && cleanRemunerationMethod === 'FIXED') {
        finalRate = new Prisma.Decimal(workTask.workOrder.price);
        finalSource = 'WORK_ORDER_RATE';
      }

      assertCalculatedAmountFits(finalQuantity, finalRate);
      const calculatedAmount = finalRate ? finalQuantity.mul(finalRate) : new Prisma.Decimal(0);

      const finalNote = allowAdditionalEntry && cleanAdditionalReason
        ? `[Dodatečný zápis: ${cleanAdditionalReason}] ${cleanNote || ''}`.trim()
        : cleanNote;

      const finalCreationSource = isManagerOrAdmin ? 'MANUAL' : 'AUTOMATIC';

      // Determine if we can auto-approve and sync directly into the employee's Settlement
      const shouldAutoApprove = autoApprove !== false && finalRate !== null && finalRate.gte(0);

      const entry = await tx.workEntry.create({
        data: {
          employeeId: resolvedEmployeeId,
          workDate: dateObj,
          workTaskId: finalWorkTaskId,
          workOrderId,
          clientId,
          clientName,
          workType: cleanWorkType,
          carrierType,
          carrierTypeLabel,
          remunerationMethod: cleanRemunerationMethod,
          quantity: finalQuantity,
          unit: finalUnit,
          appliedUnitRate: finalRate,
          calculatedAmount,
          rateSource: finalSource,
          note: finalNote,
          status: shouldAutoApprove ? 'APPROVED' : 'DRAFT',
          creationSource: finalCreationSource,
        },
      });

      if (shouldAutoApprove && finalRate !== null) {
        const settlement = await getOrCreateSettlement(
          {
            employeeId: resolvedEmployeeId,
            workDate: dateObj,
          },
          tx
        );

        const originalYearMonth = getPragueYearMonth(dateObj);
        const isOriginalMonth =
          settlement.periodYear === originalYearMonth.year &&
          settlement.periodMonth === originalYearMonth.month;

        if (isOriginalMonth && EDITABLE_SETTLEMENT_STATUSES.includes(settlement.status)) {
          const itemDescription =
            finalNote ||
            cleanActivityTitle ||
            workTask.title ||
            `Práce ${DEFAULT_WORK_TYPE_TITLES[cleanWorkType] || cleanWorkType}`;

          await tx.settlementItem.upsert({
            where: { workEntryId: entry.id },
            create: {
              settlementId: settlement.id,
              workEntryId: entry.id,
              taskId: finalWorkTaskId,
              date: dateObj,
              description: itemDescription,
              quantity: finalQuantity,
              unit: finalUnit,
              unitPrice: finalRate,
              amount: calculatedAmount,
              appliedRate: finalRate,
              rateType: cleanRemunerationMethod,
              rateSource: finalSource,
              carrierType,
              carrierTypeLabel,
              workType: cleanWorkType,
              note: finalNote || null,
            },
            update: {
              settlementId: settlement.id,
              date: dateObj,
              description: itemDescription,
              quantity: finalQuantity,
              unit: finalUnit,
              unitPrice: finalRate,
              amount: calculatedAmount,
              appliedRate: finalRate,
              rateType: cleanRemunerationMethod,
              rateSource: finalSource,
              carrierType,
              carrierTypeLabel,
              workType: cleanWorkType,
              note: finalNote || null,
            },
          });

          await recalculateSettlementTotals(settlement.id, tx);
        } else {
          // If the target month is already locked/submitted, keep entry as SUBMITTED for manager review
          await tx.workEntry.update({
            where: { id: entry.id },
            data: { status: 'SUBMITTED' },
          });
          entry.status = 'SUBMITTED';
        }
      }

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
