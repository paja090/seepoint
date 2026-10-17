import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { resolveWorkEntryRate } from '@/lib/work-entry-rates';
import { getOrCreateSettlement, getPragueYearMonth } from '@/lib/settlement-generation';
import { recalculateSettlementTotals } from '@/lib/settlement-recalculation';
import { EDITABLE_SETTLEMENT_STATUSES, FINALIZED_SETTLEMENT_STATUSES } from '@/lib/settlement-statuses';
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
  const user = await requireApiAccess(['workEntries', 'myWorkEntries']);
  if (isApiDenied(user)) return user;
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
  const user = await requireApiAccess(['workEntries', 'myWorkEntries']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id } = await params;
  const entry = await prisma.workEntry.findUnique({
    where: { id },
    include: {
      employee: true,
      workTask: true,
      settlementItem: {
        include: { settlement: true },
      },
    },
  });

  if (!entry) {
    return NextResponse.json({ error: 'Záznam práce nebyl nalezen.' }, { status: 404 });
  }

  // Authorization
  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'ACCOUNTANT';
  const isOwnRecord = entry.employee.userId === user.id || entry.employee.email === user.email;

  if (!isOwnRecord && !isManagerOrAdmin) {
    return NextResponse.json({ error: 'Nemáte oprávnění k úpravě tohoto záznamu.' }, { status: 403 });
  }

  // Check if settlement is finalized (LOCKED / PAID)
  const linkedSettlement = entry.settlementItem?.settlement;
  if (linkedSettlement && FINALIZED_SETTLEMENT_STATUSES.includes(linkedSettlement.status)) {
    return NextResponse.json({ error: 'Záznam patří do již uzamčeného nebo vyplaceného období.' }, { status: 400 });
  }
  if (!isManagerOrAdmin && linkedSettlement && linkedSettlement.status !== 'DRAFT' && linkedSettlement.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Záznam je v odeslaném nebo schváleném vyúčtování a nelze jej upravovat.' }, { status: 400 });
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
    unitRate,
    activityTitle,
    manualOverride,
    requireOverrideConfirmation,
  } = input;

  const effectiveManualRate = manualRate !== undefined && manualRate !== '' ? manualRate : unitRate;

  let qtyDecimal: Prisma.Decimal;
  let targetDate: Date;
  let targetType: ReturnType<typeof parseWorkType>;
  let targetMethod: ReturnType<typeof parseRateType>;
  let cleanUnit: string | undefined;
  let cleanNote: string | undefined;
  let cleanManualRate: Prisma.Decimal | null = null;
  try {
    targetMethod = remunerationMethod !== undefined ? parseRateType(remunerationMethod) : entry.remunerationMethod;
    const rawQty = targetMethod === 'FIXED' && (quantity === undefined || quantity === '') ? '1' : quantity;
    qtyDecimal = rawQty !== undefined ? parseQuantity(rawQty) : entry.quantity;
    targetDate = workDate !== undefined ? parseDateOnly(workDate, 'Datum práce') : entry.workDate;
    targetType = workType !== undefined ? parseWorkType(workType) : entry.workType;
    cleanUnit = unit !== undefined ? parseUnit(unit) : entry.unit;
    cleanNote = note !== undefined ? parseNote(note) : undefined;
    if (effectiveManualRate !== undefined && effectiveManualRate !== null && effectiveManualRate !== '') {
      cleanManualRate = parseMoney(effectiveManualRate, 'Sazba / Cena');
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Neplatná data výkazu.' }, { status: 400 });
  }

  let finalRate = entry.appliedUnitRate;
  let finalSource = entry.rateSource;

  let finalUnit = cleanUnit || entry.unit;
  if (targetMethod === 'HOURLY') {
    finalUnit = 'hod';
  } else if (targetMethod === 'FIXED') {
    qtyDecimal = new Prisma.Decimal(1);
    finalUnit = cleanUnit || 'ks';
  }

  const resolved = await resolveWorkEntryRate({
    employeeId: entry.employeeId,
    workType: targetType,
    workDate: targetDate,
    remunerationMethod: targetMethod,
    workOrderId: entry.workOrderId,
  });

  if (cleanManualRate !== null) {
    if (requireOverrideConfirmation === true && resolved && (manualOverride !== true || !cleanNote)) {
      return NextResponse.json({
        error: 'RUČNÍ_PŘEPSÁNÍ_VYŽADOVÁNO',
        message: 'Pro přepsání automatické sazby musíte zaškrtnout souhlas a vyplnit důvod v poznámce.',
      }, { status: 400 });
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
    }
  }

  try { assertCalculatedAmountFits(qtyDecimal, finalRate); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const calculatedAmount = finalRate ? qtyDecimal.mul(finalRate) : new Prisma.Decimal(0);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      let targetWorkTaskId = entry.workTaskId;
      let cleanActivityLabel = entry.carrierTypeLabel;

      if (typeof activityTitle === 'string' && activityTitle.trim()) {
        const trimmedTitle = activityTitle.trim().slice(0, 160);
        cleanActivityLabel = trimmedTitle;
        if (entry.workTask?.title !== trimmedTitle) {
          const existingTask = await tx.workTask.findFirst({
            where: {
              assignedToEmployeeId: entry.employeeId,
              workOrderId: entry.workOrderId,
              title: trimmedTitle,
            },
          });
          if (existingTask) {
            targetWorkTaskId = existingTask.id;
          } else {
            const newTask = await tx.workTask.create({
              data: {
                title: trimmedTitle,
                status: 'DONE',
                priority: 'NORMAL',
                scheduledDate: targetDate,
                assignedToEmployeeId: entry.employeeId,
                workOrderId: entry.workOrderId,
              },
            });
            targetWorkTaskId = newTask.id;
          }
        }
      }

      const nextStatus = finalRate !== null && finalRate.gte(0) ? 'APPROVED' : entry.status;

      const updatedEntry = await tx.workEntry.update({
        where: { id },
        data: {
          workDate: targetDate,
          workTaskId: targetWorkTaskId,
          workType: targetType,
          carrierTypeLabel: cleanActivityLabel,
          remunerationMethod: targetMethod,
          quantity: qtyDecimal,
          unit: finalUnit,
          appliedUnitRate: finalRate,
          calculatedAmount,
          rateSource: finalSource,
          status: nextStatus,
          note: note !== undefined ? cleanNote ?? null : undefined,
        },
      });

      if (nextStatus === 'APPROVED' && finalRate !== null) {
        const settlement = await getOrCreateSettlement(
          { employeeId: entry.employeeId, workDate: targetDate },
          tx
        );
        const originalYearMonth = getPragueYearMonth(targetDate);
        const isOriginalMonth =
          settlement.periodYear === originalYearMonth.year &&
          settlement.periodMonth === originalYearMonth.month;

        if (isOriginalMonth && EDITABLE_SETTLEMENT_STATUSES.includes(settlement.status)) {
          const oldSettlementId = entry.settlementItem?.settlementId;
          const desc =
            (note !== undefined ? cleanNote : entry.note) ||
            cleanActivityLabel ||
            entry.workTask?.title ||
            `Práce ${targetType}`;

          await tx.settlementItem.upsert({
            where: { workEntryId: entry.id },
            create: {
              settlementId: settlement.id,
              workEntryId: entry.id,
              taskId: targetWorkTaskId,
              date: targetDate,
              description: desc,
              quantity: qtyDecimal,
              unit: finalUnit,
              unitPrice: finalRate,
              amount: calculatedAmount,
              appliedRate: finalRate,
              rateType: targetMethod,
              rateSource: finalSource,
              carrierType: entry.carrierType,
              carrierTypeLabel: cleanActivityLabel,
              workType: targetType,
              note: note !== undefined ? cleanNote ?? null : entry.note,
            },
            update: {
              settlementId: settlement.id,
              taskId: targetWorkTaskId,
              date: targetDate,
              description: desc,
              quantity: qtyDecimal,
              unit: finalUnit,
              unitPrice: finalRate,
              amount: calculatedAmount,
              appliedRate: finalRate,
              rateType: targetMethod,
              rateSource: finalSource,
              carrierTypeLabel: cleanActivityLabel,
              workType: targetType,
              note: note !== undefined ? cleanNote ?? null : entry.note,
            },
          });

          await recalculateSettlementTotals(settlement.id, tx);
          if (oldSettlementId && oldSettlementId !== settlement.id) {
            await recalculateSettlementTotals(oldSettlementId, tx);
          }
        }
      }

      return updatedEntry;
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      quantity: updated.quantity.toString(),
      appliedUnitRate: updated.appliedUnitRate?.toString() ?? null,
      calculatedAmount: updated.calculatedAmount.toString(),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Výkaz byl mezitím změněn nebo odeslán. Obnovte stránku.' }, { status: 409 });
    }
    if (error instanceof WorkEntryValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Update work entry failed', error);
    return NextResponse.json({ error: 'Záznam práce se nepodařilo upravit.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiAccess(['workEntries', 'myWorkEntries']);
  if (isApiDenied(user)) return user;
  if (!user) {
    return NextResponse.json({ error: 'Přihlášení je vyžadováno.' }, { status: 401 });
  }

  const { id } = await params;
  const entry = await prisma.workEntry.findUnique({
    where: { id },
    include: {
      employee: true,
      settlementItem: {
        include: { settlement: true },
      },
      expenses: true,
    },
  });

  if (!entry) {
    return NextResponse.json({ error: 'Záznam práce nebyl nalezen.' }, { status: 404 });
  }

  const isManagerOrAdmin = user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'ACCOUNTANT';
  const isOwnRecord = entry.employee.userId === user.id || entry.employee.email === user.email;

  if (!isOwnRecord && !isManagerOrAdmin) {
    return NextResponse.json({ error: 'Nemáte oprávnění smazat tento záznam.' }, { status: 403 });
  }

  const linkedSettlement = entry.settlementItem?.settlement;
  if (linkedSettlement && FINALIZED_SETTLEMENT_STATUSES.includes(linkedSettlement.status)) {
    return NextResponse.json({ error: 'Záznam patří do uzamčeného nebo vyplaceného vyúčtování a nelze jej smazat.' }, { status: 400 });
  }

  if (!isManagerOrAdmin && linkedSettlement && linkedSettlement.status !== 'DRAFT' && linkedSettlement.status !== 'REJECTED') {
    return NextResponse.json({ error: 'Záznam v odeslaném nebo schváleném vyúčtování může smazat pouze manažer.' }, { status: 403 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const settlementIdToRecalculate = entry.settlementItem?.settlementId;

      if (entry.settlementItem) {
        await tx.settlementItem.delete({
          where: { id: entry.settlementItem.id },
        });
      }

      if (entry.expenses.length > 0) {
        await tx.workExpense.deleteMany({
          where: { workEntryId: entry.id },
        });
      }

      await tx.workEntry.delete({
        where: { id: entry.id },
      });

      if (settlementIdToRecalculate) {
        await recalculateSettlementTotals(settlementIdToRecalculate, tx);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete work entry failed', error);
    return NextResponse.json({ error: 'Záznam práce se nepodařilo smazat.' }, { status: 500 });
  }
}
