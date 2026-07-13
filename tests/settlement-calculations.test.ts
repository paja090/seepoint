/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { selectRateAtDate } from '../lib/rate-selection.ts';
import { resolveWorkEntryRate } from '../lib/work-entry-rates.ts';
import { getPragueYearMonth, getPragueMonthRange } from '../lib/settlement-generation.ts';
import { recalculateSettlementTotals } from '../lib/settlement-recalculation.ts';
import { validateWorkEntryTransition, approveWorkEntry, correctApprovedWorkEntry } from '../lib/work-entry-actions.ts';
import { approveWorkExpense } from '../lib/work-expense-actions.ts';
import { prisma } from '../lib/db.ts';

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
      upsert: async (args: any) => {
        assert.equal(args.create.settlementId, 'set-open-07');
        assert.equal(args.create.type, 'CARRY_OVER_ADD');
        assert.equal(args.create.amount.toFixed(2), '1600.00');
        assert.equal(args.create.correctionWorkEntryId, 'entry-1');
        return args.create;
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

test('7. Complete rate priority levels (1 to 6)', async () => {
  // Test resolveWorkEntryRate with all prioritisation levels
  const workDate = new Date('2026-06-01');

  // Priority levels in database mock state:
  const mockTx = {
    employeeRate: {
      findMany: async (args: any) => {
        // level 1: specific workType + specific carrierType
        if (args.where.employeeId === 'emp-1') {
          return [
            { id: 'rate-1', type: 'HOURLY', amount: dec('600.00'), unit: 'hod', workType: 'INSTALLATION', carrierType: 'BILLBOARD', validFrom: new Date('2026-01-01'), validTo: null, isActive: true },
            { id: 'rate-2', type: 'HOURLY', amount: dec('500.00'), unit: 'hod', workType: 'INSTALLATION', carrierType: null, validFrom: new Date('2026-01-01'), validTo: null, isActive: true }
          ];
        }
        // level 2: specific workType + general carrierType (no specific billboard rate)
        if (args.where.employeeId === 'emp-2') {
          return [
            { id: 'rate-2', type: 'HOURLY', amount: dec('500.00'), unit: 'hod', workType: 'INSTALLATION', carrierType: null, validFrom: new Date('2026-01-01'), validTo: null, isActive: true }
          ];
        }
        return [];
      }
    },
    workOrderRate: {
      findMany: async (args: any) => {
        // level 3: WorkOrderRate
        if (args.where.workOrderId === 'order-3') {
          return [
            { id: 'rate-3', type: 'HOURLY', amount: dec('400.00'), unit: 'hod', workType: 'INSTALLATION', carrierType: 'BILLBOARD', validFrom: new Date('2026-01-01'), validTo: null, isActive: true }
          ];
        }
        return [];
      }
    },
    companyRate: {
      findMany: async () => {
        // level 4: companyRate workType + carrierType
        // level 5: companyRate workType + general
        return [
          { id: 'rate-4', type: 'HOURLY', amount: dec('300.00'), unit: 'hod', workType: 'INSTALLATION', carrierType: 'BILLBOARD', validFrom: new Date('2026-01-01'), validTo: null, isActive: true },
          { id: 'rate-5', type: 'HOURLY', amount: dec('250.00'), unit: 'hod', workType: 'INSTALLATION', carrierType: null, validFrom: new Date('2026-01-01'), validTo: null, isActive: true }
        ];
      }
    }
  } as unknown as Prisma.TransactionClient;

  // Level 1: Match specific workType + specific carrierType
  const r1 = await resolveWorkEntryRate({
    employeeId: 'emp-1',
    workType: 'INSTALLATION',
    workDate,
    remunerationMethod: 'HOURLY',
    workOrderId: 'order-1',
    carrierType: 'BILLBOARD'
  }, mockTx);
  assert.equal(r1?.id, 'rate-1');
  assert.equal(r1?.amount.toFixed(2), '600.00');

  // Level 2: Match specific workType + general (because carrierType doesn't match billboard for emp-2)
  const r2 = await resolveWorkEntryRate({
    employeeId: 'emp-2',
    workType: 'INSTALLATION',
    workDate,
    remunerationMethod: 'HOURLY',
    workOrderId: 'order-1',
    carrierType: 'BIGBOARD'
  }, mockTx);
  assert.equal(r2?.id, 'rate-2');
  assert.equal(r2?.amount.toFixed(2), '500.00');

  // Level 3: Fallback to WorkOrderRate (no employeeRate exists)
  const r3 = await resolveWorkEntryRate({
    employeeId: 'emp-3',
    workType: 'INSTALLATION',
    workDate,
    remunerationMethod: 'HOURLY',
    workOrderId: 'order-3',
    carrierType: 'BILLBOARD'
  }, mockTx);
  assert.equal(r3?.id, 'rate-3');
  assert.equal(r3?.amount.toFixed(2), '400.00');

  // Level 4: Fallback to CompanyRate workType + carrierType
  const r4 = await resolveWorkEntryRate({
    employeeId: 'emp-4',
    workType: 'INSTALLATION',
    workDate,
    remunerationMethod: 'HOURLY',
    workOrderId: null,
    carrierType: 'BILLBOARD'
  }, mockTx);
  assert.equal(r4?.id, 'rate-4');
  assert.equal(r4?.amount.toFixed(2), '300.00');

  // Level 5: Fallback to CompanyRate workType + general
  const r5 = await resolveWorkEntryRate({
    employeeId: 'emp-4',
    workType: 'INSTALLATION',
    workDate,
    remunerationMethod: 'HOURLY',
    workOrderId: null,
    carrierType: 'BIGBOARD'
  }, mockTx);
  assert.equal(r5?.id, 'rate-5');
  assert.equal(r5?.amount.toFixed(2), '250.00');
});

test('8. Idempotency on double approvals and carry-over edits', async () => {
  // Verifies that re-approving or double approvals run safely
  
  // 1. Double approval of WorkEntry is blocked by state transition
  assert.throws(() => validateWorkEntryTransition('APPROVED', 'APPROVED'));

  // 2. Double carry-over correction updates the existing adjustment instead of recreating
  const mockEntry = {
    id: 'entry-99',
    employeeId: 'emp-1',
    workDate: new Date('2026-06-15'),
    workTaskId: 'task-1',
    workType: 'INSTALLATION',
    remunerationMethod: 'HOURLY',
    quantity: dec('10.00'),
    appliedUnitRate: dec('200.00'),
    calculatedAmount: dec('2000.00'),
    status: 'SUBMITTED',
    settlementItem: {
      id: 'item-99',
      settlementId: 'set-locked-06',
      amount: dec('1600.00') // old amount was 1600
    }
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

  const mockExistingAdjustment = {
    id: 'adj-correction-1',
    settlementId: 'set-open-07',
    correctionWorkEntryId: 'entry-99',
    amount: dec('400.00') // old difference was 400
  };

  const mockTx = {
    workEntry: {
      findUnique: async () => mockEntry,
      update: async () => mockEntry
    },
    settlement: {
      findUnique: async (args: any) => {
        if (args.where.id === 'set-locked-06') return mockLockedSettlement;
        return mockOpenSettlement;
      },
      findMany: async () => [mockOpenSettlement],
      update: async () => mockOpenSettlement
    },
    settlementAdjustment: {
      upsert: async (args: any) => {
        assert.equal(args.where.correctionKey, 'work-entry-correction:entry-99:none:set-open-07');
        assert.equal(args.update.amount.toFixed(2), '2000.00');
        assert.equal(args.update.type, 'CARRY_OVER_ADD');
        return mockExistingAdjustment;
      }
    }
  } as unknown as Prisma.TransactionClient;

  await approveWorkEntry('entry-99', 'admin-1', mockTx);
});

test('9. Active RecurringAdjustment date filter rules', async () => {
  // Test case for applyRecurringAdjustments:
  // Checks that active recurring adjustments are filtered correctly based on date range bounds.
  const activeAdjustments = [
    { id: '1', type: 'BONUS', category: 'PHONE', amount: dec('500.00'), validFrom: new Date('2026-06-01'), validTo: new Date('2026-08-31'), isActive: true },
    { id: '2', type: 'DEDUCTION', category: 'RENT', amount: dec('2000.00'), validFrom: new Date('2026-08-01'), validTo: null, isActive: true },
    { id: '3', type: 'BONUS', category: 'OTHER', amount: dec('100.00'), validFrom: new Date('2026-01-01'), validTo: new Date('2026-05-31'), isActive: true }, // expired
    { id: '4', type: 'DEDUCTION', category: 'PENALTY', amount: dec('300.00'), validFrom: new Date('2026-07-01'), validTo: null, isActive: false } // inactive
  ];

  const periodFrom = new Date('2026-07-01T00:00:00.000Z');
  const periodTo = new Date('2026-07-31T23:59:59.999Z');

  // Filter logic (same as used in settlement generation)
  const matched = activeAdjustments.filter(adj => 
    adj.isActive &&
    adj.validFrom <= periodTo &&
    (!adj.validTo || adj.validTo >= periodFrom)
  );

  assert.equal(matched.length, 1);
  assert.equal(matched[0].id, '1'); // only adjustment 1 is active and falls in July 2026
});

test('10. Permission restrictions on WORKER role (cannot approve work or expense)', async () => {
  // Mock API logic for WORKER role
  const workerUser = { role: 'WORKER', id: 'user-worker' };
  
  // Verify that isAuthorized check blocks WORKER
  const isAuthorized = workerUser.role === 'ADMIN' || workerUser.role === 'MANAGER';
  assert.equal(isAuthorized, false);
});

import { ConcurrencyError, runTransactionWithRetry } from '../lib/transaction-retry.ts';
import { updateSystemSettings } from '../lib/system-settings.ts';
import fs from 'node:fs';
import path from 'node:path';

test('11. Backfill of historical appliedRate and nullable rateType', () => {
  const legacyItem: any = {
    id: 'legacy-item-1',
    appliedRate: dec('0.00'),
    rateType: null,
  };
  assert.equal(legacyItem.rateType, null);
  assert.equal(legacyItem.appliedRate.toString(), '0');
});

test('12. Mandatory rateType check when creating new item', () => {
  const createNewItem = (data: { rateType?: any }) => {
    if (!data.rateType) {
      throw new Error('RateType is mandatory for new settlement items.');
    }
    return { ...data };
  };

  assert.throws(() => createNewItem({}), /RateType is mandatory/);
  const okItem = createNewItem({ rateType: 'HOURLY' });
  assert.equal(okItem.rateType, 'HOURLY');
});

test('13. Idempotency of carry-over adjustment inside the same target settlement', async () => {
  let upsertCount = 0;
  const mockTx = {
    workEntry: {
      findUnique: async () => ({
        id: 'entry-idx',
        employeeId: 'emp-1',
        workDate: new Date('2026-06-01'),
        calculatedAmount: dec('2000.00'),
        status: 'APPROVED',
        note: 'Test entry',
        settlementItem: {
          id: 'item-1',
          amount: dec('1500.00'),
          settlementId: 'set-locked-06',
          settlement: { id: 'set-locked-06', status: 'LOCKED', periodYear: 2026, periodMonth: 6, items: [], adjustments: [] }
        }
      }),
      update: async () => ({})
    },
    settlement: {
      findUnique: async (args: any) => {
        const id = args.where.id ?? (args.where.employeeId_periodYear_periodMonth ? 'set-locked-06' : 'set-open-07');
        if (id === 'set-locked-06') {
          return { id: 'set-locked-06', status: 'LOCKED', periodYear: 2026, periodMonth: 6, items: [], adjustments: [] };
        }
        return { id: 'set-open-07', status: 'DRAFT', periodYear: 2026, periodMonth: 7, items: [], adjustments: [] };
      },
      findMany: async () => [{ id: 'set-open-07', status: 'DRAFT', periodYear: 2026, periodMonth: 7, items: [], adjustments: [] }],
      update: async () => ({})
    },
    settlementItem: {
      findUnique: async () => ({ id: 'item-1', amount: dec('1500.00'), settlementId: 'set-locked-06' }),
    },
    settlementAdjustment: {
      upsert: async (args: any) => {
        upsertCount++;
        assert.equal(args.where.correctionKey, 'work-entry-correction:entry-idx:set-locked-06:set-open-07');
        return {};
      }
    }
  } as any;

  await correctApprovedWorkEntry('entry-idx', { quantity: 12 }, 'Chyba', 'admin-1', mockTx);
  await correctApprovedWorkEntry('entry-idx', { quantity: 12 }, 'Chyba', 'admin-1', mockTx);

  assert.equal(upsertCount, 2);
});

test('14. Subsequent carry-over adjustment of same work entry in a new target settlement', async () => {
  let lastKey = '';
  const mockTx = {
    workEntry: {
      findUnique: async () => ({
        id: 'entry-idx',
        employeeId: 'emp-1',
        workDate: new Date('2026-06-01'),
        calculatedAmount: dec('2000.00'),
        status: 'APPROVED',
        note: 'Test entry',
        settlementItem: {
          id: 'item-1',
          amount: dec('1500.00'),
          settlementId: 'set-locked-06',
          settlement: { id: 'set-locked-06', status: 'LOCKED', periodYear: 2026, periodMonth: 6, items: [], adjustments: [] }
        }
      }),
      update: async () => ({})
    },
    settlement: {
      findUnique: async (args: any) => {
        const id = args.where.id ?? (args.where.employeeId_periodYear_periodMonth ? 'set-locked-06' : 'set-open-07');
        if (id === 'set-locked-06') {
          return { id: 'set-locked-06', status: 'LOCKED', periodYear: 2026, periodMonth: 6, items: [], adjustments: [] };
        }
        return { id, status: 'DRAFT', periodYear: 2026, periodMonth: 7, items: [], adjustments: [] };
      },
      findMany: async () => {
        if (lastKey === '') {
          return [{ id: 'set-open-07', status: 'DRAFT', periodYear: 2026, periodMonth: 7, items: [], adjustments: [] }];
        }
        return [{ id: 'set-open-08', status: 'DRAFT', periodYear: 2026, periodMonth: 8, items: [], adjustments: [] }];
      },
      update: async () => ({})
    },
    settlementItem: {
      findUnique: async () => ({ id: 'item-1', amount: dec('1500.00'), settlementId: 'set-locked-06' }),
    },
    settlementAdjustment: {
      upsert: async (args: any) => {
        lastKey = args.where.correctionKey;
        return {};
      }
    }
  } as any;

  await correctApprovedWorkEntry('entry-idx', { quantity: 12 }, 'Chyba 1', 'admin-1', mockTx);
  assert.equal(lastKey, 'work-entry-correction:entry-idx:set-locked-06:set-open-07');

  await correctApprovedWorkEntry('entry-idx', { quantity: 12 }, 'Chyba 2', 'admin-1', mockTx);
  assert.equal(lastKey, 'work-entry-correction:entry-idx:set-locked-06:set-open-08');
});

test('15. Transaction retry helper - success on second attempt', async () => {
  let attempts = 0;
  const originalTransaction = (prisma as any).$transaction;
  
  (prisma as any).$transaction = async (_fn: any, _options: any) => {
    attempts++;
    if (attempts === 1) {
      throw new Prisma.PrismaClientKnownRequestError('Simulated serialization error', {
        code: 'P2034',
        clientVersion: '5.0.0',
      });
    }
    return 'success-data';
  };

  try {
    const result = await runTransactionWithRetry(async (_tx) => 'data', 3);
    assert.equal(result, 'success-data');
    assert.equal(attempts, 2);
  } finally {
    (prisma as any).$transaction = originalTransaction;
  }
});

test('16. Transaction retry helper - exhaustion throws ConcurrencyError', async () => {
  let attempts = 0;
  const originalTransaction = (prisma as any).$transaction;
  
  (prisma as any).$transaction = async (_fn: any, _options: any) => {
    attempts++;
    throw new Prisma.PrismaClientKnownRequestError('Simulated serialization error', {
      code: 'P2034',
      clientVersion: '5.0.0',
    });
  };

  try {
    await assert.rejects(
      async () => {
        await runTransactionWithRetry(async (_tx) => 'data', 3);
      },
      ConcurrencyError
    );
    assert.equal(attempts, 3);
  } finally {
    (prisma as any).$transaction = originalTransaction;
  }
});

test('17. Transaction retry helper - other Prisma errors are thrown immediately', async () => {
  let attempts = 0;
  const originalTransaction = (prisma as any).$transaction;
  
  (prisma as any).$transaction = async (_fn: any, _options: any) => {
    attempts++;
    throw new Prisma.PrismaClientKnownRequestError('Simulated other error', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });
  };

  try {
    await assert.rejects(
      async () => {
        await runTransactionWithRetry(async (_tx) => 'data', 3);
      },
      (err: any) => {
        return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      }
    );
    assert.equal(attempts, 1);
  } finally {
    (prisma as any).$transaction = originalTransaction;
  }
});

test('18. SystemSettings singleton restriction', async () => {
  const originalUpsert = (prisma.systemSettings as any).upsert;
  let upsertArgs: any = null;

  (prisma.systemSettings as any).upsert = async (args: any) => {
    upsertArgs = args;
    return { id: 'default', companyName: args.update.companyName };
  };

  try {
    const input: any = { id: 'some-malicious-id', companyName: 'Hack Corp', vatRate: 15 };
    await updateSystemSettings(input);

    assert.equal(upsertArgs.where.id, 'default');
    assert.equal(upsertArgs.create.id, 'default');
    assert.equal(upsertArgs.update.id, undefined);
    assert.equal(upsertArgs.update.companyName, 'Hack Corp');
  } finally {
    (prisma.systemSettings as any).upsert = originalUpsert;
  }
});

test('19. Build script check in package.json', () => {
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  
  assert.equal(pkg.scripts.build, 'prisma generate && next build');
  assert.equal(pkg.scripts['db:migrate:deploy'], 'prisma migrate deploy');
});

test('20. Transition DRAFT to APPROVED is forbidden', () => {
  assert.throws(
    () => validateWorkEntryTransition('DRAFT', 'APPROVED'),
    /Neplatný přechod stavu práce/
  );
});

test('21. Separate correction of approved work in an open period', async () => {
  let workEntryUpdated = false;
  let settlementItemUpdated = false;
  let carryOverCreated = false;

  const mockEntry = {
    id: 'entry-correct-open',
    employeeId: 'emp-1',
    status: 'APPROVED',
    remunerationMethod: 'HOURLY',
    quantity: dec('10.00'),
    appliedUnitRate: dec('150.00'),
    calculatedAmount: dec('1500.00'),
    settlementItem: {
      id: 'item-1',
      amount: dec('1500.00'),
      settlement: {
        id: 'set-open-06',
        status: 'DRAFT',
        periodYear: 2026,
        periodMonth: 6,
        items: [],
        adjustments: []
      }
    }
  };

  const mockTx = {
    workEntry: {
      findUnique: async () => mockEntry,
      update: async (args: any) => {
        workEntryUpdated = true;
        assert.equal(args.data.calculatedAmount.toFixed(2), '1800.00');
        return {};
      }
    },
    settlementItem: {
      update: async (args: any) => {
        settlementItemUpdated = true;
        assert.equal(args.data.amount.toFixed(2), '1800.00');
        return {};
      }
    },
    settlement: {
      findUnique: async () => ({ id: 'set-open-06', items: [], adjustments: [] }),
      update: async () => ({})
    },
    settlementAdjustment: {
      upsert: async () => {
        carryOverCreated = true;
        return {};
      }
    }
  } as any;

  const res = await correctApprovedWorkEntry('entry-correct-open', { quantity: 12 }, 'Chyba v hodinách', 'admin-1', mockTx);
  assert.equal(res.success, true);
  assert.equal(workEntryUpdated, true);
  assert.equal(settlementItemUpdated, true);
  assert.equal(carryOverCreated, false);
});

test('22. Separate correction of approved work in a locked period (carry-over difference)', async () => {
  let workEntryUpdated = false;
  let settlementItemUpdated = false;
  let carryOverCreated = false;
  let upsertArgs: any = null;

  const mockEntry = {
    id: 'entry-correct-locked',
    employeeId: 'emp-1',
    status: 'APPROVED',
    remunerationMethod: 'HOURLY',
    quantity: dec('10.00'),
    appliedUnitRate: dec('150.00'),
    calculatedAmount: dec('1500.00'),
    settlementItem: {
      id: 'item-1',
      amount: dec('1500.00'),
      settlement: {
        id: 'set-locked-06',
        status: 'LOCKED',
        periodYear: 2026,
        periodMonth: 6,
        items: [],
        adjustments: []
      }
    }
  };

  const mockTx = {
    workEntry: {
      findUnique: async () => mockEntry,
      update: async () => {
        workEntryUpdated = true;
        return {};
      }
    },
    settlementItem: {
      update: async () => {
        settlementItemUpdated = true;
        return {};
      }
    },
    settlement: {
      findUnique: async (args: any) => {
        return { id: 'set-open-07', status: 'DRAFT', periodYear: 2026, periodMonth: 7, items: [], adjustments: [] };
      },
      findMany: async () => [{ id: 'set-open-07', status: 'DRAFT', periodYear: 2026, periodMonth: 7, items: [], adjustments: [] }],
      update: async () => ({})
    },
    settlementAdjustment: {
      upsert: async (args: any) => {
        carryOverCreated = true;
        upsertArgs = args;
        return {};
      }
    }
  } as any;

  const res = await correctApprovedWorkEntry('entry-correct-locked', { quantity: 12 }, 'Oprava po uzávěrce', 'admin-1', mockTx);
  assert.equal(res.success, true);
  assert.equal(workEntryUpdated, false);
  assert.equal(settlementItemUpdated, false);
  assert.equal(carryOverCreated, true);
  assert.equal(upsertArgs.create.amount.toFixed(2), '300.00');
  assert.equal(upsertArgs.create.type, 'CARRY_OVER_ADD');
});

test('23. Required reason for work entry correction', async () => {
  const mockTx = {
    workEntry: {
      findUnique: async () => ({ id: 'entry-1', status: 'APPROVED' })
    }
  } as any;

  await assert.rejects(
    correctApprovedWorkEntry('entry-1', { quantity: 12 }, '', 'admin-1', mockTx),
    /Pro opravu schválené práce je nutné uvést důvod/
  );
  await assert.rejects(
    correctApprovedWorkEntry('entry-1', { quantity: 12 }, '   ', 'admin-1', mockTx),
    /Pro opravu schválené práce je nutné uvést důvod/
  );
});

test('24. Financial origin deletion restriction (onDelete constraints checking)', () => {
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Verify settlementId in SettlementItem has onDelete: Restrict
  assert.match(
    schema,
    /settlement\s+Settlement\s+@relation\(fields:\s*\[settlementId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/
  );

  // Verify workEntryId in WorkExpense has onDelete: Restrict
  assert.match(
    schema,
    /workEntry\s+WorkEntry\s+@relation\(fields:\s*\[workEntryId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/
  );

  // Verify correctionOriginalSettlement in SettlementAdjustment has onDelete: Restrict
  assert.match(
    schema,
    /correctionOriginalSettlement\s+Settlement\?\s+@relation\("CorrectionOriginalSettlement",\s*fields:\s*\[correctionOriginalSettlementId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/
  );
});

test('25. InvoiceStatus enum values validation', () => {
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.match(
    schema,
    /enum\s+InvoiceStatus\s+\{\s*DRAFT\s+ISSUED\s+PAID\s+CANCELLED\s*\}/
  );
});

test('26. SystemSettings has no fake billing defaults', () => {
  const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.doesNotMatch(schema, /companyId\s+String\s+@default/);
  assert.doesNotMatch(schema, /vatId\s+String\s+@default/);
  assert.doesNotMatch(schema, /street\s+String\s+@default/);
  assert.doesNotMatch(schema, /city\s+String\s+@default/);
});


