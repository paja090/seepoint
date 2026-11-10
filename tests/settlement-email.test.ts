/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { sendSettlementInvoiceEmail } from '../lib/settlement-invoice.ts';

function createMockSettlement(overrides: Record<string, any> = {}) {
  return {
    id: 'settlement-email-test-1',
    organizationId: 'org-seepoint-1',
    periodYear: 2026,
    periodMonth: 10,
    periodFrom: new Date('2026-10-01T00:00:00.000Z'),
    periodTo: new Date('2026-10-31T23:59:59.999Z'),
    status: 'APPROVED',
    totalWorkAmount: new Prisma.Decimal(15000),
    totalReimbursements: new Prisma.Decimal(1200),
    totalDeductions: new Prisma.Decimal(200),
    totalAdvances: new Prisma.Decimal(1000),
    finalPayableAmount: new Prisma.Decimal(15000),
    note: 'Montážní práce říjen',
    employee: {
      id: 'emp-101',
      userId: 'user-emp-101',
      firstName: 'Tomáš',
      lastName: 'Dvořák',
      email: 'tomas.dvorak@example.cz',
      phone: '+420 608 123 456',
      ico: '87654321',
      billingProfile: {
        billingName: 'Tomáš Dvořák - Montáže',
        companyId: '87654321',
        vatId: null,
        vatPayer: false,
        street: 'Nádražní 12',
        city: 'Olomouc',
        postalCode: '77900',
        country: 'CZ',
        accountNumber: '987654321',
        bankCode: '0100',
        iban: null,
        swift: null,
      },
    },
    items: [
      {
        id: 'item-101',
        description: 'Instalace laviček',
        quantity: new Prisma.Decimal(5),
        unit: 'ks',
        unitPrice: new Prisma.Decimal(1000),
        amount: new Prisma.Decimal(5000),
        appliedRate: new Prisma.Decimal(1000),
        carrierTypeLabel: 'Lavička',
        workType: 'INSTALLATION',
        task: { title: 'Instalace laviček v parku' },
      },
    ],
    adjustments: [],
    invoice: null,
    ...overrides,
  };
}

function createMockTx(settlement: any, auditLogs: any[] = []) {
  return {
    settlement: {
      findUnique: async () => settlement,
    },
    organization: {
      findUnique: async () => ({
        id: settlement?.organizationId || 'org-seepoint-1',
        name: 'SeePoint Media s.r.o.',
        ico: '12345678',
        dic: 'CZ12345678',
        street: 'Pražská 10',
        city: 'Praha',
        postalCode: '11000',
        email: 'faktury@seepoint.cz',
        phone: '+420 800 123 456',
        defaultVatRate: 21,
        invoiceDueDays: 14,
      }),
    },
    systemSettings: {
      findFirst: async () => null,
    },
    settlementAuditLog: {
      create: async ({ data }: any) => {
        auditLogs.push(data);
        return { id: `log-${auditLogs.length}`, ...data, createdAt: new Date() };
      },
    },
  };
}

test('sendSettlementInvoiceEmail: rejects invalid or missing recipient email', async () => {
  const mockSettlement = createMockSettlement();
  const mockTx = createMockTx(mockSettlement);

  await assert.rejects(
    async () => {
      await sendSettlementInvoiceEmail(
        {
          settlementId: 'settlement-email-test-1',
          recipientEmail: '',
          actor: { id: 'admin-1', email: 'admin@seepoint.cz', role: 'ADMIN' },
        },
        { tx: mockTx as any }
      );
    },
    {
      message: 'E-mail příjemce nemá platný formát.',
    }
  );

  await assert.rejects(
    async () => {
      await sendSettlementInvoiceEmail(
        {
          settlementId: 'settlement-email-test-1',
          recipientEmail: 'not-an-email',
          actor: { id: 'admin-1', email: 'admin@seepoint.cz', role: 'ADMIN' },
        },
        { tx: mockTx as any }
      );
    },
    {
      message: 'E-mail příjemce nemá platný formát.',
    }
  );
});

test('sendSettlementInvoiceEmail: rejects if settlement is not found', async () => {
  const mockTx = createMockTx(null);

  await assert.rejects(
    async () => {
      await sendSettlementInvoiceEmail(
        {
          settlementId: 'non-existent-id',
          recipientEmail: 'accountant@example.com',
          actor: { id: 'admin-1', email: 'admin@seepoint.cz', role: 'ADMIN' },
        },
        { tx: mockTx as any }
      );
    },
    {
      message: 'Vyúčtování s ID non-existent-id nebylo nalezeno.',
    }
  );
});

test('sendSettlementInvoiceEmail: enforces multi-tenant boundary', async () => {
  const mockSettlement = createMockSettlement({ organizationId: 'org-seepoint-1' });
  const mockTx = createMockTx(mockSettlement);

  await assert.rejects(
    async () => {
      await sendSettlementInvoiceEmail(
        {
          settlementId: 'settlement-email-test-1',
          recipientEmail: 'accountant@example.com',
          actor: {
            id: 'admin-other-org',
            email: 'admin@other.cz',
            role: 'ADMIN',
            organizationId: 'org-other-org-2',
          },
        },
        { tx: mockTx as any }
      );
    },
    {
      message: 'Nemáte oprávnění k tomuto vyúčtování.',
    }
  );
});

test('sendSettlementInvoiceEmail: prevents non-privileged non-owner workers from sending', async () => {
  const mockSettlement = createMockSettlement();
  const mockTx = createMockTx(mockSettlement);

  await assert.rejects(
    async () => {
      await sendSettlementInvoiceEmail(
        {
          settlementId: 'settlement-email-test-1',
          recipientEmail: 'accountant@example.com',
          actor: {
            id: 'user-other-worker',
            email: 'other.worker@example.cz',
            role: 'WORKER',
            organizationId: 'org-seepoint-1',
          },
        },
        { tx: mockTx as any }
      );
    },
    {
      message: 'Nemáte oprávnění odeslat toto vyúčtování.',
    }
  );
});

test('sendSettlementInvoiceEmail: allows worker owner to send their own settlement invoice', async () => {
  const mockSettlement = createMockSettlement();
  const auditLogs: any[] = [];
  const mockTx = createMockTx(mockSettlement, auditLogs);
  const sentEmails: any[] = [];

  const mockEmailSender = async (params: any) => {
    sentEmails.push(params);
    return { status: 'SENT', id: 'msg-123' } as any;
  };

  const result = await sendSettlementInvoiceEmail(
    {
      settlementId: 'settlement-email-test-1',
      recipientEmail: 'faktury@seepoint.cz',
      customMessage: 'Dobrý den, posílám vyúčtování za říjen.',
      actor: {
        id: 'user-emp-101', // matching worker employee.userId
        email: 'tomas.dvorak@example.cz',
        role: 'WORKER',
        organizationId: 'org-seepoint-1',
      },
    },
    {
      tx: mockTx as any,
      sendEmailFn: mockEmailSender,
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.recipient, 'faktury@seepoint.cz');
  assert.equal(result.deliveryStatus, 'SENT');

  // Verify email dispatch
  assert.equal(sentEmails.length, 1);
  const sent = sentEmails[0];
  assert.equal(sent.to, 'faktury@seepoint.cz');
  assert.ok(sent.subject.includes('Měsíční vyúčtování'));
  assert.ok(sent.subject.includes('Tomáš Dvořák'));
  assert.ok(sent.message.includes('Dobrý den, posílám vyúčtování za říjen.'));
  assert.ok(sent.customHtml.includes('Tomáš Dvořák'));
  assert.ok(sent.customHtml.includes('Dobrý den, posílám vyúčtování za říjen.'));
  assert.equal(sent.organizationId, 'org-seepoint-1');

  // Verify PDF attachment
  assert.equal(sent.attachments.length, 1);
  assert.equal(sent.attachments[0].contentType, 'application/pdf');
  assert.ok(sent.attachments[0].filename.endsWith('.pdf'));
  assert.ok(Buffer.isBuffer(sent.attachments[0].content));

  // Verify Audit Log
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, 'EMAIL_SENT');
  assert.equal(auditLogs[0].fieldName, 'email');
  assert.equal(auditLogs[0].newValue, 'faktury@seepoint.cz');
  assert.equal(auditLogs[0].userId, 'user-emp-101');
  assert.ok(auditLogs[0].reason.includes('faktury@seepoint.cz'));
});

test('sendSettlementInvoiceEmail: allows ADMIN to send with WORK_ONLY scope and custom note', async () => {
  const mockSettlement = createMockSettlement();
  const auditLogs: any[] = [];
  const mockTx = createMockTx(mockSettlement, auditLogs);
  const sentEmails: any[] = [];

  const mockEmailSender = async (params: any) => {
    sentEmails.push(params);
    return { status: 'DELIVERED', id: 'msg-999' } as any;
  };

  const result = await sendSettlementInvoiceEmail(
    {
      settlementId: 'settlement-email-test-1',
      recipientEmail: 'tomas.dvorak@example.cz',
      scope: 'WORK_ONLY',
      customMessage: 'Zasíláme schválený podklad za říjnové montáže.',
      actor: {
        id: 'admin-1',
        email: 'vedeni@seepoint.cz',
        role: 'ADMIN',
        organizationId: 'org-seepoint-1',
      },
    },
    {
      tx: mockTx as any,
      sendEmailFn: mockEmailSender,
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.deliveryStatus, 'DELIVERED');
  assert.equal(sentEmails.length, 1);
  const sent = sentEmails[0];
  assert.equal(sent.to, 'tomas.dvorak@example.cz');
  assert.ok(sent.attachments[0].filename.includes('-pouze-prace.pdf'));
  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].action, 'EMAIL_SENT');
  assert.ok(auditLogs[0].reason.includes('Pouze odpracovaná práce'));
});
