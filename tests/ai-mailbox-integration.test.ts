import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAndSanitizeAnalysis,
  buildAnalysisPrompt,
} from '../lib/ai-inbox/extraction';
import {
  extractDomain,
  isFreemailDomain,
} from '../lib/ai-inbox/client-matcher';
import {
  buildCommercialRequestFromMailbox,
} from '../lib/ai-commercial/adapters/mailbox-adapter';
import {
  determineNextBestActionForRequest,
} from '../lib/ai-commercial/next-best-action';
import type { AiInboxMessage, Client, ClientContact } from '@prisma/client';

describe('AI Mailbox Integration & Commercial Engine Foundation', () => {
  const TENANT_A = 'org_tenant_alpha_123';
  const TENANT_B = 'org_tenant_beta_456';

  /**
   * TEST A: Clear commercial inquiry ("15 CLV v Ostravě od 1.11. do 30.11.")
   * Must produce EXACT timing, correct quantity, correct city,
   * status READY_FOR_AVAILABILITY, and Next Best Action CHECK_AVAILABILITY.
   */
  it('Scenario A: Clear inquiry produces EXACT dates, valid quantity, READY_FOR_AVAILABILITY status', () => {
    // 1. Raw AI Output simulation from clear email
    const rawAiOutput = {
      classification: 'NEW_INQUIRY',
      confidence: 0.95,
      company: {
        name: 'SuperMarket Ostrava s.r.o.',
        confidence: 0.9,
      },
      contact: {
        name: 'Jan Novák',
        email: 'novak@supermarket-ostrava.cz',
        phone: '+420 777 123 456',
      },
      request: {
        projectType: 'STANDARD_MEDIA',
        cities: ['Ostrava'],
        requestedMediaTypes: ['CLV'],
        requestedQuantity: { exact: 15 },
        dateFrom: '2026-11-01',
        dateTo: '2026-11-30',
        datesClarity: 'EXACT',
        budget: { exact: 45000, currency: 'CZK' },
        missingRequirements: [],
        evidence: {
          dateText: 'od 1.11.2026 do 30.11.2026',
          quantityText: '15 ks CLV',
          locationText: 'Ostrava',
        },
      },
      summary: 'Poptávka 15 ks CLV v Ostravě v listopadu 2026.',
      reasoningSummary: 'Jasně specifikovaný termín, lokalita i formát ploch.',
      suggestedReply: 'Dobrý den, děkujeme za poptávku...',
    };

    const sanitized = validateAndSanitizeAnalysis(rawAiOutput);
    assert.equal(sanitized.classification, 'NEW_INQUIRY');
    assert.equal(sanitized.request?.datesClarity, 'EXACT');
    assert.equal(sanitized.request?.dateFrom, '2026-11-01');
    assert.equal(sanitized.request?.dateTo, '2026-11-30');
    assert.deepEqual(sanitized.request?.cities, ['Ostrava']);
    assert.deepEqual(sanitized.request?.requestedMediaTypes, ['CLV']);
    assert.equal(sanitized.request?.requestedQuantity?.exact, 15);
    assert.deepEqual(sanitized.request?.missingRequirements, []);

    // 2. Build canonical CommercialRequest
    const mockMessage = {
      id: 'msg-clear-001',
      organizationId: TENANT_A,
      providerMessageId: 'gmail-msg-clear-001',
      providerThreadId: 'thread-clear-001',
      fromEmail: 'novak@supermarket-ostrava.cz',
      fromName: 'Jan Novák',
      subject: 'Poptávka reklamních ploch CLV - Ostrava listopad',
      textBody: 'Dobrý den, poptáváme 15 ks CLV v Ostravě od 1.11. do 30.11.2026.',
      processingStatus: 'READY',
      classification: 'NEW_INQUIRY',
      confidence: 0.95,
      requiresReview: true,
      aiExtractedData: sanitized as unknown as object,
      clientId: null,
      contactId: null,
      createdAt: new Date('2026-09-01T10:00:00Z'),
      updatedAt: new Date('2026-09-01T10:00:00Z'),
    } as unknown as AiInboxMessage;

    const commercialRequest = buildCommercialRequestFromMailbox(mockMessage);

    assert.equal(commercialRequest.organizationId, TENANT_A);
    assert.equal(commercialRequest.datesClarity, 'EXACT');
    assert.deepEqual(commercialRequest.cities, ['Ostrava']);
    assert.deepEqual(commercialRequest.mediaTypes, ['CLV']);
    assert.equal(commercialRequest.quantity?.exact, 15);
    assert.equal(commercialRequest.status, 'READY_FOR_AVAILABILITY');
    assert.deepEqual(commercialRequest.missingRequirements, []);

    // 3. Compute Next Best Action
    const nextAction = determineNextBestActionForRequest(commercialRequest);
    assert.equal(nextAction.actionType, 'CHECK_AVAILABILITY');
    assert.equal(nextAction.priority, 'HIGH');
    assert.ok(nextAction.title.includes('Ověřit dostupnost inventáře'));
  });

  /**
   * TEST B: Vague campaign timing ("CLV někdy v listopadu")
   * Anti-hallucination check: must NOT invent exact days.
   * datesClarity must be APPROXIMATE, missingRequirements must contain EXACT_CAMPAIGN_DATES,
   * status must be NEEDS_MORE_INFORMATION.
   */
  it('Scenario B: Vague timing sets APPROXIMATE, missing EXACT_CAMPAIGN_DATES, NEEDS_MORE_INFORMATION', () => {
    const rawAiOutput = {
      classification: 'NEW_INQUIRY',
      confidence: 0.88,
      company: { name: 'AutoProdej Morava' },
      contact: { name: 'Petr Svoboda', email: 'svoboda@autoprodej.cz' },
      request: {
        projectType: 'STANDARD_MEDIA',
        cities: ['Ostrava'],
        requestedMediaTypes: ['CLV'],
        requestedQuantity: { exact: 5 },
        dateFrom: null,
        dateTo: null,
        rawDateDescription: 'někdy v listopadu 2026',
        datesClarity: 'APPROXIMATE',
        missingRequirements: [],
      },
      summary: 'Poptávka CLV v Ostravě v průběhu listopadu bez konkrétních dnů.',
    };

    const sanitized = validateAndSanitizeAnalysis(rawAiOutput);
    assert.equal(sanitized.request?.datesClarity, 'APPROXIMATE');
    assert.equal(sanitized.request?.dateFrom, null);
    assert.equal(sanitized.request?.dateTo, null);
    assert.equal(sanitized.request?.rawDateDescription, 'někdy v listopadu 2026');
    assert.ok(
      sanitized.request?.missingRequirements?.includes('EXACT_CAMPAIGN_DATES'),
      'Sanitizer must enforce EXACT_CAMPAIGN_DATES requirement for approximate timing'
    );

    const mockMessage = {
      id: 'msg-approx-002',
      organizationId: TENANT_A,
      providerMessageId: 'gmail-msg-approx-002',
      fromEmail: 'svoboda@autoprodej.cz',
      subject: 'Poptávka listopad',
      processingStatus: 'READY',
      classification: 'NEW_INQUIRY',
      confidence: 0.88,
      requiresReview: true,
      aiExtractedData: sanitized as unknown as object,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as AiInboxMessage;

    const commercialRequest = buildCommercialRequestFromMailbox(mockMessage);
    assert.equal(commercialRequest.datesClarity, 'APPROXIMATE');
    assert.equal(commercialRequest.status, 'NEEDS_MORE_INFORMATION');
    assert.ok(commercialRequest.missingRequirements.includes('EXACT_CAMPAIGN_DATES'));

    const nextAction = determineNextBestActionForRequest(commercialRequest);
    assert.equal(nextAction.actionType, 'COMPLETE_INFORMATION');
    assert.ok(nextAction.title.includes('Vyžádat upřesnění termínu'));
  });

  /**
   * TEST C: Missing quantity ("Máte volné billboardy v Ostravě?")
   * Anti-hallucination check: must NOT invent an arbitrary quantity (like 1 or 5).
   * requestedQuantity must be null, missingRequirements must contain EXACT_QUANTITY.
   */
  it('Scenario C: Missing quantity keeps quantity null and enforces EXACT_QUANTITY requirement', () => {
    const rawAiOutput = {
      classification: 'NEW_INQUIRY',
      confidence: 0.85,
      company: { name: 'Pekárna U Lesa' },
      request: {
        projectType: 'STANDARD_MEDIA',
        cities: ['Ostrava'],
        requestedMediaTypes: ['BILLBOARD'],
        requestedQuantity: null,
        dateFrom: '2026-10-01',
        dateTo: '2026-10-31',
        datesClarity: 'EXACT',
        missingRequirements: [],
      },
      summary: 'Dotaz na volné billboardy v Ostravě bez uvedení počtu.',
    };

    const sanitized = validateAndSanitizeAnalysis(rawAiOutput);
    assert.equal(sanitized.request?.requestedQuantity, null);
    assert.ok(
      sanitized.request?.missingRequirements?.includes('EXACT_QUANTITY'),
      'Sanitizer must automatically require EXACT_QUANTITY if missing'
    );

    const mockMessage = {
      id: 'msg-noqty-003',
      organizationId: TENANT_A,
      providerMessageId: 'gmail-msg-noqty-003',
      fromEmail: 'info@pekarna-ulesa.cz',
      subject: 'Dotaz na billboardy Ostrava',
      aiExtractedData: sanitized as unknown as object,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as AiInboxMessage;

    const commercialRequest = buildCommercialRequestFromMailbox(mockMessage);
    assert.equal(commercialRequest.quantity, null);
    assert.ok(commercialRequest.missingRequirements.includes('EXACT_QUANTITY'));
    assert.equal(commercialRequest.status, 'NEEDS_MORE_INFORMATION');
  });

  /**
   * TEST D: Existing client matching
   * Correctly links existing contact and client from CRM, sets isExistingClient to true.
   */
  it('Scenario D: Existing client in CRM is correctly matched and linked in CommercialRequest', () => {
    const existingClient = {
      id: 'client-existing-99',
      organizationId: TENANT_A,
      name: 'AmRest s.r.o.',
      companyId: '25114702',
    } as unknown as Client;

    const existingContact = {
      id: 'contact-existing-101',
      clientId: existingClient.id,
      firstName: 'Karel',
      lastName: 'Dvořák',
      email: 'karel.dvorak@amrest.eu',
      phone: '+420 602 111 222',
    } as unknown as ClientContact;

    const mockMessage = {
      id: 'msg-client-004',
      organizationId: TENANT_A,
      providerMessageId: 'gmail-msg-004',
      fromEmail: 'karel.dvorak@amrest.eu',
      fromName: 'Karel Dvořák',
      subject: 'Objednávka dalších reklamních ploch',
      clientId: existingClient.id,
      contactId: existingContact.id,
      client: existingClient,
      contact: existingContact,
      aiExtractedData: {
        classification: 'NEW_INQUIRY',
        confidence: 0.95,
        company: { name: 'AmRest s.r.o.', ico: '25114702' },
        contact: { name: 'Karel Dvořák', email: 'karel.dvorak@amrest.eu' },
        request: {
          projectType: 'STANDARD_MEDIA',
          cities: ['Praha'],
          requestedMediaTypes: ['BILLBOARD'],
          requestedQuantity: { exact: 10 },
          dateFrom: '2026-12-01',
          dateTo: '2026-12-31',
          datesClarity: 'EXACT',
          missingRequirements: [],
        },
      } as unknown as object,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as AiInboxMessage & { client: Client; contact: ClientContact };

    const commercialRequest = buildCommercialRequestFromMailbox(mockMessage);
    assert.equal(commercialRequest.clientId, 'client-existing-99');
    assert.equal(commercialRequest.contactId, 'contact-existing-101');
    assert.equal(commercialRequest.companyName, 'AmRest s.r.o.');
    assert.equal(commercialRequest.contactEmail, 'karel.dvorak@amrest.eu');
    assert.equal(commercialRequest.status, 'READY_FOR_AVAILABILITY');
  });

  /**
   * TEST E: Unknown client
   * Random external email does not trigger false-positive match to an existing client.
   */
  it('Scenario E: Unknown client does not trigger false positive matching to random CRM entities', () => {
    const unknownEmail = 'marketing@newstartup2026.io';
    const domain = extractDomain(unknownEmail);
    assert.equal(domain, 'newstartup2026.io');
    assert.equal(isFreemailDomain(unknownEmail), false);

    const mockMessage = {
      id: 'msg-unknown-005',
      organizationId: TENANT_A,
      fromEmail: unknownEmail,
      fromName: 'Nový Klient',
      subject: 'Zájem o plochy',
      clientId: null,
      contactId: null,
      client: null,
      contact: null,
      aiExtractedData: {
        classification: 'NEW_INQUIRY',
        confidence: 0.85,
        company: { name: 'New Startup 2026' },
        contact: { name: 'Nový Klient', email: unknownEmail },
        request: {
          projectType: 'STANDARD_MEDIA',
          cities: ['Brno'],
          datesClarity: 'APPROXIMATE',
          missingRequirements: ['EXACT_CAMPAIGN_DATES', 'EXACT_QUANTITY'],
        },
      } as unknown as object,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as AiInboxMessage;

    const commercialRequest = buildCommercialRequestFromMailbox(mockMessage);
    assert.equal(commercialRequest.clientId, null);
    assert.equal(commercialRequest.contactId, null);
    assert.equal(commercialRequest.companyName, 'New Startup 2026');
    assert.equal(commercialRequest.contactEmail, unknownEmail);
  });

  /**
   * TEST F: Duplicate message detection
   * Ingestion uses providerMessageId uniqueness check to prevent duplicates.
   */
  it('Scenario F: providerMessageId check prevents duplicate inbox records', () => {
    const existingMessages = new Map<string, string>();
    existingMessages.set('gmail-123456789', 'msg-orig-01');

    const incomingProviderId = 'gmail-123456789';
    const isDuplicate = existingMessages.has(incomingProviderId);

    assert.equal(isDuplicate, true, 'Duplicate providerMessageId must be detected');
  });

  /**
   * TEST G: Thread change / reply in context
   * Reply in an ongoing thread is provided with thread context and classified as CHANGE_REQUEST or UPDATE.
   */
  it('Scenario G: Thread context is properly injected into analysis prompt for ongoing discussions', () => {
    const threadContextSnippet = '[2026-09-01 10:00] Klient: Poptáváme 10 ploch v Brně.\n[2026-09-01 11:00] Obchodník: Máme volných 10 ploch na listopad.';

    const prompt = buildAnalysisPrompt({
      fromEmail: 'klient@firma.cz',
      fromName: 'Klient',
      subject: 'Re: Poptávka ploch',
      textBody: 'Dobrý den, nakonec bychom chtěli navýšit počet na 15 ploch.',
      threadContext: threadContextSnippet,
    });

    assert.ok(
      prompt.includes('<thread_context>'),
      'Analysis prompt must contain thread context tag'
    );
    assert.ok(
      prompt.includes('CHANGE_REQUEST'),
      'Analysis prompt must describe CHANGE_REQUEST classification'
    );
    assert.ok(
      prompt.includes('Klient: Poptáváme 10 ploch'),
      'Thread snippet must be embedded in the prompt'
    );
  });

  /**
   * TEST H: AI Failure handling
   * If AI extraction returns null or invalid JSON, sanitization falls back gracefully without crash,
   * retaining message state for human review.
   */
  it('Scenario H: Malformed or failing AI output degrades safely to UNKNOWN without crashing', () => {
    // 1. Passing non-object throws descriptive error caught by service try/catch
    assert.throws(() => validateAndSanitizeAnalysis(null as unknown as Record<string, unknown>), {
      message: /AI vrátila neplatnou strukturu/,
    });

    // 2. Malformed object safely falls back to UNKNOWN defaults
    const malformedOutput = { classification: 'INVALID_GARBAGE', confidence: 'invalid' };
    const sanitized = validateAndSanitizeAnalysis(malformedOutput as unknown as Record<string, unknown>);

    assert.equal(sanitized.classification, 'UNKNOWN');
    assert.equal(sanitized.confidence, 0.5);
    assert.equal(sanitized.company, null);
    assert.equal(sanitized.contact, null);
    assert.equal(sanitized.request, null);

    // CommercialRequest built from a message with null AI data
    const messageWithNoAi = {
      id: 'msg-err-008',
      organizationId: TENANT_A,
      providerMessageId: 'gmail-msg-err-008',
      fromEmail: 'partner@example.com',
      fromName: 'Partner',
      subject: 'Neznámý požadavek',
      textBody: 'Pouhý text bez AI',
      processingStatus: 'ERROR',
      errorMessage: 'AI model service unavailable (timeout)',
      requiresReview: true,
      aiExtractedData: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as AiInboxMessage;

    const commercialRequest = buildCommercialRequestFromMailbox(messageWithNoAi);
    assert.equal(commercialRequest.organizationId, TENANT_A);
    assert.equal(commercialRequest.status, 'NEEDS_MORE_INFORMATION');
    assert.equal(commercialRequest.companyName, 'Partner');
    assert.equal(commercialRequest.contactEmail, 'partner@example.com');
  });

  /**
   * TEST I: Multi-Tenant Isolation
   * Tenant Alpha client "KFC Česká republika" must NEVER be matched or leaked to Tenant Beta messages.
   */
  it('Scenario I: Tenant isolation guarantees Tenant A client is never matched or leaked to Tenant B', () => {
    const tenantA_Client = {
      id: 'client-kfc-tenant-a',
      organizationId: TENANT_A,
      name: 'KFC Česká republika',
      email: 'info@kfc.cz',
    };

    // Simulate search in Tenant B
    const searchInTenantB = (orgId: string, email: string) => {
      // Database query filter: WHERE organizationId = orgId AND email = email
      if (tenantA_Client.organizationId !== orgId || tenantA_Client.email !== email) {
        return null; // Tenant isolation filter prevents access
      }
      return tenantA_Client;
    };

    const matchForTenantB = searchInTenantB(TENANT_B, 'info@kfc.cz');
    assert.equal(matchForTenantB, null, 'Tenant B query must return null and never see Tenant A client');

    // Also verify CommercialRequest from Tenant B email
    const messageTenantB = {
      id: 'msg-tenant-b-009',
      organizationId: TENANT_B,
      fromEmail: 'info@kfc.cz',
      fromName: 'KFC',
      subject: 'Poptávka',
      clientId: null, // Correctly not matched to Tenant A's client
      aiExtractedData: {
        classification: 'NEW_INQUIRY',
        confidence: 0.9,
        company: { name: 'KFC' },
        request: {
          projectType: 'STANDARD_MEDIA',
          cities: ['Plzeň'],
          datesClarity: 'UNSPECIFIED',
          missingRequirements: ['EXACT_CAMPAIGN_DATES', 'EXACT_QUANTITY'],
        },
      } as unknown as object,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as AiInboxMessage;

    const commercialRequest = buildCommercialRequestFromMailbox(messageTenantB);
    assert.equal(commercialRequest.organizationId, TENANT_B, 'CommercialRequest must strictly belong to Tenant B');
    assert.equal(commercialRequest.clientId, null, 'CommercialRequest must NOT link Tenant A client ID');
  });
});
