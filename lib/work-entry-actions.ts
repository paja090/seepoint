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
    DRAFT: ['SUBMITTED', 'APPROVED'], // allow approved from draft for admin/manager convenience
    SUBMITTED: ['APPROVED', 'RETURNED'],
    APPROVED: [], // approved is final (until locked/paid at settlement level)
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
      const originalSettlementItem = entry.settlementItem;

      if (originalSettlementItem) {
        // CASE A: Re-approving edited work that already has a SettlementItem in a locked period
        const oldAmount = originalSettlementItem.amount;
        const newAmount = entry.calculatedAmount;
        const diff = newAmount.sub(oldAmount);

        if (!diff.isZero()) {
          const isPositive = diff.gt(0);
          const type = isPositive ? 'CARRY_OVER_ADD' as const : 'CARRY_OVER_SUB' as const;
          const absDiff = diff.abs();

          const correctionKey = `work-entry-correction:${entry.id}:${originalSettlementItem.settlementId}:${settlement.id}`;
          const description = `Oprava odměny (rozdíl) z uzamčeného období ${originalYearMonth.year}-${String(originalYearMonth.month).padStart(2, '0')} za: ${entry.note || entry.id}`;

          await transaction.settlementAdjustment.upsert({
            where: { correctionKey },
            update: {
              type,
              description,
              amount: absDiff,
              changedByUserId: approvedByUserId,
              reason: 'Oprava práce po uzávěrce (aktualizace)',
            },
            create: {
              settlementId: settlement.id,
              type,
              category: 'OTHER',
              description,
              amount: absDiff,
              correctionWorkEntryId: entry.id,
              correctionSettlementItemId: originalSettlementItem.id,
              correctionOriginalSettlementId: originalSettlementItem.settlementId,
              correctionKey,
              changedByUserId: approvedByUserId,
              reason: 'Oprava práce po uzávěrce',
            }
          });

          // Recalculate future open settlement
          await recalculateSettlementTotals(settlement.id, transaction);
        }
      } else {
        // CASE B: First-time approval of work logged in a past locked period
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
