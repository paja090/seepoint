import assert from 'node:assert/strict';
import test from 'node:test';
import { cityInventoryCategory, summarizeCityInventoryTypes } from '../lib/city-inventory';

test('city inventory uses only schema-backed categories and excludes navigation', () => {
  assert.equal(cityInventoryCategory('CITY_POSTER'), 'POSTER');
  assert.equal(cityInventoryCategory('PROMO_BENCH'), 'BENCH');
  assert.equal(cityInventoryCategory('PROMO_HORIZON'), 'HORIZON');
  assert.equal(cityInventoryCategory('PROMO_TOWER'), 'TOWER');
  assert.equal(cityInventoryCategory('PROMO_MINITOWER'), 'TOWER');
  assert.equal(cityInventoryCategory('CITYLIGHT'), 'TOWER');
  assert.equal(cityInventoryCategory('BILLBOARD'), 'OTHER');
  assert.equal(cityInventoryCategory('NAVIGATION'), 'OTHER');
});

test('city inventory summary keeps all non-navigation carriers in exactly one category', () => {
  const summary = summarizeCityInventoryTypes([
    { type: 'CITY_POSTER', count: 12 },
    { type: 'PROMO_BENCH', count: 8 },
    { type: 'PROMO_HORIZON', count: 15 },
    { type: 'PROMO_TOWER', count: 4 },
    { type: 'CITYLIGHT', count: 6 },
    { type: 'NAVIGATION', count: 20 }, // Navigation must be ignored by city inventory
    { type: 'OTHER', count: 2 },
  ]);

  assert.deepEqual(summary, { POSTER: 12, BENCH: 8, HORIZON: 15, TOWER: 10, OTHER: 2 });
  assert.equal(Object.values(summary).reduce((sum, count) => sum + count, 0), 47);
});

test('city inventory page requires explicit tenant and excludes archived rows and navigation', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile('app/projects/city-inventory/page.tsx', 'utf8'));
  assert.match(source, /organizationId: user\.organizationId/);
  assert.match(source, /archivedAt: null/);
  assert.doesNotMatch(source, /\.catch\(\(\) => \[\]\)/);
  assert.match(source, /PREVIEW_LIMIT_PER_CATEGORY = 60/);
  assert.match(source, /type: 'CITY_POSTER'/);
  assert.match(source, /type: 'PROMO_BENCH'/);
  assert.match(source, /type: 'PROMO_HORIZON'/);
  assert.match(source, /type: \{ not: 'NAVIGATION' as const \}/);
});
