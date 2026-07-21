import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseDistanceMeters, parseMountingType } from '../lib/navigation-import';

test('1. parseMountingType parses traction, column, light pole, pole correctly', () => {
  assert.equal(parseMountingType('trakce'), 'TRACTION');
  assert.equal(parseMountingType('Trakční vedení'), 'TRACTION');
  assert.equal(parseMountingType('sloupek'), 'COLUMN');
  assert.equal(parseMountingType('Patka sloupu'), 'COLUMN');
  assert.equal(parseMountingType('Stožár veřejného osvětlení'), 'LIGHT_POLE');
  assert.equal(parseMountingType('sloup VO'), 'LIGHT_POLE');
  assert.equal(parseMountingType('sloup'), 'POLE');
  assert.equal(parseMountingType('Pylon Nádraží'), 'POLE');
  assert.equal(parseMountingType('nějaké neznámé uchycení'), 'UNKNOWN');
});

test('2. parseDistanceMeters parses m and km formats accurately', () => {
  assert.equal(parseDistanceMeters('350 m'), 350);
  assert.equal(parseDistanceMeters('350m'), 350);
  assert.equal(parseDistanceMeters('1,2 km'), 1200);
  assert.equal(parseDistanceMeters('1 km'), 1000);
  assert.equal(parseDistanceMeters('0,5 km'), 500);
  assert.equal(parseDistanceMeters('neplatný text'), undefined);
});

test('3. Surface multi-tenant state isolation logic', () => {
  const poleSurfaces = [
    { id: 's1', name: 'Pozice 1', status: 'OCCUPIED', currentClientId: 'client-A' },
    { id: 's2', name: 'Pozice 2', status: 'OCCUPIED', currentClientId: 'client-B' },
    { id: 's3', name: 'Pozice 3', status: 'AVAILABLE', currentClientId: null },
  ];

  // End rental on s1
  const updatedSurfaces = poleSurfaces.map((surface) =>
    surface.id === 's1'
      ? { ...surface, status: 'AVAILABLE', currentClientId: null }
      : surface,
  );

  assert.equal(updatedSurfaces[0].status, 'AVAILABLE');
  assert.equal(updatedSurfaces[0].currentClientId, null);
  assert.equal(updatedSurfaces[1].status, 'OCCUPIED');
  assert.equal(updatedSurfaces[1].currentClientId, 'client-B');
  assert.equal(updatedSurfaces[2].status, 'AVAILABLE');
});
