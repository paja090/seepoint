/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { submitWorkEntries } from '../lib/work-entry-actions.ts';
import { approveWorkExpense, rejectWorkExpense } from '../lib/work-expense-actions.ts';
import {
  submitSettlement,
  approveSettlement,
  rejectSettlement,
  lockSettlement,
  paySettlement,
  addManualAdjustment,
  deleteManualAdjustment
} from '../lib/settlement-actions.ts';

const dec = (val: string | number) => new Prisma.Decimal(val);

test('Etapa 2: submitWorkEntries - hromadné odeslání s vlastnictvím a validním stavem', async () => {
  const mockEntries = [
    { id: 'we-1', employeeId: 'emp-worker', status: 'DRAFT' },
    { id: 'we-2', employeeId: 'emp-worker', status: 'RETURNED' },
  ];

  const mockTx = {
    workEntry: {
      findMany: async (args: any) => {
        assert.deepEqual(args.where.id.in, ['we-1', 'we-2']);
        return mockEntries;
      },
      updateMany: async (args: any) => {
        assert.deepEqual(args.where.id.in, ['we-1', 'we-2']);
        assert.equal(args.data.status, 'SUBMITTED');
        return { count: 2 };
      }
    },
    employee: {
      findFirst: async (args: any) => {
        // Mock worker user
        return { id: 'emp-worker' };
      }
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const actor = { id: 'usr-worker', email: 'worker@seepoint.cz', role: 'WORKER' };
  const res = await submitWorkEntries(['we-1', 'we-2'], actor, mockTx);
  assert.equal(res.count, 2);
});

test('Etapa 2: submitWorkEntries - pokus o odeslání cizího záznamu', async () => {
  const mockEntries = [
    { id: 'we-1', employeeId: 'emp-other', status: 'DRAFT' },
  ];

  const mockTx = {
    workEntry: {
      findMany: async () => mockEntries,
    },
    employee: {
      findFirst: async () => ({ id: 'emp-worker' }),
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const actor = { id: 'usr-worker', email: 'worker@seepoint.cz', role: 'WORKER' };
  await assert.rejects(
    async () => {
      await submitWorkEntries(['we-1'], actor, mockTx);
    },
    /Nemáte oprávnění odeslat cizí záznam práce/
  );
});

test('Etapa 2: submitWorkEntries - odeslání nevhodného stavu (např. APPROVED)', async () => {
  const mockEntries = [
    { id: 'we-1', employeeId: 'emp-worker', status: 'APPROVED' },
  ];

  const mockTx = {
    workEntry: {
      findMany: async () => mockEntries,
    },
    employee: {
      findFirst: async () => ({ id: 'emp-worker' }),
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const actor = { id: 'usr-worker', email: 'worker@seepoint.cz', role: 'WORKER' };
  await assert.rejects(
    async () => {
      await submitWorkEntries(['we-1'], actor, mockTx);
    },
    /Lze odeslat pouze koncepty a vrácené záznamy/
  );
});

test('Etapa 2: lockSettlement - kontrola neuzavřených položek práce', async () => {
  const mockSettlement = {
    id: 'set-1',
    employeeId: 'emp-1',
    periodFrom: new Date('2026-06-01'),
    periodTo: new Date('2026-06-30'),
    status: 'APPROVED',
    items: [{ id: 'item-1' }],
    adjustments: []
  };

  const mockTx = {
    settlement: {
      findUnique: async () => mockSettlement,
    },
    workEntry: {
      findMany: async (args: any) => {
        // Return 1 unresolved entry
        return [{ id: 'we-unresolved', status: 'DRAFT' }];
      }
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const actor = { id: 'usr-manager', email: 'manager@seepoint.cz', role: 'MANAGER' };
  await assert.rejects(
    async () => {
      await lockSettlement('set-1', actor, mockTx);
    },
    /neschválených záznamů práce/
  );
});

test('Etapa 2: lockSettlement - kontrola neuzavřených výdajů', async () => {
  const mockSettlement = {
    id: 'set-1',
    employeeId: 'emp-1',
    periodFrom: new Date('2026-06-01'),
    periodTo: new Date('2026-06-30'),
    status: 'APPROVED',
    items: [{ id: 'item-1' }],
    adjustments: []
  };

  const mockTx = {
    settlement: {
      findUnique: async () => mockSettlement,
    },
    workEntry: {
      findMany: async () => [] // no unresolved work entries
    },
    workExpense: {
      findMany: async (args: any) => {
        // Return 1 pending expense
        return [{ id: 'exp-unresolved', status: 'PENDING' }];
      }
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const actor = { id: 'usr-manager', email: 'manager@seepoint.cz', role: 'MANAGER' };
  await assert.rejects(
    async () => {
      await lockSettlement('set-1', actor, mockTx);
    },
    /neschválených výdajů/
  );
});

test('Etapa 2: lockSettlement - úspěšné uzamčení a zápis audit logu', async () => {
  const mockSettlement = {
    id: 'set-1',
    employeeId: 'emp-1',
    periodFrom: new Date('2026-06-01'),
    periodTo: new Date('2026-06-30'),
    periodYear: 2026,
    periodMonth: 6,
    status: 'APPROVED',
    items: [{ id: 'item-1', amount: dec('5000') }],
    adjustments: []
  };

  let auditCreated = false;
  let statusUpdated = false;

  const mockTx = {
    settlement: {
      findUnique: async () => mockSettlement,
      findFirst: async () => null, // no duplicate locks
      update: async (args: any) => {
        if (args.data.status) {
          assert.equal(args.data.status, 'LOCKED');
          statusUpdated = true;
          return { ...mockSettlement, status: 'LOCKED' };
        }
        return mockSettlement;
      }
    },
    workEntry: {
      findMany: async () => []
    },
    workExpense: {
      findMany: async () => []
    },
    settlementAuditLog: {
      create: async (args: any) => {
        assert.equal(args.data.settlementId, 'set-1');
        assert.equal(args.data.action, 'STATUS_CHANGE');
        assert.equal(args.data.oldValue, 'APPROVED');
        assert.equal(args.data.newValue, 'LOCKED');
        auditCreated = true;
        return {};
      }
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const actor = { id: 'usr-manager', email: 'manager@seepoint.cz', role: 'MANAGER' };
  const res = await lockSettlement('set-1', actor, mockTx);
  assert.equal(res.status, 'LOCKED');
  assert.ok(statusUpdated);
  assert.ok(auditCreated);
});

test('Etapa 2: paySettlement - idempotentní chování', async () => {
  const mockSettlement = {
    id: 'set-1',
    status: 'PAID'
  };

  const mockTx = {
    settlement: {
      findUnique: async () => mockSettlement,
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const actor = { id: 'usr-manager', email: 'manager@seepoint.cz', role: 'MANAGER' };
  const res = await paySettlement('set-1', actor, mockTx);
  assert.equal(res.status, 'PAID');
});

test('Etapa 2: rejectSettlement - zamítnutí s chybějícím nebo krátkým důvodem', async () => {
  const mockTx = {} as any;
  const actor = { id: 'usr-manager', email: 'manager@seepoint.cz', role: 'MANAGER' };

  await assert.rejects(
    async () => {
      await rejectSettlement('set-1', '  ', actor, mockTx);
    },
    /Důvod je povinný/
  );

  await assert.rejects(
    async () => {
      await rejectSettlement('set-1', 'test', actor, mockTx);
    },
    /Důvod je příliš krátký/
  );
});

test('Etapa 2: addManualAdjustment - nulová částka nebo chybějící důvod', async () => {
  const mockTx = {} as any;
  const actor = { id: 'usr-manager', email: 'manager@seepoint.cz', role: 'MANAGER' };

  // Zero amount check
  await assert.rejects(
    async () => {
      await addManualAdjustment({
        settlementId: 'set-1',
        amount: 0,
        description: 'Test',
        reason: 'Validní důvod',
      }, actor, mockTx);
    },
    /Částka korekce nesmí být nulová/
  );

  // Missing reason check
  await assert.rejects(
    async () => {
      await addManualAdjustment({
        settlementId: 'set-1',
        amount: 500,
        description: 'Test',
        reason: '    ',
      }, actor, mockTx);
    },
    /Důvod je povinný/
  );
});

test('Etapa 2: addManualAdjustment - nelze přidat do uzamčeného vyúčtování', async () => {
  const mockSettlement = {
    id: 'set-1',
    status: 'LOCKED'
  };

  const mockTx = {
    settlement: {
      findUnique: async () => mockSettlement,
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const actor = { id: 'usr-manager', email: 'manager@seepoint.cz', role: 'MANAGER' };
  await assert.rejects(
    async () => {
      await addManualAdjustment({
        settlementId: 'set-1',
        amount: 500,
        description: 'Test',
        reason: 'Důvod opravy',
      }, actor, mockTx);
    },
    /pouze do otevřeného vyúčtování/
  );
});

test('Etapa 2: rejectWorkExpense - zamítnutí s validací důvodu', async () => {
  const mockExpense = {
    id: 'exp-1',
    status: 'PENDING',
  };

  const mockTx = {
    workExpense: {
      findUnique: async () => mockExpense,
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  // Reject with empty reason
  await assert.rejects(
    async () => {
      await rejectWorkExpense('exp-1', '   ', 'usr-manager', mockTx);
    },
    /Důvod je povinný/
  );
});

test('Etapa 2: double approve WorkExpense idempotence check', async () => {
  const mockExpense = {
    id: 'exp-1',
    status: 'APPROVED',
  };

  const mockTx = {
    workExpense: {
      findUnique: async () => mockExpense,
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const res = await approveWorkExpense('exp-1', 'usr-manager', mockTx);
  assert.equal(res.status, 'APPROVED'); // Idempotent check
});

test('Etapa 2: Settlement reject transition (SUBMITTED -> REJECTED -> SUBMITTED)', async () => {
  const mockSettlement = {
    id: 'set-1',
    status: 'SUBMITTED'
  };

  let statusUpdatedTo = '';

  const mockTx = {
    settlement: {
      findUnique: async () => {
        // Return correct status depending on test step state
        return { ...mockSettlement, status: statusUpdatedTo || 'SUBMITTED' };
      },
      update: async (args: any) => {
        statusUpdatedTo = args.data.status;
        return { ...mockSettlement, status: statusUpdatedTo };
      }
    },
    settlementAuditLog: {
      create: async () => ({})
    },
    $transaction: async (cb: any) => cb(mockTx)
  } as any;

  const actor = { id: 'usr-manager', email: 'manager@seepoint.cz', role: 'MANAGER' };

  // 1. Reject settlement
  const resReject = await rejectSettlement('set-1', 'Zamítnuto manažerem', actor, mockTx);
  assert.equal(resReject.status, 'REJECTED');

  // 2. Submit rejected settlement back
  const resSubmit = await submitSettlement('set-1', actor, mockTx);
  assert.equal(resSubmit.status, 'SUBMITTED');
});
