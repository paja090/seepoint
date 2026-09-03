import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveSurfaceOccupancyState, BasicOccupancy } from '../lib/occupancy.js';

test('deriveSurfaceOccupancyState - returns AVAILABLE when no occupancies exist', () => {
  const state = deriveSurfaceOccupancyState([]);
  assert.equal(state.status, 'AVAILABLE');
  assert.equal(state.currentClientId, null);
  assert.equal(state.activeOccupancyId, null);
});

test('deriveSurfaceOccupancyState - ignores CANCELLED and FINISHED occupancies', () => {
  const occupancies: BasicOccupancy[] = [
    {
      id: 'occ-1',
      clientId: 'client-1',
      status: 'FINISHED',
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-12-31'),
    },
    {
      id: 'occ-2',
      clientId: 'client-2',
      status: 'CANCELLED',
      dateFrom: new Date('2026-01-01'),
      dateTo: new Date('2026-12-31'),
    },
  ];

  const state = deriveSurfaceOccupancyState(occupancies, new Date('2026-08-17'));
  assert.equal(state.status, 'AVAILABLE');
  assert.equal(state.currentClientId, null);
});

test('deriveSurfaceOccupancyState - correctly identifies active OCCUPIED state', () => {
  const occupancies: BasicOccupancy[] = [
    {
      id: 'occ-active',
      clientId: 'client-active',
      status: 'OCCUPIED',
      dateFrom: new Date('2026-08-01'),
      dateTo: new Date('2026-08-31'),
    },
  ];

  const state = deriveSurfaceOccupancyState(occupancies, new Date('2026-08-17'));
  assert.equal(state.status, 'OCCUPIED');
  assert.equal(state.currentClientId, 'client-active');
  assert.equal(state.activeOccupancyId, 'occ-active');
});

test('deriveSurfaceOccupancyState - prioritizes OCCUPIED over NEGOTIATION', () => {
  const occupancies: BasicOccupancy[] = [
    {
      id: 'occ-neg',
      clientId: 'client-neg',
      status: 'NEGOTIATION',
      dateFrom: new Date('2026-08-01'),
      dateTo: new Date('2026-08-31'),
    },
    {
      id: 'occ-occ',
      clientId: 'client-occ',
      status: 'OCCUPIED',
      dateFrom: new Date('2026-08-01'),
      dateTo: new Date('2026-08-31'),
    },
  ];

  const state = deriveSurfaceOccupancyState(occupancies, new Date('2026-08-17'));
  assert.equal(state.status, 'OCCUPIED');
  assert.equal(state.currentClientId, 'client-occ');
});

test('occupancy client components receive a server reference date for hydration-safe rendering', () => {
  const page = readFileSync(new URL('../app/occupancy/page.tsx', import.meta.url), 'utf8');
  const table = readFileSync(new URL('../components/OccupancyTableWithBulk.tsx', import.meta.url), 'utf8');
  const quickForm = readFileSync(new URL('../components/QuickOccupancyBookingForm.tsx', import.meta.url), 'utf8');
  assert.match(page, /referenceDate=\{today\.toISOString\(\)\}/);
  assert.match(page, /defaultDateFrom=\{today\.toISOString\(\)\.slice\(0, 10\)\}/);
  assert.doesNotMatch(table, /const today = new Date\(\)/);
  assert.doesNotMatch(quickForm, /useState\(new Date\(\)/);
});
