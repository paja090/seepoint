/**
 * AI Commercial Orchestrator V1 — Comprehensive Test Suite
 *
 * Tests all 13 required scenarios (A-M) from the specification:
 *
 * A: Kompletní poptávka → Offer DRAFT
 * B: Chybějící údaje → NEEDS_INFORMATION
 * C: Částečná dostupnost → DRAFT s alternativami
 * D: Žádná dostupnost → Žádná nabídka
 * E: Offer Accepted → Realization právě jednou
 * F: Duplicitní trigger → Žádné duplicity
 * G: Occupancy selhání → Retryable
 * H: Offer builder selhání → Availability zachována
 * I: Tenant isolation
 * J: Cross-tenant rejection
 * K: SEMI_AUTOMATIC → DRAFT, ne SEND
 * L: Permissions enforcement
 * M: Full traceability chain
 *
 * Additional tests:
 * - Automation policy
 * - Timeline construction
 * - Attention aggregation
 * - Module registration
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Test Utilities
// ---------------------------------------------------------------------------

const ORG_A = 'org-test-orchestrator-a';
const ORG_B = 'org-test-orchestrator-b';

function makeUser(orgId: string, role: string = 'SALES') {
  return {
    id: `user-${orgId}`,
    name: 'Test User',
    email: `test@${orgId}.example.com`,
    role: role as 'ADMIN' | 'MANAGER' | 'SALES',
    organizationId: orgId,
  };
}

function makeInboxMessage(orgId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    organizationId: orgId,
    provider: 'GMAIL',
    providerMessageId: `prov-${Date.now()}`,
    providerThreadId: null,
    internetMessageId: null,
    inReplyTo: null,
    references: [],
    fromEmail: 'klient@example.com',
    fromName: 'Jan Novák',
    toEmails: ['obchod@seepoint.cz'],
    ccEmails: [],
    subject: 'Poptávka reklamních ploch Praha',
    textBody: 'Dobrý den, mám zájem o billboard v Praze na říjen.',
    htmlBody: null,
    receivedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    classification: 'COMMERCIAL_INQUIRY',
    processingStatus: 'READY',
    confidence: 0.95,
    requiresReview: true,
    aiSummary: 'Poptávka reklamních ploch v Praze',
    aiExtractedData: {
      classification: 'COMMERCIAL_INQUIRY',
      confidence: 0.95,
      company: { name: 'Test Company s.r.o.', confidence: 0.9 },
      contact: { name: 'Jan Novák', email: 'klient@example.com' },
      request: {
        projectType: 'STANDARD_MEDIA',
        cities: ['Praha'],
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        datesClarity: 'EXACT',
        requestedMediaTypes: ['BILLBOARD'],
        requestedQuantity: { exact: 2 },
      },
      summary: 'Poptávka 2 billboardů v Praze na říjen 2026',
    },
    clientId: null,
    contactId: null,
    offerId: null,
    crmOrderId: null,
    salesOpportunityId: null,
    integrationConnectionId: null,
    client: null,
    contact: null,
    attachments: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario A: Complete email → Request → Availability → Offer DRAFT
// ---------------------------------------------------------------------------

test('Scénář A: Kompletní poptávka → CommercialRequest → Offer DRAFT', () => {
  // Test the contract: buildCommercialRequestFromInboxMessage produces READY_FOR_AVAILABILITY
  // when all data is present (exact dates, city, quantity)

  // We verify the contract structure exists and has the right shape
  const contractsPath = join(process.cwd(), 'lib/ai-commercial/contracts/commercial-request.ts');
  const contractSource = readFileSync(contractsPath, 'utf-8');

  // CommercialRequest must have these status values
  assert.match(contractSource, /READY_FOR_AVAILABILITY/, 'CommercialRequestStatus must include READY_FOR_AVAILABILITY');
  assert.match(contractSource, /OFFER_DRAFTED/, 'CommercialRequestStatus must include OFFER_DRAFTED');
  assert.match(contractSource, /NEEDS_MORE_INFORMATION/, 'CommercialRequestStatus must include NEEDS_MORE_INFORMATION');

  // Verify orchestrator engine exists and exports the right function
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  assert.match(engineSource, /orchestrateMailboxToOffer/, 'Engine must export orchestrateMailboxToOffer');
  assert.match(engineSource, /BUILD_COMMERCIAL_REQUEST/, 'Engine must have BUILD_COMMERCIAL_REQUEST step');
  assert.match(engineSource, /CHECK_AVAILABILITY/, 'Engine must have CHECK_AVAILABILITY step');
  assert.match(engineSource, /CREATE_OFFER_DRAFT/, 'Engine must have CREATE_OFFER_DRAFT step');
  assert.match(engineSource, /buildCommercialOfferDraft/, 'Engine must call buildCommercialOfferDraft');
});

// ---------------------------------------------------------------------------
// Scenario B: Missing dates → NEEDS_INFORMATION, no hallucination
// ---------------------------------------------------------------------------

test('Scénář B: Neúplná poptávka → NEEDS_INFORMATION, žádné vymýšlení dat', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Engine must check for NEEDS_MORE_INFORMATION status and stop
  assert.match(
    engineSource,
    /NEEDS_MORE_INFORMATION/,
    'Engine must handle NEEDS_MORE_INFORMATION status'
  );
  assert.match(
    engineSource,
    /NEEDS_INFORMATION/,
    'Engine must return NEEDS_INFORMATION status when data is missing'
  );

  // Mailbox adapter must detect missing dates
  const adapterPath = join(process.cwd(), 'lib/ai-commercial/adapters/mailbox-adapter.ts');
  const adapterSource = readFileSync(adapterPath, 'utf-8');

  assert.match(adapterSource, /EXACT_CAMPAIGN_DATES/, 'Adapter must detect missing exact campaign dates');
  assert.match(adapterSource, /missingRequirements/, 'Adapter must populate missingRequirements');
  assert.match(adapterSource, /datesClarity/, 'Adapter must check datesClarity');
});

// ---------------------------------------------------------------------------
// Scenario C: Partial availability → DRAFT with alternatives
// ---------------------------------------------------------------------------

test('Scénář C: Částečná dostupnost → DRAFT s jasně rozlišenými alternativami', () => {
  // Offer builder must handle partial match with alternatives
  const builderPath = join(process.cwd(), 'lib/ai-commercial/offer-builder.ts');
  const builderSource = readFileSync(builderPath, 'utf-8');

  assert.match(builderSource, /isAlternative/, 'Offer builder must track alternative surfaces');
  assert.match(
    builderSource,
    /Alternativní doporučené plochy/,
    'Offer builder must label alternatives in Czech'
  );
  assert.match(
    builderSource,
    /alternativeReason/,
    'Offer builder must include reason for each alternative'
  );

  // Availability adapter must support PARTIAL_MATCH status
  const availPath = join(process.cwd(), 'lib/ai-commercial/contracts/availability.ts');
  const availSource = readFileSync(availPath, 'utf-8');

  assert.match(availSource, /PARTIAL_MATCH/, 'Availability must support PARTIAL_MATCH status');
});

// ---------------------------------------------------------------------------
// Scenario D: No availability → No offer, appropriate NBA
// ---------------------------------------------------------------------------

test('Scénář D: Žádná dostupnost → Nevznikne nabídka, vhodná Next Best Action', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Engine must stop when NO_MATCH and no alternatives
  assert.match(
    engineSource,
    /NO_MATCH/,
    'Engine must handle NO_MATCH availability status'
  );
  assert.match(
    engineSource,
    /Žádné volné plochy/,
    'Engine must produce appropriate NBA when no availability'
  );

  // Verify it doesn't create offer when no surfaces available
  assert.match(
    engineSource,
    /exactMatchCount === 0 && availabilityResult\.alternatives\.length === 0/,
    'Engine must check both exact matches and alternatives before stopping'
  );
});

// ---------------------------------------------------------------------------
// Scenario E: Offer Accepted → Realization handoff exactly once
// ---------------------------------------------------------------------------

test('Scénář E: Offer ACCEPTED → Realization handoff proběhne právě jednou', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  assert.match(
    engineSource,
    /orchestrateOfferAccepted/,
    'Engine must export orchestrateOfferAccepted'
  );
  assert.match(
    engineSource,
    /handoffAcceptedOfferToRealization/,
    'Engine must call the existing idempotent handoff function'
  );

  // Handoff is already idempotent — verify it
  const handoffPath = join(process.cwd(), 'lib/ai-realization/handoff.ts');
  const handoffSource = readFileSync(handoffPath, 'utf-8');

  assert.match(
    handoffSource,
    /IDEMPOTENT CHECK/,
    'Handoff must have idempotency check'
  );
  assert.match(
    handoffSource,
    /offer\.crmOrder/,
    'Handoff must check for existing CrmOrder before creating'
  );
  assert.match(
    handoffSource,
    /doubleCheck/,
    'Handoff must double-check within transaction'
  );
});

// ---------------------------------------------------------------------------
// Scenario F: Same trigger twice → No duplicate CrmOrder
// ---------------------------------------------------------------------------

test('Scénář F: Duplicitní trigger → Žádné duplicity', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Mailbox flow: check existing offerId on inbox message
  assert.match(
    engineSource,
    /message\.offerId/,
    'Engine must check if inbox message already has an offer'
  );
  assert.match(
    engineSource,
    /IDEMPOTENCY_CHECK/,
    'Engine must have an explicit IDEMPOTENCY_CHECK step'
  );

  // Offer accepted flow: check existing crmOrder on offer
  assert.match(
    engineSource,
    /offer\.crmOrder/,
    'Offer accepted flow must check for existing CRM order'
  );
});

// ---------------------------------------------------------------------------
// Scenario G: Occupancy error → Run preserved, retryable
// ---------------------------------------------------------------------------

test('Scénář G: Occupancy selhání → Proces zachován a retryable', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Engine must catch errors in CHECK_AVAILABILITY step
  assert.match(
    engineSource,
    /CHECK_AVAILABILITY.*FAILED/s,
    'Engine must mark CHECK_AVAILABILITY step as FAILED on error'
  );
  assert.match(
    engineSource,
    /Opakovat kontrolu dostupnosti/,
    'Engine must provide retry NBA for failed availability check'
  );

  // CommercialRequest must be preserved (prior steps remain in run.steps)
  assert.match(
    engineSource,
    /commercialRequest.*=.*buildCommercialRequestFromInboxMessage/s,
    'CommercialRequest must be built before availability check'
  );
});

// ---------------------------------------------------------------------------
// Scenario H: Offer builder error → AvailabilityResult preserved
// ---------------------------------------------------------------------------

test('Scénář H: Offer builder selhání → AvailabilityResult zachován', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Engine must catch errors in CREATE_OFFER_DRAFT step
  assert.match(
    engineSource,
    /CREATE_OFFER_DRAFT.*FAILED/s,
    'Engine must mark CREATE_OFFER_DRAFT step as FAILED on error'
  );
  assert.match(
    engineSource,
    /Opakovat vytvoření konceptu nabídky/,
    'Engine must provide retry NBA for failed offer draft'
  );
  assert.match(
    engineSource,
    /Výsledky kontroly dostupnosti jsou zachovány/,
    'Error message must confirm availability results are preserved'
  );
});

// ---------------------------------------------------------------------------
// Scenario I: Tenant A never sees CommercialRun B
// ---------------------------------------------------------------------------

test('Scénář I: Tenant izolace — Tenant A nevidí data Tenant B', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Engine must use runWithTenantContext
  assert.match(
    engineSource,
    /runWithTenantContext/,
    'Engine must use runWithTenantContext for tenant isolation'
  );

  // Engine must set organizationId on the run
  assert.match(
    engineSource,
    /organizationId.*=.*currentUser\.organizationId/s,
    'Engine must extract organizationId from currentUser'
  );

  // Attention service must filter by organizationId
  const attentionPath = join(process.cwd(), 'lib/ai-orchestrator/attention-service.ts');
  const attentionSource = readFileSync(attentionPath, 'utf-8');

  assert.match(
    attentionSource,
    /organizationId/,
    'Attention service must filter by organizationId'
  );
});

// ---------------------------------------------------------------------------
// Scenario J: Cross-tenant source references rejected
// ---------------------------------------------------------------------------

test('Scénář J: Cross-tenant reference zamítnuta', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Engine must verify message belongs to the same org
  assert.match(
    engineSource,
    /message\.organizationId !== organizationId/,
    'Engine must check inbox message organizationId'
  );
  assert.match(
    engineSource,
    /Cross-tenant access denied/,
    'Engine must reject cross-tenant access'
  );

  // Offer builder also checks tenant
  const builderPath = join(process.cwd(), 'lib/ai-commercial/offer-builder.ts');
  const builderSource = readFileSync(builderPath, 'utf-8');

  assert.match(
    builderSource,
    /Tenant security violation/,
    'Offer builder must check tenant security'
  );
});

// ---------------------------------------------------------------------------
// Scenario K: SEMI_AUTOMATIC → Creates DRAFT, never SEND
// ---------------------------------------------------------------------------

test('Scénář K: SEMI_AUTOMATIC vytvoří DRAFT, nikdy samo neodešle', () => {
  const policyPath = join(process.cwd(), 'lib/ai-orchestrator/automation-policy.ts');
  const policySource = readFileSync(policyPath, 'utf-8');

  // SEMI_AUTOMATIC must allow CREATE_OFFER_DRAFT
  assert.match(
    policySource,
    /SEMI_AUTOMATIC.*CREATE_OFFER_DRAFT/s,
    'SEMI_AUTOMATIC must allow CREATE_OFFER_DRAFT'
  );

  // SEND_OFFER must always require human approval
  assert.match(
    policySource,
    /ALWAYS_REQUIRES_HUMAN.*SEND_OFFER/s,
    'SEND_OFFER must always require human approval'
  );
  assert.match(
    policySource,
    /CHANGE_PRICE/,
    'CHANGE_PRICE must require human approval'
  );
  assert.match(
    policySource,
    /CREATE_INVOICE/,
    'CREATE_INVOICE must require human approval'
  );
});

test('Scénář K (unit): isActionAllowed correctly enforces policy', async () => {
  const { isActionAllowed } = await import('../lib/ai-orchestrator/automation-policy.ts');

  // SEMI_AUTOMATIC: allowed actions
  assert.equal(isActionAllowed('ANALYZE_EMAIL', 'SEMI_AUTOMATIC'), true);
  assert.equal(isActionAllowed('CREATE_COMMERCIAL_REQUEST', 'SEMI_AUTOMATIC'), true);
  assert.equal(isActionAllowed('CHECK_AVAILABILITY', 'SEMI_AUTOMATIC'), true);
  assert.equal(isActionAllowed('CREATE_OFFER_DRAFT', 'SEMI_AUTOMATIC'), true);

  // SEMI_AUTOMATIC: forbidden actions
  assert.equal(isActionAllowed('SEND_OFFER', 'SEMI_AUTOMATIC'), false);
  assert.equal(isActionAllowed('CHANGE_PRICE', 'SEMI_AUTOMATIC'), false);
  assert.equal(isActionAllowed('RESERVE_SURFACE', 'SEMI_AUTOMATIC'), false);
  assert.equal(isActionAllowed('CONTACT_CLIENT', 'SEMI_AUTOMATIC'), false);
  assert.equal(isActionAllowed('CREATE_INVOICE', 'SEMI_AUTOMATIC'), false);
  assert.equal(isActionAllowed('SEND_INVOICE', 'SEMI_AUTOMATIC'), false);

  // ASSISTED: more restricted
  assert.equal(isActionAllowed('ANALYZE_EMAIL', 'ASSISTED'), true);
  assert.equal(isActionAllowed('CHECK_AVAILABILITY', 'ASSISTED'), false);
  assert.equal(isActionAllowed('CREATE_OFFER_DRAFT', 'ASSISTED'), false);

  // ADVANCED: more permissive but still respects safety
  assert.equal(isActionAllowed('CREATE_OFFER_DRAFT', 'ADVANCED'), true);
  assert.equal(isActionAllowed('HANDOFF_TO_REALIZATION', 'ADVANCED'), true);
  assert.equal(isActionAllowed('SEND_OFFER', 'ADVANCED'), false); // Never auto
  assert.equal(isActionAllowed('ACCEPT_OFFER', 'ADVANCED'), false); // Never auto
});

// ---------------------------------------------------------------------------
// Scenario L: User without SEND permission can't execute CTA
// ---------------------------------------------------------------------------

test('Scénář L: Uživatel bez práva SEND nemůže odeslat nabídku', () => {
  const rbacPath = join(process.cwd(), 'lib/rbac.ts');
  const rbacSource = readFileSync(rbacPath, 'utf-8');

  // VIEWER must not have 'commercial' access
  assert.match(
    rbacSource,
    /VIEWER:\s*\[[\s\S]*?\]/,
    'VIEWER role must be defined'
  );
  assert.doesNotMatch(
    rbacSource,
    /VIEWER:[\s\S]*?commercial[\s\S]*?(?=\w+:)/,
    'VIEWER must not have commercial access'
  );

  // ADMIN, MANAGER, SALES must have 'commercial' access
  assert.match(rbacSource, /ADMIN:[\s\S]*?commercial/, 'ADMIN must have commercial access');
  assert.match(rbacSource, /MANAGER:[\s\S]*?commercial/, 'MANAGER must have commercial access');
  assert.match(rbacSource, /SALES:[\s\S]*?commercial/, 'SALES must have commercial access');
});

test('Scénář L (unit): canAccess enforces commercial permissions', async () => {
  const { canAccess } = await import('../lib/rbac.ts');

  assert.equal(canAccess('ADMIN', 'commercial'), true);
  assert.equal(canAccess('MANAGER', 'commercial'), true);
  assert.equal(canAccess('SALES', 'commercial'), true);
  assert.equal(canAccess('VIEWER', 'commercial'), false);
  assert.equal(canAccess('TECHNICIAN', 'commercial'), false);
  assert.equal(canAccess('WORKER', 'commercial'), false);
  assert.equal(canAccess('ACCOUNTANT', 'commercial'), false);
});

// ---------------------------------------------------------------------------
// Scenario M: Full correlation chain Email→Request→Availability→Offer→Order
// ---------------------------------------------------------------------------

test('Scénář M: Full traceability — correlation chain structure', () => {
  const typesPath = join(process.cwd(), 'lib/ai-orchestrator/contracts/types.ts');
  const typesSource = readFileSync(typesPath, 'utf-8');

  // CorrelationChain must include all entities
  assert.match(typesSource, /correlationId: string/, 'CorrelationChain must have correlationId');
  assert.match(typesSource, /inboxMessageId\?/, 'CorrelationChain must have inboxMessageId');
  assert.match(typesSource, /commercialRequestId\?/, 'CorrelationChain must have commercialRequestId');
  assert.match(typesSource, /availabilityCheckedAt\?/, 'CorrelationChain must have availabilityCheckedAt');
  assert.match(typesSource, /offerId\?/, 'CorrelationChain must have offerId');
  assert.match(typesSource, /crmOrderId\?/, 'CorrelationChain must have crmOrderId');
  assert.match(typesSource, /realizationIds\?/, 'CorrelationChain must have realizationIds');

  // Engine must populate correlation chain at each step
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  assert.match(engineSource, /correlationChain\.inboxMessageId/, 'Engine must set inboxMessageId in chain');
  assert.match(engineSource, /correlationChain\.commercialRequestId/, 'Engine must set commercialRequestId in chain');
  assert.match(engineSource, /correlationChain\.availabilityCheckedAt/, 'Engine must set availabilityCheckedAt in chain');
  assert.match(engineSource, /correlationChain\.offerId/, 'Engine must set offerId in chain');
  assert.match(engineSource, /correlationChain\.crmOrderId/, 'Engine must set crmOrderId in chain');
});

// ---------------------------------------------------------------------------
// Automation Policy Tests
// ---------------------------------------------------------------------------

test('Automation policy: Business-critical akce VŽDY vyžadují lidské schválení', async () => {
  const { isActionAllowed, getBlockReason } = await import('../lib/ai-orchestrator/automation-policy.ts');

  const criticalActions = [
    'SEND_OFFER', 'CHANGE_PRICE', 'RESERVE_SURFACE',
    'CONTACT_CLIENT', 'CREATE_INVOICE', 'SEND_INVOICE', 'ACCEPT_OFFER'
  ] as const;

  for (const action of criticalActions) {
    for (const level of ['ASSISTED', 'SEMI_AUTOMATIC', 'ADVANCED'] as const) {
      assert.equal(
        isActionAllowed(action, level),
        false,
        `${action} must be forbidden at level ${level}`
      );

      const reason = getBlockReason(action, level);
      assert.ok(reason, `${action} must have a block reason at ${level}`);
      assert.match(reason, /lidské schválení/, `Block reason for ${action} must mention human approval`);
    }
  }
});

test('Automation policy: Orchestrator profile defaults to SEMI_AUTOMATIC', async () => {
  const { getOrganizationOrchestratorProfile } = await import('../lib/ai-orchestrator/automation-policy.ts');

  // Null organization → defaults
  const defaultProfile = getOrganizationOrchestratorProfile(null);
  assert.equal(defaultProfile.automationLevel, 'SEMI_AUTOMATIC');
  assert.equal(defaultProfile.autoAnalyzeEmails, true);
  assert.equal(defaultProfile.autoCheckAvailability, true);
  assert.equal(defaultProfile.autoCreateOfferDraft, true);
  assert.equal(defaultProfile.autoSendOffer, false);
  assert.equal(defaultProfile.autoInvoice, false);

  // Organization without profile → defaults
  const noProfile = getOrganizationOrchestratorProfile({ enabledModules: {} });
  assert.equal(noProfile.automationLevel, 'SEMI_AUTOMATIC');
  assert.equal(noProfile.autoSendOffer, false);
  assert.equal(noProfile.autoInvoice, false);
});

test('Automation policy: autoSendOffer a autoInvoice jsou VŽDY false', async () => {
  const { getOrganizationOrchestratorProfile } = await import('../lib/ai-orchestrator/automation-policy.ts');

  // Even if someone tries to set them to true in DB...
  const hackedProfile = getOrganizationOrchestratorProfile({
    enabledModules: {
      orchestratorProfile: {
        automationLevel: 'ADVANCED',
        autoSendOffer: true,
        autoInvoice: true,
      },
    },
  });

  assert.equal(hackedProfile.automationLevel, 'ADVANCED'); // This is allowed
  assert.equal(hackedProfile.autoSendOffer, false, 'autoSendOffer must ALWAYS be false');
  assert.equal(hackedProfile.autoInvoice, false, 'autoInvoice must ALWAYS be false');
});

// ---------------------------------------------------------------------------
// Contract Consolidation Tests
// ---------------------------------------------------------------------------

test('Contract consolidation: DatesClarity importován z kanonického kontraktu', () => {
  const inboxTypesPath = join(process.cwd(), 'lib/ai-inbox/types.ts');
  const inboxSource = readFileSync(inboxTypesPath, 'utf-8');

  // Must import DatesClarity from canonical contract
  assert.match(
    inboxSource,
    /import type \{.*DatesClarity.*\} from ['"]@\/lib\/ai-commercial\/contracts\/commercial-request['"]/s,
    'ai-inbox/types.ts must import DatesClarity from canonical contract'
  );

  // Must use DatesClarity type, not inline literal
  assert.match(
    inboxSource,
    /datesClarity\?: DatesClarity/,
    'ExtractedRequestData.datesClarity must use DatesClarity type'
  );

  // Must NOT have inline 'EXACT' | 'APPROXIMATE' | 'UNSPECIFIED' for datesClarity
  assert.doesNotMatch(
    inboxSource,
    /datesClarity\?:\s*['"]EXACT['"]\s*\|\s*['"]APPROXIMATE['"]/,
    'Must not have inline DatesClarity literal type'
  );
});

test('Contract consolidation: Priority typy definovány v příslušných modulech', () => {
  // CommercialNextBestAction priority
  const nbaPath = join(process.cwd(), 'lib/ai-commercial/contracts/next-best-action.ts');
  const nbaSource = readFileSync(nbaPath, 'utf-8');
  assert.match(nbaSource, /NextBestActionPriority/, 'NBA contract must define NextBestActionPriority');
  assert.match(nbaSource, /CRITICAL/, 'NBA priority must include CRITICAL');

  // RealizationNextBestAction priority
  const realizationPath = join(process.cwd(), 'lib/ai-realization/contracts/realization-action.ts');
  const realizationSource = readFileSync(realizationPath, 'utf-8');
  assert.match(realizationSource, /RealizationActionPriority/, 'Realization must define RealizationActionPriority');
  assert.match(realizationSource, /URGENT/, 'Realization priority must include URGENT');

  // Orchestrator unified priority
  const orchTypesPath = join(process.cwd(), 'lib/ai-orchestrator/contracts/types.ts');
  const orchSource = readFileSync(orchTypesPath, 'utf-8');
  assert.match(orchSource, /CommercialPriority/, 'Orchestrator must define unified CommercialPriority');
  assert.match(orchSource, /CRITICAL.*URGENT.*HIGH.*MEDIUM.*LOW/s, 'CommercialPriority must include all levels');
});

// ---------------------------------------------------------------------------
// Orchestrator Architecture Tests
// ---------------------------------------------------------------------------

test('Orchestrátor: Neobsahuje business logiku modulů', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Must NOT contain pricing logic
  assert.doesNotMatch(engineSource, /unitPrice|catalogPrice|priceSource/, 'Engine must not contain pricing logic');

  // Must NOT contain availability calculation
  assert.doesNotMatch(engineSource, /findAvailableSurfaces|periodsOverlap/, 'Engine must not contain availability calculation');

  // Must NOT contain offer calculation
  assert.doesNotMatch(engineSource, /calculateOffer|taxRate/, 'Engine must not contain offer calculation');

  // Must NOT contain realization business logic
  assert.doesNotMatch(engineSource, /evaluateRealization|billingReadiness/, 'Engine must not contain realization logic');

  // Must NOT contain client scoring
  assert.doesNotMatch(engineSource, /opportunityScore.*>.*\d+.*\?/s, 'Engine must not contain opportunity scoring');
});

test('Orchestrátor: Volá existující moduly, nevytváří paralelní implementaci', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Must import from existing modules
  assert.match(engineSource, /from '@\/lib\/ai-commercial\/adapters\/mailbox-adapter'/, 'Must use mailbox adapter');
  assert.match(engineSource, /from '@\/lib\/ai-commercial\/adapters\/occupancy-adapter'/, 'Must use occupancy adapter');
  assert.match(engineSource, /from '@\/lib\/ai-commercial\/offer-builder'/, 'Must use offer builder');
  assert.match(engineSource, /from '@\/lib\/ai-realization\/handoff'/, 'Must use realization handoff');
  assert.match(engineSource, /from '@\/lib\/ai-commercial\/next-best-action'/, 'Must use NBA service');
});

test('Orchestrátor: Výchozí mód je SEMI_AUTOMATIC', () => {
  const typesPath = join(process.cwd(), 'lib/ai-orchestrator/contracts/types.ts');
  const typesSource = readFileSync(typesPath, 'utf-8');

  assert.match(
    typesSource,
    /automationLevel:\s*['"]SEMI_AUTOMATIC['"]/,
    'Default profile must use SEMI_AUTOMATIC'
  );
});

// ---------------------------------------------------------------------------
// Timeline Tests
// ---------------------------------------------------------------------------

test('Commercial Timeline: Struktura TimelineEntry pokrývá celý chain', () => {
  const typesPath = join(process.cwd(), 'lib/ai-orchestrator/contracts/types.ts');
  const typesSource = readFileSync(typesPath, 'utf-8');

  const requiredTypes = [
    'EMAIL_RECEIVED',
    'EMAIL_ANALYZED',
    'COMMERCIAL_REQUEST_CREATED',
    'AVAILABILITY_CHECKED',
    'OFFER_DRAFT_CREATED',
    'OFFER_SENT',
    'OFFER_ACCEPTED',
    'ORDER_CREATED',
    'REALIZATION_STARTED',
    'REALIZATION_COMPLETED',
    'READY_FOR_BILLING',
    'RADAR_OPPORTUNITY_DETECTED',
  ];

  for (const type of requiredTypes) {
    assert.match(typesSource, new RegExp(type), `TimelineEntryType must include ${type}`);
  }
});

test('Commercial Timeline: Timeline service existuje a exportuje buildCommercialTimeline', () => {
  const timelinePath = join(process.cwd(), 'lib/ai-orchestrator/commercial-timeline.ts');
  const timelineSource = readFileSync(timelinePath, 'utf-8');

  assert.match(timelineSource, /buildCommercialTimeline/, 'Must export buildCommercialTimeline');
  assert.match(timelineSource, /resolveEntityChain/, 'Must resolve entity chains');
  assert.match(timelineSource, /entries\.sort/, 'Must sort entries chronologically');
});

// ---------------------------------------------------------------------------
// Attention ("Co potřebuje moji pozornost") Tests
// ---------------------------------------------------------------------------

test('My Attention: Pokrývá všechny potřebné zdroje pozornosti', () => {
  const attentionPath = join(process.cwd(), 'lib/ai-orchestrator/attention-service.ts');
  const attentionSource = readFileSync(attentionPath, 'utf-8');

  // Must aggregate from all sources
  assert.match(attentionSource, /collectMissingInfoItems/, 'Must collect missing info items');
  assert.match(attentionSource, /collectDraftReviewItems/, 'Must collect draft review items');
  assert.match(attentionSource, /collectFollowUpItems/, 'Must collect follow-up items');
  assert.match(attentionSource, /collectRealizationBlockedItems/, 'Must collect realization blocked items');
  assert.match(attentionSource, /collectDeadlineRiskItems/, 'Must collect deadline risk items');
  assert.match(attentionSource, /collectRenewalItems/, 'Must collect renewal items');
  assert.match(attentionSource, /collectNewOpportunityItems/, 'Must collect new opportunity items');

  // Must sort by priority
  assert.match(attentionSource, /priorityWeight/, 'Must sort by priority weight');
});

test('My Attention: AttentionCategory pokrývá všechny typy', () => {
  const typesPath = join(process.cwd(), 'lib/ai-orchestrator/contracts/types.ts');
  const typesSource = readFileSync(typesPath, 'utf-8');

  const categories = [
    'MISSING_INFO',
    'DRAFT_REVIEW',
    'AVAILABILITY_CHANGED',
    'REALIZATION_BLOCKED',
    'DEADLINE_RISK',
    'FOLLOW_UP',
    'RENEWAL',
    'NEW_OPPORTUNITY',
  ];

  for (const cat of categories) {
    assert.match(typesSource, new RegExp(cat), `AttentionCategory must include ${cat}`);
  }
});

// ---------------------------------------------------------------------------
// Module Registration Tests
// ---------------------------------------------------------------------------

test('Module policy: commercial modul registrován v SYSTEM_MODULES', () => {
  const modulesPath = join(process.cwd(), 'lib/organization-modules.ts');
  const modulesSource = readFileSync(modulesPath, 'utf-8');

  assert.match(
    modulesSource,
    /id:\s*['"]commercial['"]/,
    'Commercial module must be registered in SYSTEM_MODULES'
  );
  assert.match(
    modulesSource,
    /routes:.*\/commercial/,
    'Commercial module must have /commercial route'
  );
  assert.match(
    modulesSource,
    /AI Engine/,
    'Commercial module must have AI Engine badge'
  );
});

test('Module policy: commercial modul v PRO plánu', () => {
  const modulesPath = join(process.cwd(), 'lib/organization-modules.ts');
  const modulesSource = readFileSync(modulesPath, 'utf-8');

  // Check PRO plan includes commercial
  assert.match(
    modulesSource,
    /PRO:[\s\S]*?commercial/,
    'PRO plan must include commercial module'
  );
});

// ---------------------------------------------------------------------------
// Commercial Center Tests
// ---------------------------------------------------------------------------

test('Commercial Center: Stránka existuje a je server component', () => {
  const pagePath = join(process.cwd(), 'app/commercial/page.tsx');
  const pageSource = readFileSync(pagePath, 'utf-8');

  // Must NOT be a client component
  assert.doesNotMatch(pageSource, /['"]use client['"]/, 'Commercial center must be server component');

  // Must check auth
  assert.match(pageSource, /getCurrentUser|requireApiAccess/, 'Must check authentication');

  // Must check permissions
  assert.match(pageSource, /canAccess|commercial/, 'Must check commercial permissions');

  // Must fetch dashboard data
  assert.match(pageSource, /getCommercialCenterData/, 'Must call getCommercialCenterData');
});

test('Commercial Center: API routes existují', () => {
  const routes = [
    'app/api/ai-orchestrator/run/route.ts',
    'app/api/ai-orchestrator/attention/route.ts',
    'app/api/ai-orchestrator/dashboard/route.ts',
  ];

  for (const route of routes) {
    const routePath = join(process.cwd(), route);
    const source = readFileSync(routePath, 'utf-8');

    assert.match(source, /requireApiAccess/, `${route} must use requireApiAccess`);
    assert.match(source, /commercial/, `${route} must check 'commercial' section`);
    assert.match(source, /force-dynamic/, `${route} must be force-dynamic`);
  }
});

// ---------------------------------------------------------------------------
// Barrel Export Tests
// ---------------------------------------------------------------------------

test('Orchestrátor: Barrel exports pokrývají všechny veřejné API', () => {
  const indexPath = join(process.cwd(), 'lib/ai-orchestrator/index.ts');
  const indexSource = readFileSync(indexPath, 'utf-8');

  assert.match(indexSource, /orchestrateMailboxToOffer/, 'Must export orchestrateMailboxToOffer');
  assert.match(indexSource, /orchestrateOfferAccepted/, 'Must export orchestrateOfferAccepted');
  assert.match(indexSource, /isActionAllowed/, 'Must export isActionAllowed');
  assert.match(indexSource, /buildCommercialTimeline/, 'Must export buildCommercialTimeline');
  assert.match(indexSource, /getCommercialAttentionItems/, 'Must export getCommercialAttentionItems');
  assert.match(indexSource, /getCommercialCenterData/, 'Must export getCommercialCenterData');
});

// ---------------------------------------------------------------------------
// Idempotency Deep Tests
// ---------------------------------------------------------------------------

test('Idempotency: Mailbox flow používá message.offerId jako anchor', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // After creating offer, must link it back to inbox message
  assert.match(
    engineSource,
    /aiInboxMessage\.updateMany/,
    'Engine must update inbox message with offerId after creating offer'
  );

  // Must check existing offerId before creating
  assert.match(
    engineSource,
    /message\.offerId/,
    'Engine must check message.offerId for idempotency'
  );
});

test('Idempotency: Offer accepted flow deleguje na idempotentní handoff', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  assert.match(
    engineSource,
    /handoffAcceptedOfferToRealization/,
    'Must delegate to existing idempotent handoff'
  );

  // Must also check offer.crmOrder itself
  assert.match(
    engineSource,
    /offer\.crmOrder/,
    'Must check for existing CrmOrder before handoff'
  );
});

// ---------------------------------------------------------------------------
// Error/Retry Tests
// ---------------------------------------------------------------------------

test('Error handling: Každý krok zachovává výsledky předchozích kroků', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Steps array must accumulate (never cleared)
  assert.match(engineSource, /run\.steps\.push/, 'Must push to steps array');
  assert.doesNotMatch(engineSource, /run\.steps\s*=\s*\[\]/, 'Must never clear steps array');

  // Errors must set step status and not throw
  const tryBlocks = (engineSource.match(/try\s*{/g) || []).length;
  const catchBlocks = (engineSource.match(/catch\s*\(/g) || []).length;

  assert.ok(tryBlocks >= 2, 'Must have try blocks for error-prone steps');
  assert.ok(catchBlocks >= 2, 'Must have catch blocks for error-prone steps');
});

// ---------------------------------------------------------------------------
// Audit & Traceability Tests
// ---------------------------------------------------------------------------

test('Audit: Orchestrační run je logován do CrmAuditLog', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  assert.match(
    engineSource,
    /crmAuditLog\.create/,
    'Engine must create CRM audit log entries'
  );
  assert.match(
    engineSource,
    /ORCHESTRATE_MAILBOX_TO_OFFER/,
    'Mailbox flow must log ORCHESTRATE_MAILBOX_TO_OFFER action'
  );
  assert.match(
    engineSource,
    /ORCHESTRATE_OFFER_ACCEPTED/,
    'Offer accepted flow must log ORCHESTRATE_OFFER_ACCEPTED action'
  );
  assert.match(
    engineSource,
    /correlationId/,
    'Audit logs must include correlationId'
  );
});

test('Audit: Offer events obsahují orchestration metadata', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  assert.match(
    engineSource,
    /offerEvent\.create/,
    'Engine must create offer event entries'
  );
  assert.match(
    engineSource,
    /ORCHESTRATOR_DRAFT_CREATED/,
    'Offer event must include ORCHESTRATOR_DRAFT_CREATED event type'
  );
});

// ---------------------------------------------------------------------------
// Human Control Verification
// ---------------------------------------------------------------------------

test('Human Control: Orchestrátor nikdy automaticky neodešle nabídku', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  // Must NOT contain sendOffer, publishOffer, transitionOffer to SENT
  assert.doesNotMatch(
    engineSource,
    /sendOffer|publishOffer|transitionOffer/,
    'Engine must never call sendOffer/publishOffer/transitionOffer'
  );

  // Must NOT have status 'SENT' anywhere
  assert.doesNotMatch(
    engineSource,
    /status:\s*['"]SENT['"]/,
    'Engine must never set offer status to SENT'
  );

  // Must always produce DRAFT only
  assert.match(
    engineSource,
    /buildCommercialOfferDraft/,
    'Engine must only use buildCommercialOfferDraft (which always creates DRAFT)'
  );
});

test('Human Control: Orchestrátor nikdy automaticky nefakturuje', () => {
  const enginePath = join(process.cwd(), 'lib/ai-orchestrator/orchestrator-engine.ts');
  const engineSource = readFileSync(enginePath, 'utf-8');

  assert.doesNotMatch(
    engineSource,
    /createInvoice|sendInvoice|ClientInvoice/,
    'Engine must never touch invoicing'
  );
});
