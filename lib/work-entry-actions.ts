import { prisma } from './db';
import { Prisma, WorkEntryStatus } from '@prisma/client';
import { getOrCreateSettlement, getPragueYearMonth } from './settlement-generation';
import { recalculateSettlementTotals } from './settlement-recalculation';
import { runTransactionWithRetry } from './transaction-retry';
import { EDITABLE_SETTLEMENT_STATUSES, FINALIZED_SETTLEMENT_STATUSES } from './settlement-statuses';

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
  options?: {
    reason?: string;
    tx?: Prisma.TransactionClient;
  }
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

    // Server-side authoritative validation and recalculation
    const finalQuantity = entry.quantity;
    const finalUnitPrice = entry.appliedUnitRate;

    if (finalQuantity === null || finalQuantity.lte(0)) {
      throw new Error('Množství musí být větší než 0.');
    }
    if (finalUnitPrice === null || finalUnitPrice.lt(0)) {
      throw new Error('Jednotková sazba musí být vyplněná a nezáporná.');
    }
    if (!entry.workTaskId) {
      throw new Error('Úkol (workTaskId) je povinný.');
    }
    if (!entry.employeeId) {
      throw new Error('ID pracovníka (employeeId) je povinné.');
    }
    if (!entry.remunerationMethod) {
      throw new Error('Typ odměny (remunerationMethod) je povinný.');
    }

    let calculatedServerAmount = new Prisma.Decimal(0);
    if (entry.remunerationMethod === 'HOURLY' || entry.remunerationMethod === 'TASK') {
      calculatedServerAmount = finalQuantity.mul(finalUnitPrice);
    } else {
      calculatedServerAmount = finalUnitPrice;
    }

    if (!calculatedServerAmount.equals(entry.calculatedAmount)) {
      throw new Error('Částka uložená v záznamu neodpovídá serverovému výpočtu.');
    }

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
      if (!options?.reason || !options.reason.trim()) {
        throw new Error('Pro schválení práce po uzávěrce je nutné uvést důvod.');
      }

      // Query the original month's settlement (must exist in DB since it was locked/paid)
      const originalSettlement = await transaction.settlement.findUnique({
        where: {
          employeeId_periodYear_periodMonth: {
            employeeId: entry.employeeId,
            periodYear: originalYearMonth.year,
            periodMonth: originalYearMonth.month,
          }
        }
      });
      if (!originalSettlement) {
        throw new Error('Neočekávaný stav: původní vyúčtování nebylo nalezeno.');
      }

      const correctionKey = `work-entry-correction:${entry.id}:${originalSettlement.id}:${settlement.id}`;
      const description = `Dodatečně schválená práce z uzamčeného období ${originalYearMonth.year}-${String(originalYearMonth.month).padStart(2, '0')}: ${options.reason}`;

      await transaction.settlementAdjustment.upsert({
        where: { correctionKey },
        update: {
          type: 'CARRY_OVER_ADD',
          description,
          amount: entry.calculatedAmount,
          changedByUserId: approvedByUserId,
          reason: `Dodatečné schválení práce po uzávěrce (aktualizace): ${options.reason}`,
        },
        create: {
          settlementId: settlement.id,
          type: 'CARRY_OVER_ADD',
          category: 'OTHER',
          description,
          amount: entry.calculatedAmount,
          correctionWorkEntryId: entry.id,
          correctionOriginalSettlementId: originalSettlement.id,
          correctionKey,
          changedByUserId: approvedByUserId,
          reason: `Dodatečné schválení práce po uzávěrce: ${options.reason}`,
        }
      });

      // Audit log entries
      await transaction.settlementAuditLog.create({
        data: {
          settlementId: originalSettlement.id,
          userId: approvedByUserId,
          userName: approvedByUserId,
          action: 'WORK_ENTRY_LATE_APPROVAL',
          fieldName: 'workEntry',
          oldValue: 'SUBMITTED',
          newValue: 'APPROVED',
          reason: options.reason,
        }
      });

      await transaction.settlementAuditLog.create({
        data: {
          settlementId: settlement.id,
          userId: approvedByUserId,
          userName: approvedByUserId,
          action: 'WORK_ENTRY_LATE_APPROVAL',
          fieldName: 'carryOverAdjustment',
          oldValue: '0',
          newValue: entry.calculatedAmount.toString(),
          reason: options.reason,
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

  const client = options?.tx;
  if (client) {
    return await runApproval(client);
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

    // Convert values to Prisma.Decimal and validate
    const finalQuantity = params.quantity !== undefined ? new Prisma.Decimal(params.quantity) : entry.quantity;
    const finalUnitPrice = params.unitPrice !== undefined ? new Prisma.Decimal(params.unitPrice) : entry.appliedUnitRate ?? new Prisma.Decimal(0);

    if (finalQuantity.lte(0)) {
      throw new Error('Množství musí být větší než 0.');
    }
    if (finalUnitPrice.lt(0)) {
      throw new Error('Jednotková sazba musí být nezáporná.');
    }

    let newAmount = new Prisma.Decimal(0);
    if (entry.remunerationMethod === 'HOURLY' || entry.remunerationMethod === 'TASK') {
      newAmount = finalQuantity.mul(finalUnitPrice);
    } else {
      newAmount = finalUnitPrice;
    }

    if (newAmount.lt(0)) {
      throw new Error('Výsledná částka nesmí být záporná.');
    }

    const originalSettlementItem = entry.settlementItem;
    if (!originalSettlementItem) {
      throw new Error('Původní schválená práce nemá vazbu na položku vyúčtování.');
    }

    const originalSettlement = originalSettlementItem.settlement;
    if (!originalSettlement) {
      throw new Error('Původní položka vyúčtování nemá vazbu na vyúčtování.');
    }

    const isOriginalEditable = EDITABLE_SETTLEMENT_STATUSES.includes(originalSettlement.status);

    if (isOriginalEditable) {
      // TARGET SETTLEMENT IS OPEN: update WorkEntry and SettlementItem in-place
      const oldQuantity = entry.quantity;
      const oldUnitPrice = entry.appliedUnitRate;
      const oldAmount = entry.calculatedAmount;

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

      // Audit log in original settlement
      await transaction.settlementAuditLog.create({
        data: {
          settlementId: originalSettlement.id,
          userId: approvedByUserId,
          userName: approvedByUserId,
          action: 'WORK_ENTRY_CORRECTION',
          fieldName: 'workEntry',
          oldValue: JSON.stringify({
            quantity: oldQuantity?.toString() ?? '0',
            unitPrice: oldUnitPrice?.toString() ?? '0',
            amount: oldAmount?.toString() ?? '0',
          }),
          newValue: JSON.stringify({
            quantity: finalQuantity?.toString() ?? '0',
            unitPrice: finalUnitPrice?.toString() ?? '0',
            amount: newAmount?.toString() ?? '0',
          }),
          reason,
        }
      });

      // Recalculate original open settlement
      await recalculateSettlementTotals(originalSettlement.id, transaction);
      
      return { success: true, originalAmount: entry.calculatedAmount, newAmount, carryOverCreated: false };
    } else {
      // TARGET SETTLEMENT IS LOCKED/PAID/REJECTED (NOT EDITABLE): freeze original, create/edit carry-over diff in next open settlement
      const nextOpenSettlement = await getOrCreateSettlement({
        employeeId: entry.employeeId,
        workDate: new Date()
      }, transaction);

      // Find all adjustments in LOCKED/PAID settlements for this work entry
      const adjustments = await transaction.settlementAdjustment.findMany({
        where: {
          correctionWorkEntryId: entry.id,
          settlement: {
            status: { in: FINALIZED_SETTLEMENT_STATUSES }
          }
        }
      });

      let lastLockedEffectiveAmount = new Prisma.Decimal(originalSettlementItem.amount);
      for (const adj of adjustments) {
        if (adj.type === 'CARRY_OVER_ADD') {
          lastLockedEffectiveAmount = lastLockedEffectiveAmount.add(adj.amount);
        } else if (adj.type === 'CARRY_OVER_SUB') {
          lastLockedEffectiveAmount = lastLockedEffectiveAmount.sub(adj.amount);
        }
      }

      const diff = newAmount.sub(lastLockedEffectiveAmount);
      const correctionKey = `work-entry-correction:${entry.id}:${originalSettlement.id}:${nextOpenSettlement.id}`;

      if (diff.isZero()) {
        // If the difference is zero, delete the adjustment in the current open settlement if it exists
        const existingOpenAdjustment = await transaction.settlementAdjustment.findFirst({
          where: {
            correctionKey,
            settlement: {
              status: { in: EDITABLE_SETTLEMENT_STATUSES }
            }
          }
        });

        if (existingOpenAdjustment) {
          await transaction.settlementAdjustment.delete({
            where: { id: existingOpenAdjustment.id }
          });

          // Audit the removal on the target settlement
          await transaction.settlementAuditLog.create({
            data: {
              settlementId: nextOpenSettlement.id,
              userId: approvedByUserId,
              userName: approvedByUserId,
              action: 'WORK_ENTRY_CORRECTION_DELETE',
              fieldName: 'carryOverAdjustment',
              oldValue: existingOpenAdjustment.amount.toString(),
              newValue: '0',
              reason: `Korekční položka odstraněna (rozdíl vůči baseline je 0): ${reason}`,
            }
          });

          // Recalculate target open settlement
          await recalculateSettlementTotals(nextOpenSettlement.id, transaction);
          return { success: true, originalAmount: lastLockedEffectiveAmount, newAmount, carryOverCreated: false, carryOverDeleted: true };
        }
      } else {
        const isPositive = diff.gt(0);
        const type = isPositive ? 'CARRY_OVER_ADD' as const : 'CARRY_OVER_SUB' as const;
        const absDiff = diff.abs();

        const description = `Oprava schválené práce z uzamčeného období ${originalSettlement.periodYear}-${String(originalSettlement.periodMonth).padStart(2, '0')} (původní efektivní: ${lastLockedEffectiveAmount} CZK, nová: ${newAmount} CZK): ${reason}`;

        await transaction.settlementAdjustment.upsert({
          where: { correctionKey },
          update: {
            type,
            description,
            amount: absDiff,
            changedByUserId: approvedByUserId,
            reason: `Oprava práce po uzávěrce (aktualizace): ${reason}`,
            previousEffectiveAmount: lastLockedEffectiveAmount,
            correctedEffectiveAmount: newAmount,
            correctedQuantity: finalQuantity,
            correctedUnitRate: finalUnitPrice,
            correctedNote: params.note !== undefined ? params.note : null,
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
            previousEffectiveAmount: lastLockedEffectiveAmount,
            correctedEffectiveAmount: newAmount,
            correctedQuantity: finalQuantity,
            correctedUnitRate: finalUnitPrice,
            correctedNote: params.note !== undefined ? params.note : null,
          }
        });

        // Audit log in original settlement
        await transaction.settlementAuditLog.create({
          data: {
            settlementId: originalSettlement.id,
            userId: approvedByUserId,
            userName: approvedByUserId,
            action: 'WORK_ENTRY_CORRECTION',
            fieldName: 'workEntry',
            oldValue: JSON.stringify({
              quantity: originalSettlementItem.quantity?.toString() ?? '0',
              unitPrice: originalSettlementItem.unitPrice?.toString() ?? '0',
              amount: lastLockedEffectiveAmount?.toString() ?? '0',
            }),
            newValue: JSON.stringify({
              quantity: finalQuantity?.toString() ?? '0',
              unitPrice: finalUnitPrice?.toString() ?? '0',
              amount: newAmount?.toString() ?? '0',
            }),
            reason: `Carry-over do období ${nextOpenSettlement.periodYear}-${String(nextOpenSettlement.periodMonth).padStart(2, '0')}: ${reason}`,
          }
        });

        // Audit log in target settlement
        await transaction.settlementAuditLog.create({
          data: {
            settlementId: nextOpenSettlement.id,
            userId: approvedByUserId,
            userName: approvedByUserId,
            action: 'WORK_ENTRY_CORRECTION',
            fieldName: 'carryOverAdjustment',
            oldValue: '0',
            newValue: absDiff.toString(),
            reason,
          }
        });

        // Recalculate future open settlement
        await recalculateSettlementTotals(nextOpenSettlement.id, transaction);
        return { success: true, originalAmount: lastLockedEffectiveAmount, newAmount, carryOverCreated: true, targetSettlementId: nextOpenSettlement.id };
      }
      return { success: true, originalAmount: lastLockedEffectiveAmount, newAmount, carryOverCreated: false };
    }
  };

  if (tx) {
    return await runCorrection(tx);
  } else {
    return await runTransactionWithRetry(runCorrection);
  }
}
