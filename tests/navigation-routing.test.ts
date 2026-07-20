import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHaversineMeters, formatDistanceText, getRealRouteDistance } from '../lib/routing';

test('1. Haversine distance calculates straight line distance accurately', () => {
  // Distance between Wenceslas Square, Prague (50.0813, 14.4267) and Old Town Square, Prague (50.0875, 14.4214)
  const dist = calculateHaversineMeters(50.0813, 14.4267, 50.0875, 14.4214);
  assert.ok(dist > 500 && dist < 1000, `Distance should be ~750m, got ${dist}`);
});

test('2. Format distance formats meters and kilometers in Czech', () => {
  assert.equal(formatDistanceText(450), '450 m');
  assert.equal(formatDistanceText(1500), '1.5 km');
});

test('3. Real route distance returns structured result with fallback', async () => {
  const result = await getRealRouteDistance(50.0813, 14.4267, 50.0875, 14.4214);
  assert.ok(result.distanceMeters > 0, 'Distance in meters should be > 0');
  assert.ok(typeof result.formattedDistance === 'string', 'Formatted distance should be string');
  assert.ok(result.formattedDistance.includes('m') || result.formattedDistance.includes('km'));
});
