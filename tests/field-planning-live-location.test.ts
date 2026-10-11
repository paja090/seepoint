import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidLocationInput,
  isLocationRecent,
} from '../lib/field-planning/live-location';

test('isValidLocationInput: Validates correct GPS coordinates and telemetry', () => {
  const valid = {
    planId: 'plan-123',
    latitude: 50.087,
    longitude: 14.421,
    accuracy: 12.5,
    speed: 15.2, // ~55 km/h
    heading: 180,
  };
  assert.equal(isValidLocationInput(valid), true);

  const minimal = {
    planId: 'plan-123',
    latitude: 49.835,
    longitude: 18.292,
  };
  assert.equal(isValidLocationInput(minimal), true);
});

test('isValidLocationInput: Rejects invalid or out-of-bounds coordinates', () => {
  // Out of bounds latitude
  assert.equal(
    isValidLocationInput({ planId: 'p', latitude: 95.0, longitude: 14.0 }),
    false
  );
  assert.equal(
    isValidLocationInput({ planId: 'p', latitude: -95.0, longitude: 14.0 }),
    false
  );

  // Out of bounds longitude
  assert.equal(
    isValidLocationInput({ planId: 'p', latitude: 50.0, longitude: 190.0 }),
    false
  );
  assert.equal(
    isValidLocationInput({ planId: 'p', latitude: 50.0, longitude: -190.0 }),
    false
  );

  // NaN / non-finite
  assert.equal(
    isValidLocationInput({ planId: 'p', latitude: NaN, longitude: 14.0 }),
    false
  );
  assert.equal(
    isValidLocationInput({ planId: 'p', latitude: 50.0, longitude: Infinity }),
    false
  );

  // Missing or empty planId
  assert.equal(
    isValidLocationInput({ planId: '', latitude: 50.0, longitude: 14.0 }),
    false
  );
  assert.equal(
    isValidLocationInput({ latitude: 50.0, longitude: 14.0 }),
    false
  );

  // Negative speed or invalid heading
  assert.equal(
    isValidLocationInput({ planId: 'p', latitude: 50.0, longitude: 14.0, speed: -5 }),
    false
  );
  assert.equal(
    isValidLocationInput({ planId: 'p', latitude: 50.0, longitude: 14.0, heading: 400 }),
    false
  );
});

test('isLocationRecent: Correctly identifies fresh vs stale pings', () => {
  const now = new Date();
  assert.equal(isLocationRecent(now.toISOString(), 15), true);

  // 5 minutes ago
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  assert.equal(isLocationRecent(fiveMinAgo.toISOString(), 15), true);

  // 14 minutes ago
  const fourteenMinAgo = new Date(Date.now() - 14 * 60 * 1000);
  assert.equal(isLocationRecent(fourteenMinAgo.toISOString(), 15), true);

  // 25 minutes ago (stale)
  const twentyFiveMinAgo = new Date(Date.now() - 25 * 60 * 1000);
  assert.equal(isLocationRecent(twentyFiveMinAgo.toISOString(), 15), false);

  // Yesterday (stale)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  assert.equal(isLocationRecent(yesterday.toISOString(), 15), false);

  // Invalid date
  assert.equal(isLocationRecent('not-a-date', 15), false);
});
