import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { EDITABLE_SETTLEMENT_STATUSES } from './settlement-statuses';

/**
 * Recalculates all sum fields of a monthly Settlement inside a transaction.
 * Sources of truth: SettlementItem and SettlementAdjustment.
 * All amounts are computed using Prisma.Decimal to prevent JS float precision errors.
 */
export async function recalculateSettlementTotals(settlementId: string, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;

  // 1. Fetch settlement, items and adjustments in a transaction
  const settlement = await client.settlement.findUnique({
    where: { id: settlementId },
    include: {
      items: true,
      adjustments: true,
    },
  });

  if (!settlement) {
    throw new Error(`Settlement with ID ${settlementId} not found.`);
  }

  // Prevents modifying totals if not in editable status (integrity rule)
  if (settlement.status && !EDITABLE_SETTLEMENT_STATUSES.includes(settlement.status)) {
    throw new Error('Nelze přepočítat uzamčené, zaplacené nebo zamítnuté vyúčtování.');
  }

  let totalWorkAmount = new Prisma.Decimal(0);
  let totalReimbursements = new Prisma.Decimal(0);
  let totalDeductions = new Prisma.Decimal(0);
  let totalAdvances = new Prisma.Decimal(0);

  // 2. Sum up work entries (items)
  for (const item of settlement.items) {
    totalWorkAmount = totalWorkAmount.add(item.amount);
  }

  // 3. Sum up adjustments (reimbursements, additions, deductions, advances)
  for (const adj of settlement.adjustments) {
    const amt = adj.amount; // always stored as positive in DB
    if (adj.type === 'REIMBURSEMENT' || adj.type === 'BONUS' || adj.type === 'CARRY_OVER_ADD') {
      totalReimbursements = totalReimbursements.add(amt);
    } else if (adj.type === 'DEDUCTION' || adj.type === 'CARRY_OVER_SUB') {
      totalDeductions = totalDeductions.add(amt);
    } else if (adj.type === 'ADVANCE') {
      totalAdvances = totalAdvances.add(amt);
    }
  }

  // 4. Calculate final payable amount: Work + Reimbursements - Deductions - Advances
  const finalPayableAmount = totalWorkAmount
    .add(totalReimbursements)
    .sub(totalDeductions)
    .sub(totalAdvances);

  // 5. Update the Settlement totals snapshot
  await client.settlement.update({
    where: { id: settlementId },
    data: {
      totalWorkAmount,
      totalReimbursements,
      totalDeductions,
      totalAdvances,
      finalPayableAmount,
      totalAmount: finalPayableAmount, // Compatibility with legacy field
    },
  });

  return {
    totalWorkAmount,
    totalReimbursements,
    totalDeductions,
    totalAdvances,
    finalPayableAmount,
  };
}
