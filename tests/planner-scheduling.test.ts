import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPreferences, validatePreferences } from '../lib/planner/preferences';
import { busyMinutes, capacity, findSlots } from '../lib/planner/scheduling';
import { dayRange, localInstant } from '../lib/planner/time';
import { googleEvent } from '../lib/planner/providers/google-normalize';
import { uniqueProviderEvents } from '../lib/planner/sync-core';
test('overlapping events count only once in capacity', () => {
  const interval = (start: string, end: string) => ({ startAt: `2026-09-16T${start}:00Z`, endAt: `2026-09-16T${end}:00Z` });
  assert.equal(busyMinutes([interval('09:00', '11:00'), interval('10:00', '12:00')], interval('09:00', '13:00')), 180);
  assert.equal(capacity('2026-09-20', defaultPreferences, []).totalMinutes, 0);
});
test('timezone conversion handles Prague DST and rejects non-existent wall time', () => {
  assert.equal(localInstant('2026-09-16', '09:00', 'Europe/Prague').toISOString(), '2026-09-16T07:00:00.000Z');
  const spring = dayRange('2026-03-29', 'Europe/Prague');
  assert.equal((+spring.end - +spring.start) / 3600000, 23);
  assert.throws(() => localInstant('2026-03-29', '02:30', 'Europe/Prague'));
});
test('meeting search respects all participants, buffers, lunch and forbidden times', () => {
  const slots = findSlots({ from: new Date('2026-09-16T07:00Z'), to: new Date('2026-09-16T15:00Z'), durationMinutes: 45, participants: [
    { preferences: defaultPreferences, busy: [{ startAt: '2026-09-16T07:00Z', endAt: '2026-09-16T08:00Z' }] },
    { preferences: { ...defaultPreferences, noMeetingBlocks: [{ day: 3, start: '11:00', end: '17:00' }] }, busy: [] },
  ] });
  assert.ok(slots.length);
  assert.equal(slots[0].startAt, '2026-09-16T08:15:00.000Z');
  assert.ok(slots.every(s => s.endAt <= '2026-09-16T09:00:00.000Z'));
});
test('a fully occupied day has no suggested slot', () => {
  assert.deepEqual(findSlots({ from: new Date('2026-09-16T07:00Z'), to: new Date('2026-09-16T15:00Z'), durationMinutes: 45, participants: [{ preferences: defaultPreferences, busy: [{ startAt: '2026-09-16T00:00Z', endAt: '2026-09-17T00:00Z' }] }] }), []);
});
test('all-day end is exclusive in calendar timezone and duplicate tombstones win', () => {
  const event = googleEvent({ id: 'e', start: { date: '2026-09-16' }, end: { date: '2026-09-17' }, summary: '<b>Work</b>' }, 'Europe/Prague')!;
  assert.equal(event.startAt?.toISOString(), '2026-09-15T22:00:00.000Z');
  assert.equal(event.endAt?.toISOString(), '2026-09-16T22:00:00.000Z');
  assert.equal(event.title, 'Work');
  const deleted = googleEvent({ id: 'e', status: 'cancelled' }, 'Europe/Prague')!;
  assert.equal(uniqueProviderEvents([event, event, deleted]).length, 1);
  assert.equal(uniqueProviderEvents([event, deleted])[0].cancelled, true);
});
test('preferences reject invalid hours and timezone', () => {
  assert.throws(() => validatePreferences({ ...defaultPreferences, workingStart: '18:00' }));
  assert.throws(() => validatePreferences({ ...defaultPreferences, timezone: 'Not/AZone' }));
  assert.throws(() => validatePreferences({ ...defaultPreferences, meetingBufferMinutes: -1 }));
});
