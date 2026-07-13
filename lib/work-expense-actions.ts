import { prisma } from './db';
import { Prisma } from '@prisma/client';
import { getOrCreateSettlement } from './settlement-generation';
import { recalculateSettlementTotals } from './settlement-recalculation';

/**
 * Approves a WorkExpense. Creates the corresponding SettlementAdjustment.
 * Handled in serializable transaction to prevent race conditions.
 */
export async function approveWorkExpense(
  workExpenseId: string,
  approvedByUserId: string,
  tx?: Prisma.TransactionClient
) {

  const runApproval = async (transaction: Prisma.TransactionClient) => {
    // 1. Fetch the WorkExpense with its WorkEntry
    const expense = await transaction.workExpense.findUnique({
      where: { id: workExpenseId },
      include: {
        workEntry: true,
      },
    });

    if (!expense) {
      throw new Error(`Výdaj s ID ${workExpenseId} nebyl nalezen.`);
    }

    if (expense.status === 'APPROVED') {
      return expense; // already approved, idempotency
    }

    // 2. Fetch/Create the Settlement (handling locks)
    const settlement = await getOrCreateSettlement(
      {
        employeeId: expense.workEntry.employeeId,
        workDate: expense.workEntry.workDate,
      },
      transaction
    );

    // Map ExpenseType to AdjustmentCategory
    const categoryMap: Record<string, 'FUEL' | 'PARKING' | 'PURCHASE' | 'OTHER'> = {
      FUEL: 'FUEL',
      PARKING: 'PARKING',
      PURCHASE: 'PURCHASE',
      OTHER: 'OTHER',
    };
    const category = categoryMap[expense.type] || 'OTHER';

    // 3. Upsert the SettlementAdjustment. Unique constraint is workExpenseId
    await transaction.settlementAdjustment.upsert({
      where: { workExpenseId: expense.id },
      create: {
        settlementId: settlement.id,
        workExpenseId: expense.id,
        type: 'REIMBURSEMENT',
        category,
        description: `Náhrada výdaje (${expense.type}): ${expense.description}`,
        amount: expense.amount,
        changedByUserId: approvedByUserId,
        reason: 'Schválení pracovního výdaje',
      },
      update: {
        settlementId: settlement.id,
        amount: expense.amount,
        category,
        description: `Náhrada výdaje (${expense.type}): ${expense.description}`,
      },
    });

    // 4. Update the WorkExpense status
    const updated = await transaction.workExpense.update({
      where: { id: expense.id },
      data: {
        status: 'APPROVED',
        approvedByUserId,
        approvedAt: new Date(),
        rejectionReason: null,
      },
    });

    // 5. Recalculate the settlement totals
    await recalculateSettlementTotals(settlement.id, transaction);

    return updated;
  };

  if (tx) {
    return await runApproval(tx);
  } else {
    return await prisma.$transaction(runApproval, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}

/**
 * Rejects a WorkExpense with a reason.
 */
export async function rejectWorkExpense(
  workExpenseId: string,
  reason: string,
  approvedByUserId: string,
  tx?: Prisma.TransactionClient
) {

  const runRejection = async (transaction: Prisma.TransactionClient) => {
    const expense = await transaction.workExpense.findUnique({
      where: { id: workExpenseId },
      include: {
        workEntry: true,
      },
    });

    if (!expense) {
      throw new Error(`Výdaj s ID ${workExpenseId} nebyl nalezen.`);
    }

    if (expense.status === 'APPROVED') {
      throw new Error('Nelze zamítnout již schválený výdaj.');
    }

    if (!reason.trim()) {
      throw new Error('Pro zamítnutí výdaje musíte vyplnit důvod.');
    }

    // Update status
    const updated = await transaction.workExpense.update({
      where: { id: expense.id },
      data: {
        status: 'REJECTED',
        approvedByUserId,
        approvedAt: new Date(),
        rejectionReason: reason,
      },
    });

    return updated;
  };

  if (tx) {
    return await runRejection(tx);
  } else {
    return await prisma.$transaction(runRejection, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}
