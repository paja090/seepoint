import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createNavigationInvoicePdf, validateNavigationInvoiceParties } from '../lib/navigation/invoice-pdf.ts';

const completeSupplier = {
  name: 'SeePOINT s.r.o.',
  companyId: '01234567',
  street: 'Příkladná 12',
  city: 'Ostrava',
  postalCode: '702 00',
  bankAccount: '123456789/0100',
};
const completeCustomer = {
  name: 'Klient s.r.o.',
  street: 'Klientská 8',
  city: 'Havířov',
  postalCode: '736 01',
};

test('faktura vyžaduje identifikaci, adresy a platební údaje', () => {
  assert.deepEqual(validateNavigationInvoiceParties(completeSupplier, completeCustomer), []);
  assert.deepEqual(
    validateNavigationInvoiceParties({ name: '' }, { name: '' }),
    [
      'název dodavatele',
      'IČO dodavatele',
      'úplná adresa dodavatele',
      'bankovní účet nebo IBAN dodavatele',
      'název odběratele',
      'úplná fakturační adresa odběratele',
    ],
  );
});

test('generátor vytvoří skutečný PDF dokument', async () => {
  const pdf = await createNavigationInvoicePdf({
    invoiceNumber: 'NAV-TEST-001',
    variableSymbol: '001',
    issueDate: new Date('2026-08-25T10:00:00Z'),
    dueDate: new Date('2026-09-08T10:00:00Z'),
    currency: 'CZK',
    supplier: completeSupplier,
    customer: completeCustomer,
    orderNumber: 'TEST-001',
    orderTitle: 'Testovací navigace',
    periodFrom: new Date('2026-08-01T00:00:00Z'),
    periodTo: new Date('2026-08-31T23:59:59Z'),
    items: [{ description: 'Navigační bod', quantity: 1, unit: 'ks', unitPrice: 1000, amount: 1000, vatRate: 21, vatAmount: 210, totalAmount: 1210 }],
    subtotal: 1000,
    taxAmount: 210,
    totalAmount: 1210,
  });

  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.byteLength > 5_000);
});

test('API ukládá neměnný doklad, přikládá jej a chrání samostatným billing oprávněním', () => {
  const issueRoute = readFileSync(new URL('../app/api/navigation/orders/[id]/invoice/route.ts', import.meta.url), 'utf8');
  const downloadRoute = readFileSync(new URL('../app/api/crm/invoices/[id]/pdf/route.ts', import.meta.url), 'utf8');
  const email = readFileSync(new URL('../lib/email.ts', import.meta.url), 'utf8');

  assert.match(issueRoute, /requireApiAccess\('billing'\)/);
  assert.match(issueRoute, /uploadDocumentToGoogleDrive/);
  assert.match(issueRoute, /downloadFileFromGoogleDrive/);
  assert.match(issueRoute, /attachments: \[\{ filename: pdfFileName, content: invoicePdf/);
  assert.match(issueRoute, /idempotencyKey: `navigation-invoice\/\$\{invoice\.id\}`/);
  assert.match(downloadRoute, /requireApiAccess\('billing'\)/);
  assert.match(downloadRoute, /Cache-Control': 'private, no-store'/);
  assert.match(email, /'Idempotency-Key'/);
  assert.match(email, /multipart\/mixed/);
});
