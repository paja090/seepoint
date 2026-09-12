import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommercialOpportunityContextFromRadar,
  buildCommercialRequestFromRadar,
  buildCommercialRequestFromMailbox,
  determineCommercialNextBestActions,
} from '../lib/ai-commercial';
import type {
  CommercialRequest,
  CommercialOpportunityContext,
} from '../lib/ai-commercial';
import type { AiInboxMessage, Client, ClientContact, SalesOpportunity } from '@prisma/client';

describe('AI Commercial Engine Contracts & Adapters', () => {
  const TENANT_A = 'org_tenant_alpha_123';
  const TENANT_B = 'org_tenant_beta_456';

  describe('AI Sales Radar Adapter', () => {
    it('classifies new prospect opportunity as NEW_ACQUISITION when no client is linked', () => {
      const opportunity = {
        id: 'opp-1',
        organizationId: TENANT_A,
        title: 'Nová pobočka Kaufland Kolín',
        companyName: 'Kaufland Česká republika v.o.s.',
        companyId: '25110161',
        city: 'Kolín',
        region: 'Středočeský kraj',
        address: 'Havlíčkova 123, Kolín',
        latitude: 50.02,
        longitude: 15.20,
        eventDate: new Date('2026-11-15T00:00:00Z'),
        eventType: 'NEW_BRANCH',
        opportunityScore: 85,
        suggestedMediaTypes: ['BILLBOARD', 'BIGBOARD'],
        sourceUrl: 'https://example.com/kaufland-kolin',
        sourceTitle: 'Kaufland staví v Kolíně',
        summary: 'Otevření plánováno na listopad 2026.',
        clientId: null,
        assignedToUserId: 'user-sales-1',
        createdAt: new Date('2026-09-01T10:00:00Z'),
        updatedAt: new Date('2026-09-01T10:00:00Z'),
      } as unknown as SalesOpportunity;

      const context = buildCommercialOpportunityContextFromRadar(opportunity);

      assert.equal(context.organizationId, TENANT_A, 'Tenant isolation must be strictly preserved');
      assert.equal(context.opportunityType, 'NEW_ACQUISITION');
      assert.equal(context.companyName, 'Kaufland Česká republika v.o.s.');
      assert.equal(context.score, 85);
      assert.deepEqual(context.suggestedMediaTypes, ['BILLBOARD', 'BIGBOARD']);
    });

    it('classifies existing client opportunity as EXPANSION for new branch event', () => {
      const opportunity = {
        id: 'opp-2',
        organizationId: TENANT_A,
        title: 'Nová pobočka KFC Plzeň',
        companyName: 'AmRest s.r.o.',
        companyId: '25114702',
        city: 'Plzeň',
        region: 'Plzeňský kraj',
        address: 'Rokycanská 12, Plzeň',
        latitude: 49.74,
        longitude: 13.38,
        eventDate: new Date('2026-12-01T00:00:00Z'),
        eventType: 'NEW_BRANCH',
        opportunityScore: 92,
        suggestedMediaTypes: ['NAVIGATION', 'BILLBOARD'],
        clientId: 'client-existing-kfc',
        client: {
          id: 'client-existing-kfc',
          organizationId: TENANT_A,
          name: 'AmRest s.r.o. - KFC',
        } as Client,
        assignedToUserId: 'user-sales-1',
        createdAt: new Date('2026-09-01T10:00:00Z'),
        updatedAt: new Date('2026-09-01T10:00:00Z'),
      } as unknown as SalesOpportunity & { client?: Client | null };

      const context = buildCommercialOpportunityContextFromRadar(opportunity);

      assert.equal(context.opportunityType, 'EXPANSION');
      assert.equal(context.companyName, 'AmRest s.r.o. - KFC');
      assert.equal(context.clientId, 'client-existing-kfc');
    });

    it('classifies existing client opportunity as UPSELL for campaign/marketing event', () => {
      const opportunity = {
        id: 'opp-3',
        organizationId: TENANT_A,
        title: 'Podzimní kampaň Datart',
        companyName: 'HP TRONIC Zlín, spol. s r.o.',
        city: 'Praha',
        region: 'Hlavní město Praha',
        eventType: 'MARKETING_CAMPAIGN',
        opportunityScore: 78,
        suggestedMediaTypes: ['BILLBOARD', 'LED_SCREEN'],
        clientId: 'client-existing-datart',
        createdAt: new Date('2026-09-01T10:00:00Z'),
        updatedAt: new Date('2026-09-01T10:00:00Z'),
      } as unknown as SalesOpportunity;

      const context = buildCommercialOpportunityContextFromRadar(opportunity);

      assert.equal(context.opportunityType, 'UPSELL');
    });

    it('builds CommercialRequest from Radar with approximate timing and flags EXACT_CAMPAIGN_DATES as missing', () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const opportunity = {
        id: 'opp-4',
        organizationId: TENANT_A,
        title: 'Nový autosalon Hyundai Olomouc',
        companyName: 'Hyundai Olomouc s.r.o.',
        city: 'Olomouc',
        region: 'Olomoucký kraj',
        address: 'Pražská 45, Olomouc',
        eventDate: futureDate,
        eventType: 'NEW_BRANCH',
        opportunityScore: 88,
        suggestedMediaTypes: ['BILLBOARD'],
        summary: 'Plánované otevření za měsíc.',
        clientId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as SalesOpportunity;

      const request = buildCommercialRequestFromRadar(opportunity);

      assert.equal(request.organizationId, TENANT_A);
      assert.equal(request.source, 'SALES_RADAR');
      assert.equal(request.sourceReference.id, 'opp-4');
      assert.equal(request.datesClarity, 'APPROXIMATE');
      assert.ok(request.missingRequirements.includes('EXACT_CAMPAIGN_DATES'), 'Must flag that exact campaign dates are required');
      assert.equal(request.status, 'NEEDS_MORE_INFORMATION', 'Must not jump blindly into offer generation without exact dates');
      assert.ok(request.dateFrom !== null && request.dateTo !== null, 'Proposes approximate 4-week window around opening');
    });
  });

  describe('AI Mailbox Adapter & Anti-Hallucination Guard', () => {
    it('sets status to READY_FOR_AVAILABILITY when dates are exact and media types are present', () => {
      const message = {
        id: 'msg-exact-1',
        organizationId: TENANT_B,
        fromEmail: 'marketing@lidl.cz',
        fromName: 'Petr Novotný',
        subject: 'Poptávka billboardů na říjen 2026 - Brno',
        extractedData: {
          company: { name: 'Lidl Česká republika v.o.s.' },
          contact: { name: 'Petr Novotný', email: 'marketing@lidl.cz', phone: '+420 800 115 555' },
          request: {
            projectType: 'CAMPAIGN',
            cities: ['Brno'],
            regions: ['Jihomoravský kraj'],
            requestedMediaTypes: ['BILLBOARD', 'BIGBOARD'],
            dateFrom: '2026-10-01',
            dateTo: '2026-10-31',
            datesClarity: 'EXACT',
            rawDateDescription: '1.10. - 31.10.2026',
            budget: 150000,
            requestedQuantity: { min: 4, max: 8, exact: 6 },
            notes: 'Preferujeme hlavní tahy městem.',
            missingRequirements: [],
          },
        },
        matchedClientId: 'client-lidl',
        matchedContactId: 'contact-petr',
        createdAt: new Date('2026-09-02T08:00:00Z'),
        updatedAt: new Date('2026-09-02T08:00:00Z'),
      } as unknown as AiInboxMessage;

      const request = buildCommercialRequestFromMailbox(message);

      assert.equal(request.organizationId, TENANT_B, 'Preserves tenant B');
      assert.equal(request.source, 'AI_MAILBOX');
      assert.equal(request.datesClarity, 'EXACT');
      assert.equal(request.status, 'READY_FOR_AVAILABILITY');
      assert.equal(request.missingRequirements.length, 0);
      assert.deepEqual(request.cities, ['Brno']);
      assert.equal(request.budget, 150000);
      assert.equal(request.quantity?.exact, 6);
    });

    it('flags missing requirements and prevents availability scan when dates are vague or seasonal', () => {
      const message = {
        id: 'msg-vague-1',
        organizationId: TENANT_A,
        fromEmail: 'info@zahradnictvi.cz',
        fromName: 'Karel Zelený',
        subject: 'Reklama na jaře',
        extractedData: {
          company: { name: 'Zahradnictví Zelený s.r.o.' },
          contact: { name: 'Karel Zelený', email: 'info@zahradnictvi.cz' },
          request: {
            projectType: 'CAMPAIGN',
            cities: ['Hradec Králové'],
            requestedMediaTypes: ['BILLBOARD'],
            dateFrom: null,
            dateTo: null,
            datesClarity: 'APPROXIMATE',
            rawDateDescription: 'někdy na jaře příštího roku',
            missingRequirements: ['EXACT_CAMPAIGN_DATES'],
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AiInboxMessage;

      const request = buildCommercialRequestFromMailbox(message);

      assert.equal(request.status, 'NEEDS_MORE_INFORMATION');
      assert.ok(request.missingRequirements.includes('EXACT_CAMPAIGN_DATES'));
      assert.equal(request.datesClarity, 'APPROXIMATE');
    });

    it('correctly maps CRM ClientContact with firstName and lastName without crashing', () => {
      const message = {
        id: 'msg-contact-1',
        organizationId: TENANT_A,
        fromEmail: 'eva.dvorakova@firma.cz',
        extractedData: {
          company: { name: 'Firma s.r.o.' },
          request: {
            projectType: 'CAMPAIGN',
            cities: ['Pardubice'],
            requestedMediaTypes: ['BILLBOARD'],
            dateFrom: '2026-11-01',
            dateTo: '2026-11-30',
            datesClarity: 'EXACT',
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as AiInboxMessage;

      const contact = {
        id: 'contact-eva',
        organizationId: TENANT_A,
        firstName: 'Eva',
        lastName: 'Dvořáková',
        email: 'eva.dvorakova@firma.cz',
        phone: '+420 721 000 111',
      } as unknown as ClientContact;

      const request = buildCommercialRequestFromMailbox(message, contact);

      assert.equal(request.contactName, 'Eva Dvořáková');
      assert.equal(request.contactEmail, 'eva.dvorakova@firma.cz');
      assert.equal(request.contactPhone, '+420 721 000 111');
    });
  });

  describe('Deterministic Next-Best-Action Recommender', () => {
    it('recommends COMPLETE_INFORMATION when CommercialRequest needs more information', () => {
      const request: CommercialRequest = {
        organizationId: TENANT_A,
        id: 'req-1',
        source: 'AI_MAILBOX',
        sourceReference: { type: 'AiInboxMessage', id: 'msg-1' },
        cities: ['Praha'],
        regions: [],
        dateFrom: null,
        dateTo: null,
        datesClarity: 'UNSPECIFIED',
        mediaTypes: [],
        missingRequirements: ['EXACT_CAMPAIGN_DATES', 'LOCATION_OR_MEDIA_TYPE'],
        status: 'NEEDS_MORE_INFORMATION',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const actions = determineCommercialNextBestActions({ request });

      assert.ok(actions.length > 0);
      const firstAction = actions[0];
      assert.equal(firstAction.actionType, 'COMPLETE_INFORMATION');
      assert.equal(firstAction.priority, 'HIGH');
      assert.equal(firstAction.organizationId, TENANT_A);
      const payload = firstAction.suggestedPayload as { missingRequirements?: string[] };
      assert.ok(payload.missingRequirements?.includes('EXACT_CAMPAIGN_DATES'));
    });

    it('recommends CHECK_AVAILABILITY when CommercialRequest is READY_FOR_AVAILABILITY', () => {
      const request: CommercialRequest = {
        organizationId: TENANT_A,
        id: 'req-2',
        source: 'AI_MAILBOX',
        sourceReference: { type: 'AiInboxMessage', id: 'msg-2' },
        cities: ['Brno'],
        regions: [],
        dateFrom: new Date('2026-10-01'),
        dateTo: new Date('2026-10-31'),
        datesClarity: 'EXACT',
        mediaTypes: ['BILLBOARD'],
        missingRequirements: [],
        status: 'READY_FOR_AVAILABILITY',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const actions = determineCommercialNextBestActions({ request });

      assert.ok(actions.some((a) => a.actionType === 'CHECK_AVAILABILITY'));
      const checkAction = actions.find((a) => a.actionType === 'CHECK_AVAILABILITY')!;
      assert.equal(checkAction.organizationId, TENANT_A);
      assert.equal(checkAction.priority, 'HIGH');
    });

    it('recommends CHECK_AVAILABILITY for high-score Sales Radar opportunity', () => {
      const opportunityContext: CommercialOpportunityContext = {
        organizationId: TENANT_B,
        opportunityId: 'opp-high',
        source: 'SALES_RADAR',
        opportunityType: 'EXPANSION',
        companyName: 'Lidl ČR',
        title: 'Nová prodejna v Chebu',
        score: 95,
        city: 'Cheb',
        suggestedMediaTypes: ['BILLBOARD'],
        createdAt: new Date(),
      };

      const actions = determineCommercialNextBestActions({ opportunityContext });

      assert.ok(actions.some((a) => a.actionType === 'CHECK_AVAILABILITY'));
      const highOppAction = actions.find((a) => a.actionType === 'CHECK_AVAILABILITY')!;
      assert.equal(highOppAction.organizationId, TENANT_B);
      assert.equal(highOppAction.priority, 'HIGH');
      assert.ok(highOppAction.title.includes('Lidl ČR'));
    });

    it('recommends resolving conflict when unavailable conflict surfaces are detected', () => {
      const availabilityResult = {
        organizationId: TENANT_A,
        dateFrom: new Date('2026-10-01'),
        dateTo: new Date('2026-10-31'),
        totalSurfacesEvaluated: 10,
        availableSurfaces: [],
        unavailableSurfaces: [
          {
            surfaceId: 'surf-99',
            surfaceName: 'BB Kolín - Nádraží',
            code: 'BB-099',
            mediaType: 'BILLBOARD',
            blockingOccupancies: [
              {
                id: 'occ-1',
                status: 'ACTIVE_RENTED' as const,
                dateFrom: new Date('2026-09-15'),
                dateTo: new Date('2026-10-15'),
                clientName: 'Jiný Inzerent',
              },
            ],
            reason: 'Obsazeno jinou kampaní',
          },
        ],
        summary: '1 plocha v konfliktu',
      };

      const actions = determineCommercialNextBestActions({ availabilityResult });

      assert.ok(actions.some((a) => a.actionType === 'COMPLETE_INFORMATION'));
      const conflictAction = actions.find((a) => a.actionType === 'COMPLETE_INFORMATION')!;
      assert.equal(conflictAction.organizationId, TENANT_A);
      assert.equal(conflictAction.priority, 'MEDIUM');
      assert.ok(conflictAction.title.includes('Vyřešit konflikt obsazenosti'));
    });
  });
});
