/**
 * AI Commercial Orchestrator — Commercial Timeline
 *
 * Reconstructs the complete commercial timeline from existing DB entities.
 * Does NOT create a separate timeline table — uses existing:
 * - AiInboxMessage (email received, analyzed)
 * - OfferEvent (offer lifecycle)
 * - CrmAuditLog (handoff, status changes)
 * - CrmRealization (realization progress)
 */

import { prisma } from '@/lib/db';
import type { TimelineEntry, TimelineEntryType } from './contracts/types';

/**
 * Builds a complete commercial timeline for an entity chain.
 * Starting from any entity (inbox message, offer, CRM order), traces related entities
 * and assembles a chronological timeline.
 */
export async function buildCommercialTimeline(
  organizationId: string,
  entityId: string,
  entityType: 'AiInboxMessage' | 'Offer' | 'CrmOrder' | 'SalesOpportunity'
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  // Resolve related entity IDs from the starting point
  const relatedIds = await resolveEntityChain(organizationId, entityId, entityType);

  // 1. Inbox message events
  if (relatedIds.inboxMessageId) {
    const msg = await prisma.aiInboxMessage.findFirst({
      where: { id: relatedIds.inboxMessageId, organizationId },
      select: {
        id: true, fromEmail: true, fromName: true, subject: true,
        receivedAt: true, classification: true, processingStatus: true,
        reviewedAt: true, reviewedBy: { select: { name: true } },
      },
    });

    if (msg) {
      entries.push({
        id: `tl-inbox-recv-${msg.id}`,
        timestamp: msg.receivedAt,
        type: 'EMAIL_RECEIVED',
        actor: msg.fromName || msg.fromEmail,
        title: `Email přijat: ${msg.subject}`,
        description: `Od: ${msg.fromName || msg.fromEmail}`,
        entityType: 'AiInboxMessage',
        entityId: msg.id,
      });

      if (msg.processingStatus !== 'INGESTED') {
        entries.push({
          id: `tl-inbox-analyzed-${msg.id}`,
          timestamp: new Date(msg.receivedAt.getTime() + 1000), // shortly after
          type: 'EMAIL_ANALYZED',
          actor: 'AI Engine',
          title: `Email analyzován: ${msg.classification}`,
          description: `Klasifikace: ${msg.classification}, Stav: ${msg.processingStatus}`,
          entityType: 'AiInboxMessage',
          entityId: msg.id,
          metadata: { classification: msg.classification, processingStatus: msg.processingStatus },
        });
      }

      if (msg.reviewedAt && msg.reviewedBy) {
        entries.push({
          id: `tl-inbox-reviewed-${msg.id}`,
          timestamp: msg.reviewedAt,
          type: 'STATUS_CHANGED',
          actor: msg.reviewedBy.name,
          title: 'Poptávka zkontrolována obchodníkem',
          description: `${msg.reviewedBy.name} zkontroloval(a) poptávku.`,
          entityType: 'AiInboxMessage',
          entityId: msg.id,
        });
      }
    }
  }

  // 2. Radar opportunity events
  if (relatedIds.salesOpportunityId) {
    const opp = await prisma.salesOpportunity.findFirst({
      where: { id: relatedIds.salesOpportunityId, organizationId },
      select: {
        id: true, companyName: true, title: true, detectedAt: true,
        status: true, opportunityScore: true, city: true,
      },
    });

    if (opp) {
      entries.push({
        id: `tl-radar-${opp.id}`,
        timestamp: opp.detectedAt,
        type: 'RADAR_OPPORTUNITY_DETECTED',
        actor: 'AI Sales Radar',
        title: `Příležitost detekována: ${opp.companyName}`,
        description: `${opp.title} (Skóre: ${opp.opportunityScore}/100, Město: ${opp.city || 'N/A'})`,
        entityType: 'SalesOpportunity',
        entityId: opp.id,
        metadata: { score: opp.opportunityScore, status: opp.status },
      });
    }
  }

  // 3. Offer lifecycle events
  if (relatedIds.offerId) {
    const offerEvents = await prisma.offerEvent.findMany({
      where: { offerId: relatedIds.offerId, organizationId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    for (const event of offerEvents) {
      const meta = (event.metadata && typeof event.metadata === 'object' ? event.metadata : {}) as Record<string, unknown>;
      let type: TimelineEntryType = 'STATUS_CHANGED';

      if (meta.event === 'AI_COMMERCIAL_DRAFT_CREATED' || meta.event === 'ORCHESTRATOR_DRAFT_CREATED') {
        type = 'OFFER_DRAFT_CREATED';
      } else if (event.type === 'SENT' || meta.event === 'OFFER_SENT') {
        type = 'OFFER_SENT';
      } else if (event.type === 'ACCEPTED') {
        type = 'OFFER_ACCEPTED';
      } else if (event.type === 'REJECTED') {
        type = 'OFFER_REJECTED';
      } else if (event.type === 'EXPIRED') {
        type = 'OFFER_EXPIRED';
      }

      entries.push({
        id: `tl-offer-evt-${event.id}`,
        timestamp: event.createdAt,
        type,
        actor: event.actorName || 'Systém',
        title: event.message || `Nabídka: ${event.type}`,
        description: event.message || '',
        entityType: 'Offer',
        entityId: relatedIds.offerId,
        metadata: meta,
      });
    }
  }

  // 4. CRM Order and Realization events
  if (relatedIds.crmOrderId) {
    const auditLogs = await prisma.crmAuditLog.findMany({
      where: {
        organizationId,
        OR: [
          { entityId: relatedIds.crmOrderId },
          ...(relatedIds.offerId ? [{ detailsJson: { contains: relatedIds.offerId } }] : []),
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    for (const log of auditLogs) {
      let type: TimelineEntryType = 'STATUS_CHANGED';
      if (log.action === 'HANDOFF_ACCEPTED_OFFER_TO_REALIZATION' || log.action === 'ORCHESTRATE_OFFER_ACCEPTED') {
        type = 'ORDER_CREATED';
      }

      entries.push({
        id: `tl-audit-${log.id}`,
        timestamp: log.createdAt,
        type,
        actor: log.userEmail || 'Systém',
        title: `${log.action}: ${log.entityType}`,
        description: log.action,
        entityType: log.entityType || 'CrmOrder',
        entityId: log.entityId || relatedIds.crmOrderId,
      });
    }

    // Realization entries
    const realizations = await prisma.crmRealization.findMany({
      where: { crmOrderId: relatedIds.crmOrderId, organizationId },
      select: {
        id: true, status: true, plannedDate: true, actualDate: true,
        surface: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const r of realizations) {
      entries.push({
        id: `tl-realization-${r.id}`,
        timestamp: r.createdAt,
        type: 'REALIZATION_STARTED',
        actor: 'Systém',
        title: `Realizace vytvořena: ${r.surface?.name || 'Plocha'}`,
        description: `Stav: ${r.status}`,
        entityType: 'CrmRealization',
        entityId: r.id,
        metadata: { status: r.status },
      });

      if (r.actualDate) {
        entries.push({
          id: `tl-realization-done-${r.id}`,
          timestamp: r.actualDate,
          type: 'REALIZATION_COMPLETED',
          actor: 'Systém',
          title: `Realizace dokončena: ${r.surface?.name || 'Plocha'}`,
          description: `Realizace plochy ${r.surface?.name || ''} dokončena.`,
          entityType: 'CrmRealization',
          entityId: r.id,
        });
      }
    }
  }

  // Sort chronologically
  entries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return entries;
}

/**
 * Resolves a complete entity chain from any starting point.
 * Follows relationships: AiInboxMessage ↔ Offer ↔ CrmOrder ↔ SalesOpportunity
 */
async function resolveEntityChain(
  organizationId: string,
  entityId: string,
  entityType: string
): Promise<{
  inboxMessageId?: string;
  salesOpportunityId?: string;
  offerId?: string;
  crmOrderId?: string;
}> {
  const result: {
    inboxMessageId?: string;
    salesOpportunityId?: string;
    offerId?: string;
    crmOrderId?: string;
  } = {};

  if (entityType === 'AiInboxMessage') {
    const msg = await prisma.aiInboxMessage.findFirst({
      where: { id: entityId, organizationId },
      select: { id: true, offerId: true, crmOrderId: true, salesOpportunityId: true },
    });
    if (msg) {
      result.inboxMessageId = msg.id;
      result.offerId = msg.offerId || undefined;
      result.crmOrderId = msg.crmOrderId || undefined;
      result.salesOpportunityId = msg.salesOpportunityId || undefined;
    }
  } else if (entityType === 'Offer') {
    result.offerId = entityId;
    const offer = await prisma.offer.findFirst({
      where: { id: entityId, organizationId },
      select: { id: true, crmOrder: { select: { id: true } } },
    });
    if (offer?.crmOrder) {
      result.crmOrderId = offer.crmOrder.id;
    }
    // Find inbox message linked to this offer
    const msg = await prisma.aiInboxMessage.findFirst({
      where: { offerId: entityId, organizationId },
      select: { id: true, salesOpportunityId: true },
    });
    if (msg) {
      result.inboxMessageId = msg.id;
      result.salesOpportunityId = msg.salesOpportunityId || undefined;
    }
    // Check SalesOpportunity linked to this offer
    const opp = await prisma.salesOpportunity.findFirst({
      where: { createdOfferId: entityId, organizationId },
      select: { id: true },
    });
    if (opp) result.salesOpportunityId = opp.id;
  } else if (entityType === 'CrmOrder') {
    result.crmOrderId = entityId;
    const order = await prisma.crmOrder.findFirst({
      where: { id: entityId, organizationId },
      select: { offerId: true },
    });
    if (order?.offerId) {
      result.offerId = order.offerId;
      // Recurse to get full chain
      const offerChain = await resolveEntityChain(organizationId, order.offerId, 'Offer');
      result.inboxMessageId = offerChain.inboxMessageId;
      result.salesOpportunityId = offerChain.salesOpportunityId;
    }
  } else if (entityType === 'SalesOpportunity') {
    result.salesOpportunityId = entityId;
    const opp = await prisma.salesOpportunity.findFirst({
      where: { id: entityId, organizationId },
      select: { createdOfferId: true },
    });
    if (opp?.createdOfferId) {
      result.offerId = opp.createdOfferId;
      const offerChain = await resolveEntityChain(organizationId, opp.createdOfferId, 'Offer');
      result.crmOrderId = offerChain.crmOrderId;
    }
  }

  return result;
}
