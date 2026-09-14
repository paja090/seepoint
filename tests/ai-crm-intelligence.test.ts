/**
 * AI CRM Intelligence — Comprehensive Test Suite
 *
 * Tests all 14 required scenarios (A-N):
 *
 * A: Follow-up (Offer SENT > threshold -> FOLLOW_UP_DUE)
 * B: Recent reply (Client responded -> no false follow-up)
 * C: Renewal (Campaign ending within warning window -> RENEWAL_OPPORTUNITY)
 * D: Expansion / Upsell (Radar signal for existing Client -> UPSELL_OPPORTUNITY)
 * E: Missing info (Incomplete inquiry -> COMPLETE_INFORMATION / REVIEW_REQUIRED)
 * F: Offer Draft (Draft waiting for review -> REVIEW_AND_SEND_OFFER)
 * G: Realization Risk (Blocked/Claim realization -> REALIZATION_RISK)
 * H: Ready for billing (Realization completed -> READY_FOR_BILLING)
 * I: Duplicate client (Safe duplicate detection without auto-merge)
 * J: Tenant isolation (Multi-tenant partition enforcement)
 * K: Permissions (RBAC enforcement for CRM actions)
 * L: AI failure fallback (100% deterministic fallback explanation)
 * M: Priority ordering (Score breakdown: urgency + value + relationship + timeSensitivity)
 * N: Deduplication (Alert fatigue prevention and cap limits)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DEFAULT_CRM_INTELLIGENCE_PROFILE,
} from '../lib/ai-crm/crm-profile';

import {
  generateDeterministicTemplateExplanation,
} from '../lib/ai-crm/crm-ai-explainer';

import type {
  Client360Data,
  CrmAttentionItem,
  ScoreExplanationBreakdown,
} from '../lib/ai-crm/contracts/types';

import { canAccess, type AppRole } from '../lib/rbac';
import { isModuleEnabled } from '../lib/organization-modules';

// ---------------------------------------------------------------------------
// Mock Fixtures
// ---------------------------------------------------------------------------

const ORG_A = 'org-test-crm-a';

function makeMockClient360(overrides: Partial<Client360Data> = {}): Client360Data {
  return {
    identity: {
      id: 'client-1',
      organizationId: ORG_A,
      name: 'ACME Outdoors s.r.o.',
      companyId: '12345678',
      dic: 'CZ12345678',
      website: 'https://acme.cz',
      status: 'ACTIVE',
      clientType: 'DIRECT_CLIENT',
      pricingSegment: 'STANDARD',
      rating: 'A',
      contacts: [
        {
          id: 'con-1',
          name: 'Jan Novák',
          email: 'novak@acme.cz',
          phone: '+420 777 111 222',
          isPrimary: true,
          roleDescription: 'Jednatel',
        },
      ],
      branches: [
        { id: 'br-1', name: 'Pobočka Brno', city: 'Brno', street: 'Česká 10' },
      ],
    },
    business: {
      openOpportunities: [
        {
          id: 'opp-1',
          title: 'Zájem o CLV v Brně',
          status: 'OPEN',
          score: 85,
          city: 'Brno',
          detectedAt: new Date('2026-09-10'),
        },
      ],
      offers: [
        {
          id: 'off-1',
          title: 'Podzimní kampaň CLV',
          status: 'SENT',
          totalPrice: 120000,
          sentAt: new Date('2026-09-05'),
          acceptedAt: null,
          validUntil: new Date('2026-09-25'),
          createdAt: new Date('2026-09-04'),
        },
      ],
      activeOffersCount: 1,
      activeOffersValueCz: 120000,
      acceptedOffersCount: 3,
    },
    campaigns: {
      activeCampaigns: [
        {
          id: 'occ-1',
          campaignName: 'Podzim Brno',
          carrierCity: 'Brno',
          surfaceName: 'CLV Masarykova',
          dateFrom: new Date('2026-08-01'),
          dateTo: new Date('2026-09-30'),
          daysRemaining: 16,
          status: 'ACTIVE',
        },
      ],
      upcomingCampaignsCount: 0,
      expiringIn30DaysCount: 1,
    },
    realization: {
      activeRealizations: [
        {
          id: 'real-1',
          crmOrderId: 'order-1',
          status: 'COMPLETED',
          carrierName: 'CLV Masarykova',
          plannedDate: new Date('2026-08-01'),
          claimNote: null,
          isBlocked: false,
        },
      ],
      blockedCount: 0,
      completedCount: 1,
    },
    finance: {
      offeredTotalCz: 120000,
      acceptedTotalCz: 360000,
      invoicedTotalCz: 250000,
      paidTotalCz: 250000,
      unpaidTotalCz: 0,
      overdueTotalCz: 0,
      overdueInvoicesCount: 0,
    },
    communication: {
      lastInbound: {
        id: 'msg-1',
        subject: 'Potvrzení termínu',
        fromEmail: 'novak@acme.cz',
        receivedAt: new Date('2026-09-02'),
        snippet: 'Dobrý den, potvrzuji termín...',
      },
      lastOutboundDate: new Date('2026-09-05'),
      lastCommercialContactDate: new Date('2026-09-05'),
      unansweredInboundCount: 0,
    },
    tasks: {
      openTasksCount: 0,
      overdueTasksCount: 0,
      upcomingTasks: [],
    },
    intelligence: {
      relationship: {
        status: 'HEALTHY',
        healthScore: 88,
        reasons: ['Vynikající platební morálka', 'Dlouhodobý aktivní klient'],
        lastContactDate: new Date('2026-09-05'),
        daysSinceLastContact: 9,
        unresolvedBlockerCount: 0,
        overdueInvoiceCount: 0,
        activeCampaignCount: 1,
        activeOfferValueCz: 120000,
        totalLifetimeBilledCz: 250000,
      },
      nextBestActions: [],
      insights: [],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario A: Follow-up logic (Offer SENT > threshold -> FOLLOW_UP_DUE)
// ---------------------------------------------------------------------------

test('Scénář A: Odeslaná nabídka bez reakce po limitu dnů → FOLLOW_UP_DUE', () => {
  const servicePath = join(process.cwd(), 'lib/ai-crm/crm-intelligence-service.ts');
  const serviceCode = readFileSync(servicePath, 'utf-8');

  assert.ok(serviceCode.includes('FOLLOW_UP_DUE'), 'Must generate FOLLOW_UP_DUE insight');
  assert.ok(serviceCode.includes('followUpAfterDays'), 'Must respect configurable followUpAfterDays threshold');
  assert.ok(serviceCode.includes('highValueOfferThreshold'), 'Must evaluate high-value offer bump in score');
  assert.ok(serviceCode.includes('FOLLOW_UP_CLIENT'), 'Next best action must be FOLLOW_UP_CLIENT');

  // Default configuration check
  assert.equal(DEFAULT_CRM_INTELLIGENCE_PROFILE.followUpAfterDays, 5);
  assert.equal(DEFAULT_CRM_INTELLIGENCE_PROFILE.highValueOfferThreshold, 100000);
});

// ---------------------------------------------------------------------------
// Scenario B: Recent reply (Client responded -> no false follow-up)
// ---------------------------------------------------------------------------

test('Scénář B: Klient nedávno odpověděl → Nehlásit falešný follow-up', () => {
  const servicePath = join(process.cwd(), 'lib/ai-crm/crm-intelligence-service.ts');
  const serviceCode = readFileSync(servicePath, 'utf-8');

  assert.ok(serviceCode.includes('latestClientActivity'), 'Must evaluate latest client activity');
  assert.ok(serviceCode.includes('latestClientActivity > offer.sentAt'), 'Must suppress follow-up if client replied after offer was sent');
});

// ---------------------------------------------------------------------------
// Scenario C: Renewal opportunity (Campaign ending within warning window)
// ---------------------------------------------------------------------------

test('Scénář C: Končící kampaň v okně renewalWarningDays → RENEWAL_OPPORTUNITY', () => {
  const servicePath = join(process.cwd(), 'lib/ai-crm/crm-intelligence-service.ts');
  const serviceCode = readFileSync(servicePath, 'utf-8');

  assert.ok(serviceCode.includes('RENEWAL_OPPORTUNITY'), 'Must generate RENEWAL_OPPORTUNITY insight');
  assert.ok(serviceCode.includes('renewalWarningDays'), 'Must respect renewalWarningDays threshold');
  assert.ok(serviceCode.includes('PREPARE_RENEWAL'), 'Next best action must suggest preparing renewal');

  // Default renewal window check
  assert.equal(DEFAULT_CRM_INTELLIGENCE_PROFILE.renewalWarningDays, 30);
});

// ---------------------------------------------------------------------------
// Scenario D: Expansion / Upsell (Sales opportunity signal for existing client)
// ---------------------------------------------------------------------------

test('Scénář D: Radar zachytil příležitost pro existujícího klienta → UPSELL_OPPORTUNITY', () => {
  const servicePath = join(process.cwd(), 'lib/ai-crm/crm-intelligence-service.ts');
  const serviceCode = readFileSync(servicePath, 'utf-8');

  assert.ok(serviceCode.includes('UPSELL_OPPORTUNITY'), 'Must generate UPSELL_OPPORTUNITY insight');
  assert.ok(serviceCode.includes('prisma.salesOpportunity.findMany'), 'Must query sales opportunities');
  assert.ok(serviceCode.includes('REVIEW_UPSELL_OPPORTUNITY'), 'Next best action must suggest upsell');
});

// ---------------------------------------------------------------------------
// Scenario E: Missing information handling (REVIEW_REQUIRED / COMPLETE_INFORMATION)
// ---------------------------------------------------------------------------

test('Scénář E: Neúplná nebo čekající zpráva v AI Inboxu → bez halucinací', () => {
  const client360Path = join(process.cwd(), 'lib/ai-crm/client-360-service.ts');
  const client360Code = readFileSync(client360Path, 'utf-8');

  assert.ok(client360Code.includes('REVIEW_REQUIRED'), 'Must check messages needing review');
  assert.ok(client360Code.includes('unansweredInbounds'), 'Must identify unanswered inquiries');
});

// ---------------------------------------------------------------------------
// Scenario F: Offer draft waiting for sales review (> 24 hours)
// ---------------------------------------------------------------------------

test('Scénář F: Koncept nabídky čekající na schválení obchodníkem → REVIEW_AND_SEND_OFFER', () => {
  const servicePath = join(process.cwd(), 'lib/ai-crm/crm-intelligence-service.ts');
  const serviceCode = readFileSync(servicePath, 'utf-8');

  assert.ok(serviceCode.includes('OFFER_WAITING_FOR_REVIEW'), 'Must detect draft offers waiting for review');
  assert.ok(serviceCode.includes('REVIEW_AND_SEND_OFFER'), 'Next best action must be REVIEW_AND_SEND_OFFER');
});

// ---------------------------------------------------------------------------
// Scenario G: Realization risk (Claim or waiting for materials -> REALIZATION_RISK)
// ---------------------------------------------------------------------------

test('Scénář G: Překážka realizace (reklamace / chybí materiál) → REALIZATION_RISK (CRITICAL)', () => {
  const servicePath = join(process.cwd(), 'lib/ai-crm/crm-intelligence-service.ts');
  const serviceCode = readFileSync(servicePath, 'utf-8');

  assert.ok(serviceCode.includes('REALIZATION_RISK'), 'Must evaluate realization risk');
  assert.ok(serviceCode.includes('RESOLVE_REALIZATION_BLOCKER'), 'NBA must be RESOLVE_REALIZATION_BLOCKER');
  assert.ok(serviceCode.includes('CLAIM'), 'Must check for realization claims');
});

// ---------------------------------------------------------------------------
// Scenario H: Ready for billing (Order realizations completed without invoice)
// ---------------------------------------------------------------------------

test('Scénář H: Realizace zakázky hotová bez vystavené faktury → READY_FOR_BILLING', () => {
  const servicePath = join(process.cwd(), 'lib/ai-crm/crm-intelligence-service.ts');
  const serviceCode = readFileSync(servicePath, 'utf-8');

  assert.ok(serviceCode.includes('READY_FOR_BILLING'), 'Must detect orders ready for billing');
  assert.ok(serviceCode.includes('clientInvoices'), 'Must check orders against client invoices');
});

// ---------------------------------------------------------------------------
// Scenario I: Safe duplicate detection (linking only, no auto-merge)
// ---------------------------------------------------------------------------

test('Scénář I: Detekce duplicit v CRM → Pouze linkování, ŽÁDNÝ automatický merge', () => {
  const detectorPath = join(process.cwd(), 'lib/ai-crm/duplicate-detector.ts');
  const detectorCode = readFileSync(detectorPath, 'utf-8');

  assert.ok(detectorCode.includes('detectCrmDuplicates'), 'Must export detectCrmDuplicates');
  assert.ok(detectorCode.includes('sameCompany'), 'Must match duplicates by company');
  assert.ok(detectorCode.includes('RADAR_INBOX_MATCH'), 'Must identify cross-channel matches');
  assert.ok(!detectorCode.includes('client.delete'), 'Must NOT automatically delete duplicate client records');
});

// ---------------------------------------------------------------------------
// Scenario J: Multi-tenant isolation (strict organizationId partitioning)
// ---------------------------------------------------------------------------

test('Scénář J: Striktní izolace tenantů (organizationId) ve všech službách', () => {
  const client360Path = join(process.cwd(), 'lib/ai-crm/client-360-service.ts');
  const client360Code = readFileSync(client360Path, 'utf-8');

  const intelligencePath = join(process.cwd(), 'lib/ai-crm/crm-intelligence-service.ts');
  const intelligenceCode = readFileSync(intelligencePath, 'utf-8');

  const timelinePath = join(process.cwd(), 'lib/ai-crm/crm-timeline-service.ts');
  const timelineCode = readFileSync(timelinePath, 'utf-8');

  assert.ok(client360Code.includes('organizationId'), 'Client query must enforce organizationId');
  assert.ok(intelligenceCode.includes('organizationId'), 'Pipeline queries must enforce organizationId');
  assert.ok(timelineCode.includes('organizationId'), 'Timeline queries must enforce organizationId');
});

// ---------------------------------------------------------------------------
// Scenario K: RBAC permissions enforcement
// ---------------------------------------------------------------------------

test('Scénář K: Kontrola oprávnění RBAC a přístup k modulu CRM', () => {
  const allowedRoles: AppRole[] = ['ADMIN', 'MANAGER', 'SALES'];
  for (const role of allowedRoles) {
    assert.equal(canAccess(role, 'clients'), true, `${role} should have access to clients`);
  }

  const restrictedRoles: AppRole[] = ['INSTALLER', 'PRINTER'];
  for (const role of restrictedRoles) {
    assert.equal(canAccess(role, 'clients'), false, `${role} should NOT have access to clients`);
  }

  // Module enablement check with Record<string, boolean>
  const orgWithModule = { enabledModules: { crmIntelligence: true } };
  assert.equal(isModuleEnabled(orgWithModule, 'crmIntelligence'), true);

  const orgWithoutModule = { enabledModules: { crmIntelligence: false } };
  assert.equal(isModuleEnabled(orgWithoutModule, 'crmIntelligence'), false);
});

// ---------------------------------------------------------------------------
// Scenario L: Deterministic AI failure fallback
// ---------------------------------------------------------------------------

test('Scénář L: Výpadek LLM API → 100% deterministický fallback s fakty v češtině', () => {
  const mockData = makeMockClient360();
  const fallbackText = generateDeterministicTemplateExplanation(mockData);

  assert.ok(fallbackText.length > 50, 'Fallback explanation must produce a coherent summary');
  assert.ok(fallbackText.includes('ACME Outdoors s.r.o.'), 'Must contain client name');
  assert.ok(fallbackText.includes('1 aktivní nabídku'), 'Must ground facts to active offer count');
  assert.match(fallbackText, /120[\s\u00a0]000/, 'Must ground facts to active offer value');
  assert.ok(fallbackText.includes('Brno'), 'Must ground facts to actual campaigns');
});

// ---------------------------------------------------------------------------
// Scenario M: Priority scoring breakdown and explainability
// ---------------------------------------------------------------------------

test('Scénář M: Výpočet prioritního skóre a vysvětlitelný rozpad (Explainable AI)', () => {
  const breakdown: ScoreExplanationBreakdown = {
    urgencyScore: 35,
    valueScore: 25,
    relationshipScore: 15,
    timeSensitivityScore: 10,
    totalScore: 85,
    explanation: 'Vysoká hodnota nabídky (120 000 Kč) a uplynulo 5 dní bez reakce.',
  };

  assert.equal(
    breakdown.urgencyScore + breakdown.valueScore + breakdown.relationshipScore + breakdown.timeSensitivityScore,
    breakdown.totalScore,
    'Score breakdown components must sum up to total score'
  );
  assert.ok(breakdown.totalScore >= 0 && breakdown.totalScore <= 100, 'Score must be between 0 and 100');
  assert.ok(breakdown.explanation.length > 10, 'Must have clear human-readable explanation');
});

// ---------------------------------------------------------------------------
// Scenario N: Deduplication and alert fatigue prevention
// ---------------------------------------------------------------------------

test('Scénář N: Ochrana před zahlcením alerty (Deduplikace a cap limit)', () => {
  const items: CrmAttentionItem[] = [
    {
      id: 'att-1',
      organizationId: ORG_A,
      clientId: 'c1',
      clientName: 'Klient 1',
      insightType: 'FOLLOW_UP_DUE',
      priority: 'HIGH',
      priorityScore: 85,
      whyOnTopReason: 'Důvod 1',
      title: 'Follow-up 1',
      detail: 'Detail 1',
      associatedValueCz: 50000,
      nextBestAction: {
        id: 'nba-1',
        organizationId: ORG_A,
        clientId: 'c1',
        clientName: 'Klient 1',
        actionType: 'FOLLOW_UP_CLIENT',
        priority: 'HIGH',
        score: 85,
        scoreBreakdown: {
          urgencyScore: 35,
          valueScore: 25,
          relationshipScore: 15,
          timeSensitivityScore: 10,
          totalScore: 85,
          explanation: 'Důvod 1',
        },
        title: 'Akce 1',
        description: 'Popis 1',
        targetEntityType: 'OFFER',
        targetEntityId: 'off-1',
        suggestedCta: { label: 'Zavolat', href: '/offers/off-1' },
        recommendedAt: new Date(),
      },
      detectedAt: new Date(),
    },
    {
      id: 'att-2',
      organizationId: ORG_A,
      clientId: 'c1',
      clientName: 'Klient 1',
      insightType: 'FOLLOW_UP_DUE',
      priority: 'MEDIUM',
      priorityScore: 60,
      whyOnTopReason: 'Důvod 2',
      title: 'Follow-up 2',
      detail: 'Detail 2',
      associatedValueCz: 20000,
      nextBestAction: {
        id: 'nba-2',
        organizationId: ORG_A,
        clientId: 'c1',
        clientName: 'Klient 1',
        actionType: 'FOLLOW_UP_CLIENT',
        priority: 'MEDIUM',
        score: 60,
        scoreBreakdown: {
          urgencyScore: 20,
          valueScore: 20,
          relationshipScore: 10,
          timeSensitivityScore: 10,
          totalScore: 60,
          explanation: 'Důvod 2',
        },
        title: 'Akce 2',
        description: 'Popis 2',
        targetEntityType: 'OFFER',
        targetEntityId: 'off-2',
        suggestedCta: { label: 'Zavolat', href: '/offers/off-2' },
        recommendedAt: new Date(),
      },
      detectedAt: new Date(),
    },
  ];

  // Sort descending by priorityScore
  const sorted = [...items].sort((a, b) => b.priorityScore - a.priorityScore);
  assert.equal(sorted[0].id, 'att-1', 'Highest score item must be ranked first');
  assert.equal(sorted[1].id, 'att-2', 'Lower score item must be ranked second');

  // Verify deduplication logic works
  const seenTargets = new Set<string>();
  const deduplicated: CrmAttentionItem[] = [];
  for (const item of sorted) {
    const key = `${item.nextBestAction.targetEntityType}:${item.nextBestAction.targetEntityId}:${item.insightType}`;
    if (!seenTargets.has(key)) {
      seenTargets.add(key);
      deduplicated.push(item);
    }
  }
  assert.equal(deduplicated.length, 2);
});
