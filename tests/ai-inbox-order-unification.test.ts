import test from 'node:test';
import assert from 'node:assert/strict';
import { groupAiInboxMessagesByOrder } from '../lib/ai-inbox/grouping';
import type { AiInboxListItem } from '../components/ai-inbox/AiInboxMessageCard';

test('groupAiInboxMessagesByOrder groups emails by CRM order, calculates message counters and participants', () => {
  const items: AiInboxListItem[] = [
    {
      id: 'msg-1',
      fromEmail: 'jan@klient.cz',
      fromName: 'Jan Novák',
      subject: 'Re: Objednávka kampaně ZAK-2026-001',
      receivedAt: new Date('2026-11-01T10:00:00Z'),
      processingStatus: 'PROCESSED',
      classification: 'ORDER_CONFIRMED',
      confidence: 0.95,
      requiresReview: false,
      aiSummary: 'Klient potvrdil termín zahájení kampaně.',
      providerThreadId: 'thread-100',
      client: { id: 'client-1', name: 'Klient s.r.o.', companyId: '12345678' },
      crmOrder: { id: 'order-1', orderNumber: 'ZAK-2026-001', title: 'Billboardy Ostrava', status: 'ACTIVE' },
    },
    {
      id: 'msg-2',
      fromEmail: 'jan@klient.cz',
      fromName: 'Jan Novák',
      subject: 'Změna motivu pro ZAK-2026-001',
      receivedAt: new Date('2026-11-02T15:30:00Z'),
      processingStatus: 'INGESTED',
      classification: 'INQUIRY_NEW',
      confidence: 0.88,
      requiresReview: true,
      aiSummary: 'Klient zasílá nový tiskový podklad pro polep.',
      providerThreadId: 'thread-100',
      client: { id: 'client-1', name: 'Klient s.r.o.', companyId: '12345678' },
      crmOrder: { id: 'order-1', orderNumber: 'ZAK-2026-001', title: 'Billboardy Ostrava', status: 'ACTIVE' },
    },
    {
      id: 'msg-3',
      fromEmail: 'eva@jina-firma.cz',
      fromName: 'Eva Dvořáková',
      subject: 'Nová poptávka CLV',
      receivedAt: new Date('2026-11-02T12:00:00Z'),
      processingStatus: 'READY',
      classification: 'INQUIRY_NEW',
      confidence: 0.9,
      requiresReview: true,
      aiSummary: 'Poptávka po 5 CLV plochách v Havířově.',
      providerThreadId: 'thread-200',
      client: { id: 'client-2', name: 'Jirásek a spol.', companyId: '87654321' },
    },
  ];

  const groups = groupAiInboxMessagesByOrder(items);

  // Měly by vzniknout 2 skupiny (1 pro zakázku ZAK-2026-001 se 2 zprávami, 1 pro poptávku klienta)
  assert.equal(groups.length, 2);

  // První skupina je ZAK-2026-001 (má zprávu vyžadující pozornost a novější aktivitu)
  const orderGroup = groups.find((g) => g.key === 'order-order-1');
  assert.ok(orderGroup, 'Skupina pro zakázku ZAK-2026-001 musí existovat');
  assert.equal(orderGroup.type, 'CRM_ORDER');
  assert.equal(orderGroup.orderNumber, 'ZAK-2026-001');
  assert.equal(orderGroup.messageCount, 2);
  assert.equal(orderGroup.attentionCount, 1);
  assert.equal(orderGroup.newCount, 1);
  assert.equal(orderGroup.hasNewIncoming, true);
  assert.equal(orderGroup.latestAiSummary, 'Klient zasílá nový tiskový podklad pro polep.');
  assert.equal(orderGroup.participants.length, 1);
  assert.equal(orderGroup.participants[0].email, 'jan@klient.cz');
});

test('groupAiInboxMessagesByOrder prioritizes orders requiring attention and with new messages', () => {
  const items: AiInboxListItem[] = [
    {
      id: 'msg-old',
      fromEmail: 'klient1@test.cz',
      fromName: 'Klient 1',
      subject: 'Dotaz',
      receivedAt: new Date('2026-11-02T16:00:00Z'),
      processingStatus: 'PROCESSED',
      classification: 'OTHER',
      confidence: 0.5,
      requiresReview: false,
      aiSummary: 'Vyřízeno.',
      crmOrder: { id: 'order-processed', orderNumber: 'ZAK-2026-099', title: 'Hotovo', status: 'COMPLETED' },
    },
    {
      id: 'msg-urgent',
      fromEmail: 'klient2@test.cz',
      fromName: 'Klient 2',
      subject: 'Reklamace',
      receivedAt: new Date('2026-11-01T08:00:00Z'),
      processingStatus: 'INGESTED',
      classification: 'INQUIRY_NEW',
      confidence: 0.8,
      requiresReview: true,
      aiSummary: 'Požadavek na úpravu.',
      crmOrder: { id: 'order-urgent', orderNumber: 'ZAK-2026-050', title: 'Aktivní', status: 'ACTIVE' },
    },
  ];

  const groups = groupAiInboxMessagesByOrder(items);

  assert.equal(groups[0].orderNumber, 'ZAK-2026-050', 'Zakázka vyžadující pozornost musí být řazena na první místo');
  assert.equal(groups[0].attentionCount, 1);
  assert.equal(groups[1].orderNumber, 'ZAK-2026-099');
});
