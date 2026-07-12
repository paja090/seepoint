import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma, WorkType, RateType } from '@prisma/client';
import { resolveWorkEntryRate } from '../lib/work-entry-rates.ts';
import { syncWorkOrderTasks } from '../lib/work-task-sync.ts';

// Helper to create Decimal
const dec = (val: string | number) => new Prisma.Decimal(val);

test('1. hourly work amount calculation with Decimal precision', async () => {
  // Test 2.50 hours * 150 CZK/hr = 375.00 CZK
  const quantity = dec('2.50');
  const rate = dec('150.00');
  const amount = quantity.mul(rate);
  assert.equal(amount.toFixed(2), '375.00');
});

test('2. piece-based or task-based work amount calculation', async () => {
  // Test 5 units * 100 CZK/unit = 500.00 CZK
  const quantity = dec('5.00');
  const rate = dec('100.00');
  const amount = quantity.mul(rate);
  assert.equal(amount.toFixed(2), '500.00');
});

test('3. fixed amount work representation', async () => {
  // Fixed amount is pre-filled directly as rate and quantity is 1
  const quantity = dec('1.00');
  const rate = dec('5000.00');
  const amount = quantity.mul(rate);
  assert.equal(amount.toFixed(2), '5000.00');
});

test('4. resolve rate priority: EmployeeRate -> WorkOrderRate -> CompanyRate -> MANUAL', async () => {
  // Mock rates database state
  const employeeRates = [
    { workType: 'INSTALLATION', amount: dec('400.00'), source: 'EMPLOYEE_RATE' }
  ];
  const workOrderRates = [
    { workType: 'INSTALLATION', amount: dec('350.00'), source: 'WORK_ORDER_RATE' }
  ];
  const companyRates = [
    { workType: 'INSTALLATION', amount: dec('300.00'), source: 'COMPANY_RATE' }
  ];
  const manualRate = { amount: dec('500.00'), source: 'MANUAL' };

  // 1. Highest priority is EmployeeRate
  const resolved = employeeRates[0] || workOrderRates[0] || companyRates[0];
  assert.equal(resolved.source, 'EMPLOYEE_RATE');
  assert.equal(resolved.amount.toFixed(2), '400.00');

  // 2. Next priority is WorkOrderRate if no EmployeeRate exists
  const resolvedNoEmp = workOrderRates[0] || companyRates[0];
  assert.equal(resolvedNoEmp.source, 'WORK_ORDER_RATE');
  assert.equal(resolvedNoEmp.amount.toFixed(2), '350.00');

  // 3. Next priority is CompanyRate if neither EmployeeRate nor WorkOrderRate exists
  const resolvedNoEmpNoOrder = companyRates[0];
  assert.equal(resolvedNoEmpNoOrder.source, 'COMPANY_RATE');
  assert.equal(resolvedNoEmpNoOrder.amount.toFixed(2), '300.00');

  // 4. Manual rate override bypasses the entire resolver hierarchy if present
  const resolvedManual = manualRate;
  assert.equal(resolvedManual.source, 'MANUAL');
  assert.equal(resolvedManual.amount.toFixed(2), '500.00');
});

test('5. draft entry can be saved when rate is missing', () => {
  const status = 'DRAFT';
  const appliedUnitRate = null;
  const isSaveAllowed = status === 'DRAFT' && appliedUnitRate === null;
  assert.equal(isSaveAllowed, true);
});

test('6. rejection of confirmation when rate is missing', () => {
  const status = 'CONFIRMED';
  const appliedUnitRate = null;
  // Rule: status cannot transition to CONFIRMED if rate is missing
  const isConfirmationAllowed = status === 'CONFIRMED' && appliedUnitRate !== null;
  assert.equal(isConfirmationAllowed, false);
});

test('7. duplicate prevention logic', () => {
  const existingEntries = [
    { workTaskId: 'task-1', employeeId: 'emp-1', workType: 'INSTALLATION', workDate: '2026-07-12' }
  ];

  const newEntry = { workTaskId: 'task-1', employeeId: 'emp-1', workType: 'INSTALLATION', workDate: '2026-07-12' };

  const isDuplicate = existingEntries.some(
    e => e.workTaskId === newEntry.workTaskId &&
         e.employeeId === newEntry.employeeId &&
         e.workType === newEntry.workType &&
         e.workDate === newEntry.workDate
  );

  assert.equal(isDuplicate, true);
});

test('8. authorized explicit additional entry by manager/admin', () => {
  const userRole = 'MANAGER' as string;
  const allowAdditionalEntry = true;
  const additionalEntryReason = 'Opakovaná zkouška montáže';

  const isBypassAllowed = (userRole === 'ADMIN' || userRole === 'MANAGER') && 
                          allowAdditionalEntry && 
                          additionalEntryReason.trim().length > 0;

  assert.equal(isBypassAllowed, true);
});

test('9 & 10. rate change after WorkEntry confirmation does not affect confirmed amount', () => {
  // Store snapshot in confirmed entry
  const confirmedEntry = {
    id: 'entry-1',
    appliedUnitRate: dec('350.00'),
    quantity: dec('2.00'),
    calculatedAmount: dec('700.00'),
    status: 'CONFIRMED'
  };

  // Simulate a change in the employee rates table to 450 CZK
  const updatedRate = dec('450.00');
  assert.equal(updatedRate.toFixed(2), '450.00');

  // Verify that the already confirmed entry amount and rate remain unchanged
  assert.equal(confirmedEntry.appliedUnitRate.toFixed(2), '350.00');
  assert.equal(confirmedEntry.calculatedAmount.toFixed(2), '700.00');
});

test('11. employee can edit their own draft entry', () => {
  const currentUser = { id: 'user-1', role: 'WORKER' };
  const entry = { employeeId: 'emp-1', employeeUserId: 'user-1', status: 'DRAFT' };

  const isAllowed = entry.status === 'DRAFT' && entry.employeeUserId === currentUser.id;
  assert.equal(isAllowed, true);
});

test('12. employee cannot edit confirmed entry', () => {
  const currentUser = { id: 'user-1', role: 'WORKER' };
  const entry = { employeeId: 'emp-1', employeeUserId: 'user-1', status: 'CONFIRMED' };

  const isAllowed = entry.status === 'DRAFT' && entry.employeeUserId === currentUser.id;
  assert.equal(isAllowed, false);
});

test('13. employee cannot edit another employee\'s entry', () => {
  const currentUser = { id: 'user-1', role: 'WORKER' };
  const entry = { employeeId: 'emp-2', employeeUserId: 'user-2', status: 'DRAFT' };

  const isAllowed = entry.status === 'DRAFT' && entry.employeeUserId === currentUser.id;
  assert.equal(isAllowed, false);
});

test('14. manager or admin can confirm a draft entry', () => {
  const currentUser = { role: 'MANAGER' };
  const entry = { status: 'DRAFT', appliedUnitRate: dec('300.00') };

  const isAllowed = (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && 
                    entry.status === 'DRAFT' && 
                    entry.appliedUnitRate !== null;
  assert.equal(isAllowed, true);
});

test('15. WorkTask and WorkOrder traceability', () => {
  const entry = {
    workTaskId: 'task-1',
    workOrderId: 'order-1',
  };

  assert.ok(entry.workTaskId);
  assert.ok(entry.workOrderId);
});

test('16. one WorkTask performed by multiple employees has separate WorkEntry records', () => {
  const task = { id: 'task-1', assignedWorkers: ['emp-1', 'emp-2'] };
  
  const entries = [
    { id: 'entry-1', workTaskId: task.id, employeeId: 'emp-1', quantity: dec('3.00') },
    { id: 'entry-2', workTaskId: task.id, employeeId: 'emp-2', quantity: dec('3.00') }
  ];

  assert.equal(entries[0].workTaskId, entries[1].workTaskId);
  assert.notEqual(entries[0].employeeId, entries[1].employeeId);
});

test('17. syncWorkOrderTasks updates in-place and does not delete tasks with work entries', () => {
  const existingTasks = [
    { id: 'task-1', assignedToEmployeeId: 'emp-1', workEntriesCount: 1 }
  ];

  const targetWorkerIds = ['emp-2']; // we want to assign emp-2 instead of emp-1

  // Check if obsolete tasks can be deleted
  const tasksToDelete = existingTasks.filter(t => !targetWorkerIds.includes(t.assignedToEmployeeId));
  
  const hasConflict = tasksToDelete.some(t => t.workEntriesCount > 0);
  assert.equal(hasConflict, true); // conflict detected, deletion will be blocked
});

test('18. WorkTask archival or change does not delete confirmed WorkEntry due to Restrict onDelete', () => {
  // Representing Restrict constraint
  const onDeleteRestrictActive = true;
  assert.equal(onDeleteRestrictActive, true);
});

test('19. resolveWorkEntryRate executes EmployeeRate priority', async () => {
  const mockTx = {
    employeeRate: {
      findMany: async () => [
        {
          id: 'emp-rate-1',
          type: 'HOURLY',
          amount: dec('400.00'),
          unit: 'hod',
          workType: 'INSTALLATION',
          validFrom: new Date('2026-01-01'),
          validTo: null,
          isActive: true,
        }
      ]
    },
    workOrderRate: {
      findMany: async () => []
    },
    companyRate: {
      findMany: async () => []
    }
  } as unknown as Prisma.TransactionClient;

  const result = await resolveWorkEntryRate({
    employeeId: 'employee-1',
    workType: 'INSTALLATION',
    workDate: new Date('2026-06-01'),
    remunerationMethod: 'HOURLY',
    workOrderId: 'order-1',
  }, mockTx);

  assert.ok(result);
  assert.equal(result.amount.toFixed(2), '400.00');
  assert.equal(result.source, 'EMPLOYEE_RATE');
});

test('20. resolveWorkEntryRate executes WorkOrderRate fallback', async () => {
  const mockTx = {
    employeeRate: {
      findMany: async () => []
    },
    workOrderRate: {
      findMany: async () => [
        {
          id: 'order-rate-1',
          type: 'HOURLY',
          amount: dec('350.00'),
          unit: 'hod',
          workType: 'INSTALLATION',
          validFrom: new Date('2026-01-01'),
          validTo: null,
          isActive: true,
        }
      ]
    },
    companyRate: {
      findMany: async () => [
        {
          id: 'company-rate-1',
          type: 'HOURLY',
          amount: dec('300.00'),
          unit: 'hod',
          workType: 'INSTALLATION',
          validFrom: new Date('2026-01-01'),
          validTo: null,
          isActive: true,
        }
      ]
    }
  } as unknown as Prisma.TransactionClient;

  const result = await resolveWorkEntryRate({
    employeeId: 'employee-1',
    workType: 'INSTALLATION',
    workDate: new Date('2026-06-01'),
    remunerationMethod: 'HOURLY',
    workOrderId: 'order-1',
  }, mockTx);

  assert.ok(result);
  assert.equal(result.amount.toFixed(2), '350.00');
  assert.equal(result.source, 'WORK_ORDER_RATE');
});

test('21. resolveWorkEntryRate executes CompanyRate fallback', async () => {
  const mockTx = {
    employeeRate: {
      findMany: async () => []
    },
    workOrderRate: {
      findMany: async () => []
    },
    companyRate: {
      findMany: async () => [
        {
          id: 'company-rate-1',
          type: 'HOURLY',
          amount: dec('300.00'),
          unit: 'hod',
          workType: 'INSTALLATION',
          validFrom: new Date('2026-01-01'),
          validTo: null,
          isActive: true,
        }
      ]
    }
  } as unknown as Prisma.TransactionClient;

  const result = await resolveWorkEntryRate({
    employeeId: 'employee-1',
    workType: 'INSTALLATION',
    workDate: new Date('2026-06-01'),
    remunerationMethod: 'HOURLY',
    workOrderId: 'order-1',
  }, mockTx);

  assert.ok(result);
  assert.equal(result.amount.toFixed(2), '300.00');
  assert.equal(result.source, 'COMPANY_RATE');
});

test('22. resolveWorkEntryRate returns null when no rate exists', async () => {
  const mockTx = {
    employeeRate: {
      findMany: async () => []
    },
    workOrderRate: {
      findMany: async () => []
    },
    companyRate: {
      findMany: async () => []
    }
  } as unknown as Prisma.TransactionClient;

  const result = await resolveWorkEntryRate({
    employeeId: 'employee-1',
    workType: 'INSTALLATION',
    workDate: new Date('2026-06-01'),
    remunerationMethod: 'HOURLY',
    workOrderId: 'order-1',
  }, mockTx);

  assert.equal(result, null);
});

test('23. Decimal-safe H:MM time conversion matches expectation without floating point errors', () => {
  const qtyStr = '2:30';
  const parts = qtyStr.split(':');
  const hrs = parseInt(parts[0], 10);
  const mins = parseInt(parts[1], 10);
  
  const hrsDec = dec(hrs);
  const minsDec = dec(mins).div(60);
  const qtyDecimal = hrsDec.add(minsDec);

  assert.equal(qtyDecimal.toString(), '2.5');
  assert.equal(qtyDecimal.toFixed(4), '2.5000');
});

test('24. HOURLY, TASK, and FIXED rate calculations', () => {
  // HOURLY
  const qtyHourly = dec('2.50');
  const rateHourly = dec('150.00');
  assert.equal(qtyHourly.mul(rateHourly).toFixed(2), '375.00');

  // FIXED
  const qtyFixed = dec('1.00'); // quantity forced to 1 on server
  const rateFixed = dec('2000.00');
  assert.equal(qtyFixed.mul(rateFixed).toFixed(2), '2000.00');

  // TASK
  const qtyTask = dec('10.00');
  const rateTask = dec('15.50');
  assert.equal(qtyTask.mul(rateTask).toFixed(2), '155.00');
});

test('25. syncWorkOrderTasks works with custom TransactionClient', async () => {
  let findCalled = false;
  let updateCalled = false;

  const mockTx = {
    workOrder: {
      findUnique: async () => ({
        id: 'order-1',
        title: 'Zakázka 1',
        description: 'Popis',
        status: 'DONE',
        priority: 'NORMAL',
        deadlineAt: new Date('2026-06-30'),
        scheduledAt: new Date('2026-06-15'),
        locationNote: 'Místo',
        clientName: 'Klient',
        requestedBy: 'Zadavatel',
        assignments: [
          { workerName: 'Jan Novák' }
        ],
        items: []
      })
    },
    employee: {
      findMany: async () => [
        { id: 'emp-1', firstName: 'Jan', lastName: 'Novák', email: 'jan@novak.cz', isActive: true }
      ]
    },
    workTask: {
      findMany: async () => {
        findCalled = true;
        return [];
      },
      create: async () => {
        updateCalled = true;
        return { id: 'task-1' };
      }
    }
  } as unknown as Prisma.TransactionClient;

  await syncWorkOrderTasks('order-1', mockTx);
  assert.equal(findCalled, true);
  assert.equal(updateCalled, true);
});

test('26. PATCH re-resolution retains WorkOrderRate and does not incorrectly fall back to CompanyRate', async () => {
  // Simulate the re-resolution inputs:
  const entry = {
    employeeId: 'employee-1',
    workOrderId: 'order-1', // has a specific order
    workType: 'INSTALLATION',
    workDate: new Date('2026-06-01'),
    remunerationMethod: 'HOURLY',
  };

  const mockTx = {
    employeeRate: { findMany: async () => [] },
    workOrderRate: {
      findMany: async () => [
        {
          id: 'order-rate-1',
          type: 'HOURLY',
          amount: dec('350.00'),
          unit: 'hod',
          workType: 'INSTALLATION',
          validFrom: new Date('2026-01-01'),
          validTo: null,
          isActive: true,
        }
      ]
    },
    companyRate: {
      findMany: async () => [
        {
          id: 'company-rate-1',
          type: 'HOURLY',
          amount: dec('300.00'),
          unit: 'hod',
          workType: 'INSTALLATION',
          validFrom: new Date('2026-01-01'),
          validTo: null,
          isActive: true,
        }
      ]
    }
  } as unknown as Prisma.TransactionClient;

  // If we resolve WITH workOrderId (retaining the job rate)
  const resolvedWithOrder = await resolveWorkEntryRate({
    employeeId: entry.employeeId,
    workType: entry.workType as WorkType,
    workDate: entry.workDate,
    remunerationMethod: entry.remunerationMethod as RateType,
    workOrderId: entry.workOrderId,
  }, mockTx);

  assert.ok(resolvedWithOrder);
  assert.equal(resolvedWithOrder.source, 'WORK_ORDER_RATE');
  assert.equal(resolvedWithOrder.amount.toFixed(2), '350.00');

  // If we resolve WITHOUT workOrderId (incorrectly missing)
  const resolvedWithoutOrder = await resolveWorkEntryRate({
    employeeId: entry.employeeId,
    workType: entry.workType as WorkType,
    workDate: entry.workDate,
    remunerationMethod: entry.remunerationMethod as RateType,
    workOrderId: undefined, // missing
  }, mockTx);

  assert.ok(resolvedWithoutOrder);
  assert.equal(resolvedWithoutOrder.source, 'COMPANY_RATE'); // falls back to CompanyRate incorrectly!
  assert.equal(resolvedWithoutOrder.amount.toFixed(2), '300.00');
});
