/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { selectRateAtDate } from '../lib/rate-selection.ts';
import { getPragueYearMonth, getPragueMonthRange } from '../lib/settlement-generation.ts';
import { recalculateSettlementTotals } from '../lib/settlement-recalculation.ts';
import { validateWorkEntryTransition, approveWorkEntry } from '../lib/work-entry-actions.ts';
import { approveWorkExpense } from '../lib/work-expense-actions.ts';

const dec = (val: string | number) => new Prisma.Decimal(val);

test('1. Rate Selection Priority with carrierType specific matches', () => {
  // Test that selectRateAtDate prioritizes carrierType and workType correctly:
  // 1. workType (specific) + carrierType (specific)
  // 2. workType (specific) + carrierType (null)
  // 3. workType (null) + carrierType (specific)
  // 4. workType (null) + carrierType (null)
  
  const rates = [
    { id: '1', workType: 'INSTALLATION', carrierType: 'BILLBOARD', amount: dec('500.00'), validFrom: new Date('2026-01-01'), validTo: null },
    { id: '2', workType: 'INSTALLATION', carrierType: null, amount: dec('400.00'), validFrom: new Date('2026-01-01'), validTo: null },
    { id: '3', workType: null, carrierType: 'BILLBOARD', amount: dec('300.00'), validFrom: new Date('2026-01-01'), validTo: null },
    { id: '4', workType: null, carrierType: null, amount: dec('200.00'), validFrom: new Date('2026-01-01'), validTo: null }
  ];

  const date = new Date('2026-06-01');

  // Match specific+specific
  const r1 = selectRateAtDate(rates, 'INSTALLATION', 'BILLBOARD', date);
  assert.equal(r1?.id, '1');
  assert.equal(r1?.amount.toFixed(2), '500.00');

  // Match specific+null (when carrierType is different and no specific exists)
  const r2 = selectRateAtDate(rates, 'INSTALLATION', 'CITYLIGHT', date);
  assert.equal(r2?.id, '2');
  assert.equal(r2?.amount.toFixed(2), '400.00');

  // Match null+specific (when workType is different and no specific workType rate exists)
  const r3 = selectRateAtDate(rates, 'REPAIR', 'BILLBOARD', date);
  assert.equal(r3?.id, '3');
  assert.equal(r3?.amount.toFixed(2), '300.00');

  // Fallback to general (both null)
  const r4 = selectRateAtDate(rates, 'REPAIR', 'CITYLIGHT', date);
  assert.equal(r4?.id, '4');
  assert.equal(r4?.amount.toFixed(2), '200.00');
});

test('2. Time Zone month assignment (Europe/Prague boundaries)', () => {
  // Test Prague local hour shifts for summer / winter months:
  // Summer transition boundary: 2026-06-30 23:30:00 UTC is 2026-07-01 01:30:00 in Prague
  const dateSummer = new Date('2026-06-30T23:30:00Z');
  const ymSummer = getPragueYearMonth(dateSummer);
  assert.equal(ymSummer.year, 2026);
  assert.equal(ymSummer.month, 7); // July

  // Winter boundary check: 2026-10-31 22:30:00 UTC is 2026-10-31 23:30:00 in Prague (offset +1)
  const dateWinter = new Date('2026-10-31T22:30:00Z');
  const ymWinter = getPragueYearMonth(dateWinter);
  assert.equal(ymWinter.year, 2026);
  assert.equal(ymWinter.month, 10); // October

  // Verify Month Ranges computed in UTC
  const ranges = getPragueMonthRange(2026, 7);
  // July 1st 00:00 Prague time is June 30th 22:00:00 UTC (summer offset +2)
  assert.equal(ranges.periodFrom.toISOString(), '2026-06-30T22:00:00.000Z');
  // July 31st 23:59:59.999 Prague time is July 31st 21:59:59.999 UTC
  assert.equal(ranges.periodTo.toISOString(), '2026-07-31T21:59:59.999Z');
});

test('3. Recalculation logic for Settlements totals', async () => {
  // Mock data for recalculating totals
  const mockSettlement = {
    id: 'set-1',
    status: 'DRAFT',
    items: [
      { id: 'item-1', amount: dec('1500.00') },
      { id: 'item-2', amount: dec('2500.00') }
    ],
    adjustments: [
      { id: 'adj-1', type: 'BONUS', amount: dec('500.00') }, // reimbursement/addition
      { id: 'adj-2', type: 'REIMBURSEMENT', amount: dec('120.00') }, // reimbursement/addition
      { id: 'adj-3', type: 'DEDUCTION', amount: dec('300.00') }, // deduction
      { id: 'adj-4', type: 'ADVANCE', amount: dec('1000.00') } // advance
    ]
  };

  const mockTx = {
    settlement: {
      findUnique: async () => mockSettlement,
      update: async (args: any) => {
        // Assert sum values inside database update payload
        assert.equal(args.data.totalWorkAmount.toFixed(2), '4000.00'); // 1500 + 2500
        assert.equal(args.data.totalReimbursements.toFixed(2), '620.00'); // 500 + 120
        assert.equal(args.data.totalDeductions.toFixed(2), '300.00'); // 300
        assert.equal(args.data.totalAdvances.toFixed(2), '1000.00'); // 1000
        assert.equal(args.data.finalPayableAmount.toFixed(2), '3320.00'); // 4000 + 620 - 300 - 1000
        return args.data;
      }
    }
  } as unknown as Prisma.TransactionClient;

  const result = await recalculateSettlementTotals('set-1', mockTx);
  assert.equal(result.finalPayableAmount.toFixed(2), '3320.00');
});

test('4. State transitions validation for WorkEntry', () => {
  // Valid transitions
  assert.doesNotThrow(() => validateWorkEntryTransition('DRAFT', 'SUBMITTED'));
  assert.doesNotThrow(() => validateWorkEntryTransition('SUBMITTED', 'APPROVED'));
  assert.doesNotThrow(() => validateWorkEntryTransition('SUBMITTED', 'RETURNED'));
  assert.doesNotThrow(() => validateWorkEntryTransition('RETURNED', 'SUBMITTED'));

  // Invalid transitions
  assert.throws(() => validateWorkEntryTransition('APPROVED', 'DRAFT'));
  assert.throws(() => validateWorkEntryTransition('APPROVED', 'RETURNED'));
  assert.throws(() => validateWorkEntryTransition('DRAFT', 'RETURNED'));
});

test('5. Lock-based carry-over offset during WorkEntry approval', async () => {
  // Original locked month: 2026-06
  // Future open month: 2026-07
  const workDate = new Date('2026-06-15T12:00:00Z');

  const mockEntry = {
    id: 'entry-1',
    employeeId: 'emp-1',
    workDate,
    workTaskId: 'task-1',
    workType: 'INSTALLATION',
    remunerationMethod: 'HOURLY',
    quantity: dec('8.00'),
    appliedUnitRate: dec('200.00'),
    calculatedAmount: dec('1600.00'),
    rateSource: 'EMPLOYEE_RATE',
    carrierType: 'BILLBOARD',
    status: 'SUBMITTED',
    settlementItem: null
  };

  const mockLockedSettlement = {
    id: 'set-locked-06',
    employeeId: 'emp-1',
    periodYear: 2026,
    periodMonth: 6,
    status: 'LOCKED',
    items: [],
    adjustments: []
  };

  const mockOpenSettlement = {
    id: 'set-open-07',
    employeeId: 'emp-1',
    periodYear: 2026,
    periodMonth: 7,
    status: 'DRAFT',
    items: [],
    adjustments: []
  };

  const mockTx = {
    workEntry: {
      findUnique: async () => mockEntry,
      update: async (args: any) => {
        assert.equal(args.data.status, 'APPROVED');
        return mockEntry;
      }
    },
    settlement: {
      // getOrCreateSettlement queries
      findUnique: async (args: any) => {
        if (args.where.id) {
          return args.where.id === 'set-locked-06' ? mockLockedSettlement : mockOpenSettlement;
        }
        const key = args.where.employeeId_periodYear_periodMonth;
        if (key) {
          // Return locked for 2026-06
          if (key.periodMonth === 6) {
            return mockLockedSettlement;
          }
          // Return open for 2026-07
          if (key.periodMonth === 7) {
            return mockOpenSettlement;
          }
        }
        return null;
      },
      findMany: async () => [mockOpenSettlement], // return the future open month
      update: async () => mockOpenSettlement
    },
    settlementAdjustment: {
      create: async (args: any) => {
        // Check that correction carries over the entire amount of 1600 CZK
        assert.equal(args.data.settlementId, 'set-open-07');
        assert.equal(args.data.type, 'CARRY_OVER_ADD');
        assert.equal(args.data.amount.toFixed(2), '1600.00');
        assert.equal(args.data.correctionWorkEntryId, 'entry-1');
        return args.data;
      }
    }
  } as unknown as Prisma.TransactionClient;

  // Run approval
  await approveWorkEntry('entry-1', 'admin-1', mockTx);
});

test('6. Idempotent WorkExpense approval and unique SettlementAdjustment link', async () => {
  const mockExpense = {
    id: 'exp-1',
    workEntryId: 'entry-1',
    type: 'FUEL',
    description: 'Benzin D1',
    amount: dec('1200.00'),
    status: 'PENDING',
    workEntry: {
      employeeId: 'emp-1',
      workDate: new Date('2026-07-10')
    }
  };

  const mockSettlement = {
    id: 'set-open-07',
    employeeId: 'emp-1',
    periodYear: 2026,
    periodMonth: 7,
    status: 'DRAFT',
    items: [],
    adjustments: []
  };

  const mockTx = {
    workExpense: {
      findUnique: async () => mockExpense,
      update: async (args: any) => {
        assert.equal(args.data.status, 'APPROVED');
        return mockExpense;
      }
    },
    settlement: {
      findUnique: async () => mockSettlement,
      update: async () => mockSettlement
    },
    settlementAdjustment: {
      upsert: async (args: any) => {
        // Idempotency: upsert using unique workExpenseId
        assert.equal(args.where.workExpenseId, 'exp-1');
        assert.equal(args.create.amount.toFixed(2), '1200.00');
        assert.equal(args.create.type, 'REIMBURSEMENT');
        assert.equal(args.create.category, 'FUEL');
        return args.create;
      }
    }
  } as unknown as Prisma.TransactionClient;

  // Run approval
  await approveWorkExpense('exp-1', 'admin-1', mockTx);
});
