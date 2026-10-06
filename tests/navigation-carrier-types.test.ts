import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAVIGATION_CARRIER_TYPES,
  CARRIER_PIN_COLORS,
  detectCarrierCategory,
  getPointPinColor,
  getPointPinVisual,
} from '../lib/offers/navigation-carrier-types.js';

test('detectCarrierCategory identifies standard categories from free text', () => {
  assert.equal(detectCarrierCategory('Reklamní věž Tower').id, 'TOWER');
  assert.equal(detectCarrierCategory('promo_tower').id, 'TOWER');
  assert.equal(detectCarrierCategory('Áčko na chodníku').id, 'A_BOARD');
  assert.equal(detectCarrierCategory('Reklamní stojan A-board').id, 'A_BOARD');
  assert.equal(detectCarrierCategory('Citylight vitrína').id, 'CITYLIGHT');
  assert.equal(detectCarrierCategory('CLV panel').id, 'CITYLIGHT');
  assert.equal(detectCarrierCategory('Billboard 504x238').id, 'BILLBOARD');
  assert.equal(detectCarrierCategory('Plachta na plotě').id, 'BANNER');
  assert.equal(detectCarrierCategory('Směrová tabule VO').id, 'NAVIGATION');
  assert.equal(detectCarrierCategory(undefined).id, 'NAVIGATION');
  assert.equal(detectCarrierCategory('Něco jiného').id, 'OTHER');
});

test('getPointPinColor prioritizes explicit point.color and falls back to carrier type color', () => {
  // Explicit custom color
  assert.equal(
    getPointPinColor({ color: '#ff0000', navigationType: 'Tower' }),
    '#ff0000'
  );

  // Fallback to Tower default color (#7c3aed)
  assert.equal(
    getPointPinColor({ navigationType: 'Tower' }),
    '#7c3aed'
  );

  // Fallback to A-board default color (#ea580c)
  assert.equal(
    getPointPinColor({ navigationType: 'Áčko / stojan' }),
    '#ea580c'
  );

  // Fallback to Navigation default color (#0284c7)
  assert.equal(
    getPointPinColor({ navigationType: 'Směrovka' }),
    '#0284c7'
  );
});

test('getPointPinVisual returns category, icon, color and label', () => {
  const vis = getPointPinVisual({ navigationType: 'Reklamní věž (Tower)' });
  assert.equal(vis.category.id, 'TOWER');
  assert.equal(vis.color, '#7c3aed');
  assert.equal(vis.icon, '🗼');
  assert.equal(vis.label, 'Reklamní věž (Tower)');
});

test('NAVIGATION_CARRIER_TYPES has 7 categories and CARRIER_PIN_COLORS has vibrant options', () => {
  assert.equal(NAVIGATION_CARRIER_TYPES.length, 7);
  assert.ok(CARRIER_PIN_COLORS.length >= 7);
});
