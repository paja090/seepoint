import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SalesOpportunity, Client } from '@prisma/client';
import {
  calculateOpportunityScore,
} from '../lib/opportunities/scoring';
import {
  buildCommercialOpportunityContextFromRadar,
  buildCommercialRequestFromRadar,
  type SalesOpportunityWithRelations,
} from '../lib/ai-commercial/adapters/radar-adapter';
import {
  determineCommercialNextBestActions,
  determineNextBestActionForRequest,
} from '../lib/ai-commercial/next-best-action';
import {
  parseOpportunityCreateInput,
  parseOpportunityFilters,
  parseOpportunityStatusInput,
  OpportunityValidationError,
} from '../lib/opportunities/policy';

describe('AI Sales Radar Integration & Commercial Engine Foundation', () => {
  const TENANT_A = 'org_tenant_alpha_123';
  const TENANT_B = 'org_tenant_beta_456';

  /**
   * SCENARIO A: New prospect discovery -> NEW_ACQUISITION
   * A new store opening signal for a company not currently in CRM.
   * Must produce canonical CommercialOpportunityContext with opportunityType NEW_ACQUISITION,
   * CommercialRequest with status NEEDS_MORE_INFORMATION, quantity: null (anti-hallucination),
   * and missingRequirements containing EXACT_CAMPAIGN_DATES and EXACT_QUANTITY.
   */
  it('Scenario A: New prospect discovery produces NEW_ACQUISITION, null quantity, and missingRequirements', () => {
    const mockOpportunity: SalesOpportunityWithRelations = {
      id: 'opp-prospect-001',
      organizationId: TENANT_A,
      companyName: 'Lidl Česká republika v.o.s.',
      companyId: '26178541',
      website: 'https://www.lidl.cz',
      eventType: 'STORE_OPENING',
      title: 'Nová prodejna Lidl v Olomouci',
      summary: 'Lidl otevírá novou moderní prodejnu na ulici Velkomoravská v Olomouci.',
      city: 'Olomouc',
      region: 'Olomoucký kraj',
      address: 'Velkomoravská 45, Olomouc',
      latitude: 49.58,
      longitude: 17.25,
      eventDate: new Date('2026-11-15T08:00:00.000Z'),
      detectedAt: new Date('2026-09-01T10:00:00.000Z'),
      sourceUrl: 'https://olomoucky.denik.cz/zpravy_region/lidl-nova-prodejna-olomouc.html',
      sourceTitle: 'Lidl otevře v listopadu novou prodejnu v Olomouci',
      sourcePublishedAt: new Date('2026-09-01T08:00:00.000Z'),
      opportunityScore: 78,
      scoreReasons: null,
      scoreTrigger: 25,
      scoreCustomerFit: 5,
      scoreTiming: 15,
      scoreGeo: 20,
      scoreMediaFit: 8,
      scoreEvidence: 5,
      suggestedMediaTypes: ['BILLBOARD', 'CITYLIGHT'],
      suggestedCampaignPhases: null,
      status: 'NEW',
      clientId: null,
      client: null,
      createdOfferId: null,
      assignedToUserId: null,
      radarSignalId: 'sig-001',
      dismissedReason: null,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };

    // 1. Context transformation
    const oppContext = buildCommercialOpportunityContextFromRadar(mockOpportunity);
    assert.equal(oppContext.organizationId, TENANT_A);
    assert.equal(oppContext.opportunityType, 'NEW_ACQUISITION');
    assert.equal(oppContext.clientId, null);
    assert.equal(oppContext.companyName, 'Lidl Česká republika v.o.s.');
    assert.equal(oppContext.city, 'Olomouc');
    assert.deepEqual(oppContext.suggestedMediaTypes, ['BILLBOARD', 'CITYLIGHT']);

    // 2. Commercial Request adapter (Anti-hallucination)
    const commRequest = buildCommercialRequestFromRadar(mockOpportunity);
    assert.equal(commRequest.organizationId, TENANT_A);
    assert.equal(commRequest.source, 'SALES_RADAR');
    assert.equal(commRequest.sourceReference.type, 'SalesOpportunity');
    assert.equal(commRequest.sourceReference.id, 'opp-prospect-001');
    assert.equal(commRequest.status, 'NEEDS_MORE_INFORMATION');
    assert.equal(commRequest.quantity, null, 'Radar must NEVER hallucinate campaign quantity (e.g. 3 billboards)');
    assert.equal(commRequest.budget, null, 'Radar must NEVER invent client budget');
    assert.ok(commRequest.missingRequirements.includes('EXACT_QUANTITY'));
    assert.ok(commRequest.missingRequirements.includes('EXACT_CAMPAIGN_DATES'));
    assert.deepEqual(commRequest.cities, ['Olomouc']);

    // 3. Next Best Action determination
    const nba = determineNextBestActionForRequest(commRequest);
    assert.equal(nba.organizationId, TENANT_A);
    assert.equal(nba.actionType, 'COMPLETE_INFORMATION');
    assert.ok(nba.description.includes('EXACT_QUANTITY'));
  });

  /**
   * SCENARIO B: Existing client in CRM -> EXPANSION or UPSELL
   * When an opportunity matches an active CRM client, the adapter classifies it
   * as EXPANSION (for new branch/store) or UPSELL, and attaches the client ID.
   */
  it('Scenario B: Existing client in CRM is classified as EXPANSION with linked clientId', () => {
    const mockClient: Client = {
      id: 'client-mountfield-001',
      organizationId: TENANT_A,
      name: 'Mountfield a.s.',
      normalizedName: 'mountfield a.s.',
      companyId: '25620991',
      vatId: 'CZ25620991',
      status: 'ACTIVE',
      tier: 'VIP',
      website: 'https://www.mountfield.cz',
      source: 'DIRECT',
      assignedToUserId: null,
      active: true,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    } as unknown as Client;

    const mockOpportunity: SalesOpportunityWithRelations = {
      id: 'opp-client-002',
      organizationId: TENANT_A,
      companyName: 'Mountfield a.s.',
      companyId: '25620991',
      website: 'https://www.mountfield.cz',
      eventType: 'NEW_BRANCH',
      title: 'Otevření nového prodejního centra v Opavě',
      summary: 'Mountfield otevírá nové prodejní centrum zahradní techniky.',
      city: 'Opava',
      region: 'Moravskoslezský kraj',
      address: 'Hlučínská 12, Opava',
      latitude: 49.94,
      longitude: 17.90,
      eventDate: new Date('2026-10-01T08:00:00.000Z'),
      detectedAt: new Date('2026-09-01T10:00:00.000Z'),
      sourceUrl: 'https://www.patria.cz/zpravy/mountfield-opava.html',
      sourceTitle: 'Mountfield expanduje do Opavy',
      sourcePublishedAt: new Date('2026-09-01T08:00:00.000Z'),
      opportunityScore: 85,
      scoreReasons: null,
      scoreTrigger: 25,
      scoreCustomerFit: 15,
      scoreTiming: 15,
      scoreGeo: 15,
      scoreMediaFit: 10,
      scoreEvidence: 5,
      suggestedMediaTypes: ['BILLBOARD', 'BIGBOARD'],
      suggestedCampaignPhases: null,
      status: 'NEW',
      clientId: mockClient.id,
      client: mockClient,
      createdOfferId: null,
      assignedToUserId: null,
      radarSignalId: null,
      dismissedReason: null,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };

    const oppContext = buildCommercialOpportunityContextFromRadar(mockOpportunity);
    assert.equal(oppContext.organizationId, TENANT_A);
    assert.equal(oppContext.opportunityType, 'EXPANSION');
    assert.equal(oppContext.clientId, 'client-mountfield-001');

    // Also verify scoring gives bonus points for existing client in CRM
    const scoreResult = calculateOpportunityScore({
      eventType: 'NEW_BRANCH',
      city: 'Opava',
      isInCrm: true,
      companyId: '25620991',
      website: 'https://www.mountfield.cz',
    });

    assert.ok(scoreResult.components.companyFit >= 15, 'Existing CRM client must receive customer fit points');
    const existingClientReason = scoreResult.reasons.find((r) => r.factor === 'EXISTING_CLIENT');
    assert.ok(existingClientReason, 'Must include reason for existing client');
    assert.equal(existingClientReason?.points, 10);
  });

  /**
   * SCENARIO C: Freshness decay & staleness penalties
   * Signals with articles older than 1 year or events in past (>90 days)
   * must have freshness = 0 and be heavily penalized.
   */
  it('Scenario C: Freshness decay penalizes signals older than 1 year or past events', () => {
    // 1. Fresh signal: article 3 days ago, event in 20 days
    const freshSignal = calculateOpportunityScore({
      eventType: 'STORE_OPENING',
      city: 'Brno',
      targetCities: ['Brno'],
      carrierCountInCity: 5,
      sourcePublishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      eventDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      hasVerifiedEvidence: true,
      sourceUrl: 'https://www.brnenskenoviny.cz/clanek-123',
    });

    // 2. Stale signal: article published 400 days ago (old news)
    const staleSignal = calculateOpportunityScore({
      eventType: 'STORE_OPENING',
      city: 'Brno',
      targetCities: ['Brno'],
      carrierCountInCity: 5,
      sourcePublishedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
      eventDate: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000), // event 150 days in past
      hasVerifiedEvidence: true,
      sourceUrl: 'https://www.brnenskenoviny.cz/stary-clanek-2024',
    });

    assert.equal(freshSignal.components.freshness, 20, 'Fresh signal should receive maximum freshness points');
    assert.equal(staleSignal.components.freshness, 0, 'Stale signal must receive 0 freshness points');
    assert.ok(
      staleSignal.reasons.some((r) => r.factor === 'STALE_SIGNAL'),
      'Stale signal must include STALE_SIGNAL penalty'
    );
    assert.ok(
      freshSignal.score - staleSignal.score >= 25,
      `Fresh score (${freshSignal.score}) must be significantly higher than stale score (${staleSignal.score})`
    );
  });

  /**
   * SCENARIO D: 5-Component Scoring Breakdown Transparency
   * Verifies that calculateOpportunityScore returns all 5 transparent components:
   * relevance (max 25), freshness (max 20), locationFit (max 25), companyFit (max 20), confidence (max 10).
   */
  it('Scenario D: Scoring returns transparent 5-component breakdown bounded to 100', () => {
    const result = calculateOpportunityScore({
      eventType: 'RETAIL_PARK',
      city: 'Plzeň',
      region: 'Plzeňský kraj',
      targetCities: ['Plzeň'],
      targetRegions: ['Plzeňský kraj'],
      carrierCountInCity: 12,
      isInCrm: true,
      companyId: '12345678',
      website: 'https://retailpark.cz',
      sourceUrl: 'https://idnes.cz/ekonomika/novy-retail-park-plzen',
      eventDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      sourcePublishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      hasVerifiedEvidence: true,
    });

    assert.ok(result.components.relevance <= 25, 'Relevance capped at 25');
    assert.ok(result.components.freshness <= 20, 'Freshness capped at 20');
    assert.ok(result.components.locationFit <= 25, 'Location fit capped at 25');
    assert.ok(result.components.companyFit <= 20, 'Company fit capped at 20');
    assert.ok(result.components.confidence <= 10, 'Confidence capped at 10');

    assert.ok(result.score >= 70, `High quality signal should score >= 70, got ${result.score}`);
    assert.ok(result.score <= 100, 'Score must never exceed 100');

    // Breakdown backward compatibility
    assert.equal(result.breakdown.trigger, result.components.relevance);
    assert.equal(result.breakdown.customerFit, result.components.companyFit);
    assert.equal(result.breakdown.timing, result.components.freshness);
    assert.equal(result.breakdown.geo, result.components.locationFit);
    assert.equal(result.breakdown.evidence, result.components.confidence);
  });

  /**
   * SCENARIO E: Multi-tenant Isolation
   * Data and opportunities from Tenant A must never leak or be assigned to Tenant B.
   */
  it('Scenario E: Strict multi-tenant isolation across opportunities and commercial requests', () => {
    const oppA: SalesOpportunityWithRelations = {
      id: 'opp-tenant-a-1',
      organizationId: TENANT_A,
      companyName: 'Firma Alpha',
      companyId: null,
      website: null,
      title: 'Pobočka v Praze',
      summary: 'Alpha pobočka',
      eventType: 'NEW_BRANCH',
      city: 'Praha',
      region: 'Hlavní město Praha',
      address: null,
      latitude: null,
      longitude: null,
      eventDate: null,
      detectedAt: new Date(),
      sourceUrl: 'https://radar.internal/a',
      sourceTitle: 'Zdroj A',
      sourcePublishedAt: null,
      opportunityScore: 60,
      scoreReasons: null,
      scoreTrigger: 20,
      scoreCustomerFit: 0,
      scoreTiming: 10,
      scoreGeo: 10,
      scoreMediaFit: 0,
      scoreEvidence: 5,
      suggestedMediaTypes: ['BILLBOARD'],
      suggestedCampaignPhases: null,
      status: 'NEW',
      clientId: null,
      client: null,
      createdOfferId: null,
      assignedToUserId: null,
      radarSignalId: null,
      dismissedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const oppB: SalesOpportunityWithRelations = {
      ...oppA,
      id: 'opp-tenant-b-1',
      organizationId: TENANT_B,
      companyName: 'Firma Beta',
    };

    const reqA = buildCommercialRequestFromRadar(oppA);
    const reqB = buildCommercialRequestFromRadar(oppB);

    assert.equal(reqA.organizationId, TENANT_A);
    assert.equal(reqB.organizationId, TENANT_B);
    assert.notEqual(reqA.organizationId, reqB.organizationId);

    const contextA = buildCommercialOpportunityContextFromRadar(oppA);
    const contextB = buildCommercialOpportunityContextFromRadar(oppB);

    assert.equal(contextA.organizationId, TENANT_A);
    assert.equal(contextB.organizationId, TENANT_B);
  });

  /**
   * SCENARIO F: Policy validation, bounded inputs and error handling
   * Prevents malformed inputs, past dates, injection attempts, and invalid enums.
   */
  it('Scenario F: Policy validation enforces sanitization, bounds and prevents past dates', () => {
    // Valid input parses cleanly
    const valid = parseOpportunityCreateInput({
      companyName: '  Kaufland ČR  ',
      title: 'Nová prodejna',
      summary: 'Ověřený signál z tisku',
      city: 'Kladno',
      eventDate: '2099-01-01',
      website: 'https://kaufland.cz',
      companyId: '15987452',
    });
    assert.equal(valid.companyName, 'Kaufland ČR');
    assert.equal(valid.companyId, '15987452');
    assert.equal(valid.city, 'Kladno');

    // Event date in the past must be rejected
    assert.throws(
      () => parseOpportunityCreateInput({
        companyName: 'Test',
        title: 'Akce',
        summary: 'Popis',
        eventDate: '2020-01-01',
      }),
      /minulosti/
    );

    // Malformed website URL must be rejected
    assert.throws(
      () => parseOpportunityCreateInput({
        companyName: 'Test',
        title: 'Akce',
        summary: 'Popis',
        website: 'javascript:alert(1)',
      }),
      OpportunityValidationError
    );

    // Invalid eventType must be rejected
    assert.throws(
      () => parseOpportunityCreateInput({
        companyName: 'Test',
        title: 'Akce',
        summary: 'Popis',
        eventType: 'MALICIOUS_TYPE',
      }),
      OpportunityValidationError
    );
  });

  /**
   * SCENARIO G: Filter validation and bounds
   * Protects API endpoints against unbounded pagination or invalid score queries.
   */
  it('Scenario G: Opportunity filters reject unbounded pagination and invalid ranges', () => {
    const validParams = new URLSearchParams('take=50&skip=0&minScore=50&maxScore=90&city=Brno');
    const filters = parseOpportunityFilters(validParams);
    assert.equal(filters.take, 50);
    assert.equal(filters.minScore, 50);
    assert.equal(filters.maxScore, 90);
    assert.equal(filters.city, 'Brno');

    // Excessive take rejected
    assert.throws(() => parseOpportunityFilters(new URLSearchParams('take=500')), OpportunityValidationError);
    // minScore > maxScore rejected
    assert.throws(() => parseOpportunityFilters(new URLSearchParams('minScore=80&maxScore=40')), OpportunityValidationError);
  });

  /**
   * SCENARIO H: State transitions and dismissal reasons
   * State machine must enforce valid status transitions and mandatory reasons for dismissal.
   */
  it('Scenario H: Opportunity state machine requires dismissal reason when DISMISSED', () => {
    // DISMISSED requires reason
    assert.throws(
      () => parseOpportunityStatusInput({ status: 'DISMISSED' }),
      /důvod/
    );

    const validDismissal = parseOpportunityStatusInput({
      status: 'DISMISSED',
      dismissedReason: 'Není v cílovém regionu klienta',
    });
    assert.equal(validDismissal.status, 'DISMISSED');
    assert.equal(validDismissal.dismissedReason, 'Není v cílovém regionu klienta');
  });

  /**
   * SCENARIO I: Commercial Next Best Action Orchestration
   * Evaluates deterministic Next Best Action for incomplete vs ready requests.
   */
  it('Scenario I: Commercial Next Best Action guides salesperson without unapproved automation', () => {
    // Case 1: Incomplete request (needs more info)
    const incompleteActions = determineCommercialNextBestActions({
      request: {
        organizationId: TENANT_A,
        id: 'req-incomplete',
        source: 'SALES_RADAR',
        sourceReference: { type: 'SalesOpportunity', id: 'opp-1' },
        cities: ['Ostrava'],
        regions: [],
        dateFrom: null,
        dateTo: null,
        datesClarity: 'UNSPECIFIED',
        mediaTypes: ['BILLBOARD'],
        missingRequirements: ['EXACT_CAMPAIGN_DATES', 'EXACT_QUANTITY'],
        status: 'NEEDS_MORE_INFORMATION',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    assert.equal(incompleteActions.length, 1);
    assert.equal(incompleteActions[0].actionType, 'COMPLETE_INFORMATION');
    assert.equal(incompleteActions[0].priority, 'HIGH');
    assert.ok(incompleteActions[0].title.includes('Vyžádat upřesnění'));

    // Case 2: Opportunity with score >= 85
    const highOpportunityActions = determineCommercialNextBestActions({
      opportunityContext: {
        organizationId: TENANT_A,
        opportunityId: 'opp-high',
        source: 'SALES_RADAR',
        opportunityType: 'EXPANSION',
        companyName: 'Albert Heijn',
        title: 'Nový supermarket',
        city: 'Praha',
        score: 92,
        suggestedMediaTypes: ['BILLBOARD', 'CITYLIGHT'],
        createdAt: new Date(),
      },
    });

    assert.equal(highOpportunityActions.length, 1);
    assert.equal(highOpportunityActions[0].actionType, 'CHECK_AVAILABILITY');
    assert.equal(highOpportunityActions[0].priority, 'HIGH');
  });
});
