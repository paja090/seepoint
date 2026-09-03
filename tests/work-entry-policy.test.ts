import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canResolveEmployeeRate,
  parseDateOnly,
  parseMoney,
  parseQuantity,
  parseRateType,
  parseWorkEntryStatus,
  parseWorkType,
} from '../lib/work-entry-policy.ts';

test('výkazy: datum je striktně kalendářní a bez tichého přetečení', () => {
  assert.equal(parseDateOnly('2026-02-28').toISOString(), '2026-02-28T00:00:00.000Z');
  assert.throws(() => parseDateOnly('2026-02-30'), /platné datum/);
  assert.throws(() => parseDateOnly('2026-02-28T12:00:00Z'), /platné datum/);
});

test('výkazy: množství podporuje desetinné číslo a H:MM bez float nepřesnosti', () => {
  assert.equal(parseQuantity('2:30').toString(), '2.5');
  assert.equal(parseQuantity('12,125').toString(), '12.125');
  assert.throws(() => parseQuantity('1:60'), /formát času/);
  assert.throws(() => parseQuantity('1e3'), /formát množství/);
  assert.throws(() => parseQuantity('0'), /kladné číslo/);
});

test('výkazy: sazby jsou přesné, nezáporné a odpovídají DB měřítku', () => {
  assert.equal(parseMoney('1234,50', 'Sazba').toFixed(2), '1234.50');
  assert.throws(() => parseMoney('-1', 'Sazba'), /nezáporné/);
  assert.throws(() => parseMoney('10.123', 'Sazba'), /2 desetinnými/);
  assert.throws(() => parseMoney('Infinity', 'Sazba'), /platné/);
});

test('výkazy: neznámé enum hodnoty jsou odmítnuty před dotazem do DB', () => {
  assert.equal(parseWorkType('INSTALLATION'), 'INSTALLATION');
  assert.equal(parseRateType('HOURLY'), 'HOURLY');
  assert.equal(parseWorkEntryStatus('SUBMITTED'), 'SUBMITTED');
  assert.throws(() => parseWorkType('HACK'));
  assert.throws(() => parseRateType('DAILY'));
  assert.throws(() => parseWorkEntryStatus('PAID'));
});

test('sazby: pracovník vidí jen vlastní sazbu, privilegovaná role všechny', () => {
  const user = { id: 'user-1', email: 'worker@example.cz' };
  assert.equal(canResolveEmployeeRate('WORKER', user, { userId: 'user-1', email: null }), true);
  assert.equal(canResolveEmployeeRate('WORKER', user, { userId: 'user-2', email: 'other@example.cz' }), false);
  assert.equal(canResolveEmployeeRate('ACCOUNTANT', user, { userId: 'user-2', email: 'other@example.cz' }), true);
});
