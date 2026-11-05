import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAiInboxImportance,
  sortAiInboxItems,
  PRIORITY_TIER_META,
} from '../lib/ai-inbox/importance';
import { groupAiInboxMessagesByOrder } from '../lib/ai-inbox/grouping';
import type { AiInboxListItem } from '../components/ai-inbox/AiInboxMessageCard';

test('calculateAiInboxImportance correctly evaluates urgency and priority tiers', () => {
  // 1. Reklamace vyžadující pozornost -> URGENT
  const complaint = calculateAiInboxImportance({
    classification: 'COMPLAINT',
    processingStatus: 'INGESTED',
    requiresReview: true,
    confidence: 0.95,
    client: { id: 'c1', name: 'Auto Kelly', companyId: '123' },
    crmOrder: { id: 'o1', orderNumber: 'ZAK-2026-001', title: 'CLV Ostrava', status: 'ACTIVE' },
  });
  assert.equal(complaint.tier, 'URGENT');
  assert.ok(complaint.score >= 120, 'Reklamace s aktivní zakázkou musí mít skóre >= 120');
  assert.ok(complaint.reasons.some((r) => r.toLowerCase().includes('kontrol')));

  // 2. Schválená nabídka vyžadující pozornost -> URGENT
  const offerAccepted = calculateAiInboxImportance({
    classification: 'OFFER_ACCEPTED',
    processingStatus: 'READY',
    requiresReview: true,
    confidence: 0.9,
    offer: { id: 'off1', title: 'Kampaň Jaro', status: 'SENT' },
  });
  assert.equal(offerAccepted.tier, 'URGENT');

  // 3. Nová poptávka vyžadující pozornost -> HIGH
  const inquiry = calculateAiInboxImportance({
    classification: 'NEW_INQUIRY',
    processingStatus: 'INGESTED',
    requiresReview: true,
    confidence: 0.85,
  });
  assert.equal(inquiry.tier, 'HIGH');

  // 4. Běžná komunikace -> NORMAL
  const general = calculateAiInboxImportance({
    classification: 'GENERAL_COMMUNICATION',
    processingStatus: 'INGESTED',
    requiresReview: false,
    confidence: 0.8,
  });
  assert.equal(general.tier, 'NORMAL');

  // 5. Zpracovaná zpráva -> LOW
  const processed = calculateAiInboxImportance({
    classification: 'NEW_INQUIRY',
    processingStatus: 'PROCESSED',
    requiresReview: false,
    confidence: 0.9,
  });
  assert.equal(processed.tier, 'LOW');

  // 6. Spam / Ignored -> SPAM
  const spam = calculateAiInboxImportance({
    classification: 'SPAM_IRRELEVANT',
    processingStatus: 'IGNORED',
    requiresReview: false,
    confidence: 0.99,
  });
  assert.equal(spam.tier, 'SPAM');
  assert.equal(spam.score, 0);
});

test('sortAiInboxItems sorts by IMPORTANCE_AND_TIME (priority tiers, newest within tier first)', () => {
  const items: AiInboxListItem[] = [
    {
      id: 'msg-normal-new',
      fromEmail: 'info@firma.cz',
      fromName: 'Firma Info',
      subject: 'Informační e-mail',
      receivedAt: new Date('2026-11-05T14:00:00Z'), // nejnovější čas, ale běžná zpráva
      processingStatus: 'INGESTED',
      classification: 'GENERAL_COMMUNICATION',
      confidence: 0.8,
      requiresReview: false,
      aiSummary: 'Běžná zpráva',
    },
    {
      id: 'msg-urgent-older',
      fromEmail: 'sef@klient.cz',
      fromName: 'Petr Ředitel',
      subject: 'Reklamace osvětlení plochy',
      receivedAt: new Date('2026-11-05T10:00:00Z'), // starší než běžná, ale URGENT!
      processingStatus: 'INGESTED',
      classification: 'COMPLAINT',
      confidence: 0.95,
      requiresReview: true,
      aiSummary: 'Poškozený billboard',
      crmOrder: { id: 'ord-1', orderNumber: 'ZAK-2026-100', title: 'Billboard', status: 'ACTIVE' },
    },
    {
      id: 'msg-urgent-newest',
      fromEmail: 'nakup@velkafirma.cz',
      fromName: 'Jana Nákupčí',
      subject: 'Akceptace nabídky na rok 2027',
      receivedAt: new Date('2026-11-05T12:00:00Z'), // URGENT a novější než reklamace
      processingStatus: 'READY',
      classification: 'OFFER_ACCEPTED',
      confidence: 0.92,
      requiresReview: true,
      aiSummary: 'Potvrzení nabídky',
      offer: { id: 'off-1', title: 'Navigace 2027', status: 'SENT' },
    },
    {
      id: 'msg-processed',
      fromEmail: 'stary@klient.cz',
      fromName: 'Stary Klient',
      subject: 'Vyřízeno',
      receivedAt: new Date('2026-11-05T13:00:00Z'),
      processingStatus: 'PROCESSED',
      classification: 'DOCUMENTS',
      confidence: 0.9,
      requiresReview: false,
      aiSummary: 'Smlouva založena',
    },
  ];

  // 1. IMPORTANCE_AND_TIME:
  // Obě URGENT zprávy nahoře, mezi nimi ta novější první (12:00 před 10:00).
  // Následně NORMAL zpráva (14:00).
  // Nakonec PROCESSED zpráva (LOW).
  const sorted = sortAiInboxItems(items, 'IMPORTANCE_AND_TIME');
  assert.equal(sorted[0].id, 'msg-urgent-newest', 'Nejnovější URGENT zpráva musí být první');
  assert.equal(sorted[1].id, 'msg-urgent-older', 'Starší URGENT zpráva musí být druhá');
  assert.equal(sorted[2].id, 'msg-normal-new', 'Běžná zpráva následuje po urgentních');
  assert.equal(sorted[3].id, 'msg-processed', 'Zpracovaná zpráva je na konci');

  // 2. NEWEST: čistě podle data sestupně
  const sortedNewest = sortAiInboxItems(items, 'NEWEST');
  assert.equal(sortedNewest[0].id, 'msg-normal-new', 'Čistě nejnovější čas příchodu (14:00)');
  assert.equal(sortedNewest[1].id, 'msg-processed', 'Druhý nejnovější (13:00)');
  assert.equal(sortedNewest[2].id, 'msg-urgent-newest', 'Třetí nejnovější (12:00)');
  assert.equal(sortedNewest[3].id, 'msg-urgent-older', 'Nejstarší čas (10:00)');

  // 3. OLDEST: čistě od nejstarších vzestupně
  const sortedOldest = sortAiInboxItems(items, 'OLDEST');
  assert.equal(sortedOldest[0].id, 'msg-urgent-older', 'Nejstarší zpráva (10:00) musí být první');
});

test('groupAiInboxMessagesByOrder evaluates group priority and sorts internal items newest first', () => {
  const items: AiInboxListItem[] = [
    {
      id: 'item-thread-1',
      fromEmail: 'klient@firma.cz',
      fromName: 'Klient',
      subject: 'Původní dotaz',
      receivedAt: new Date('2026-11-03T10:00:00Z'),
      processingStatus: 'PROCESSED',
      classification: 'GENERAL_COMMUNICATION',
      confidence: 0.8,
      requiresReview: false,
      aiSummary: 'Úvodní dotaz',
      providerThreadId: 'th-1',
      crmOrder: { id: 'ord-10', orderNumber: 'ZAK-2026-555', title: 'Polepy', status: 'ACTIVE' },
    },
    {
      id: 'item-thread-2',
      fromEmail: 'klient@firma.cz',
      fromName: 'Klient',
      subject: 'Reklamace odlepování fólie',
      receivedAt: new Date('2026-11-05T09:00:00Z'), // novější zpráva v témže vlákně
      processingStatus: 'INGESTED',
      classification: 'COMPLAINT',
      confidence: 0.95,
      requiresReview: true,
      aiSummary: 'Reklamace kvality instalace',
      providerThreadId: 'th-1',
      crmOrder: { id: 'ord-10', orderNumber: 'ZAK-2026-555', title: 'Polepy', status: 'ACTIVE' },
    },
    {
      id: 'other-inquiry',
      fromEmail: 'novy@poptavka.cz',
      fromName: 'Nový Poptávající',
      subject: 'Poptávka LED obrazovek',
      receivedAt: new Date('2026-11-05T11:00:00Z'),
      processingStatus: 'READY',
      classification: 'NEW_INQUIRY',
      confidence: 0.88,
      requiresReview: true,
      aiSummary: 'Zájem o 3 LED plochy',
      providerThreadId: 'th-2',
    },
  ];

  const groups = groupAiInboxMessagesByOrder(items, 'IMPORTANCE_AND_TIME');

  // Skupina ZAK-2026-555 obsahuje reklamaci -> priorita URGENT, musí být před skupinou s pouhou poptávkou (HIGH)
  assert.equal(groups[0].type, 'CRM_ORDER');
  assert.equal(groups[0].orderNumber, 'ZAK-2026-555');
  assert.equal(groups[0].priorityTier, 'URGENT', 'Skupina s reklamací musí mít prioritu URGENT');

  // Uvnitř skupiny ZAK-2026-555 musí být zprávy seřazeny (nejnovější urgentní reklamace nahoře)
  assert.equal(groups[0].items[0].id, 'item-thread-2', 'Nejnovější prioritní zpráva musí být uvnitř vlákna na prvním místě');
  assert.equal(groups[0].items[1].id, 'item-thread-1');
});
