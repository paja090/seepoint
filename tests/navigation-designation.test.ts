import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNavigationPointDesignation,
  detectCarrierCategory,
  getPointPinVisual,
} from '../lib/offers/navigation-carrier-types.ts';

test('formatNavigationPointDesignation formats P1 – Orlovská – 500 m rovně', () => {
  const result = formatNavigationPointDesignation({
    address: 'Orlovská 42, Ostrava',
    calculatedDistanceMeters: 500,
    arrowDirectionEnum: 'STRAIGHT',
  }, 0);

  assert.equal(result.code, 'P1');
  assert.equal(result.street, 'Orlovská 42');
  assert.equal(result.distance, '500 m');
  assert.equal(result.direction, 'rovně');
  assert.equal(result.fullTitle, 'P1 – Orlovská 42 – 500 m rovně');
});

test('formatNavigationPointDesignation formats manual distance and right turn correctly', () => {
  const result = formatNavigationPointDesignation({
    address: '1. máje',
    manualDistanceValue: 1.5,
    manualDistanceUnit: 'KILOMETERS',
    arrowDirectionEnum: 'RIGHT',
  }, 1);

  assert.equal(result.code, 'P2');
  assert.equal(result.street, '1. máje');
  assert.equal(result.distance, '1.5 km');
  assert.equal(result.direction, 'vpravo');
  assert.equal(result.fullTitle, 'P2 – 1. máje – 1.5 km vpravo');
});

test('formatNavigationPointDesignation handles fallback when address is empty but pillar number is set', () => {
  const result = formatNavigationPointDesignation({
    label: 'Navigační bod 3',
    pillarNumber: '5482',
    arrowDirectionEnum: 'LEFT',
  }, 2);

  assert.equal(result.code, 'P3');
  assert.equal(result.street, 'Sloup VO 5482');
  assert.equal(result.direction, 'vlevo');
  assert.equal(result.fullTitle, 'P3 – Sloup VO 5482 – vlevo');
});

test('detectCarrierCategory correctly classifies all carrier types (VO, A-boards, Towers, etc.)', () => {
  assert.equal(detectCarrierCategory('sloup VO').id, 'NAVIGATION');
  assert.equal(detectCarrierCategory('A-stojan (Áčko)').id, 'A_BOARD');
  assert.equal(detectCarrierCategory('Reklamní věž / Tower').id, 'TOWER');
  assert.equal(detectCarrierCategory('Citylight CLV').id, 'CITYLIGHT');
  assert.equal(detectCarrierCategory('Billboard 504x238').id, 'BILLBOARD');
});

test('getPointPinVisual resolves visual metadata for varied carriers', () => {
  const voVisual = getPointPinVisual({ navigationType: 'Směrová tabule (VO)' });
  assert.equal(voVisual.category.id, 'NAVIGATION');
  assert.equal(voVisual.category.icon, '🧭');

  const aBoardVisual = getPointPinVisual({ navigationType: 'Áčko / stojan' });
  assert.equal(aBoardVisual.category.id, 'A_BOARD');
  assert.equal(aBoardVisual.category.icon, '🪧');
});
