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

  assert.match(issueRoute, /requireApiAccess\('billing', 'navigation'\)/);
  assert.match(issueRoute, /uploadDocumentToGoogleDrive/);
  assert.match(issueRoute, /downloadFileFromGoogleDrive/);
  assert.match(issueRoute, /attachments: \[\{ filename: pdfFileName, content: invoicePdf/);
  assert.match(issueRoute, /idempotencyKey: `navigation-invoice\/\$\{invoice\.id\}`/);
  assert.match(downloadRoute, /requireApiAccess\('billing'\)/);
  assert.match(downloadRoute, /Cache-Control': 'private, no-store'/);
  assert.match(email, /'Idempotency-Key'/);
  assert.match(email, /multipart\/mixed/);
});

test('API podporuje doplnění položek, úpravu e-mailu a samostatný náhled dokladu před odesláním', () => {
  const issueRoute = readFileSync(new URL('../app/api/navigation/orders/[id]/invoice/route.ts', import.meta.url), 'utf8');
  const previewRoute = readFileSync(new URL('../app/api/navigation/orders/[id]/invoice/preview/route.ts', import.meta.url), 'utf8');

  // Issue route supports custom items, email customization and draft without sending
  assert.match(issueRoute, /customItems\?: Array/);
  assert.match(issueRoute, /sendEmail === false/);
  assert.match(issueRoute, /emailSubject = body\.subject\?\.trim\(\)/);
  assert.match(issueRoute, /emailMessage = body\.message\?\.trim\(\)/);

  // Preview route exists and has billing security and PDF generator
  assert.match(previewRoute, /requireApiAccess\('billing', 'navigation'\)/);
  assert.match(previewRoute, /createNavigationInvoicePdf/);
  assert.match(previewRoute, /format'\) === 'pdf'/);
  assert.match(previewRoute, /'Content-Type': 'application\/pdf'/);
});

test('API a UI poskytují akční chybová hlášení s přímým odkazem na řešení a rychlé doplnění', () => {
  const issueRoute = readFileSync(new URL('../app/api/navigation/orders/[id]/invoice/route.ts', import.meta.url), 'utf8');
  const detailView = readFileSync(new URL('../components/navigation/NavigationOrderDetailView.tsx', import.meta.url), 'utf8');
  const modalComp = readFileSync(new URL('../components/settings/QuickCompanySettingsModal.tsx', import.meta.url), 'utf8');
  const cardComp = readFileSync(new URL('../components/ui/ActionableResolutionCard.tsx', import.meta.url), 'utf8');

  // Backend returns structured error with resolution
  assert.match(issueRoute, /errorType: 'MISSING_INVOICE_DATA'/);
  assert.match(issueRoute, /resolution: \{/);
  assert.match(issueRoute, /url: hasSupplierIssue \? '\/settings\/company'/);

  // Frontend integrates ActionableResolutionCard and QuickCompanySettingsModal
  assert.match(detailView, /ActionableResolutionCard/);
  assert.match(detailView, /QuickCompanySettingsModal/);
  assert.match(detailView, /showCompanyModal/);
  assert.match(detailView, /Rychle doplnit firemní údaje a vystavit fakturu/);

  // QuickCompanySettingsModal saves to /api/settings/company
  assert.match(modalComp, /\/api\/settings\/company/);
  assert.match(modalComp, /PATCH/);

  // Card component renders interactive primary/secondary action buttons
  assert.match(cardComp, /primaryAction/);
  assert.match(cardComp, /missingFields/);
});

