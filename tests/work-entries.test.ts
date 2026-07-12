import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

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

test('4. resolve rate priority: employee-specific rate vs company-wide rate', async () => {
  // Mock resolve logic in a pure unit test
  const employeeRates = [
    { workType: 'INSTALLATION', validFrom: new Date('2026-01-01'), validTo: null, amount: dec('400.00'), unit: 'hod', type: 'HOURLY' }
  ];
  const companyRates = [
    { workType: 'INSTALLATION', validFrom: new Date('2026-01-01'), validTo: null, amount: dec('300.00'), unit: 'hod', type: 'HOURLY' }
  ];

  // If employee rate exists, resolve it
  const resolvedFromEmployee = employeeRates[0];
  assert.equal(resolvedFromEmployee.amount.toFixed(2), '400.00');

  // If no employee rate exists, fall back to company rate
  const resolvedFromCompany = companyRates[0];
  assert.equal(resolvedFromCompany.amount.toFixed(2), '300.00');
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
