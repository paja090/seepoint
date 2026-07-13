import { prisma } from './db';
import { Prisma, Settlement } from '@prisma/client';

export function getPragueYearMonth(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: 'numeric',
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find(p => p.type === 'month')!.value, 10);
  return { year, month };
}

function getLastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getPragueOffsetMinutes(date: Date): number {
  const pragueStr = date.toLocaleString('en-US', { timeZone: 'Europe/Prague', hour12: false });
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
  const pDate = new Date(pragueStr);
  const uDate = new Date(utcStr);
  return (pDate.getTime() - uDate.getTime()) / 60000;
}

function convertPragueToUtc(localIsoWithoutZ: string): Date {
  const utcDate = new Date(localIsoWithoutZ + 'Z');
  const offsetMin = getPragueOffsetMinutes(utcDate);
  return new Date(utcDate.getTime() - offsetMin * 60000);
}

export function getPragueMonthRange(year: number, month: number) {
  const lastDay = getLastDayOfMonth(year, month);
  const fromStr = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000`;
  const toStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999`;

  const periodFrom = convertPragueToUtc(fromStr);
  const periodTo = convertPragueToUtc(toStr);

  return { periodFrom, periodTo };
}

/**
 * Finds or safely creates a Settlement period for an employee.
 * Handles locking rules: if the period corresponding to the workDate is locked or paid,
 * it returns the earliest non-locked/non-paid settlement that is not before the target period.
 * If none exists in the future, it consecutivelly creates the next open period.
 */
export async function getOrCreateSettlement(
  params: {
    employeeId: string;
    workDate: Date;
  },
  tx?: Prisma.TransactionClient
): Promise<Settlement> {
  const { employeeId, workDate } = params;
  const client = tx || prisma;

  // 1. Get Prague components of workDate
  const { year: targetYear, month: targetMonth } = getPragueYearMonth(workDate);

  // 2. Query target settlement
  const targetSettlement = await client.settlement.findUnique({
    where: {
      employeeId_periodYear_periodMonth: {
        employeeId,
        periodYear: targetYear,
        periodMonth: targetMonth,
      },
    },
  });

  // 3. If target settlement exists and is NOT locked or paid, return it!
  if (targetSettlement && targetSettlement.status !== 'LOCKED' && targetSettlement.status !== 'PAID') {
    return targetSettlement;
  }

  // 4. If target settlement is locked/paid, search for the nearest open period in the future
  if (targetSettlement) {
    const openSettlements = await client.settlement.findMany({
      where: {
        employeeId,
        status: { notIn: ['LOCKED', 'PAID'] },
        OR: [
          { periodYear: { gt: targetYear } },
          {
            periodYear: targetYear,
            periodMonth: { gte: targetMonth },
          },
        ],
      },
      orderBy: [
        { periodYear: 'asc' },
        { periodMonth: 'asc' },
      ],
      take: 1,
    });

    if (openSettlements.length > 0) {
      return openSettlements[0];
    }

    // No future open settlement exists. We must safely generate the next consecutive open month!
    let nextYear = targetYear;
    let nextMonth = targetMonth + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    // Keep checking consecutive months in case they were pre-created and locked (unlikely but safe)
    while (true) {
      const existing = await client.settlement.findUnique({
        where: {
          employeeId_periodYear_periodMonth: {
            employeeId,
            periodYear: nextYear,
            periodMonth: nextMonth,
          },
        },
      });

      if (!existing) {
        // Create new open month
        const { periodFrom, periodTo } = getPragueMonthRange(nextYear, nextMonth);
        const newSettlement = await client.settlement.create({
          data: {
            employeeId,
            periodFrom,
            periodTo,
            periodYear: nextYear,
            periodMonth: nextMonth,
            status: 'DRAFT',
          },
        });
        
        // Auto-add any active RecurringAdjustments for this employee
        await applyRecurringAdjustments(newSettlement.id, employeeId, periodFrom, periodTo, client);
        return newSettlement;
      }

      if (existing.status !== 'LOCKED' && existing.status !== 'PAID') {
        return existing;
      }

      // If it is locked/paid, increment and check next
      nextMonth += 1;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
    }
  }

  // 5. Target settlement did not exist at all, safely create it!
  const { periodFrom, periodTo } = getPragueMonthRange(targetYear, targetMonth);
  const newSettlement = await client.settlement.create({
    data: {
      employeeId,
      periodFrom,
      periodTo,
      periodYear: targetYear,
      periodMonth: targetMonth,
      status: 'DRAFT',
    },
  });

  // Auto-add active RecurringAdjustments
  await applyRecurringAdjustments(newSettlement.id, employeeId, periodFrom, periodTo, client);
  return newSettlement;
}

/**
 * Auto-applies active RecurringAdjustments to a new Settlement period.
 */
async function applyRecurringAdjustments(
  settlementId: string,
  employeeId: string,
  periodFrom: Date,
  periodTo: Date,
  client: Prisma.TransactionClient
) {
  const activeRecs = await client.recurringAdjustment.findMany({
    where: {
      employeeId,
      isActive: true,
      validFrom: { lte: periodTo },
      OR: [
        { validTo: null },
        { validTo: { gte: periodFrom } },
      ],
    },
  });

  for (const rec of activeRecs) {
    await client.settlementAdjustment.create({
      data: {
        settlementId,
        recurringAdjustmentId: rec.id,
        type: rec.type,
        category: rec.category,
        description: rec.description,
        amount: rec.amount,
      },
    });
  }
}
