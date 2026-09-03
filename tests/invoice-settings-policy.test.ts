import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { normalizeCompanySettingsUpdate } from '../lib/company-settings-policy.ts';
import { createInvoicePartySnapshot, formatInvoiceNumber, invoiceDueDate, invoiceVatAmounts, readInvoicePartySnapshot } from '../lib/invoice-policy.ts';

test('invoice settings normalize tenant defaults and reject unsafe values', () => {
  assert.deepEqual(normalizeCompanySettingsUpdate({ invoiceDueDays: '30', defaultVatRate: '12,5', invoiceNumberPrefix: ' nav-vo ' }), {
    invoiceDueDays: 30,
    defaultVatRate: '12.5',
    invoiceNumberPrefix: 'NAV-VO',
  });
  assert.throws(() => normalizeCompanySettingsUpdate({ invoiceDueDays: 0 }), /1 až 365/);
  assert.throws(() => normalizeCompanySettingsUpdate({ defaultVatRate: '100.01' }), /0 až 100/);
  assert.throws(() => normalizeCompanySettingsUpdate({ invoiceNumberPrefix: '../NAV' }), /Prefix faktury/);
});

test('invoice sequence, due date and VAT calculations are deterministic', () => {
  assert.equal(formatInvoiceNumber('nav', 1), 'NAV-000001');
  assert.equal(formatInvoiceNumber('VO-26', 42), 'VO-26-000042');
  assert.equal(invoiceDueDate(new Date('2026-03-28T12:00:00Z'), 14).toISOString(), '2026-04-11T12:00:00.000Z');
  const totals = invoiceVatAmounts(new Prisma.Decimal('1000.00'), '12.5');
  assert.equal(totals.taxAmount.toFixed(2), '125.00');
  assert.equal(totals.totalAmount.toFixed(2), '1125.00');
});

test('invoice party snapshots are detached from later source changes', () => {
  const supplier = { name: 'SeePoint', city: 'Ostrava', optional: undefined };
  const snapshot = createInvoicePartySnapshot(supplier);
  supplier.city = 'Praha';
  assert.deepEqual(readInvoicePartySnapshot(snapshot, supplier), { name: 'SeePoint', city: 'Ostrava' });
});

test('invoice route uses stored line items, party snapshots, currency and atomic tenant sequence', () => {
  const route = readFileSync(new URL('../app/api/navigation/orders/[id]/invoice/route.ts', import.meta.url), 'utf8');
  assert.match(route, /invoiceSequence: \{ increment: 1 \}/);
  assert.match(route, /TransactionIsolationLevel\.Serializable/);
  assert.match(route, /clientInvoiceItem\.findMany/);
  assert.match(route, /readInvoicePartySnapshot\(invoice\.supplierSnapshot/);
  assert.match(route, /currency: invoice\.currency/);
  assert.doesNotMatch(route, /dueDate\.setDate\(dueDate\.getDate\(\) \+ 14\)/);
  assert.doesNotMatch(route, /mul\('0\.21'\)/);
});
