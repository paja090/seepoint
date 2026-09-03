import assert from 'node:assert/strict';
import test from 'node:test';
import { cityInventoryCategory, summarizeCityInventoryTypes } from '../lib/city-inventory';

test('city inventory uses only schema-backed categories', () => {
  assert.equal(cityInventoryCategory('CITY_POSTER'), 'POSTER');
  assert.equal(cityInventoryCategory('PROMO_BENCH'), 'BENCH');
  assert.equal(cityInventoryCategory('NAVIGATION'), 'NAVIGATION');
  assert.equal(cityInventoryCategory('BILLBOARD'), 'OTHER');
  assert.equal(cityInventoryCategory('PROMO_HORIZON'), 'OTHER');
});

test('city inventory summary keeps all carriers in exactly one category', () => {
  const summary = summarizeCityInventoryTypes([
    { type: 'CITY_POSTER', count: 12 },
    { type: 'PROMO_BENCH', count: 8 },
    { type: 'NAVIGATION', count: 20 },
    { type: 'PROMO_TOWER', count: 4 },
    { type: 'OTHER', count: 2 },
  ]);

  assert.deepEqual(summary, { POSTER: 12, BENCH: 8, NAVIGATION: 20, OTHER: 6 });
  assert.equal(Object.values(summary).reduce((sum, count) => sum + count, 0), 46);
});

test('city inventory page requires explicit tenant and excludes archived rows', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile('app/projects/city-inventory/page.tsx', 'utf8'));
  assert.match(source, /organizationId: user\.organizationId/);
  assert.match(source, /archivedAt: null/);
  assert.doesNotMatch(source, /\.catch\(\(\) => \[\]\)/);
  assert.match(source, /PREVIEW_LIMIT_PER_CATEGORY = 60/);
  assert.match(source, /type: 'CITY_POSTER'/);
  assert.match(source, /type: 'PROMO_BENCH'/);
  assert.match(source, /type: 'NAVIGATION'/);
  assert.match(source, /notIn: \['CITY_POSTER', 'PROMO_BENCH', 'NAVIGATION'\]/);
});
