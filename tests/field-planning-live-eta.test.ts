import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRouteLiveETA, formatLiveClock } from '../lib/field-planning/live-eta';
import type { MyRouteStop } from '../lib/field-planning/contracts';

function makeMockStop(partial: Partial<MyRouteStop>): MyRouteStop {
  return {
    jobId: 'job-1',
    workOrderId: 'wo-1',
    workOrderItemId: null,
    navigationPointId: null,
    electionRemovalPointId: null,
    address: 'Vodičkova 10, Praha',
    pointPhotoUrl: null,
    orderTitle: 'Zakázka 1',
    title: 'Instalace lavičky',
    clientName: 'Magistrát',
    instructions: '',
    status: 'PLANNED',
    issueType: null,
    issueNote: null,
    workType: 'BENCH_INSTALLATION',
    startAt: '2026-10-11T08:15:00.000Z',
    endAt: '2026-10-11T08:35:00.000Z',
    location: { latitude: 50.08, longitude: 14.42 },
    taskId: null,
    navigationOrderId: null,
    carrier: null,
    serviceMinutes: 20,
    travelMinutes: 15,
    ...partial,
  };
}

test('Live ETA: Shifts all stops and shift end when worker starts late (e.g. 10:00 instead of 08:00)', () => {
  const stops: MyRouteStop[] = [
    makeMockStop({
      jobId: 'stop-1',
      startAt: '2026-10-11T08:15:00.000Z',
      endAt: '2026-10-11T08:45:00.000Z',
      travelMinutes: 15,
      serviceMinutes: 30,
      status: 'IN_PROGRESS',
      startedAt: '2026-10-11T10:00:00.000Z', // Started 1h 45m late
    }),
    makeMockStop({
      jobId: 'stop-2',
      startAt: '2026-10-11T09:00:00.000Z',
      endAt: '2026-10-11T09:30:00.000Z',
      travelMinutes: 15,
      serviceMinutes: 30,
      status: 'PLANNED',
    }),
  ];

  const route = {
    departureAt: '2026-10-11T08:00:00.000Z',
    endAt: '2026-10-11T09:45:00.000Z', // 15m return drive from stop-2
    stops,
  };

  const result = computeRouteLiveETA(route, {
    now: new Date('2026-10-11T10:05:00.000Z'),
    targetDate: '2026-10-11',
  });

  // Stop 1: started at 10:00, expected end 10:30
  assert.equal(result.stops[0].liveEstimatedStartAt, '2026-10-11T10:00:00.000Z');
  assert.equal(result.stops[0].liveEstimatedEndAt, '2026-10-11T10:30:00.000Z');
  assert.equal(result.stops[0].delayMinutes, 105); // 1h 45m delay

  // Stop 2: previous end 10:30 + 15m travel = 10:45 start, + 30m service = 11:15 end
  assert.equal(result.stops[1].liveEstimatedStartAt, '2026-10-11T10:45:00.000Z');
  assert.equal(result.stops[1].liveEstimatedEndAt, '2026-10-11T11:15:00.000Z');
  assert.equal(result.stops[1].delayMinutes, 105);

  // Return to warehouse: 11:15 + 15m return drive = 11:30
  assert.equal(result.liveEstimatedEndAt, '2026-10-11T11:30:00.000Z');
  assert.equal(result.totalDelayMinutes, 105); // 11:30 vs planned 09:45
  assert.equal(result.hasStarted, true);
  assert.equal(result.isOngoingShift, true);
});

test('Live ETA: Recalculates remaining stops when earlier stop finishes early', () => {
  const stops: MyRouteStop[] = [
    makeMockStop({
      jobId: 'stop-1',
      startAt: '2026-10-11T08:15:00.000Z',
      endAt: '2026-10-11T08:45:00.000Z',
      travelMinutes: 15,
      serviceMinutes: 30,
      status: 'DONE',
      startedAt: '2026-10-11T08:15:00.000Z',
      completedAt: '2026-10-11T08:30:00.000Z', // Finished 15m faster!
      actualDurationMinutes: 15,
    }),
    makeMockStop({
      jobId: 'stop-2',
      startAt: '2026-10-11T09:00:00.000Z',
      endAt: '2026-10-11T09:30:00.000Z',
      travelMinutes: 15,
      serviceMinutes: 30,
      status: 'PLANNED',
    }),
  ];

  const route = {
    departureAt: '2026-10-11T08:00:00.000Z',
    endAt: '2026-10-11T09:45:00.000Z',
    stops,
  };

  const result = computeRouteLiveETA(route, {
    now: new Date('2026-10-11T08:31:00.000Z'),
    targetDate: '2026-10-11',
  });

  // Stop 2 cascades from 08:30 completion + 15m travel = 08:45 start (15m lead!)
  assert.equal(result.stops[1].liveEstimatedStartAt, '2026-10-11T08:45:00.000Z');
  assert.equal(result.stops[1].liveEstimatedEndAt, '2026-10-11T09:15:00.000Z');
  assert.equal(result.stops[1].delayMinutes, -15); // 15 min ahead of schedule

  // Return to warehouse: 09:15 + 15m = 09:30 (15 min earlier than planned 09:45)
  assert.equal(result.liveEstimatedEndAt, '2026-10-11T09:30:00.000Z');
  assert.equal(result.totalDelayMinutes, -15);
});

test('Live ETA: When entire trip is completed, reports actual return time and final delta', () => {
  const stops: MyRouteStop[] = [
    makeMockStop({
      jobId: 'stop-1',
      startAt: '2026-10-11T08:15:00.000Z',
      endAt: '2026-10-11T08:45:00.000Z',
      status: 'DONE',
      startedAt: '2026-10-11T08:20:00.000Z',
      completedAt: '2026-10-11T08:50:00.000Z',
    }),
  ];

  const route = {
    departureAt: '2026-10-11T08:00:00.000Z',
    endAt: '2026-10-11T09:10:00.000Z',
    tripStartedAt: '2026-10-11T08:05:00.000Z',
    tripCompletedAt: '2026-10-11T09:15:00.000Z', // Returned at 09:15 (+5 min)
    stops,
  };

  const result = computeRouteLiveETA(route);
  assert.equal(result.liveEstimatedEndAt, '2026-10-11T09:15:00.000Z');
  assert.equal(result.totalDelayMinutes, 5);
  assert.equal(result.hasStarted, true);
  assert.equal(result.isOngoingShift, false);
});

test('Live ETA: Preserves planned times for future date before departure', () => {
  const stops: MyRouteStop[] = [
    makeMockStop({
      jobId: 'stop-1',
      startAt: '2026-10-12T08:15:00.000Z',
      endAt: '2026-10-12T08:45:00.000Z',
      travelMinutes: 15,
      serviceMinutes: 30,
      status: 'PLANNED',
    }),
  ];

  const route = {
    departureAt: '2026-10-12T08:00:00.000Z',
    endAt: '2026-10-12T09:00:00.000Z',
    stops,
  };

  const result = computeRouteLiveETA(route, {
    now: new Date('2026-10-11T20:00:00.000Z'),
    targetDate: '2026-10-12',
  });

  assert.equal(result.stops[0].delayMinutes, 0);
  assert.equal(result.totalDelayMinutes, 0);
  assert.equal(result.hasStarted, false);
});

test('Live ETA: Correctly reflects stop from tomorrow completed today in advance', () => {
  const stops: MyRouteStop[] = [
    makeMockStop({
      jobId: 'stop-1',
      startAt: '2026-10-12T08:15:00.000Z',
      endAt: '2026-10-12T08:45:00.000Z',
      status: 'DONE',
      startedAt: '2026-10-11T14:00:00.000Z', // Completed day before!
      completedAt: '2026-10-11T14:25:00.000Z',
      actualDurationMinutes: 25,
    }),
    makeMockStop({
      jobId: 'stop-2',
      startAt: '2026-10-12T09:00:00.000Z',
      endAt: '2026-10-12T09:30:00.000Z',
      status: 'PLANNED',
    }),
  ];

  const route = {
    departureAt: '2026-10-12T08:00:00.000Z',
    endAt: '2026-10-12T09:45:00.000Z',
    stops,
  };

  const result = computeRouteLiveETA(route, {
    now: new Date('2026-10-11T15:00:00.000Z'),
    targetDate: '2026-10-12',
  });

  assert.equal(result.stops[0].status, 'DONE');
  assert.equal(result.stops[0].liveEstimatedStartAt, '2026-10-11T14:00:00.000Z');
});

test('formatLiveClock: Formats ISO timestamp in local Prague timezone', () => {
  assert.equal(formatLiveClock('2026-10-11T08:15:00.000Z', 'UTC'), '08:15');
  assert.equal(formatLiveClock(null), '—');
});
