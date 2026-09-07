import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNavigationOfferInput } from '../lib/offers/specialized.ts';

test('1. parseNavigationOfferInput recognizes roundabout exit directions', () => {
  const input = {
    clientId: 'test-client',
    title: 'Navigace Ostrava',
    targetName: 'OC Karolina',
    targetAddress: 'Jantarová 4, Ostrava',
    targetLatitude: 49.83,
    targetLongitude: 18.28,
    city: 'Ostrava',
    points: [
      { quantity: 1, unitPrice: 12000, latitude: 49.82, longitude: 18.27, arrowDirectionEnum: 'ROUNDABOUT_1' },
      { quantity: 1, unitPrice: 12000, latitude: 49.81, longitude: 18.26, arrowDirectionEnum: 'ROUNDABOUT_2' },
      { quantity: 1, unitPrice: 12000, latitude: 49.80, longitude: 18.25, arrowDirectionEnum: 'ROUNDABOUT_3' },
      { quantity: 1, unitPrice: 12000, latitude: 49.79, longitude: 18.24, arrowDirectionEnum: 'ROUNDABOUT_4' },
      { quantity: 1, unitPrice: 12000, latitude: 49.78, longitude: 18.23, arrowDirectionEnum: 'ROUNDABOUT_5' },
      { quantity: 1, unitPrice: 12000, latitude: 49.77, longitude: 18.22, arrowDirectionEnum: 'ROUNDABOUT' },
    ],
  };

  const parsed = parseNavigationOfferInput(input);
  assert.equal(parsed.city, 'Ostrava');
  assert.equal(parsed.points[0].arrowDirectionEnum, 'ROUNDABOUT_1');
  assert.equal(parsed.points[1].arrowDirectionEnum, 'ROUNDABOUT_2');
  assert.equal(parsed.points[2].arrowDirectionEnum, 'ROUNDABOUT_3');
  assert.equal(parsed.points[3].arrowDirectionEnum, 'ROUNDABOUT_4');
  assert.equal(parsed.points[4].arrowDirectionEnum, 'ROUNDABOUT_5');
  assert.equal(parsed.points[5].arrowDirectionEnum, 'ROUNDABOUT');
});

test('2. parseNavigationOfferInput recognizes Havířov city and fallback detection', () => {
  const inputWithCity = {
    clientId: 'test-client',
    title: 'Navigace Havířov',
    targetName: 'Prodejna Havířov',
    targetAddress: 'Hlavní třída 5',
    targetLatitude: 49.78,
    targetLongitude: 18.43,
    city: 'Havířov',
    points: [
      { quantity: 1, unitPrice: 12000, latitude: 49.77, longitude: 18.42, arrowDirectionEnum: 'ROUNDABOUT_2' },
    ],
  };
  const parsed1 = parseNavigationOfferInput(inputWithCity);
  assert.equal(parsed1.city, 'Havířov');

  // Detection from targetAddress when city is not explicitly passed
  const inputWithAddress = {
    clientId: 'test-client',
    title: 'Navigace',
    targetName: 'Pobočka',
    targetAddress: 'Dělnická 12, Havířov',
    targetLatitude: 49.78,
    targetLongitude: 18.43,
    points: [
      { quantity: 1, unitPrice: 12000, latitude: 49.77, longitude: 18.42, arrowDirectionEnum: 'STRAIGHT' },
    ],
  };
  const parsed2 = parseNavigationOfferInput(inputWithAddress);
  assert.equal(parsed2.city, 'Havířov');
});
