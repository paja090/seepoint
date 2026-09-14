/**
 * AI Commercial Orchestrator Engine V1
 *
 * ŘÍDICÍ VRSTVA — neobsahuje business logiku jednotlivých modulů.
 * Pouze volá existující moduly v definovaném pořadí a sleduje stav procesu.
 *
 * Flow 1: Mailbox → CommercialRequest → Occupancy → Offer DRAFT → Human Review
 * Flow 2: Offer ACCEPTED → Realization Handoff
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { runWithTenantContext } from '@/lib/tenant-context';
import type { CurrentUser } from '@/lib/rbac';

// Commercial module adapters & services
import { buildCommercialRequestFromInboxMessage } from '@/lib/ai-commercial/adapters/mailbox-adapter';
import type { InboxMessageWithRelations } from '@/lib/ai-commercial/adapters/mailbox-adapter';
import { checkCommercialAvailability } from '@/lib/ai-commercial/adapters/occupancy-adapter';
import { buildCommercialOfferDraft } from '@/lib/ai-commercial/offer-builder';
import { determineNextBestActionForRequest, getOrganizationNextBestActions } from '@/lib/ai-commercial/next-best-action';

// Realization handoff
import { handoffAcceptedOfferToRealization } from '@/lib/ai-realization/handoff';

// Automation policy
import { isActionAllowed, getOrganizationOrchestratorProfile } from './automation-policy';

// Types
import type {
  CommercialRun,
  CommercialRunStep,
  CommercialRunStatus,
  AutomationLevel,
} from './contracts/types';
import type { CommercialRequest } from '@/lib/ai-commercial/contracts/commercial-request';
import type { AvailabilityResult } from '@/lib/ai-commercial/contracts/availability';
import type { CommercialNextBestAction } from '@/lib/ai-commercial/contracts/next-best-action';
import type { OfferDraftResult } from '@/lib/ai-commercial/contracts/offer-draft';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addStep(
  run: CommercialRun,
  step: string,
  status: CommercialRunStep['status'],
  opts?: { input?: Record<string, unknown>; output?: Record<string, unknown>; error?: string }
): void {
  const prevTimestamp = run.steps.length > 0 ? run.steps[run.steps.length - 1].timestamp : run.startedAt;
  const now = new Date();
  run.steps.push({
    step,
    status,
    durationMs: now.getTime() - prevTimestamp.getTime(),
    input: opts?.input,
    output: opts?.output,
    error: opts?.error,
    timestamp: now,
  });
}

function completeRun(run: CommercialRun, status: CommercialRunStatus): CommercialRun {
  run.status = status;
  run.completedAt = new Date();
  return run;
}

function createRun(
  organizationId: string,
  triggerType: CommercialRun['triggerType'],
  triggerEntityId: string,
  automationLevel: AutomationLevel
): CommercialRun {
  const correlationId = randomUUID();
  return {
    id: correlationId,
    organizationId,
    triggerType,
    triggerEntityId,
    status: 'STARTED',
    automationLevel,
    steps: [],
    nextBestActions: [],
    correlationChain: { correlationId },
    startedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Flow 1: Mailbox → CommercialRequest → Availability → Offer Draft
// ---------------------------------------------------------------------------

export type OrchestrateMailboxOptions = {
  automationLevel?: AutomationLevel;
  /** Vynuceně přeskočit kontrolu idempotence (pouze pro testy) */
  skipIdempotencyCheck?: boolean;
};

/**
 * Orchestruje kompletní flow od příchozího emailu po Offer DRAFT.
 *
 * Idempotentní: pokud inbox message již má přiřazenou nabídku, vrátí existující stav.
 * Každý krok je bezpečně opakovatelný.
 * Při chybě v libovolném kroku se předchozí výsledky zachovají.
 */
export async function orchestrateMailboxToOffer(
  inboxMessageId: string,
  currentUser: CurrentUser,
  options?: OrchestrateMailboxOptions
): Promise<CommercialRun> {
  const organizationId = currentUser.organizationId;
  if (!organizationId) {
    throw new Error('Tenant security violation: Chybí kontext organizace.');
  }

  return runWithTenantContext({ organizationId, userId: currentUser.id, source: 'session' }, async () => {
    // Resolve automation level
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { enabledModules: true },
    });
    const profile = getOrganizationOrchestratorProfile(org);
    const automationLevel = options?.automationLevel ?? profile.automationLevel;

    const run = createRun(organizationId, 'MAILBOX', inboxMessageId, automationLevel);

    // -----------------------------------------------------------------------
    // Step 0: Load inbox message
    // -----------------------------------------------------------------------
    const message = await prisma.aiInboxMessage.findFirst({
      where: { id: inboxMessageId, organizationId },
      include: {
        client: true,
        contact: true,
      },
    }) as InboxMessageWithRelations | null;

    if (!message) {
      addStep(run, 'LOAD_MESSAGE', 'FAILED', { error: 'Zpráva nebyla nalezena.' });
      return completeRun(run, 'FAILED');
    }

    // Tenant security check
    if (message.organizationId !== organizationId) {
      addStep(run, 'LOAD_MESSAGE', 'FAILED', { error: 'Cross-tenant access denied.' });
      return completeRun(run, 'FAILED');
    }

    run.correlationChain.inboxMessageId = message.id;
    addStep(run, 'LOAD_MESSAGE', 'COMPLETED', {
      output: { messageId: message.id, subject: message.subject, fromEmail: message.fromEmail },
    });

    // -----------------------------------------------------------------------
    // Step 1: Idempotency check — already has offer?
    // -----------------------------------------------------------------------
    if (!options?.skipIdempotencyCheck && message.offerId) {
      const existingOffer = await prisma.offer.findFirst({
        where: { id: message.offerId, organizationId },
        select: { id: true, status: true, title: true, crmOrder: { select: { id: true } } },
      });

      if (existingOffer) {
        run.correlationChain.offerId = existingOffer.id;
        run.correlationChain.crmOrderId = existingOffer.crmOrder?.id;

        addStep(run, 'IDEMPOTENCY_CHECK', 'COMPLETED', {
          output: { existingOfferId: existingOffer.id, offerStatus: existingOffer.status },
        });

        run.nextBestActions = await getOrganizationNextBestActions(organizationId);
        return completeRun(run, 'COMPLETED');
      }
    }

    addStep(run, 'IDEMPOTENCY_CHECK', 'COMPLETED', { output: { duplicate: false } });

    // -----------------------------------------------------------------------
    // Step 2: Build CommercialRequest
    // -----------------------------------------------------------------------
    if (!isActionAllowed('CREATE_COMMERCIAL_REQUEST', automationLevel)) {
      addStep(run, 'BUILD_COMMERCIAL_REQUEST', 'BLOCKED', {
        error: `Automatizace "${automationLevel}" nepovoluje vytvoření CommercialRequest.`,
      });
      return completeRun(run, 'BLOCKED');
    }

    let commercialRequest: CommercialRequest;
    try {
      commercialRequest = buildCommercialRequestFromInboxMessage(message);
      run.commercialRequest = commercialRequest;
      run.correlationChain.commercialRequestId = commercialRequest.id;

      addStep(run, 'BUILD_COMMERCIAL_REQUEST', 'COMPLETED', {
        output: {
          requestId: commercialRequest.id,
          status: commercialRequest.status,
          companyName: commercialRequest.companyName,
          datesClarity: commercialRequest.datesClarity,
          missingRequirements: commercialRequest.missingRequirements,
        },
      });
    } catch (err) {
      addStep(run, 'BUILD_COMMERCIAL_REQUEST', 'FAILED', {
        error: err instanceof Error ? err.message : 'Chyba při sestavování CommercialRequest.',
      });
      return completeRun(run, 'FAILED');
    }

    // -----------------------------------------------------------------------
    // Step 3: Check if NEEDS_MORE_INFORMATION → stop
    // -----------------------------------------------------------------------
    if (commercialRequest.status === 'NEEDS_MORE_INFORMATION') {
      const nba = determineNextBestActionForRequest(commercialRequest);
      run.nextBestActions = [nba];

      addStep(run, 'EVALUATE_READINESS', 'COMPLETED', {
        output: {
          ready: false,
          missingRequirements: commercialRequest.missingRequirements,
          nextAction: nba.actionType,
        },
      });

      return completeRun(run, 'NEEDS_INFORMATION');
    }

    addStep(run, 'EVALUATE_READINESS', 'COMPLETED', { output: { ready: true } });

    // -----------------------------------------------------------------------
    // Step 4: Check availability
    // -----------------------------------------------------------------------
    if (!isActionAllowed('CHECK_AVAILABILITY', automationLevel)) {
      const nba = determineNextBestActionForRequest(commercialRequest);
      run.nextBestActions = [nba];
      addStep(run, 'CHECK_AVAILABILITY', 'BLOCKED', {
        error: `Automatizace "${automationLevel}" nepovoluje automatickou kontrolu dostupnosti.`,
      });
      return completeRun(run, 'BLOCKED');
    }

    run.status = 'AVAILABILITY_CHECK';
    let availabilityResult: AvailabilityResult;

    try {
      availabilityResult = await checkCommercialAvailability({
        organizationId,
        dateFrom: commercialRequest.dateFrom!,
        dateTo: commercialRequest.dateTo!,
        cities: commercialRequest.cities,
        mediaTypes: commercialRequest.mediaTypes,
        quantity: commercialRequest.quantity?.exact || 1,
      });
      run.availabilityResult = availabilityResult;
      run.correlationChain.availabilityCheckedAt = availabilityResult.checkedAt;

      addStep(run, 'CHECK_AVAILABILITY', 'COMPLETED', {
        output: {
          status: availabilityResult.status,
          exactMatchCount: availabilityResult.exactMatchCount,
          alternativesCount: availabilityResult.alternatives.length,
          requestedQuantity: availabilityResult.requestedQuantity,
        },
      });
    } catch (err) {
      run.error = err instanceof Error ? err.message : 'Chyba při kontrole dostupnosti.';
      addStep(run, 'CHECK_AVAILABILITY', 'FAILED', { error: run.error });

      // Předchozí kroky se zachovají — request je retryable
      const nba: CommercialNextBestAction = {
        id: `nba-retry-avail-${run.id}`,
        organizationId,
        actionType: 'CHECK_AVAILABILITY',
        priority: 'HIGH',
        title: 'Opakovat kontrolu dostupnosti',
        description: `Kontrola dostupnosti selhala: ${run.error}. Email a poptávka jsou zachovány. Opakujte akci.`,
        targetEntityType: 'COMMERCIAL_REQUEST',
        targetEntityId: commercialRequest.id,
        recommendedAt: new Date(),
      };
      run.nextBestActions = [nba];
      return completeRun(run, 'FAILED');
    }

    // -----------------------------------------------------------------------
    // Step 5: Evaluate availability — no match → stop
    // -----------------------------------------------------------------------
    if (availabilityResult.status === 'NO_MATCH' && availabilityResult.exactMatchCount === 0 && availabilityResult.alternatives.length === 0) {
      const nba: CommercialNextBestAction = {
        id: `nba-no-avail-${run.id}`,
        organizationId,
        actionType: 'COMPLETE_INFORMATION',
        priority: 'HIGH',
        title: `Žádné volné plochy: ${commercialRequest.companyName || 'Poptávka'}`,
        description: 'V požadovaném termínu a lokalitě nebyly nalezeny žádné volné plochy. Kontaktujte klienta a navrhněte alternativní termín nebo lokalitu.',
        targetEntityType: 'COMMERCIAL_REQUEST',
        targetEntityId: commercialRequest.id,
        recommendedAt: new Date(),
      };
      run.nextBestActions = [nba];

      addStep(run, 'EVALUATE_AVAILABILITY', 'COMPLETED', {
        output: { hasInventory: false, recommendation: 'NO_OFFER' },
      });

      return completeRun(run, 'COMPLETED');
    }

    addStep(run, 'EVALUATE_AVAILABILITY', 'COMPLETED', {
      output: { hasInventory: true, exactMatches: availabilityResult.exactMatchCount },
    });

    // -----------------------------------------------------------------------
    // Step 6: Create Offer Draft
    // -----------------------------------------------------------------------
    if (!isActionAllowed('CREATE_OFFER_DRAFT', automationLevel)) {
      const nba = determineNextBestActionForRequest({
        ...commercialRequest,
        status: 'AVAILABILITY_CHECKED',
      });
      run.nextBestActions = [nba];
      addStep(run, 'CREATE_OFFER_DRAFT', 'BLOCKED', {
        error: `Automatizace "${automationLevel}" nepovoluje automatické vytvoření konceptu nabídky.`,
      });
      return completeRun(run, 'BLOCKED');
    }

    run.status = 'OFFER_DRAFTING';
    let offerResult: OfferDraftResult;

    try {
      offerResult = await buildCommercialOfferDraft(
        {
          organizationId,
          commercialRequest,
          availabilityResult,
          sourceCommercialRequestId: commercialRequest.id,
          campaignName: commercialRequest.campaignTitle || undefined,
        },
        currentUser
      );
      run.offerDraftResult = offerResult;

      if (offerResult.offerId) {
        run.correlationChain.offerId = offerResult.offerId;

        // Link offer back to inbox message (idempotency anchor)
        await prisma.aiInboxMessage.updateMany({
          where: { id: inboxMessageId, organizationId },
          data: { offerId: offerResult.offerId },
        });

        // Audit trail with correlation
        await prisma.offerEvent.create({
          data: {
            offerId: offerResult.offerId,
            organizationId,
            type: 'UPDATED',
            actorUserId: currentUser.id,
            actorName: currentUser.name,
            message: 'Orchestrátor: koncept nabídky vytvořen z emailové poptávky.',
            metadata: {
              event: 'ORCHESTRATOR_DRAFT_CREATED',
              correlationId: run.id,
              inboxMessageId,
              commercialRequestId: commercialRequest.id,
              availabilityStatus: availabilityResult.status,
              exactMatches: availabilityResult.exactMatchCount,
              alternatives: availabilityResult.alternatives.length,
            },
          },
        });
      }

      addStep(run, 'CREATE_OFFER_DRAFT', offerResult.success ? 'COMPLETED' : 'FAILED', {
        output: {
          success: offerResult.success,
          offerId: offerResult.offerId,
          surfaceCount: offerResult.surfaceCount,
          exactMatchesCount: offerResult.exactMatchesCount,
          alternativesCount: offerResult.alternativesCount,
        },
        error: offerResult.success ? undefined : offerResult.warnings?.join('; '),
      });

      if (offerResult.nextBestAction) {
        run.nextBestActions.push(offerResult.nextBestAction);
      }
    } catch (err) {
      run.error = err instanceof Error ? err.message : 'Chyba při vytváření konceptu nabídky.';
      addStep(run, 'CREATE_OFFER_DRAFT', 'FAILED', { error: run.error });

      // AvailabilityResult je zachován — retry bezpečný
      const nba: CommercialNextBestAction = {
        id: `nba-retry-draft-${run.id}`,
        organizationId,
        actionType: 'CREATE_OFFER_DRAFT',
        priority: 'HIGH',
        title: 'Opakovat vytvoření konceptu nabídky',
        description: `Vytvoření konceptu selhalo: ${run.error}. Výsledky kontroly dostupnosti jsou zachovány. Opakujte akci.`,
        targetEntityType: 'COMMERCIAL_REQUEST',
        targetEntityId: commercialRequest.id,
        recommendedAt: new Date(),
      };
      run.nextBestActions = [nba];
      return completeRun(run, 'FAILED');
    }

    // -----------------------------------------------------------------------
    // Step 7: Finalize
    // -----------------------------------------------------------------------
    addStep(run, 'FINALIZE', 'COMPLETED', {
      output: {
        correlationChain: run.correlationChain,
        automationLevel,
        totalSteps: run.steps.length,
      },
    });

    // Log orchestration run to CRM audit
    await prisma.crmAuditLog.create({
      data: {
        organizationId,
        userId: currentUser.id,
        userEmail: currentUser.email,
        action: 'ORCHESTRATE_MAILBOX_TO_OFFER',
        entityType: 'CommercialRun',
        entityId: run.id,
        detailsJson: JSON.stringify({
          correlationId: run.id,
          inboxMessageId,
          commercialRequestId: commercialRequest.id,
          availabilityStatus: availabilityResult.status,
          offerId: offerResult.offerId,
          automationLevel,
          steps: run.steps.map((s) => ({ step: s.step, status: s.status, durationMs: s.durationMs })),
        }),
      },
    }).catch(() => null); // Non-critical

    return completeRun(run, 'COMPLETED');
  });
}

// ---------------------------------------------------------------------------
// Flow 2: Offer ACCEPTED → Realization Handoff
// ---------------------------------------------------------------------------

/**
 * Orchestruje handoff schválené nabídky do realizace.
 * Idempotentní: handoffAcceptedOfferToRealization interně kontroluje existující CrmOrder.
 */
export async function orchestrateOfferAccepted(
  offerId: string,
  currentUser: CurrentUser
): Promise<CommercialRun> {
  const organizationId = currentUser.organizationId;
  if (!organizationId) {
    throw new Error('Tenant security violation: Chybí kontext organizace.');
  }

  return runWithTenantContext({ organizationId, userId: currentUser.id, source: 'session' }, async () => {
    const run = createRun(organizationId, 'OFFER_ACCEPTED', offerId, 'SEMI_AUTOMATIC');
    run.correlationChain.offerId = offerId;

    // -----------------------------------------------------------------------
    // Step 0: Verify offer state
    // -----------------------------------------------------------------------
    const offer = await prisma.offer.findFirst({
      where: { id: offerId, organizationId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        title: true,
        crmOrder: { select: { id: true } },
      },
    });

    if (!offer) {
      addStep(run, 'VERIFY_OFFER', 'FAILED', { error: 'Nabídka nebyla nalezena.' });
      return completeRun(run, 'FAILED');
    }

    if (offer.organizationId && offer.organizationId !== organizationId) {
      addStep(run, 'VERIFY_OFFER', 'FAILED', { error: 'Cross-tenant access denied.' });
      return completeRun(run, 'FAILED');
    }

    if (offer.status !== 'ACCEPTED') {
      addStep(run, 'VERIFY_OFFER', 'FAILED', {
        error: `Nabídka není ve stavu ACCEPTED (aktuální stav: ${offer.status}).`,
      });
      return completeRun(run, 'FAILED');
    }

    addStep(run, 'VERIFY_OFFER', 'COMPLETED', {
      output: { offerId: offer.id, status: offer.status },
    });

    // -----------------------------------------------------------------------
    // Step 1: Idempotency check
    // -----------------------------------------------------------------------
    if (offer.crmOrder) {
      run.correlationChain.crmOrderId = offer.crmOrder.id;
      addStep(run, 'IDEMPOTENCY_CHECK', 'COMPLETED', {
        output: { existingOrderId: offer.crmOrder.id, duplicate: true },
      });
      return completeRun(run, 'COMPLETED');
    }

    addStep(run, 'IDEMPOTENCY_CHECK', 'COMPLETED', { output: { duplicate: false } });

    // -----------------------------------------------------------------------
    // Step 2: Handoff to realization
    // -----------------------------------------------------------------------
    try {
      const realizationContext = await handoffAcceptedOfferToRealization(offerId, currentUser);

      run.correlationChain.crmOrderId = realizationContext.orderId;
      run.correlationChain.realizationIds = realizationContext.items?.map((r) => r.id) || [];

      addStep(run, 'HANDOFF_TO_REALIZATION', 'COMPLETED', {
        output: {
          crmOrderId: realizationContext.orderId,
          orderNumber: realizationContext.orderNumber,
          realizationCount: realizationContext.items?.length || 0,
        },
      });

      // Determine realization next best actions
      const ctxActions = (realizationContext as { nextBestActions?: Array<{ id: string; priority: string; title: string; description: string; recommendedAt?: Date }> }).nextBestActions;
      if (ctxActions && ctxActions.length > 0) {
        // Map realization actions to commercial NBA format
        for (const rba of ctxActions) {
          run.nextBestActions.push({
            id: rba.id,
            organizationId,
            actionType: 'CONFIRM_ORDER',
            priority: rba.priority === 'URGENT' ? 'CRITICAL' : rba.priority as CommercialNextBestAction['priority'],
            title: rba.title,
            description: rba.description,
            targetEntityType: 'OFFER',
            targetEntityId: offerId,
            recommendedAt: rba.recommendedAt || new Date(),
          });
        }
      }
    } catch (err) {
      run.error = err instanceof Error ? err.message : 'Chyba při handoff do realizace.';
      addStep(run, 'HANDOFF_TO_REALIZATION', 'FAILED', { error: run.error });

      run.nextBestActions.push({
        id: `nba-retry-handoff-${run.id}`,
        organizationId,
        actionType: 'CONFIRM_ORDER',
        priority: 'HIGH',
        title: 'Opakovat předání do realizace',
        description: `Předání do realizace selhalo: ${run.error}. Nabídka zůstala ve stavu ACCEPTED. Opakujte akci.`,
        targetEntityType: 'OFFER',
        targetEntityId: offerId,
        recommendedAt: new Date(),
      });
      return completeRun(run, 'FAILED');
    }

    // -----------------------------------------------------------------------
    // Step 3: Audit
    // -----------------------------------------------------------------------
    await prisma.crmAuditLog.create({
      data: {
        organizationId,
        userId: currentUser.id,
        userEmail: currentUser.email,
        action: 'ORCHESTRATE_OFFER_ACCEPTED',
        entityType: 'CommercialRun',
        entityId: run.id,
        detailsJson: JSON.stringify({
          correlationId: run.id,
          offerId,
          crmOrderId: run.correlationChain.crmOrderId,
          realizationIds: run.correlationChain.realizationIds,
        }),
      },
    }).catch(() => null);

    addStep(run, 'FINALIZE', 'COMPLETED');
    return completeRun(run, 'COMPLETED');
  });
}

// ---------------------------------------------------------------------------
// Run Trace Retrieval Helpers (CrmAuditLog based)
// ---------------------------------------------------------------------------

export interface OrchestrationRunSummary {
  id: string;
  action: string;
  userId: string | null;
  userEmail: string | null;
  createdAt: Date;
  details: Record<string, unknown>;
}

/**
 * Reconstructs an orchestration run by its correlationId for a given organization.
 */
export async function getOrchestrationRunByCorrelationId(
  organizationId: string,
  correlationId: string
): Promise<OrchestrationRunSummary | null> {
  return runWithTenantContext({ organizationId }, async () => {
    const log = await prisma.crmAuditLog.findFirst({
      where: {
        organizationId,
        entityType: 'CommercialRun',
        entityId: correlationId,
      },
    });

    if (!log) return null;

    let details: Record<string, unknown> = {};
    if (log.detailsJson) {
      try {
        details = JSON.parse(log.detailsJson);
      } catch {
        details = {};
      }
    }

    return {
      id: log.entityId || log.id,
      action: log.action,
      userId: log.userId,
      userEmail: log.userEmail,
      createdAt: log.createdAt,
      details,
    };
  });
}

/**
 * Retrieves recent orchestration runs associated with a given entity.
 */
export async function getOrchestrationRunsForEntity(
  organizationId: string,
  entityType: string,
  entityId: string
): Promise<OrchestrationRunSummary[]> {
  return runWithTenantContext({ organizationId }, async () => {
    const logs = await prisma.crmAuditLog.findMany({
      where: {
        organizationId,
        entityType: 'CommercialRun',
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return logs
      .map((log) => {
        let details: Record<string, unknown> = {};
        if (log.detailsJson) {
          try {
            details = JSON.parse(log.detailsJson);
          } catch {
            details = {};
          }
        }
        return {
          id: log.entityId || log.id,
          action: log.action,
          userId: log.userId,
          userEmail: log.userEmail,
          createdAt: log.createdAt,
          details,
        };
      })
      .filter((run) => {
        const type = entityType.toLowerCase();
        if (type.includes('offer') && run.details.offerId === entityId) return true;
        if (type.includes('inbox') && run.details.inboxMessageId === entityId) return true;
        if (type.includes('request') && run.details.commercialRequestId === entityId) return true;
        if (type.includes('order') && run.details.crmOrderId === entityId) return true;
        return false;
      });
  });
}

