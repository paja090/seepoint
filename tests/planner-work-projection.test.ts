import test from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import {
  buildPlannerAttentionItems,
  canonicalFirstName,
  extractClockTime,
  normalizePersonToken,
  projectWorkTaskToPlannerTask,
  projectWorkTaskToTimelineItem,
  sortPlannerTasks,
} from '../lib/planner/work-projection';
import { syncWorkOrderTasks } from '../lib/work-task-sync';

test('extractClockTime extracts valid wall-clock times from Czech work descriptions', () => {
  assert.deepEqual(extractClockTime('Porada navigace a CG – 8:30 porada Navigace'), { hour: 8, minute: 30 });
  assert.deepEqual(extractClockTime('Porada nový systém SP – 9:00'), { hour: 9, minute: 0 });
  assert.deepEqual(extractClockTime('Fitko SP – Dovézt osy a ezety od Dušana 9:45'), { hour: 9, minute: 45 });
  assert.equal(extractClockTime('Aréna – Billboard - ulice Závodní Plocha č. 2'), null);
});

test('projectWorkTaskToPlannerTask falls back to scheduledDate and links work orders for Work users', () => {
  const scheduled = new Date('2026-11-12T07:00:00.000Z');
  const managerTask = projectWorkTaskToPlannerTask(
    {
      id: 'wt-1',
      title: 'Porada nový systém SP – 9:00 · Pavel',
      priority: 'HIGH',
      dueDate: null,
      scheduledDate: scheduled,
      plannedTimeHours: 1,
      workOrderId: 'wo-1',
    },
    true
  );
  assert.equal(managerTask.dueAt, '2026-11-12T07:00:00.000Z');
  assert.equal(managerTask.href, '/work/wo-1');
  assert.equal(managerTask.plannedMinutes, 60);

  const workerTask = projectWorkTaskToPlannerTask(
    {
      id: 'wt-2',
      title: 'Montáž banneru',
      priority: 'NORMAL',
      dueDate: null,
      scheduledDate: scheduled,
      plannedTimeHours: null,
      workOrderId: 'wo-1',
    },
    false
  );
  assert.equal(workerTask.href, '/my-tasks?taskId=wt-2');
});

test('projectWorkTaskToTimelineItem maps timed tasks to busy blocks and untimed tasks to non-blocking day items', () => {
  const timed = projectWorkTaskToTimelineItem(
    {
      id: 'wt-timed',
      title: 'Porada navigace a CG – 8:30 porada',
      priority: 'NORMAL',
      dueDate: null,
      scheduledDate: new Date('2026-11-12T07:00:00.000Z'),
      plannedTimeHours: null,
      workOrderId: 'wo-9',
    },
    'Europe/Prague',
    true
  )!;
  assert.equal(timed.source, 'WORK_PLAN');
  assert.equal(timed.busy, true);
  assert.equal(timed.allDay, false);
  // 08:30 CET = 07:30 UTC (default 30 min when plannedTimeHours is unset)
  assert.equal(timed.startAt, '2026-11-12T07:30:00.000Z');
  assert.equal(timed.endAt, '2026-11-12T08:00:00.000Z');
  assert.equal(timed.href, '/work/wo-9');

  const untimed = projectWorkTaskToTimelineItem(
    {
      id: 'wt-day',
      title: 'Auta kontrola – výbava aut',
      priority: 'HIGH',
      dueDate: null,
      scheduledDate: new Date('2026-11-12T07:00:00.000Z'),
      plannedTimeHours: null,
      workOrderId: 'wo-10',
    },
    'Europe/Prague',
    true
  )!;
  assert.equal(untimed.allDay, true);
  assert.equal(untimed.busy, false);
});

test('sortPlannerTasks and buildPlannerAttentionItems prioritize today, tomorrow, and recent overdue work', () => {
  const sorted = sortPlannerTasks(
    [
      { id: 'old', sourceKind: 'WORK_TASK', title: 'Old backlog', dueAt: '2026-10-20T10:00:00.000Z', priority: 'NORMAL', href: '/work/old', plannedMinutes: null },
      { id: 'undated', sourceKind: 'QUICK_TASK', title: 'Bez termínu', dueAt: null, priority: 'LOW', href: '/my-tasks', plannedMinutes: null },
      { id: 'tomorrow', sourceKind: 'WORK_TASK', title: 'Tomorrow task', dueAt: '2026-11-12T07:00:00.000Z', priority: 'HIGH', href: '/work/tom', plannedMinutes: null },
      { id: 'today', sourceKind: 'WORK_TASK', title: 'Today task', dueAt: '2026-11-11T07:00:00.000Z', priority: 'NORMAL', href: '/work/tod', plannedMinutes: null },
    ],
    '2026-11-11',
    'Europe/Prague'
  );
  assert.deepEqual(sorted.map((t) => t.id), ['today', 'tomorrow', 'old', 'undated']);

  const attention = buildPlannerAttentionItems({
    tasks: sorted,
    todayDate: '2026-11-11',
    tomorrowDate: '2026-11-12',
    timezone: 'Europe/Prague',
    hasCollision: false,
    unassignedOrdersCount: 2,
  });
  assert.equal(attention[0].href, '/work');
  assert.equal(attention[1].reason, 'Dnes v plánu');
  assert.equal(attention[2].reason, 'Zítra v plánu');
  assert.match(attention[3].reason, /Po termínu/);
});

test('Czech worker alias resolution links Vlaďka, Mirek, and Ondra Krašik while keeping ambiguous first names separate', async () => {
  assert.equal(normalizePersonToken('Vlaďka'), 'vladka');
  assert.equal(canonicalFirstName('Mirek'), canonicalFirstName('Miroslav'));
  assert.equal(canonicalFirstName('Vlaďka'), canonicalFirstName('Vladimíra'));

  const createdTasks: Array<{ title: string; assignedToEmployeeId: string | null }> = [];
  const tx = {
    workOrder: {
      findUnique: async () => ({
        id: 'order-aliases',
        organizationId: 'org-seepoint',
        title: 'Kontrola trasy',
        description: null,
        clientName: 'Klient',
        locationNote: null,
        requestedBy: null,
        status: 'PLANNED',
        priority: 'NORMAL',
        scheduledAt: new Date('2026-11-12T07:00:00.000Z'),
        deadlineAt: null,
        items: [],
        assignments: [
          { workerName: 'Vlaďka', userId: null },
          { workerName: 'Mirek', userId: null },
          { workerName: 'Ondra Krašik', userId: null },
          { workerName: 'Marek', userId: null },
        ],
      }),
    },
    employee: {
      findMany: async () => [
        { id: 'emp-vladka', firstName: 'Vladimíra', lastName: 'Konečná', email: null },
        { id: 'emp-mirek', firstName: 'Miroslav', lastName: 'Mec', email: null },
        { id: 'emp-ondra', firstName: 'Ondřej', lastName: 'Krasula', email: null },
        { id: 'emp-marek-1', firstName: 'Marek', lastName: 'Konečný', email: null },
        { id: 'emp-marek-2', firstName: 'Marek', lastName: 'Slapnička', email: null },
      ],
    },
    workTask: {
      findMany: async () => [],
      create: async ({ data }: { data: { title: string; assignedToEmployeeId: string | null } }) => {
        createdTasks.push({ title: data.title, assignedToEmployeeId: data.assignedToEmployeeId });
        return data;
      },
    },
  } as unknown as Prisma.TransactionClient;

  await syncWorkOrderTasks('order-aliases', tx, { preserveLoggedTasks: true });
  const byTitle = (suffix: string) => createdTasks.find((t) => t.title.endsWith(suffix))?.assignedToEmployeeId;
  assert.equal(byTitle('Vlaďka'), 'emp-vladka');
  assert.equal(byTitle('Mirek'), 'emp-mirek');
  assert.equal(byTitle('Ondra Krašik'), 'emp-ondra');
  assert.equal(byTitle('Marek'), null, 'Ambiguous first name matching two employees must not guess');
});
