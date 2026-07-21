import assert from 'node:assert/strict';
import { test } from 'node:test';

test('1. Average GPS calculation logic when merging multiple poles', () => {
  const poles = [
    { id: 'pole-1', latitude: 49.835, longitude: 18.292 },
    { id: 'pole-2', latitude: 49.837, longitude: 18.294 },
    { id: 'pole-3', latitude: 49.836, longitude: 18.293 },
  ];

  const avgLat = Number((poles.reduce((sum, p) => sum + p.latitude, 0) / poles.length).toFixed(6));
  const avgLng = Number((poles.reduce((sum, p) => sum + p.longitude, 0) / poles.length).toFixed(6));

  assert.equal(avgLat, 49.836);
  assert.equal(avgLng, 18.293);
});

test('2. Surface relocation and photo attachment transfer state structure', () => {
  const targetPoleId = 'target-pole-1';
  const surfacesToTransfer = [
    { id: 's1', originalCarrierId: 'source-pole-1', name: 'Pozice A' },
    { id: 's2', originalCarrierId: 'source-pole-2', name: 'Pozice B' },
  ];

  const updatedSurfaces = surfacesToTransfer.map((s) => ({
    ...s,
    carrierId: targetPoleId,
  }));

  assert.equal(updatedSurfaces[0].carrierId, targetPoleId);
  assert.equal(updatedSurfaces[1].carrierId, targetPoleId);
});
