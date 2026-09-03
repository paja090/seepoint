import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createNavigationInvoicePdf } from '../lib/navigation/invoice-pdf.ts';

async function main() {
  const outputDir = resolve('output/pdf');
  await mkdir(outputDir, { recursive: true });

  const pdf = await createNavigationInvoicePdf({
  invoiceNumber: 'NAV-ZAK-2026-001',
  variableSymbol: '2026001',
  issueDate: new Date('2026-08-25T10:00:00Z'),
  dueDate: new Date('2026-09-08T10:00:00Z'),
  currency: 'CZK',
  supplier: { name: 'SeePOINT s.r.o.', companyId: '01234567', vatId: 'CZ01234567', street: 'Příkladná 12', city: 'Ostrava', postalCode: '702 00', country: 'CZ', email: 'info@seepoint.cz', phone: '+420 777 000 000', bankAccount: '123456789/0100', iban: 'CZ6501000000000123456789', swift: 'KOMBCZPP' },
  customer: { name: 'Ukázkový klient s.r.o.', companyId: '76543210', vatId: 'CZ76543210', street: 'Klientská 8', city: 'Havířov', postalCode: '736 01', country: 'CZ', email: 'fakturace@example.test' },
  orderNumber: 'ZAK-2026-001',
  orderTitle: 'Navigační kampaň - ukázka',
  periodFrom: new Date('2026-08-01T00:00:00Z'),
  periodTo: new Date('2026-08-31T23:59:59Z'),
  items: [
    { description: 'Navigační bod Ostrava - centrum', quantity: 2, unit: 'ks', unitPrice: 3500, amount: 7000, vatRate: 21, vatAmount: 1470, totalAmount: 8470 },
    { description: 'Výroba a instalace navigační tabule', quantity: 1, unit: 'ks', unitPrice: 2800, amount: 2800, vatRate: 21, vatAmount: 588, totalAmount: 3388 },
  ],
  subtotal: 9800,
  taxAmount: 2058,
  totalAmount: 11858,
  });

  await writeFile(resolve(outputDir, 'seepoint-navigation-invoice-demo.pdf'), pdf);
}

void main();
