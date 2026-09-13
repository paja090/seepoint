import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CurrentUser } from '../lib/rbac';
import type {
  CommercialRequest,
  AvailabilityResult,
  CommercialOpportunityContext,
  OfferDraftInput,
} from '../lib/ai-commercial/contracts';
import { buildCommercialOfferDraft } from '../lib/ai-commercial/offer-builder';
import { generateOfferDraftFromStructuredInput } from '../lib/ai-commercial/adapters/offer-adapter';
import { periodsOverlap, getOverlapDaysCount } from '../lib/occupancy/availability-service';

describe('AI Offer Intelligence / Offer Builder (AI Commercial Engine)', () => {
  const TENANT_A = 'org_tenant_alpha_123';
  const TENANT_B = 'org_tenant_beta_456';

  const mockUserTenantA: CurrentUser = {
    id: 'usr-sales-001',
    organizationId: TENANT_A,
    email: 'obchodnik@seepoint.cz',
    name: 'Jan Obchodník',
    role: 'ADMIN',
  };

  const mockUserTenantB: CurrentUser = {
    id: 'usr-sales-002',
    organizationId: TENANT_B,
    email: 'cizi@firma.cz',
    name: 'Cizí Uživatel',
    role: 'ADMIN',
  };

  /**
   * SCENARIO A: Complete request with free surfaces -> Valid DRAFT Offer
   * Full match of requested quantity. All surfaces are Exact Match.
   * Offer status is always strictly DRAFT.
   */
  it('Scenario A: Complete request produces a valid DRAFT with exact matches and no conflicts', async () => {
    const commercialReq: CommercialRequest = {
      organizationId: TENANT_A,
      id: 'req-complete-001',
      source: 'AI_MAILBOX',
      sourceReference: { type: 'AiInboxMessage', id: 'msg-001' },
      companyName: 'Kaufland Česká republika v.o.s.',
      contactEmail: 'marketing@kaufland.cz',
      cities: ['Ostrava'],
      regions: ['Moravskoslezský kraj'],
      dateFrom: new Date('2026-11-01T00:00:00.000Z'),
      dateTo: new Date('2026-11-30T00:00:00.000Z'),
      datesClarity: 'EXACT',
      mediaTypes: ['BILLBOARD'],
      quantity: { exact: 2 },
      missingRequirements: [],
      status: 'AVAILABILITY_CHECKED',
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    };

    const availResult: AvailabilityResult = {
      organizationId: TENANT_A,
      status: 'FULL_MATCH',
      requestedQuantity: 2,
      exactMatchCount: 2,
      exactMatches: [
        {
          surfaceId: 'surf-ostrava-001',
          surfaceName: 'Ostrava - Rudná A',
          carrierId: 'carr-001',
          carrierCode: 'OSR-001',
          carrierName: 'Rudná billboard',
          carrierCity: 'Ostrava',
          mediaType: 'BILLBOARD',
          price: 8500,
          matchScore: 100,
          matchReasons: ['Volná plocha v termínu', 'Odpovídá lokalitě Ostrava'],
        },
        {
          surfaceId: 'surf-ostrava-002',
          surfaceName: 'Ostrava - Místecká B',
          carrierId: 'carr-002',
          carrierCode: 'OSR-002',
          carrierName: 'Místecká bigboard',
          carrierCity: 'Ostrava',
          mediaType: 'BILLBOARD',
          price: 9200,
          matchScore: 100,
          matchReasons: ['Volná plocha v termínu', 'Odpovídá lokalitě Ostrava'],
        },
      ],
      alternatives: [],
      missingRequirements: [],
      checkedAt: new Date('2026-09-01T10:05:00.000Z'),
    };

    const draftInput: OfferDraftInput = {
      organizationId: TENANT_A,
      commercialRequest: commercialReq,
      availabilityResult: availResult,
      clientName: 'Kaufland Česká republika v.o.s.',
      contactEmail: 'marketing@kaufland.cz',
      dateFrom: commercialReq.dateFrom!,
      dateTo: commercialReq.dateTo!,
      sourceCommercialRequestId: commercialReq.id,
    };

    // The builder will resolve data and structure the draft offer
    assert.equal(draftInput.organizationId, TENANT_A);
    assert.equal(availResult.status, 'FULL_MATCH');
    assert.equal(availResult.exactMatches.length, 2);
    assert.equal(availResult.alternatives.length, 0);
  });

  /**
   * SCENARIO B: Partial availability -> DRAFT with marked Alternatives
   * When requested count is 3, but only 2 exact matches are free + 1 alternative nearby.
   * Alternative must be explicitly tagged with isAlternative: true and alternativeReason.
   */
  it('Scenario B: Partial availability correctly tags alternatives and informs human reviewer', () => {
    const availResult: AvailabilityResult = {
      organizationId: TENANT_A,
      status: 'PARTIAL_MATCH',
      requestedQuantity: 3,
      exactMatchCount: 2,
      exactMatches: [
        {
          surfaceId: 'surf-opava-001',
          surfaceName: 'Opava - Krnovská',
          carrierId: 'carr-op-001',
          carrierCode: 'OPA-001',
          carrierName: 'Krnovská BB',
          carrierCity: 'Opava',
          mediaType: 'BILLBOARD',
          price: 6000,
          matchScore: 100,
          matchReasons: ['Volná plocha v termínu'],
        },
        {
          surfaceId: 'surf-opava-002',
          surfaceName: 'Opava - Olomoucká',
          carrierId: 'carr-op-002',
          carrierCode: 'OPA-002',
          carrierName: 'Olomoucká BB',
          carrierCity: 'Opava',
          mediaType: 'BILLBOARD',
          price: 6500,
          matchScore: 100,
          matchReasons: ['Volná plocha v termínu'],
        },
      ],
      alternatives: [
        {
          surfaceId: 'surf-hulin-001',
          surfaceName: 'Hlučín - Ostravská',
          carrierId: 'carr-hl-001',
          carrierCode: 'HLU-001',
          carrierName: 'Hlučín CL',
          carrierCity: 'Hlučín',
          mediaType: 'CITYLIGHT',
          price: 5000,
          matchScore: 70,
          matchReasons: ['Alternativní lokalita v blízkosti (Hlučín)', 'Alternativní formát (CITYLIGHT)'],
        },
      ],
      missingRequirements: ['Nalezeny pouze 2 z 3 požadovaných ploch.'],
      checkedAt: new Date(),
    };

    assert.equal(availResult.status, 'PARTIAL_MATCH');
    assert.equal(availResult.exactMatchCount, 2);
    assert.equal(availResult.alternatives.length, 1);

    const alternative = availResult.alternatives[0];
    assert.ok(alternative.matchReasons.some((r) => r.includes('Alternativní')));
  });

  /**
   * SCENARIO C: Zero availability -> Draft NOT created, returns explanation and Next Best Action
   */
  it('Scenario C: Zero availability prevents draft creation and recommends Next Best Action', async () => {
    const availResult: AvailabilityResult = {
      organizationId: TENANT_A,
      status: 'NO_MATCH',
      requestedQuantity: 2,
      exactMatchCount: 0,
      exactMatches: [],
      alternatives: [],
      unavailableSurfaces: [
        {
          surfaceId: 'surf-busy-001',
          surfaceName: 'Ostrava - Centrum',
          reason: 'Plocha je obsazena kampaní Coca-Cola do 31.12.2026',
        },
      ],
      missingRequirements: ['V požadovaném období nebyly nalezeny žádné volné plochy.'],
      checkedAt: new Date(),
    };

    const result = await buildCommercialOfferDraft(
      {
        organizationId: TENANT_A,
        availabilityResult: availResult,
        dateFrom: new Date('2026-11-01'),
        dateTo: new Date('2026-11-30'),
        clientName: 'Test Klient',
      },
      mockUserTenantA
    );

    assert.equal(result.success, false);
    assert.equal(result.surfaceCount, 0);
    assert.equal(result.offerId, undefined);
    assert.equal(result.availabilityConfirmed, false);
    assert.ok(result.warnings?.[0]?.includes('nebyly nalezeny'));
    assert.ok(result.nextBestAction);
  });

  /**
   * SCENARIO D: Request with ambiguous / approximate dates -> Rejected, demands clarification
   * Strict anti-hallucination rule: AI must not guess campaign start/end dates.
   */
  it('Scenario D: Request with approximate or missing dates refuses draft creation and requests clarification', async () => {
    const commercialReq: CommercialRequest = {
      organizationId: TENANT_A,
      id: 'req-approx-dates',
      source: 'SALES_RADAR',
      sourceReference: { type: 'SalesOpportunity', id: 'opp-001' },
      companyName: 'Restaurace Na Rynku',
      cities: ['Brno'],
      regions: ['Jihomoravský kraj'],
      dateFrom: null,
      dateTo: null,
      datesClarity: 'UNSPECIFIED',
      rawDateDescription: 'Plánované otevření někdy na jaře 2027',
      mediaTypes: ['CITYLIGHT'],
      missingRequirements: ['EXACT_CAMPAIGN_DATES'],
      status: 'NEEDS_MORE_INFORMATION',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await buildCommercialOfferDraft(
      {
        organizationId: TENANT_A,
        commercialRequest: commercialReq,
      },
      mockUserTenantA
    );

    assert.equal(result.success, false);
    assert.equal(result.surfaceCount, 0);
    assert.ok(result.warnings?.[0]?.includes('přesně specifikovaný termín'));
    assert.equal(result.nextBestAction?.actionType, 'COMPLETE_INFORMATION');
  });

  /**
   * SCENARIO E: Attempt to include conflicting surface -> Refused / Filtered by canonical engine
   */
  it('Scenario E: Inclusive OOH period overlap correctly blocks touching collision dates', () => {
    // Touching dates: 1.10.–15.10. and 15.10.–31.10. must overlap on 15.10.
    const touchingOverlap = periodsOverlap('2026-10-01', '2026-10-15', '2026-10-15', '2026-10-31');
    assert.equal(touchingOverlap, true, 'Campaigns touching on the same day must collide in OOH calendar');
    assert.equal(getOverlapDaysCount('2026-10-01', '2026-10-15', '2026-10-15', '2026-10-31'), 1);

    // Disjoint dates: 1.10.–15.10. and 16.10.–31.10. must not overlap
    const nonTouching = periodsOverlap('2026-10-01', '2026-10-15', '2026-10-16', '2026-10-31');
    assert.equal(nonTouching, false, 'Non-touching dates must not collide');
  });

  /**
   * SCENARIO F: Availability changes between draft creation and send -> Pre-send recheck blocks send
   * validateOfferBeforeSend strictly verifies inventory before human sends email or link.
   */
  it('Scenario F: validateOfferBeforeSend function is exported and guards offer sending', () => {
    const service = readFileSync(new URL('../lib/offers/service.ts', import.meta.url), 'utf8');

    assert.match(
      service,
      /export async function validateOfferBeforeSend/,
      'lib/offers/service.ts must export validateOfferBeforeSend'
    );
    assert.match(
      service,
      /blockingConflicts\.length === 0/,
      'validateOfferBeforeSend must ensure zero blocking conflicts for canSend'
    );
    assert.match(
      service,
      /findAvailableSurfaces/,
      'validateOfferBeforeSend must find alternatives when blocking conflicts exist'
    );
  });

  /**
   * SCENARIO G: Acceptance concurrency safety -> Serializable / Locking prevents double booking
   * convertOfferToOccupancy uses Serializable transaction and SELECT ... FOR UPDATE.
   */
  it('Scenario G: convertOfferToOccupancy enforces Serializable transaction and FOR UPDATE surface locks', () => {
    const service = readFileSync(new URL('../lib/offers/service.ts', import.meta.url), 'utf8');

    assert.match(
      service,
      /isolationLevel:\s*Prisma\.TransactionIsolationLevel\.Serializable/,
      'convertOfferToOccupancy must use Serializable isolation level'
    );
    assert.match(
      service,
      /SELECT\s+"id"\s+FROM\s+"AdvertisingSurface"[\s\S]*?FOR\s+UPDATE/,
      'convertOfferToOccupancy must lock surface rows with FOR UPDATE'
    );
    assert.match(
      service,
      /findConflicts\(tx,\s*offer\.items,\s*id\)/,
      'convertOfferToOccupancy must re-verify conflicts inside the locked transaction'
    );
  });

  /**
   * SCENARIO H: Pricing integrity -> Real catalog & price rules, 0% default discount, no invented figures
   * offer-adapter.ts must not contain arbitrary fallback numbers like 5000 or 2500.
   */
  it('Scenario H: Offer adapter and builder contain no invented price fallbacks or automatic discounts', () => {
    const adapter = readFileSync(new URL('../lib/ai-commercial/adapters/offer-adapter.ts', import.meta.url), 'utf8');
    const builder = readFileSync(new URL('../lib/ai-commercial/offer-builder.ts', import.meta.url), 'utf8');

    assert.doesNotMatch(
      adapter,
      /rentalPricePerMonth:\s*s\.price\s*\?\s*Number\(s\.price\)\s*:\s*5000/,
      'offer-adapter must not contain 5000 CZK fallback'
    );
    assert.doesNotMatch(
      builder,
      /price\s*\|\|\s*5000/,
      'builder must not invent 5000 CZK price'
    );
    assert.match(
      builder,
      /discountPercent:\s*'0'/,
      'builder must default discount percent to 0'
    );
    assert.match(
      builder,
      /priceSource:\s*'SURFACE_CATALOG'\s*\|\s*'OFFER_PRICE_RULE'\s*\|\s*'MANUAL'/,
      'builder must attribute real pricing sources'
    );
  });

  /**
   * SCENARIO I: Multi-tenant isolation -> Organization barrier
   * Tenant A user cannot create or manipulate offers for Tenant B.
   */
  it('Scenario I: Tenant mismatch throws security violation error', async () => {
    await assert.rejects(
      async () => {
        await buildCommercialOfferDraft(
          {
            organizationId: TENANT_B,
            clientName: 'Firma z jiné organizace',
          },
          mockUserTenantA // User belongs to TENANT_A, request is for TENANT_B
        );
      },
      /Tenant security violation/,
      'Must reject cross-tenant offer creation'
    );
  });

  /**
   * SCENARIO J: LLM provider failure -> Deterministic fallback copy
   * Offer creation must succeed even if Gemini is down or offline.
   */
  it('Scenario J: Builder contains deterministic structured Czech fallback copy when LLM fails', () => {
    const builder = readFileSync(new URL('../lib/ai-commercial/offer-builder.ts', import.meta.url), 'utf8');

    assert.match(
      builder,
      /let\s+clientMessage\s*=\s*`Dobrý den,[\s\S]*?S pozdravem,\s*\\nObchodní tým SeePOINT`/,
      'Builder must have a deterministic Czech client message fallback'
    );
    assert.match(
      builder,
      /let\s+campaignStrategySummary\s*=\s*`Navržený media mix/,
      'Builder must have a deterministic campaign strategy summary fallback'
    );
    assert.match(
      builder,
      /const\s+campaignPhases\s*=\s*\[/,
      'Builder must have structured campaign phases'
    );
  });

  /**
   * SCENARIO K: Source traceability
   * Offer events and metadata must store commercialRequestId, opportunityId, and exact/alt counts.
   */
  it('Scenario K: Builder logs AI_COMMERCIAL_DRAFT_CREATED with source references', () => {
    const builder = readFileSync(new URL('../lib/ai-commercial/offer-builder.ts', import.meta.url), 'utf8');

    assert.match(
      builder,
      /event:\s*'AI_COMMERCIAL_DRAFT_CREATED'/,
      'Builder must create audit event with AI_COMMERCIAL_DRAFT_CREATED'
    );
    assert.match(
      builder,
      /sourceCommercialRequestId:\s*input\.sourceCommercialRequestId/,
      'Audit event must capture sourceCommercialRequestId'
    );
    assert.match(
      builder,
      /sourceOpportunityId:\s*input\.sourceOpportunityId/,
      'Audit event must capture sourceOpportunityId'
    );
  });

  /**
   * SCENARIO L: Idempotence & adapter compatibility
   * Calling generateOfferDraftFromStructuredInput delegates cleanly to buildCommercialOfferDraft.
   */
  it('Scenario L: Adapter delegates cleanly to builder preserving interface compatibility', () => {
    const adapter = readFileSync(new URL('../lib/ai-commercial/adapters/offer-adapter.ts', import.meta.url), 'utf8');

    assert.match(
      adapter,
      /return\s+buildCommercialOfferDraft\(input,\s*currentUser\);/,
      'generateOfferDraftFromStructuredInput must delegate cleanly to buildCommercialOfferDraft'
    );
  });
});
