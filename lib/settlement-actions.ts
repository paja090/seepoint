import { prisma } from './db';
import { Prisma, Settlement, AdjustmentCategory } from '@prisma/client';
import { EDITABLE_SETTLEMENT_STATUSES, FINALIZED_SETTLEMENT_STATUSES } from './settlement-statuses';
import { recalculateSettlementTotals } from './settlement-recalculation';

export function validateReason(reason: string | undefined, defaultMessage?: string, minLen = 5): string {
  const trimmed = (reason || '').trim();
  if (!trimmed) {
    throw new Error(defaultMessage || 'Důvod je povinný a nesmí obsahovat pouze prázdné znaky.');
  }
  if (trimmed.length < minLen) {
    throw new Error(`Důvod je příliš krátký (musí mít alespoň ${minLen} znaků).`);
  }
  if (trimmed.length > 500) {
    throw new Error('Důvod je příliš dlouhý (maximálně 500 znaků).');
  }
  return trimmed;
}

async function runInTx<T>(
  tx: Prisma.TransactionClient | undefined,
  op: (transaction: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (tx) {
    return await op(tx);
  } else {
    return await prisma.$transaction(op, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }
}

export async function submitSettlement(
  settlementId: string,
  actor: { id: string; email: string; role: string },
  tx?: Prisma.TransactionClient
): Promise<Settlement> {
  return await runInTx(tx, async (transaction: Prisma.TransactionClient) => {
    const settlement = await transaction.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new Error(`Vyúčtování s ID ${settlementId} nebylo nalezeno.`);
    }

    // Role check
    if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
      const employee = await transaction.employee.findFirst({
        where: { OR: [{ userId: actor.id }, { email: actor.email }] },
      });
      if (!employee || settlement.employeeId !== employee.id) {
        throw new Error('Nemáte oprávnění odeslat toto vyúčtování.');
      }
    }

    if (settlement.status === 'SUBMITTED') {
      return settlement; // Idempotency
    }

    if (settlement.status !== 'DRAFT' && settlement.status !== 'REJECTED') {
      throw new Error(`Neplatný přechod stavu. Vyúčtování je ve stavu ${settlement.status}.`);
    }

    // Create Audit Log
    await transaction.settlementAuditLog.create({
      data: {
        settlementId,
        userId: actor.id,
        userName: actor.email,
        action: 'STATUS_CHANGE',
        fieldName: 'status',
        oldValue: settlement.status,
        newValue: 'SUBMITTED',
        reason: 'Odeslání vyúčtování ke schválení',
      },
    });

    // Update status
    const updated = await transaction.settlement.update({
      where: { id: settlementId },
      data: { status: 'SUBMITTED' },
    });

    return updated;
  });
}

export async function approveSettlement(
  settlementId: string,
  actor: { id: string; email: string; role: string },
  tx?: Prisma.TransactionClient
): Promise<Settlement> {
  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    throw new Error('Pouze manažer nebo administrátor může schválit vyúčtování.');
  }

  return await runInTx(tx, async (transaction: Prisma.TransactionClient) => {
    const settlement = await transaction.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new Error(`Vyúčtování s ID ${settlementId} nebylo nalezeno.`);
    }

    if (settlement.status === 'APPROVED') {
      return settlement; // Idempotency
    }

    if (settlement.status !== 'SUBMITTED') {
      throw new Error(`Neplatný přechod stavu. Vyúčtování je ve stavu ${settlement.status}.`);
    }

    // Create Audit Log
    await transaction.settlementAuditLog.create({
      data: {
        settlementId,
        userId: actor.id,
        userName: actor.email,
        action: 'STATUS_CHANGE',
        fieldName: 'status',
        oldValue: settlement.status,
        newValue: 'APPROVED',
        reason: 'Schválení vyúčtování',
      },
    });

    // Update status
    const updated = await transaction.settlement.update({
      where: { id: settlementId },
      data: { status: 'APPROVED' },
    });

    return updated;
  });
}

export async function rejectSettlement(
  settlementId: string,
  reason: string,
  actor: { id: string; email: string; role: string },
  tx?: Prisma.TransactionClient
): Promise<Settlement> {
  const cleanReason = validateReason(reason);

  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    throw new Error('Pouze manažer nebo administrátor může zamítnout vyúčtování.');
  }

  return await runInTx(tx, async (transaction: Prisma.TransactionClient) => {
    const settlement = await transaction.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new Error(`Vyúčtování s ID ${settlementId} nebylo nalezeno.`);
    }

    if (settlement.status === 'REJECTED') {
      return settlement; // Idempotency
    }

    if (settlement.status !== 'SUBMITTED') {
      throw new Error(`Neplatný přechod stavu. Vyúčtování je ve stavu ${settlement.status}.`);
    }

    // Create Audit Log
    await transaction.settlementAuditLog.create({
      data: {
        settlementId,
        userId: actor.id,
        userName: actor.email,
        action: 'STATUS_CHANGE',
        fieldName: 'status',
        oldValue: settlement.status,
        newValue: 'REJECTED',
        reason: cleanReason,
      },
    });

    // Update status and note
    const updated = await transaction.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'REJECTED',
        note: `Zamítnuto: ${cleanReason}`,
      },
    });

    return updated;
  });
}

export async function lockSettlement(
  settlementId: string,
  actor: { id: string; email: string; role: string },
  tx?: Prisma.TransactionClient
): Promise<Settlement> {
  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    throw new Error('Pouze manažer nebo administrátor může uzamknout vyúčtování.');
  }

  return await runInTx(tx, async (transaction: Prisma.TransactionClient) => {
    // 1. Fetch settlement, items, and adjustments
    const settlement = await transaction.settlement.findUnique({
      where: { id: settlementId },
      include: {
        items: true,
        adjustments: true,
      },
    });

    if (!settlement) {
      throw new Error(`Vyúčtování s ID ${settlementId} nebylo nalezeno.`);
    }

    if (settlement.status === 'LOCKED') {
      return settlement; // Idempotency
    }

    if (settlement.status !== 'APPROVED') {
      throw new Error(`Neplatný přechod stavu. Vyúčtování je ve stavu ${settlement.status}.`);
    }

    // 2. Validate valid items are present
    if (settlement.items.length === 0 && settlement.adjustments.length === 0) {
      throw new Error('Nelze uzamknout prázdné vyúčtování bez položek nebo korekcí.');
    }

    // 3. Check for unresolved or unapproved items in the same period
    const unresolvedEntries = await transaction.workEntry.findMany({
      where: {
        employeeId: settlement.employeeId,
        workDate: {
          gte: settlement.periodFrom,
          lte: settlement.periodTo,
        },
        status: { in: ['DRAFT', 'SUBMITTED', 'RETURNED'] },
      },
    });

    if (unresolvedEntries.length > 0) {
      throw new Error(`Nelze uzamknout vyúčtování, protože v daném období existuje ${unresolvedEntries.length} neschválených záznamů práce.`);
    }

    // 4. Check for unresolved or unapproved expenses in the same period
    const unresolvedExpenses = await transaction.workExpense.findMany({
      where: {
        workEntry: {
          employeeId: settlement.employeeId,
          workDate: {
            gte: settlement.periodFrom,
            lte: settlement.periodTo,
          },
        },
        status: 'PENDING',
      },
    });

    if (unresolvedExpenses.length > 0) {
      throw new Error(`Nelze uzamknout vyúčtování, protože v daném období existuje ${unresolvedExpenses.length} neschválených výdajů.`);
    }

    // 5. Ensure totals are calculated and consistent
    await recalculateSettlementTotals(settlementId, transaction);

    // 6. Check that period is not locked by another active settlement
    const duplicateLock = await transaction.settlement.findFirst({
      where: {
        employeeId: settlement.employeeId,
        periodYear: settlement.periodYear,
        periodMonth: settlement.periodMonth,
        status: { in: FINALIZED_SETTLEMENT_STATUSES },
        id: { not: settlementId },
      },
    });

    if (duplicateLock) {
      throw new Error('Toto období je již uzamčeno jiným vyúčtováním.');
    }

    // Create Audit Log
    await transaction.settlementAuditLog.create({
      data: {
        settlementId,
        userId: actor.id,
        userName: actor.email,
        action: 'STATUS_CHANGE',
        fieldName: 'status',
        oldValue: settlement.status,
        newValue: 'LOCKED',
        reason: 'Uzamčení období vyúčtování',
      },
    });

    // Update status
    const updated = await transaction.settlement.update({
      where: { id: settlementId },
      data: { status: 'LOCKED' },
    });

    return updated;
  });
}

export async function paySettlement(
  settlementId: string,
  actor: { id: string; email: string; role: string },
  tx?: Prisma.TransactionClient
): Promise<Settlement> {
  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    throw new Error('Pouze manažer nebo administrátor může označit vyúčtování jako vyplacené.');
  }

  return await runInTx(tx, async (transaction: Prisma.TransactionClient) => {
    const settlement = await transaction.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      throw new Error(`Vyúčtování s ID ${settlementId} nebylo nalezeno.`);
    }

    if (settlement.status === 'PAID') {
      return settlement; // Idempotency
    }

    if (settlement.status !== 'LOCKED') {
      throw new Error(`Neplatný přechod stavu. Vyúčtování je ve stavu ${settlement.status}.`);
    }

    // Create Audit Log
    await transaction.settlementAuditLog.create({
      data: {
        settlementId,
        userId: actor.id,
        userName: actor.email,
        action: 'STATUS_CHANGE',
        fieldName: 'status',
        oldValue: settlement.status,
        newValue: 'PAID',
        reason: 'Označení vyúčtování jako vyplacené',
      },
    });

    // Update status
    const updated = await transaction.settlement.update({
      where: { id: settlementId },
      data: { status: 'PAID' },
    });

    return updated;
  });
}

export async function addManualAdjustment(
  params: {
    settlementId: string;
    amount: string | number;
    description: string;
    reason: string;
    category?: string;
  },
  actor: { id: string; email: string; role: string },
  tx?: Prisma.TransactionClient
) {
  const cleanDescription = (params.description || '').trim();
  const cleanReason = validateReason(params.reason);

  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    throw new Error('Nemáte oprávnění přidat korekci.');
  }

  if (!cleanDescription) throw new Error('Popis korekce je povinný.');
  if (cleanDescription.length > 250) throw new Error('Popis korekce je příliš dlouhý (maximálně 250 znaků).');
  if (typeof params.category !== 'undefined' && !Object.values(AdjustmentCategory).includes(params.category as AdjustmentCategory)) {
    throw new Error('Kategorie korekce není platná.');
  }
  const rawAmount = String(params.amount).trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(rawAmount)) throw new Error('Částka korekce musí být platné číslo s nejvýše 2 desetinnými místy.');
  const signedAmount = new Prisma.Decimal(rawAmount);
  if (signedAmount.abs().gt('9999999999.99')) throw new Error('Částka korekce překračuje povolený rozsah.');
  if (signedAmount.isZero()) {
    throw new Error('Částka korekce nesmí být nulová.');
  }

  return await runInTx(tx, async (transaction: Prisma.TransactionClient) => {
    const settlement = await transaction.settlement.findUnique({
      where: { id: params.settlementId },
    });

    if (!settlement) {
      throw new Error(`Vyúčtování s ID ${params.settlementId} nebylo nalezeno.`);
    }

    if (!EDITABLE_SETTLEMENT_STATUSES.includes(settlement.status)) {
      throw new Error('Korekci lze přidat pouze do otevřeného vyúčtování.');
    }

    const type = signedAmount.gt(0) ? 'BONUS' : 'DEDUCTION';
    const absAmount = signedAmount.abs();
    const finalCategory = (params.category || 'OTHER') as AdjustmentCategory;

    const adjustment = await transaction.settlementAdjustment.create({
      data: {
        settlementId: params.settlementId,
        type,
        category: finalCategory,
        description: cleanDescription,
        amount: absAmount,
        reason: cleanReason,
        changedByUserId: actor.id,
      },
    });

    // Create Audit Log
    await transaction.settlementAuditLog.create({
      data: {
        settlementId: params.settlementId,
        userId: actor.id,
        userName: actor.email,
        action: 'ADJUSTMENT_ADD',
        fieldName: 'amount',
        oldValue: null,
        newValue: `${signedAmount.toFixed(2)} CZK (${type})`,
        reason: cleanReason,
      },
    });

    // Recalculate totals
    await recalculateSettlementTotals(params.settlementId, transaction);

    return adjustment;
  });
}

export async function deleteManualAdjustment(
  adjustmentId: string,
  reason: string,
  actor: { id: string; email: string; role: string },
  tx?: Prisma.TransactionClient
) {
  const cleanReason = validateReason(reason);

  if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
    throw new Error('Nemáte oprávnění smazat korekci.');
  }

  return await runInTx(tx, async (transaction: Prisma.TransactionClient) => {
    const adjustment = await transaction.settlementAdjustment.findUnique({
      where: { id: adjustmentId },
      include: { settlement: true },
    });

    if (!adjustment) {
      throw new Error(`Korekce s ID ${adjustmentId} nebyla nalezena.`);
    }

    if (!EDITABLE_SETTLEMENT_STATUSES.includes(adjustment.settlement.status)) {
      throw new Error('Korekci lze smazat pouze z otevřeného vyúčtování.');
    }

    // Create Audit Log
    await transaction.settlementAuditLog.create({
      data: {
        settlementId: adjustment.settlementId,
        userId: actor.id,
        userName: actor.email,
        action: 'ADJUSTMENT_DELETE',
        fieldName: 'amount',
        oldValue: `${adjustment.amount.toString()} CZK (${adjustment.type})`,
        newValue: null,
        reason: cleanReason,
      },
    });

    await transaction.settlementAdjustment.delete({
      where: { id: adjustmentId },
    });

    // Recalculate totals
    await recalculateSettlementTotals(adjustment.settlementId, transaction);
  });
}
