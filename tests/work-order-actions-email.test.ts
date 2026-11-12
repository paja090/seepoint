import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRescheduleUpdate,
  parseRescheduleDate,
  WorkOrderActionError,
} from '../lib/work/work-order-actions.ts';

test('parseRescheduleDate rejects impossible calendar dates like Feb 30', () => {
  assert.throws(() => parseRescheduleDate('2026-02-30'), WorkOrderActionError);
  assert.throws(() => parseRescheduleDate('   '), WorkOrderActionError);
  const valid = parseRescheduleDate('2026-11-13');
  assert.equal(valid.toISOString(), '2026-11-13T07:00:00.000Z');
});

test('computeRescheduleUpdate locks manual reschedule against Google Sheet revert and preserves original sheet origin date across repeated moves', () => {
  const firstMove = computeRescheduleUpdate({
    existing: {
      id: 'wo-1',
      scheduledAt: new Date('2026-11-12T07:00:00.000Z'),
      deadlineAt: new Date('2026-11-12T17:00:00.000Z'),
      status: 'PLANNED',
      locationNote: 'Masarykovo nám.',
      planningConstraints: { source: 'GOOGLE_SHEETS_PLAN', sheetKey: 'k1', sheetRow: 4 },
    },
    targetDate: '2026-11-13',
    reason: 'Počasí / déšť',
    note: 'Pršelo celé odpoledne',
    actorName: 'Miroslav Mec',
    viaEmail: true,
    now: new Date('2026-11-12T16:30:00.000Z'),
  });

  assert.equal(firstMove.newDateIso, '2026-11-13');
  assert.equal(firstMove.status, 'PLANNED');
  assert.equal(firstMove.deadlineAt?.toISOString().slice(0, 10), '2026-11-13');
  assert.match(firstMove.locationNote || '', /Přesunuto \(Miroslav Mec\)/);
  assert.match(firstMove.locationNote || '', /Počasí \/ déšť – Pršelo celé odpoledne/);

  const pc = firstMove.planningConstraints as Record<string, unknown>;
  assert.equal(pc.manualScheduledDateIso, '2026-11-13');
  assert.equal(pc.sheetScheduledDateAtReschedule, '2026-11-12');
  assert.equal(pc.lastEmailAction, 'RESCHEDULED');
  assert.equal(pc.lastWorkerReportBy, 'Miroslav Mec');

  // Second reschedule on the next day keeps original sheet date '2026-11-12'
  const secondMove = computeRescheduleUpdate({
    existing: {
      id: 'wo-1',
      scheduledAt: firstMove.scheduledAt,
      deadlineAt: firstMove.deadlineAt,
      status: firstMove.status,
      locationNote: firstMove.locationNote,
      planningConstraints: pc,
    },
    targetDate: '2026-11-14',
    reason: 'Klient nebyl k zastižení',
    actorName: 'Miroslav Mec',
    viaEmail: true,
    now: new Date('2026-11-13T16:00:00.000Z'),
  });

  const pc2 = secondMove.planningConstraints as Record<string, unknown>;
  assert.equal(pc2.manualScheduledDateIso, '2026-11-14');
  assert.equal(pc2.sheetScheduledDateAtReschedule, '2026-11-12');
});
