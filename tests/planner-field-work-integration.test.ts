import test from 'node:test';
import assert from 'node:assert/strict';
import type { PlannerItem, PlannerTask, SourceKind } from '../lib/planner/domain';
import { busyMinutes, capacity } from '../lib/planner/scheduling';
import { defaultPreferences } from '../lib/planner/preferences';

test('Planner domain supports FIELD_TRIP source and FIELD_TASK sourceKind', () => {
  const sourceKind: SourceKind = 'FIELD_TASK';
  assert.equal(sourceKind, 'FIELD_TASK');

  const item: PlannerItem = {
    id: 'field-plan:plan-1:crew-1',
    title: 'Výjezd: Volby 2026',
    startAt: '2026-10-18T07:00:00.000Z',
    endAt: '2026-10-18T15:00:00.000Z',
    source: 'FIELD_TRIP',
    busy: true,
    location: 'Vozidlo: Dodávka 1 · 12 zastávek',
    href: '/election-removal/camp-1/route',
  };
  assert.equal(item.source, 'FIELD_TRIP');
  assert.equal(item.busy, true);
  assert.equal(item.href, '/election-removal/camp-1/route');

  const task: PlannerTask = {
    id: 'point-1',
    sourceKind: 'FIELD_TASK',
    title: 'Demontáž: Banner Centrum',
    dueAt: '2026-10-18T10:00:00.000Z',
    priority: 'HIGH',
    href: '/election-removal/camp-1',
    plannedMinutes: 15,
  };
  assert.equal(task.sourceKind, 'FIELD_TASK');
  assert.equal(task.priority, 'HIGH');
});

test('FIELD_TRIP calendar blocks automatically reduce employee free capacity in Planner', () => {
  const tripItem: PlannerItem = {
    id: 'field-plan:1',
    title: 'Terénní výjezd',
    startAt: '2026-10-19T07:00:00.000Z',
    endAt: '2026-10-19T13:00:00.000Z',
    source: 'FIELD_TRIP',
    busy: true,
  };

  const busy = busyMinutes([tripItem], { startAt: '2026-10-19T07:00:00.000Z', endAt: '2026-10-19T15:00:00.000Z' });
  assert.equal(busy, 360); // 6 hours = 360 minutes

  const cap = capacity('2026-10-19', defaultPreferences, [tripItem]);
  assert.equal(cap.busyMinutes, 330);
  assert.equal(cap.freeMinutes, cap.totalMinutes - cap.busyMinutes);
  assert.ok(cap.freeMinutes < cap.totalMinutes);
});
