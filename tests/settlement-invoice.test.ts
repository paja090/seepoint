/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import {
  getCzechMonthName,
  czechAccountToIban,
  generateSpaydString,
  buildSettlementInvoiceData,
  generateSettlementInvoice,
  createSettlementInvoicePdf,
} from '../lib/settlement-invoice.ts';

test('Settlement Invoice: getCzechMonthName returns Czech names for all 12 months', () => {
  assert.equal(getCzechMonthName(1), 'Leden');
  assert.equal(getCzechMonthName(5), 'Květen');
  assert.equal(getCzechMonthName(10), 'Říjen');
  assert.equal(getCzechMonthName(12), 'Prosinec');
});

test('Settlement Invoice: buildSettlementInvoiceData compiles work items, other costs, and customer/supplier data', async () => {
  const mockSettlement = {
    id: 'settlement-test-1234',
    organizationId: 'org-1',
    periodYear: 2026,
    periodMonth: 10,
    periodFrom: new Date('2026-10-01T00:00:00.000Z'),
    periodTo: new Date('2026-10-31T23:59:59.999Z'),
    status: 'APPROVED',
    totalWorkAmount: new Prisma.Decimal(18200),
    totalReimbursements: new Prisma.Decimal(1500),
    totalDeductions: new Prisma.Decimal(400),
    totalAdvances: new Prisma.Decimal(2000),
    finalPayableAmount: new Prisma.Decimal(17300),
    note: 'Říjnové montáže billboardů',
    employee: {
      id: 'emp-1',
      firstName: 'Petr',
      lastName: 'Novák',
      email: 'petr.novak@example.com',
      phone: '+420 777 123 456',
      ico: '12345678',
      billingProfile: {
        billingName: 'Petr Novák - Montáže',
        companyId: '12345678',
        vatId: 'CZ12345678',
        vatPayer: false,
        street: 'Dlouhá 15',
        city: 'Brno',
        postalCode: '60200',
        country: 'CZ',
        accountNumber: '123456789',
        bankCode: '0800',
        iban: 'CZ650800000000123456789',
        swift: 'GIBACZPX',
      },
    },
    items: [
      {
        id: 'item-1',
        description: 'Instalace lavičky',
        quantity: new Prisma.Decimal(10),
        unit: 'ks',
        unitPrice: new Prisma.Decimal(500),
        amount: new Prisma.Decimal(5000),
        appliedRate: new Prisma.Decimal(500),
        carrierTypeLabel: 'Lavička',
        workType: 'INSTALLATION',
        task: { title: 'Instalace laviček na náměstí' },
      },
      {
        id: 'item-2',
        description: 'Lepení billboardu',
        quantity: new Prisma.Decimal(8),
        unit: 'ks',
        unitPrice: new Prisma.Decimal(650),
        amount: new Prisma.Decimal(5200),
        appliedRate: new Prisma.Decimal(650),
        carrierTypeLabel: 'Billboard',
        workType: 'INSTALLATION',
        task: { title: 'Kampaň Podzim' },
      },
      {
        id: 'item-3',
        description: 'Hodinová práce montáže',
        quantity: new Prisma.Decimal(32),
        unit: 'h',
        unitPrice: new Prisma.Decimal(250),
        amount: new Prisma.Decimal(8000),
        appliedRate: new Prisma.Decimal(250),
        carrierTypeLabel: null,
        workType: 'INSTALLATION',
        task: null,
      },
    ],
    adjustments: [
      {
        id: 'adj-1',
        type: 'REIMBURSEMENT',
        category: 'FUEL',
        description: 'Čerpání PHM OMV',
        amount: new Prisma.Decimal(1500),
        createdAt: new Date('2026-10-15'),
      },
      {
        id: 'adj-2',
        type: 'DEDUCTION',
        category: 'PHONE',
        description: 'Telefonní paušál',
        amount: new Prisma.Decimal(400),
        createdAt: new Date('2026-10-20'),
      },
      {
        id: 'adj-3',
        type: 'ADVANCE',
        category: 'OTHER',
        description: 'Záloha na cestovné',
        amount: new Prisma.Decimal(2000),
        createdAt: new Date('2026-10-05'),
      },
    ],
    invoice: null,
  };

  const mockOrg = {
    id: 'org-1',
    name: 'SeePoint s.r.o.',
    companyId: '98765432',
    vatId: 'CZ98765432',
    street: 'Kancelářská 10',
    city: 'Praha',
    postalCode: '11000',
    country: 'CZ',
    bankAccount: '987654321/0100',
    iban: 'CZ1201000000000987654321',
    swift: 'KOMBCZPP',
    defaultVatRate: new Prisma.Decimal(21),
    invoiceDueDays: 14,
  };

  const mockTx = {
    settlement: {
      findUnique: async (args: any) => {
        assert.equal(args.where.id, 'settlement-test-1234');
        return mockSettlement;
      },
    },
    organization: {
      findUnique: async (args: any) => {
        assert.equal(args.where.id, 'org-1');
        return mockOrg;
      },
    },
    systemSettings: {
      findFirst: async () => null,
    },
  } as any;

  const result = await buildSettlementInvoiceData('settlement-test-1234', mockTx);

  assert.equal(result.periodMonth, 10);
  assert.equal(result.periodYear, 2026);
  assert.equal(result.periodTitle, 'Říjen 2026');
  assert.equal(result.supplier.name, 'Petr Novák - Montáže');
  assert.equal(result.supplier.companyId, '12345678');
  assert.equal(result.customer.name, 'SeePoint s.r.o.');
  assert.equal(result.customer.companyId, '98765432');
  assert.equal(result.totalWorkAmount, 18200);
  assert.equal(result.totalReimbursements, 1500);
  assert.equal(result.totalDeductions, 400);
  assert.equal(result.totalAdvances, 2000);
  assert.equal(result.netPayableAmount, 17300);
  assert.equal(result.grossAmount, 17300);
  assert.equal(result.paymentIban, 'CZ650800000000123456789');
  assert.ok(result.qrPaymentString);
  assert.match(result.qrPaymentString, /^SPD\*1\.0\*ACC:CZ650800000000123456789\*AM:17300\.00\*CC:CZK\*/);
  assert.match(result.qrPaymentString, /\*RN:Petr Novak - Montaze\*/);

  // Check line items: 3 work items + 3 adjustments = 6 line items
  assert.equal(result.items.length, 6);
  assert.equal(result.items[0].description, 'Instalace lavičky (Lavička)');
  assert.equal(result.items[0].quantity, 10);
  assert.equal(result.items[0].amount, 5000);
  assert.equal(result.items[1].description, 'Lepení billboardu (Billboard)');
  assert.equal(result.items[1].quantity, 8);
  assert.equal(result.items[1].amount, 5200);
  assert.equal(result.items[2].description, 'Hodinová práce montáže');
  assert.equal(result.items[2].quantity, 32);
  assert.equal(result.items[2].amount, 8000);

  // Check adjustments in items
  assert.match(result.items[3].description, /Náhrada výdajů: Čerpání PHM OMV/);
  assert.equal(result.items[3].amount, 1500);
  assert.match(result.items[4].description, /Srážka \/ Odpočet: Telefonní paušál/);
  assert.equal(result.items[4].amount, -400);
  assert.match(result.items[5].description, /Záloha: Záloha na cestovné/);
  assert.equal(result.items[5].amount, -2000);
});

test('Settlement Invoice: generateSettlementInvoice performs monthly closure and creates invoice record', async () => {
  let createdInvoice: any = null;
  let updatedSettlementStatus = 'DRAFT';
  let auditLogCreated = false;

  const mockSettlement = {
    id: 'settlement-clos-1',
    organizationId: 'org-1',
    periodYear: 2026,
    periodMonth: 10,
    periodFrom: new Date('2026-10-01T00:00:00.000Z'),
    periodTo: new Date('2026-10-31T23:59:59.999Z'),
    status: 'DRAFT',
    totalWorkAmount: new Prisma.Decimal(10000),
    totalReimbursements: new Prisma.Decimal(0),
    totalDeductions: new Prisma.Decimal(0),
    totalAdvances: new Prisma.Decimal(0),
    finalPayableAmount: new Prisma.Decimal(10000),
    note: null,
    employee: {
      id: 'emp-worker',
      firstName: 'Jan',
      lastName: 'Dvořák',
      email: 'jan.dvorak@example.com',
      userId: 'usr-worker',
      ico: null,
      billingProfile: null,
    },
    items: [
      {
        id: 'it-1',
        description: 'Instalace lavičky',
        quantity: new Prisma.Decimal(20),
        unit: 'ks',
        unitPrice: new Prisma.Decimal(500),
        amount: new Prisma.Decimal(10000),
        appliedRate: new Prisma.Decimal(500),
        carrierTypeLabel: null,
        workType: 'INSTALLATION',
        task: null,
      },
    ],
    adjustments: [],
    invoice: null,
  };

  const mockTx = {
    settlement: {
      findUnique: async () => mockSettlement,
      update: async (args: any) => {
        updatedSettlementStatus = args.data.status;
        return { ...mockSettlement, status: args.data.status };
      },
    },
    organization: {
      findUnique: async () => ({
        id: 'org-1',
        name: 'SeePoint s.r.o.',
        defaultVatRate: new Prisma.Decimal(21),
      }),
    },
    systemSettings: {
      findFirst: async () => null,
    },
    settlementAuditLog: {
      create: async () => {
        auditLogCreated = true;
        return {};
      },
    },
    invoice: {
      upsert: async (args: any) => {
        createdInvoice = {
          id: 'inv-1',
          ...args.create,
          items: args.create.items.create,
        };
        return createdInvoice;
      },
    },
  } as any;

  // 1. Worker closes month -> advances from DRAFT to SUBMITTED
  const workerActor = { id: 'usr-worker', email: 'jan.dvorak@example.com', role: 'WORKER' };
  const res1 = await generateSettlementInvoice('settlement-clos-1', workerActor, { closeMonth: true }, mockTx);

  assert.equal(res1.settlement.status, 'SUBMITTED');
  assert.equal(updatedSettlementStatus, 'SUBMITTED');
  assert.equal(auditLogCreated, true);
  assert.ok(res1.invoice);
  assert.equal(res1.invoice.supplierName, 'Jan Dvořák');
  assert.equal(res1.invoice.totalAmount.toNumber(), 10000);

  // 2. Manager closes month -> advances straight to LOCKED
  mockSettlement.status = 'SUBMITTED';
  const managerActor = { id: 'usr-manager', email: 'admin@seepoint.cz', role: 'ADMIN' };
  const res2 = await generateSettlementInvoice('settlement-clos-1', managerActor, { closeMonth: true }, mockTx);

  assert.equal(res2.settlement.status, 'LOCKED');
  assert.equal(updatedSettlementStatus, 'LOCKED');
});

test('Settlement Invoice: createSettlementInvoicePdf generates valid PDF buffer', async () => {
  const invoiceData = {
    invoiceNumber: 'VYU-202610-TEST',
    variableSymbol: '2026101234',
    issueDate: new Date('2026-10-31'),
    dueDate: new Date('2026-11-14'),
    periodFrom: new Date('2026-10-01'),
    periodTo: new Date('2026-10-31'),
    periodMonth: 10,
    periodYear: 2026,
    periodTitle: 'Říjen 2026',
    settlementStatus: 'LOCKED',
    supplier: {
      name: 'Karel Novotný',
      companyId: '11223344',
      vatId: null,
      street: 'Veselská 5',
      city: 'Praha',
      postalCode: '19900',
      country: 'CZ',
      bankAccount: '123456/0300',
      isVatPayer: false,
    },
    customer: {
      name: 'SeePoint s.r.o.',
      companyId: '98765432',
      vatId: 'CZ98765432',
      street: 'Kancelářská 10',
      city: 'Praha',
      postalCode: '11000',
      country: 'CZ',
      bankAccount: '987654321/0100',
    },
    items: [
      {
        description: 'Instalace lavičky',
        quantity: 10,
        unit: 'ks',
        unitPrice: 500,
        amount: 5000,
        vatRate: 0,
        vatAmount: 0,
        totalAmount: 5000,
        category: 'INSTALLATION',
      },
      {
        description: 'Náhrada výdajů: Využití soukromého vozidla',
        quantity: 1,
        unit: 'náhrada',
        unitPrice: 1200,
        amount: 1200,
        vatRate: 0,
        vatAmount: 0,
        totalAmount: 1200,
        category: 'RENT',
      },
    ],
    totalWorkAmount: 5000,
    totalReimbursements: 1200,
    totalDeductions: 0,
    totalAdvances: 0,
    netPayableAmount: 6200,
    vatAmount: 0,
    grossAmount: 6200,
    note: 'Měsíční vyúčtování za Říjen 2026',
    qrPaymentString: 'SPD*1.0*ACC:CZ650800000000123456789*AM:6200.00*CC:CZK*X-VS:2026101234*MSG:Vyuctovani Rijen 2026*RN:Karel Novotny*',
    paymentIban: 'CZ650800000000123456789',
  };

  const buffer = await createSettlementInvoicePdf(invoiceData);
  assert.ok(buffer);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 500);

  // Verify PDF header magic bytes "%PDF-"
  const magic = buffer.subarray(0, 5).toString('ascii');
  assert.equal(magic, '%PDF-');
});

test('Settlement Invoice: czechAccountToIban converts Czech account numbers to standard IBAN', () => {
  // Standard account without prefix
  const iban1 = czechAccountToIban('123456789/0800');
  assert.equal(iban1, 'CZ7508000000000123456789');

  // Account with prefix
  const iban2 = czechAccountToIban('19-2000145399/0800');
  assert.ok(iban2);
  assert.match(iban2, /^CZ\d{2}08000000192000145399$/);

  // Account with whitespace
  const iban3 = czechAccountToIban('  123456789 / 0800 ');
  assert.equal(iban3, 'CZ7508000000000123456789');

  // Already an IBAN
  const iban4 = czechAccountToIban('cz7508000000000123456789');
  assert.equal(iban4, 'CZ7508000000000123456789');

  // Invalid accounts return null
  assert.equal(czechAccountToIban(null), null);
  assert.equal(czechAccountToIban(undefined), null);
  assert.equal(czechAccountToIban(''), null);
  assert.equal(czechAccountToIban('invalid-account'), null);
  assert.equal(czechAccountToIban('12345/12'), null); // bank code must be 4 digits
});

test('Settlement Invoice: generateSpaydString produces valid SPAYD format with diacritics stripping', () => {
  const spayd = generateSpaydString({
    iban: 'CZ650800000000123456789',
    amount: 15450.5,
    currency: 'CZK',
    variableSymbol: '202610001',
    message: 'Vyúčtování montáží za Říjen 2026',
    recipientName: 'Jan Dvořák - Montáže',
  });

  assert.ok(spayd);
  assert.ok(spayd.startsWith('SPD*1.0*'));
  assert.ok(spayd.endsWith('*'));
  assert.ok(spayd.includes('ACC:CZ650800000000123456789*'));
  assert.ok(spayd.includes('AM:15450.50*'));
  assert.ok(spayd.includes('CC:CZK*'));
  assert.ok(spayd.includes('X-VS:202610001*'));
  // Diacritics should be stripped
  assert.ok(spayd.includes('MSG:Vyuctovani montazi za Rijen 2026*'));
  assert.ok(spayd.includes('RN:Jan Dvorak - Montaze*'));
});

