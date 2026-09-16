import test from 'node:test';
import assert from 'node:assert/strict';
import { validOdometer } from '../lib/odometer';

test('odometer accepts whole kilometres including zero', () => {
  for (const km of [0, 142500, 245001, 10_000_000]) assert.equal(validOdometer(km), true);
});

test('unreadable and malformed odometer results cannot overwrite the field', () => {
  for (const value of [null, undefined, '', '142500', -1, 32.5, NaN, Infinity, 10_000_001]) assert.equal(validOdometer(value), false);
});
