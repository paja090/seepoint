import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { syncWorkOrderTasks } from '../lib/work-task-sync';

function fixture() {
  const tasks: Array<{ id: string; title: string; assignedToEmployeeId: string | null; workEntries: Array<{ id: string; quantity: number }> }> = [
    { id: 'logged', title: 'lepení bilboardu', assignedToEmployeeId: 'former-worker', workEntries: [{ id: 'entry-1', quantity: 3 }] },
    { id: 'obsolete', title: 'Old task', assignedToEmployeeId: 'other-worker', workEntries: [] },
  ];
  const deleted: string[] = [];
  const updated: string[] = [];
  const tx = {
    workOrder: { findUnique: async () => ({
      id: 'order-1', organizationId: 'org-1', title: 'Current title', status: 'PLANNED',
      priority: 'NORMAL', assignments: [], items: [], scheduledAt: new Date('2026-10-30'),
    }) },
    employee: { findMany: async () => [] },
    workTask: {
      findMany: async () => structuredClone(tasks),
      create: async ({ data }: { data: { title: string; assignedToEmployeeId: string | null } }) => {
        const task = { id: 'current', workEntries: [], ...data };
        tasks.push(task);
        return task;
      },
      update: async ({ where }: { where: { id: string } }) => { updated.push(where.id); },
      delete: async ({ where }: { where: { id: string } }) => {
        deleted.push(where.id);
        tasks.splice(tasks.findIndex(t => t.id === where.id), 1);
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, tasks, deleted, updated };
}

test('automatic sync preserves logged history and is idempotent', async () => {
  const f = fixture();
  const history = structuredClone(f.tasks[0]);
  await syncWorkOrderTasks('order-1', f.tx, { preserveLoggedTasks: true });
  await syncWorkOrderTasks('order-1', f.tx, { preserveLoggedTasks: true });
  assert.deepEqual(f.tasks.find(t => t.id === 'logged'), history);
  assert.deepEqual(f.deleted, ['obsolete']);
  assert.equal(f.tasks.filter(t => t.id === 'current').length, 1);
  assert.deepEqual(f.updated, ['current']);
});

test('explicit edits still reject removing a worker with logged work', async () => {
  const f = fixture();
  await assert.rejects(syncWorkOrderTasks('order-1', f.tx), /NELZE_ODEBRAT_PRACOVNIKA/);
  assert.equal(f.deleted.includes('logged'), false);
});

test('explicit false retains the same protection', async () => {
  const f = fixture();
  await assert.rejects(syncWorkOrderTasks('order-1', f.tx, { preserveLoggedTasks: false }), /NELZE_ODEBRAT_PRACOVNIKA/);
  assert.equal(f.deleted.includes('logged'), false);
});
