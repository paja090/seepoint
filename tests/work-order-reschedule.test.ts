import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma, WorkOrderStatus } from '@prisma/client';
import { syncWorkOrderTasks } from '../lib/work-task-sync';

// Helper mirroring reschedule logic in route
function computeReschedulePayload(params: {
  existingScheduledAt: Date;
  existingDeadlineAt: Date | null;
  existingStatus: WorkOrderStatus;
  existingLocationNote: string | null;
  rawTargetDate: string;
  reason?: string;
}) {
  const rawDate = params.rawTargetDate.trim();
  let newScheduledAt: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split('-').map(Number);
    newScheduledAt = new Date(Date.UTC(y, m - 1, d, 7, 0, 0));
  } else {
    newScheduledAt = new Date(rawDate);
  }

  if (Number.isNaN(newScheduledAt.getTime())) {
    throw new Error('INVALID_DATE');
  }

  // Adjust deadline if new scheduledAt is after existing deadline
  let deadlineAt = params.existingDeadlineAt;
  if (deadlineAt && newScheduledAt > deadlineAt) {
    deadlineAt = newScheduledAt;
  }

  // Append reschedule reason to location/reschedule note history
  let locationNote = params.existingLocationNote;
  const oldDateStr = params.existingScheduledAt.toLocaleDateString('cs-CZ');
  const newDateStr = newScheduledAt.toLocaleDateString('cs-CZ');

  const reasonText = params.reason?.trim();
  const rescheduleLog = `[Přeplánováno z ${oldDateStr} na ${newDateStr}${reasonText ? `: ${reasonText}` : ''}]`;
  locationNote = locationNote ? `${locationNote}\n${rescheduleLog}` : rescheduleLog;

  // Reactivate completed / cancelled orders to PLANNED
  const status =
    params.existingStatus === 'DONE' || params.existingStatus === 'CANCELLED'
      ? 'PLANNED'
      : params.existingStatus;

  return {
    scheduledAt: newScheduledAt,
    deadlineAt,
    status,
    locationNote,
    newDateStr,
  };
}

test('reschedule computes correct scheduledAt date for YYYY-MM-DD input', () => {
  const existing = new Date('2026-11-10T07:00:00.000Z');
  const result = computeReschedulePayload({
    existingScheduledAt: existing,
    existingDeadlineAt: new Date('2026-11-15T18:00:00.000Z'),
    existingStatus: 'PLANNED',
    existingLocationNote: 'Kancelář Brno',
    rawTargetDate: '2026-11-12',
    reason: 'Klient neměl připravené podklady',
  });

  assert.equal(result.scheduledAt.toISOString(), '2026-11-12T07:00:00.000Z');
  assert.equal(result.status, 'PLANNED');
  assert.match(result.locationNote, /\[Přeplánováno z .* na .*: Klient neměl připravené podklady\]/);
  assert.ok(result.locationNote.startsWith('Kancelář Brno\n'));
});

test('reschedule auto-pushes deadline if new scheduled date is after original deadline', () => {
  const existing = new Date('2026-11-10T07:00:00.000Z');
  const oldDeadline = new Date('2026-11-11T12:00:00.000Z');
  const result = computeReschedulePayload({
    existingScheduledAt: existing,
    existingDeadlineAt: oldDeadline,
    existingStatus: 'IN_PROGRESS',
    existingLocationNote: null,
    rawTargetDate: '2026-11-14',
  });

  assert.equal(result.scheduledAt.toISOString(), '2026-11-14T07:00:00.000Z');
  // Deadline pushed forward to match new scheduledAt
  assert.equal(result.deadlineAt?.toISOString(), '2026-11-14T07:00:00.000Z');
  assert.equal(result.status, 'IN_PROGRESS');
});

test('reschedule reopens completed or cancelled work order to PLANNED', () => {
  const existing = new Date('2026-11-05T07:00:00.000Z');
  const resultDone = computeReschedulePayload({
    existingScheduledAt: existing,
    existingDeadlineAt: null,
    existingStatus: 'DONE',
    existingLocationNote: null,
    rawTargetDate: '2026-11-12',
  });
  assert.equal(resultDone.status, 'PLANNED');

  const resultCancelled = computeReschedulePayload({
    existingScheduledAt: existing,
    existingDeadlineAt: null,
    existingStatus: 'CANCELLED',
    existingLocationNote: null,
    rawTargetDate: '2026-11-12',
  });
  assert.equal(resultCancelled.status, 'PLANNED');
});

test('reschedule throws on invalid date', () => {
  assert.throws(() => {
    computeReschedulePayload({
      existingScheduledAt: new Date(),
      existingDeadlineAt: null,
      existingStatus: 'PLANNED',
      existingLocationNote: null,
      rawTargetDate: 'invalid-date-string',
    });
  }, /INVALID_DATE/);
});

test('syncWorkOrderTasks propagates rescheduled date to employee tasks', async () => {
  const updatedTasks: Array<{ id: string; scheduledDate?: Date; dueDate?: Date | null }> = [];
  const fakeTasks = [
    {
      id: 'task-1',
      title: 'Montáž polepu · Jan Novák',
      assignedToEmployeeId: 'emp-1',
      workEntries: [],
    },
  ];

  const newScheduledAt = new Date('2026-11-15T07:00:00.000Z');
  const newDeadlineAt = new Date('2026-11-16T18:00:00.000Z');

  const tx = {
    workOrder: {
      findUnique: async () => ({
        id: 'order-rescheduled',
        organizationId: 'org-test',
        title: 'Montáž polepu',
        status: 'PLANNED',
        priority: 'HIGH',
        assignments: [{ workerName: 'Jan Novák', userId: null }],
        items: [],
        scheduledAt: newScheduledAt,
        deadlineAt: newDeadlineAt,
        description: 'Test popisku',
        locationNote: 'Brno střed',
      }),
    },
    employee: {
      findMany: async () => [
        { id: 'emp-1', firstName: 'Jan', lastName: 'Novák', email: 'jan@example.com', isActive: true },
      ],
      findFirst: async () => null,
    },
    workTask: {
      findMany: async () => structuredClone(fakeTasks),
      create: async () => ({ id: 'new-task' }),
      update: async ({ where, data }: { where: { id: string }; data: { scheduledDate?: Date; dueDate?: Date | null } }) => {
        updatedTasks.push({ id: where.id, scheduledDate: data.scheduledDate, dueDate: data.dueDate });
      },
      delete: async () => {},
    },
  } as unknown as Prisma.TransactionClient;

  await syncWorkOrderTasks('order-rescheduled', tx, { preserveLoggedTasks: true });

  assert.equal(updatedTasks.length, 1);
  assert.equal(updatedTasks[0].id, 'task-1');
  assert.equal(updatedTasks[0].scheduledDate?.toISOString(), newScheduledAt.toISOString());
  assert.equal(updatedTasks[0].dueDate?.toISOString(), newDeadlineAt.toISOString());
});
