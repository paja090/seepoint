import test from 'node:test';
import assert from 'node:assert/strict';
import { nextCrmOrderNumber, normalizeClientName } from '../lib/crm/domain.ts';

test('CRM normalizes client names consistently', () => {
  assert.equal(normalizeClientName('  ČESKÁ   Firma  s.r.o. '), 'česká firma s.r.o.');
  assert.equal(normalizeClientName('Kofola'), normalizeClientName('  KOFOLA  '));
});

test('CRM order number starts at one and increments within a year', () => {
  assert.equal(nextCrmOrderNumber(2026), 'ZAK-2026-0001');
  assert.equal(nextCrmOrderNumber(2026, 'ZAK-2026-0042'), 'ZAK-2026-0043');
});

test('CRM order number ignores a previous-year sequence', () => {
  assert.equal(nextCrmOrderNumber(2027, 'ZAK-2026-9999'), 'ZAK-2027-0001');
});
