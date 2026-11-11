import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinates } from '../lib/field-planning/profile';

test('coordinates validator accepts valid Czech coordinates and rejects invalid ranges', () => {
  // Prague coordinates
  assert.equal(coordinates({ latitude: 50.08804, longitude: 14.42076 }), true);
  // Brno coordinates
  assert.equal(coordinates({ latitude: 49.19506, longitude: 16.60683 }), true);
  // Ostrava coordinates
  assert.equal(coordinates({ latitude: 49.83465, longitude: 18.28204 }), true);

  // Invalid coordinates
  assert.equal(coordinates(null), false);
  assert.equal(coordinates(undefined), false);
  assert.equal(coordinates({ latitude: 91, longitude: 14.4 }), false);
  assert.equal(coordinates({ latitude: -91, longitude: 14.4 }), false);
  assert.equal(coordinates({ latitude: 50, longitude: 181 }), false);
  assert.equal(coordinates({ latitude: 50, longitude: -181 }), false);
  assert.equal(coordinates({ latitude: Number.NaN, longitude: 14 }), false);
  assert.equal(coordinates({ latitude: 50, longitude: Number.NaN }), false);
});

test('extractDirectCoordinates correctly resolves lat/lng from various planningConstraints structures', () => {
  function extractDirectCoordinates(planningConstraints: unknown) {
    const pc = (planningConstraints as Record<string, unknown> | null) || {};
    const directLat =
      typeof pc.latitude === 'number'
        ? pc.latitude
        : typeof (pc.location as { latitude?: unknown })?.latitude === 'number'
          ? (pc.location as { latitude: number }).latitude
          : null;
    const directLng =
      typeof pc.longitude === 'number'
        ? pc.longitude
        : typeof (pc.location as { longitude?: unknown })?.longitude === 'number'
          ? (pc.location as { longitude: number }).longitude
          : null;

    if (directLat !== null && directLng !== null && coordinates({ latitude: directLat, longitude: directLng })) {
      return { latitude: directLat, longitude: directLng };
    }
    return null;
  }

  // Structure A: Flat latitude and longitude
  const flat = extractDirectCoordinates({ latitude: 50.123, longitude: 14.456 });
  assert.deepEqual(flat, { latitude: 50.123, longitude: 14.456 });

  // Structure B: Nested location object
  const nested = extractDirectCoordinates({ location: { latitude: 49.201, longitude: 16.612 } });
  assert.deepEqual(nested, { latitude: 49.201, longitude: 16.612 });

  // Structure C: Both
  const both = extractDirectCoordinates({
    latitude: 50.0,
    longitude: 14.0,
    location: { latitude: 50.0, longitude: 14.0 },
    locationAddress: 'Praha, Václavské náměstí',
  });
  assert.deepEqual(both, { latitude: 50.0, longitude: 14.0 });

  // Structure D: Missing or null
  assert.equal(extractDirectCoordinates(null), null);
  assert.equal(extractDirectCoordinates({}), null);
  assert.equal(extractDirectCoordinates({ latitude: null, longitude: null }), null);
});

test('planningConstraints updater builds correct payload for saving and clearing GPS', () => {
  function buildUpdatedConstraints(
    currentConstraints: Record<string, unknown> | null,
    update: { latitude?: number; longitude?: number; locationAddress?: string; clearGps?: boolean }
  ) {
    const current = currentConstraints || {};
    if (update.clearGps) {
      return {
        ...current,
        latitude: null,
        longitude: null,
        location: null,
        locationAddress: null,
      };
    }

    if (typeof update.latitude === 'number' && typeof update.longitude === 'number') {
      return {
        ...current,
        latitude: update.latitude,
        longitude: update.longitude,
        location: {
          latitude: update.latitude,
          longitude: update.longitude,
        },
        ...(update.locationAddress ? { locationAddress: update.locationAddress.trim() } : {}),
      };
    }

    return current;
  }

  // Update GPS
  const initial = { requiredEmployeeIds: ['emp-1'], scope: 'FIELD' };
  const updated = buildUpdatedConstraints(initial, {
    latitude: 50.088,
    longitude: 14.42,
    locationAddress: 'Staroměstské náměstí, Praha',
  });

  assert.equal(updated.latitude, 50.088);
  assert.equal(updated.longitude, 14.42);
  assert.deepEqual(updated.location, { latitude: 50.088, longitude: 14.42 });
  assert.equal(updated.locationAddress, 'Staroměstské náměstí, Praha');
  assert.deepEqual(updated.requiredEmployeeIds, ['emp-1']); // Preserved

  // Clear GPS
  const cleared = buildUpdatedConstraints(updated, { clearGps: true });
  assert.equal(cleared.latitude, null);
  assert.equal(cleared.longitude, null);
  assert.equal(cleared.location, null);
  assert.equal(cleared.locationAddress, null);
  assert.deepEqual(cleared.requiredEmployeeIds, ['emp-1']); // Preserved
});
