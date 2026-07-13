import { prisma } from './db';
import { Prisma, WorkEntryStatus } from '@prisma/client';
import { getOrCreateSettlement, getPragueYearMonth } from './settlement-generation';
import { recalculateSettlementTotals } from './settlement-recalculation';
import { runTransactionWithRetry } from './transaction-retry';

/**
 * Validates state transitions for WorkEntry.
 */
export function validateWorkEntryTransition(from: WorkEntryStatus, to: WorkEntryStatus) {
  const allowed: Record<WorkEntryStatus, WorkEntryStatus[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['APPROVED', 'RETURNED'],
    APPROVED: [],
    RETURNED: ['SUBMITTED'],
  };

  if (!allowed[from].includes(to)) {
    throw new Error(`Neplatný přechod stavu práce z ${from} do ${to}.`);
  }
}

/**
 * Approves a WorkEntry. Computes or updates the corresponding SettlementItem or SettlementAdjustment.
 * All DB operations are inside a serializable transaction to prevent race conditions.
 */
export async function approveWorkEntry(
  workEntryId: string,
  approvedByUserId: string,
  tx?: Prisma.TransactionClient
) {

  const runApproval = async (transaction: Prisma.TransactionClient) => {
    // 1. Fetch the WorkEntry
    const entry = await transaction.workEntry.findUnique({
      where: { id: workEntryId },
      include: {
        settlementItem: {
          include: { settlement: true }
        }
      }
    });

    if (!entry) {
      throw new Error(`Záznam práce s ID ${workEntryId} nebyl nalezen.`);
    }

    // Validate state transition
    validateWorkEntryTransition(entry.status, 'APPROVED');

    // 2. Fetch/Create the appropriate Settlement (handling locks)
    const settlement = await getOrCreateSettlement(
      {
        employeeId: entry.employeeId,
        workDate: entry.workDate,
      },
      transaction
    );

    const originalYearMonth = getPragueYearMonth(entry.workDate);

    // Check if the target settlement is the original month's settlement
    const isOriginalMonth =
      settlement.periodYear === originalYearMonth.year &&
      settlement.periodMonth === originalYearMonth.month;

    if (isOriginalMonth) {
      // TARGET MONTH IS OPEN: We create or update a SettlementItem
      const description = entry.note || `Práce ${entry.workType} na úkolu ${entry.workTaskId}`;

      await transaction.settlementItem.upsert({
        where: { workEntryId: entry.id },
        create: {
          settlementId: settlement.id,
          workEntryId: entry.id,
          taskId: entry.workTaskId,
          date: entry.workDate,
          description,
          quantity: entry.quantity,
          unit: entry.unit,
          unitPrice: entry.appliedUnitRate,
          amount: entry.calculatedAmount,
          appliedRate: entry.appliedUnitRate || new Prisma.Decimal(0),
          rateType: entry.remunerationMethod,
          rateSource: entry.rateSource,
          carrierType: entry.carrierType,
          workType: entry.workType,
        },
        update: {
          settlementId: settlement.id,
          date: entry.workDate,
          description,
          quantity: entry.quantity,
          unit: entry.unit,
          unitPrice: entry.appliedUnitRate,
          amount: entry.calculatedAmount,
          appliedRate: entry.appliedUnitRate || new Prisma.Decimal(0),
          rateType: entry.remunerationMethod,
          rateSource: entry.rateSource,
          carrierType: entry.carrierType,
          workType: entry.workType,
        }
      });

      // Recalculate totals for this open settlement
      await recalculateSettlementTotals(settlement.id, transaction);

    } else {
      // TARGET MONTH IS LOCKED: original period is locked/paid, so we must add a carry-over adjustment in a future open month.
      // Since first-time approval (the WorkEntry did not have any SettlementItem), we only have Case B: Dodatečné schválení.
      const correctionKey = `work-entry-correction:${entry.id}:none:${settlement.id}`;
      const description = `Dodatečně schválená práce z uzamčeného období ${originalYearMonth.year}-${String(originalYearMonth.month).padStart(2, '0')}: ${entry.note || entry.id}`;

      await transaction.settlementAdjustment.upsert({
        where: { correctionKey },
        update: {
          type: 'CARRY_OVER_ADD',
          description,
          amount: entry.calculatedAmount,
          changedByUserId: approvedByUserId,
          reason: 'Dodatečné schválení práce po uzávěrce (aktualizace)',
        },
        create: {
          settlementId: settlement.id,
          type: 'CARRY_OVER_ADD',
          category: 'OTHER',
          description,
          amount: entry.calculatedAmount,
          correctionWorkEntryId: entry.id,
          correctionKey,
          changedByUserId: approvedByUserId,
          reason: 'Dodatečné schválení práce po uzávěrce',
        }
      });

      // Recalculate future open settlement
      await recalculateSettlementTotals(settlement.id, transaction);
    }

    // 5. Update WorkEntry status
    const updated = await transaction.workEntry.update({
      where: { id: entry.id },
      data: {
        status: 'APPROVED',
        rejectionReason: null, // Clear any previous rejection
      }
    });

    return updated;
  };

  if (tx) {
    return await runApproval(tx);
  } else {
    return await runTransactionWithRetry(runApproval);
  }
}

/**
 * Returns a WorkEntry to the worker for correction.
 */
export async function returnWorkEntry(
  workEntryId: string,
  reason: string,
  tx?: Prisma.TransactionClient
) {

  const runReturn = async (transaction: Prisma.TransactionClient) => {
    const entry = await transaction.workEntry.findUnique({
      where: { id: workEntryId }
    });

    if (!entry) {
      throw new Error(`Záznam práce s ID ${workEntryId} nebyl nalezen.`);
    }

    validateWorkEntryTransition(entry.status, 'RETURNED');

    if (!reason.trim()) {
      throw new Error('Pro vrácení práce k opravě musíte vyplnit důvod.');
    }

    const updated = await transaction.workEntry.update({
      where: { id: entry.id },
      data: {
        status: 'RETURNED',
        rejectionReason: reason,
      }
    });

    return updated;
  };

  if (tx) {
    return await runReturn(tx);
  } else {
    return await prisma.$transaction(runReturn, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }
}

export interface WorkEntryCorrectionInput {
  quantity?: Prisma.Decimal | number;
  unitPrice?: Prisma.Decimal | number;
  note?: string;
}

/**
 * Corrects an already approved WorkEntry.
 * - Target settlement is OPEN: modifies the WorkEntry and SettlementItem in-place and recalculates totals.
 * - Target settlement is LOCKED/PAID: leaves original intact, creates a carry-over adjustment in next open settlement.
 */
export async function correctApprovedWorkEntry(
  workEntryId: string,
  params: WorkEntryCorrectionInput,
  reason: string,
  approvedByUserId: string,
  tx?: Prisma.TransactionClient
) {
  const runCorrection = async (transaction: Prisma.TransactionClient) => {
    const entry = await transaction.workEntry.findUnique({
      where: { id: workEntryId },
      include: {
        settlementItem: {
          include: { settlement: true }
        }
      }
    });

    if (!entry) {
      throw new Error(`Záznam práce s ID ${workEntryId} nebyl nalezen.`);
    }

    if (entry.status !== 'APPROVED') {
      throw new Error('Lze opravit pouze již schválené záznamy práce.');
    }

    if (!reason || !reason.trim()) {
      throw new Error('Pro opravu schválené práce je nutné uvést důvod.');
    }

    // Convert values to Prisma.Decimal
    const finalQuantity = params.quantity !== undefined ? new Prisma.Decimal(params.quantity) : entry.quantity;
    const finalUnitPrice = params.unitPrice !== undefined ? new Prisma.Decimal(params.unitPrice) : entry.appliedUnitRate ?? new Prisma.Decimal(0);
    let newAmount = new Prisma.Decimal(0);

    if (entry.remunerationMethod === 'HOURLY' || entry.remunerationMethod === 'TASK') {
      newAmount = finalQuantity.mul(finalUnitPrice);
    } else {
      newAmount = finalUnitPrice;
    }

    const originalSettlementItem = entry.settlementItem;
    if (!originalSettlementItem) {
      throw new Error('Původní schválená práce nemá vazbu na položku vyúčtování.');
    }

    const originalSettlement = originalSettlementItem.settlement;
    if (!originalSettlement) {
      throw new Error('Původní položka vyúčtování nemá vazbu na vyúčtování.');
    }

    if (originalSettlement.status !== 'LOCKED' && originalSettlement.status !== 'PAID') {
      // TARGET SETTLEMENT IS OPEN: update WorkEntry and SettlementItem in-place
      await transaction.workEntry.update({
        where: { id: entry.id },
        data: {
          quantity: finalQuantity,
          appliedUnitRate: finalUnitPrice,
          calculatedAmount: newAmount,
          note: params.note !== undefined ? params.note : entry.note,
        }
      });

      await transaction.settlementItem.update({
        where: { id: originalSettlementItem.id },
        data: {
          quantity: finalQuantity,
          unitPrice: finalUnitPrice,
          appliedRate: finalUnitPrice,
          amount: newAmount,
          note: params.note !== undefined ? params.note : originalSettlementItem.note,
        }
      });

      // Recalculate original open settlement
      await recalculateSettlementTotals(originalSettlement.id, transaction);
      
      return { success: true, originalAmount: entry.calculatedAmount, newAmount, carryOverCreated: false };
    } else {
      // TARGET SETTLEMENT IS LOCKED/PAID: freeze original, create carry-over diff in next open settlement
      const nextOpenSettlement = await getOrCreateSettlement({
        employeeId: entry.employeeId,
        workDate: new Date()
      }, transaction);

      const diff = newAmount.sub(entry.calculatedAmount);
      if (!diff.isZero()) {
        const isPositive = diff.gt(0);
        const type = isPositive ? 'CARRY_OVER_ADD' as const : 'CARRY_OVER_SUB' as const;
        const absDiff = diff.abs();

        const correctionKey = `work-entry-correction:${entry.id}:${originalSettlement.id}:${nextOpenSettlement.id}`;
        const description = `Oprava schválené práce z uzamčeného období ${originalSettlement.periodYear}-${String(originalSettlement.periodMonth).padStart(2, '0')} (původní: ${entry.calculatedAmount} CZK, nová: ${newAmount} CZK): ${reason}`;

        await transaction.settlementAdjustment.upsert({
          where: { correctionKey },
          update: {
            type,
            description,
            amount: absDiff,
            changedByUserId: approvedByUserId,
            reason: `Oprava práce po uzávěrce (aktualizace): ${reason}`,
            note: `Původní částka: ${entry.calculatedAmount.toString()}, Nová částka: ${newAmount.toString()}`,
          },
          create: {
            settlementId: nextOpenSettlement.id,
            type,
            category: 'OTHER',
            description,
            amount: absDiff,
            correctionWorkEntryId: entry.id,
            correctionSettlementItemId: originalSettlementItem.id,
            correctionOriginalSettlementId: originalSettlement.id,
            correctionKey,
            changedByUserId: approvedByUserId,
            reason: `Oprava práce po uzávěrce: ${reason}`,
            note: `Původní částka: ${entry.calculatedAmount.toString()}, Nová částka: ${newAmount.toString()}`,
          }
        });

        // Recalculate future open settlement
        await recalculateSettlementTotals(nextOpenSettlement.id, transaction);
        return { success: true, originalAmount: entry.calculatedAmount, newAmount, carryOverCreated: true, targetSettlementId: nextOpenSettlement.id };
      }
      return { success: true, originalAmount: entry.calculatedAmount, newAmount, carryOverCreated: false };
    }
  };

  if (tx) {
    return await runCorrection(tx);
  } else {
    return await runTransactionWithRetry(runCorrection);
  }
}
