/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCommercialCenterData,
  priorityWeight,
  isActionAllowed,
  getBlockReason,
  getOrganizationOrchestratorProfile,
  ALWAYS_REQUIRES_HUMAN,
  getOrchestrationRunByCorrelationId,
  getOrchestrationRunsForEntity,
} from '../lib/ai-orchestrator';
import type { CommercialPriority } from '../lib/ai-orchestrator/contracts/types';
import { prisma } from '../lib/db';

test('Integration: Priority ordering follows CRITICAL > URGENT > HIGH > MEDIUM > LOW', () => {
  const priorities: CommercialPriority[] = ['CRITICAL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'];
  for (let i = 0; i < priorities.length - 1; i++) {
    const currentWeight = priorityWeight[priorities[i]];
    const nextWeight = priorityWeight[priorities[i + 1]];
    assert.ok(
      currentWeight > nextWeight,
      `Priority ${priorities[i]} (${currentWeight}) must have higher weight than ${priorities[i + 1]} (${nextWeight})`
    );
  }
});

test('Integration: Human approval enforcement — dangerous actions always require human approval', () => {
  const dangerousActions = [
    'SEND_OFFER',
    'CHANGE_PRICE',
    'RESERVE_SURFACE',
    'CONTACT_CLIENT',
    'CREATE_INVOICE',
    'SEND_INVOICE',
    'ACCEPT_OFFER',
  ] as const;

  for (const action of dangerousActions) {
    // Under all levels, must be false
    assert.strictEqual(isActionAllowed(action, 'ASSISTED'), false, `${action} must require human approval in ASSISTED`);
    assert.strictEqual(isActionAllowed(action, 'SEMI_AUTOMATIC'), false, `${action} must require human approval in SEMI_AUTOMATIC`);
    assert.strictEqual(isActionAllowed(action, 'ADVANCED'), false, `${action} must require human approval in ADVANCED`);

    const reason = getBlockReason(action, 'ADVANCED');
    assert.ok(reason && reason.includes('vyžaduje lidské schválení'), `Reason for ${action} must state human approval required`);
    assert.ok(ALWAYS_REQUIRES_HUMAN.has(action), `${action} must be present in ALWAYS_REQUIRES_HUMAN set`);
  }

  // Automated action CHECK_AVAILABILITY is allowed under SEMI_AUTOMATIC
  assert.strictEqual(isActionAllowed('CHECK_AVAILABILITY', 'SEMI_AUTOMATIC'), true);
  assert.strictEqual(isActionAllowed('CHECK_AVAILABILITY', 'ADVANCED'), true);
  assert.strictEqual(isActionAllowed('CHECK_AVAILABILITY', 'ASSISTED'), false);
});

test('Integration: Profile defaults guarantee autoSendOffer and autoInvoice are false', () => {
  const profile = getOrganizationOrchestratorProfile(null);
  assert.strictEqual(profile.automationLevel, 'SEMI_AUTOMATIC');
  assert.strictEqual(profile.autoSendOffer, false);
  assert.strictEqual(profile.autoInvoice, false);

  // Even if an org tries to sneak autoSendOffer: true in DB json
  const hostileProfile = getOrganizationOrchestratorProfile({
    enabledModules: {
      orchestratorProfile: {
        automationLevel: 'ADVANCED',
        autoSendOffer: true,
        autoInvoice: true,
      },
    },
  });
  assert.strictEqual(hostileProfile.autoSendOffer, false, 'autoSendOffer must remain false regardless of input');
  assert.strictEqual(hostileProfile.autoInvoice, false, 'autoInvoice must remain false regardless of input');
});

test('Integration: Commercial Center Data aggregates UnifiedNextBestActions from Attention and Mailbox', async () => {
  const orgA = 'test-org-integ-cca';

  // Mock prisma queries to provide controlled deterministic data
  const origFindManyInbox = prisma.aiInboxMessage.findMany;
  const origFindManyOffer = prisma.offer.findMany;
  const origFindManyOpp = prisma.salesOpportunity.findMany;
  const origCountRealization = prisma.crmRealization.count;
  const origFindManyRealization = prisma.crmRealization.findMany;
  const origFindManyOccupancyInsight = (prisma as any).occupancyInsight?.findMany;

  try {
    if ((prisma as any).occupancyInsight) {
      (prisma as any).occupancyInsight.findMany = async () => [];
    }
    (prisma.aiInboxMessage as any).findMany = async () => [
      {
        id: 'inbox-msg-1',
        organizationId: orgA,
        subject: 'Poptávka na LED obrazovku',
        fromEmail: 'klient@acme.cz',
        fromName: 'Petr Novák',
        classification: 'NEW_INQUIRY',
        receivedAt: new Date('2026-09-10T10:00:00Z'),
        requiresReview: true,
        offerId: null,
        client: { name: 'ACME s.r.o.' },
      },
    ];

    (prisma.salesOpportunity as any).findMany = async () => [
      {
        id: 'opp-1',
        companyName: 'Brno BigBoard',
        title: 'Expanze v Brně',
        city: 'Brno',
        opportunityScore: 90,
        status: 'NEW',
        createdOfferId: null,
        detectedAt: new Date('2026-09-11T12:00:00Z'),
      },
    ];

    (prisma.offer as any).findMany = async () => [
      {
        id: 'offer-draft-1',
        title: 'Nabídka kampaně Q4',
        createdAt: new Date('2026-09-08T09:00:00Z'),
        totalPrice: 150000,
        client: { name: 'ACME s.r.o.' },
      },
    ];

    (prisma.crmRealization as any).count = async () => 2;
    (prisma.crmRealization as any).findMany = async () => [];

    const data = await getCommercialCenterData(orgA);

    assert.ok(Array.isArray(data.attentionItems), 'attentionItems must be an array');
    assert.ok(Array.isArray(data.nextBestActions), 'nextBestActions must be an array');
    assert.ok(data.nextBestActions.length > 0, 'nextBestActions should contain actions');
    assert.ok(data.offers && Array.isArray(data.offers.drafts), 'offers.drafts must be an array');
    assert.ok(data.realizations, 'realizations summary must be present');

    // Verify nextBestActions are sorted by priority weight descending
    for (let i = 0; i < data.nextBestActions.length - 1; i++) {
      const pCurrent = priorityWeight[data.nextBestActions[i].priority as CommercialPriority] || 0;
      const pNext = priorityWeight[data.nextBestActions[i + 1].priority as CommercialPriority] || 0;
      assert.ok(pCurrent >= pNext, `NBA at index ${i} (${pCurrent}) must be >= index ${i + 1} (${pNext})`);
    }

    // Verify all NBAs have required human approval flags
    for (const nba of data.nextBestActions) {
      assert.ok(typeof nba.requiresHumanApproval === 'boolean', 'requiresHumanApproval must be boolean');
      assert.ok(typeof nba.executableByOrchestrator === 'boolean', 'executableByOrchestrator must be boolean');
      assert.ok(nba.organizationId, 'organizationId must be set');
      assert.ok(nba.source, 'source must be set');
    }

    // Specifically verify that inbox action CHECK_AVAILABILITY is executableByOrchestrator without human approval
    const inboxAction = data.nextBestActions.find((a) => a.actionType === 'CHECK_AVAILABILITY' && a.source === 'MAILBOX');
    assert.ok(inboxAction, 'MAILBOX CHECK_AVAILABILITY action must be generated for new inquiry');
    assert.strictEqual(inboxAction.requiresHumanApproval, false);
    assert.strictEqual(inboxAction.executableByOrchestrator, true);

  } finally {
    if ((prisma as any).occupancyInsight) {
      (prisma as any).occupancyInsight.findMany = origFindManyOccupancyInsight;
    }
    (prisma.aiInboxMessage as any).findMany = origFindManyInbox;
    (prisma.offer as any).findMany = origFindManyOffer;
    (prisma.salesOpportunity as any).findMany = origFindManyOpp;
    (prisma.crmRealization as any).count = origCountRealization;
    (prisma.crmRealization as any).findMany = origFindManyRealization;
  }
});

test('Integration: Audit log trace retrieval for CommercialRun', async () => {
  const orgId = 'test-org-audit-trace';
  const correlationId = 'corr-integ-test-123';
  const offerId = 'offer-integ-test-456';

  const mockLogs = [
    {
      id: 'log-1',
      organizationId: orgId,
      userId: 'user-trace-1',
      userEmail: 'trace@example.com',
      action: 'ORCHESTRATE_MAILBOX_TO_OFFER',
      entityType: 'CommercialRun',
      entityId: correlationId,
      createdAt: new Date('2026-09-12T10:00:00Z'),
      detailsJson: JSON.stringify({
        correlationId,
        inboxMessageId: 'inbox-789',
        offerId,
        automationLevel: 'SEMI_AUTOMATIC',
        steps: [
          { step: 'ANALYZE_MAILBOX', status: 'COMPLETED', durationMs: 12 },
          { step: 'CHECK_AVAILABILITY', status: 'COMPLETED', durationMs: 45 },
          { step: 'CREATE_OFFER_DRAFT', status: 'COMPLETED', durationMs: 30 },
        ],
      }),
    },
  ];

  const origFindFirst = prisma.crmAuditLog.findFirst;
  const origFindMany = prisma.crmAuditLog.findMany;

  try {
    (prisma.crmAuditLog as any).findFirst = async (args: any) => {
      const match = mockLogs.find(
        (l) =>
          l.organizationId === args?.where?.organizationId &&
          l.entityId === args?.where?.entityId &&
          l.entityType === args?.where?.entityType
      );
      return match || null;
    };

    (prisma.crmAuditLog as any).findMany = async (args: any) => {
      return mockLogs.filter(
        (l) =>
          l.organizationId === args?.where?.organizationId &&
          l.entityType === args?.where?.entityType
      );
    };

    // Query by correlation ID
    const retrievedRun = await getOrchestrationRunByCorrelationId(orgId, correlationId);
    assert.ok(retrievedRun, 'Run must be retrievable by correlation ID');
    assert.strictEqual(retrievedRun.id, correlationId);
    assert.strictEqual(retrievedRun.action, 'ORCHESTRATE_MAILBOX_TO_OFFER');
    assert.strictEqual(retrievedRun.details.offerId, offerId);
    assert.strictEqual(retrievedRun.details.automationLevel, 'SEMI_AUTOMATIC');

    // Verify cross-tenant isolation on trace lookup
    const crossTenantRun = await getOrchestrationRunByCorrelationId('other-org', correlationId);
    assert.strictEqual(crossTenantRun, null, 'Other tenant must not be able to retrieve run trace');

    // Query by entity
    const entityRuns = await getOrchestrationRunsForEntity(orgId, 'Offer', offerId);
    assert.ok(entityRuns.length >= 1, 'Run must be retrievable by associated offer entity');
    assert.strictEqual(entityRuns[0].id, correlationId);

  } finally {
    (prisma.crmAuditLog as any).findFirst = origFindFirst;
    (prisma.crmAuditLog as any).findMany = origFindMany;
  }
});

test('Integration: Follow-up & Renewal delegation to CRM Intelligence (no duplicate 4-day logic)', async () => {
  const { collectFollowUpItems, collectRenewalItems } = await import('../lib/ai-orchestrator/attention-service');
  const orgId = 'test-org-followup-crm';

  const mockCrmItems: any[] = [
    {
      id: 'crm-att-1',
      organizationId: orgId,
      insightType: 'FOLLOW_UP_DUE',
      priority: 'HIGH',
      title: 'Follow-up: Nabídka Billboard Brno',
      detail: 'Klient nereagoval 7 dní (profilový limit: 5 dní)',
      whyOnTopReason: 'Vysoká hodnota zakázky: 120 000 Kč',
      entityType: 'Offer',
      entityId: 'offer-100',
      detectedAt: new Date('2026-09-10T10:00:00Z'),
      nextBestAction: {
        id: 'nba-crm-1',
        organizationId: orgId,
        actionType: 'FOLLOW_UP_CLIENT',
        priority: 'HIGH',
        title: 'Kontaktovat klienta s follow-upem',
        description: 'Zavolejte klientovi a ověřte stav nabídky.',
        targetEntityType: 'Offer',
        targetEntityId: 'offer-100',
        suggestedCta: { label: 'Otevřít nabídku', href: '/offers/offer-100' },
        scoreBreakdown: { explanation: 'Doba bez odezvy překročila 5 dní' },
      },
    },
    {
      id: 'crm-att-2',
      organizationId: orgId,
      insightType: 'RENEWAL_OPPORTUNITY',
      priority: 'URGENT',
      title: 'Obnova: Kampaň Q3 končí za 14 dní',
      detail: 'Klient má 3 plochy končící k 30.9.2026',
      whyOnTopReason: 'Dlouhodobý VIP klient',
      entityType: 'Occupancy',
      entityId: 'occ-200',
      detectedAt: new Date('2026-09-11T11:00:00Z'),
      nextBestAction: {
        id: 'nba-crm-2',
        organizationId: orgId,
        actionType: 'PROPOSE_CAMPAIGN_RENEWAL',
        priority: 'URGENT',
        title: 'Navrhnout prodloužení kampaně',
        description: 'Připravte návrh pokračování pronájmu.',
        targetEntityType: 'Occupancy',
        targetEntityId: 'occ-200',
        suggestedCta: { label: 'Detail obsazenosti', href: '/occupancy' },
        scoreBreakdown: { explanation: 'Kampaň končí v rámci varovného okna' },
      },
    },
  ];

  const items: any[] = [];
  await collectFollowUpItems(orgId, items, mockCrmItems);
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].category, 'FOLLOW_UP');
  assert.strictEqual(items[0].source, 'CRM');
  assert.strictEqual(items[0].entityId, 'offer-100');
  assert.strictEqual(items[0].whyReason, 'Vysoká hodnota zakázky: 120 000 Kč');
  assert.strictEqual(items[0].unifiedNextBestAction?.requiresHumanApproval, true);
  assert.strictEqual(items[0].unifiedNextBestAction?.executableByOrchestrator, false);

  await collectRenewalItems(orgId, items, mockCrmItems);
  assert.strictEqual(items.length, 2);
  const renewalItem = items.find((i) => i.category === 'RENEWAL');
  assert.ok(renewalItem);
  assert.strictEqual(renewalItem.priority, 'URGENT');
  assert.strictEqual(renewalItem.unifiedNextBestAction?.requiresHumanApproval, true);
});

test('Integration: Multi-tenant isolation — items from Org A never leak to Org B', async () => {
  const { collectMissingInfoItems } = await import('../lib/ai-orchestrator/attention-service');
  const orgA = 'org-tenant-iso-a';
  const orgB = 'org-tenant-iso-b';

  const origFindManyInbox = prisma.aiInboxMessage.findMany;
  try {
    (prisma.aiInboxMessage as any).findMany = async (args: any) => {
      // Simulate strict database isolation
      if (args?.where?.organizationId === orgA) {
        return [
          {
            id: 'inbox-msg-org-a',
            subject: 'Poptávka Org A',
            fromEmail: 'a@example.com',
            fromName: 'Klient A',
            receivedAt: new Date(),
            client: { name: 'Firma A' },
          },
        ];
      }
      return [];
    };

    const itemsA: any[] = [];
    await collectMissingInfoItems(orgA, itemsA);
    assert.strictEqual(itemsA.length, 1);
    assert.strictEqual(itemsA[0].organizationId, orgA);

    const itemsB: any[] = [];
    await collectMissingInfoItems(orgB, itemsB);
    assert.strictEqual(itemsB.length, 0, 'Org B must not receive any items belonging to Org A');

  } finally {
    (prisma.aiInboxMessage as any).findMany = origFindManyInbox;
  }
});

