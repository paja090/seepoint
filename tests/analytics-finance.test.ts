import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { deriveAnalyticsSurfaceState } from '../lib/analytics-finance.ts';

const asOf = new Date('2026-08-25T12:00:00.000Z');

test('active explicitly priced occupancy contributes known monthly rent', () => {
  const result = deriveAnalyticsSurfaceState({
    surfaceStatus: 'AVAILABLE',
    contract: null,
    occupancies: [{ status: 'OCCUPIED', price: 4200 }],
    asOf,
  });
  assert.deepEqual(result, { isOccupied: true, monthlyRent: 4200, hasExplicitPrice: true });
});

test('valid active contract price has priority over occupancy price', () => {
  const result = deriveAnalyticsSurfaceState({
    surfaceStatus: 'OCCUPIED',
    contract: {
      status: 'ACTIVE',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      monthlyPrice: 5000,
    },
    occupancies: [{ status: 'OCCUPIED', price: 4200 }],
    asOf,
  });
  assert.equal(result.monthlyRent, 5000);
});

test('expired or terminated contract never creates occupancy or revenue', () => {
  for (const status of ['EXPIRED', 'TERMINATED']) {
    const result = deriveAnalyticsSurfaceState({
      surfaceStatus: 'AVAILABLE',
      contract: {
        status,
        startDate: new Date('2025-01-01T00:00:00.000Z'),
        endDate: new Date('2025-12-31T23:59:59.999Z'),
        monthlyPrice: 9000,
      },
      occupancies: [],
      asOf,
    });
    assert.deepEqual(result, { isOccupied: false, monthlyRent: null, hasExplicitPrice: false });
  }
});

test('manual occupied state without explicit price remains visible but is not assigned an estimate', () => {
  const result = deriveAnalyticsSurfaceState({ surfaceStatus: 'OCCUPIED', contract: null, occupancies: [], asOf });
  assert.deepEqual(result, { isOccupied: true, monthlyRent: null, hasExplicitPrice: false });
});

test('analytics dates are formatted on the server to keep hydration deterministic', () => {
  const page = readFileSync(new URL('../app/analytics/page.tsx', import.meta.url), 'utf8');
  const dashboard = readFileSync(new URL('../components/analytics/AnalyticsDashboard.tsx', import.meta.url), 'utf8');
  assert.match(page, /timeZone: 'Europe\/Prague'/);
  assert.match(page, /dateFromLabel:/);
  assert.doesNotMatch(dashboard, /new Date\(occ\.dateFrom/);
});

test('hlavní dashboard nepoužívá ceníkové ani smyšlené fallback sazby', () => {
  const dashboard = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  const manager = readFileSync(new URL('../components/dashboard/ManagerDashboard.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(dashboard, /defaultRates/);
  assert.doesNotMatch(dashboard, /surface\?\.price/);
  assert.match(dashboard, /deriveAnalyticsSurfaceState/);
  assert.doesNotMatch(manager, /Měsíční tržby \(MRR\)/);
  assert.match(manager, /Evidované měsíční nájemné/);
});
