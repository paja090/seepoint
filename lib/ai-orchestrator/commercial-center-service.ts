/**
 * AI Commercial Orchestrator — Commercial Center Data Service
 *
 * Provides aggregated data for the Commercial Center UI.
 * Combines attention items, inbox requests, radar opportunities,
 * offers lifecycle, realizations, and next best actions.
 */

import { prisma } from '@/lib/db';
import { runWithTenantContext } from '@/lib/tenant-context';
import { getOrganizationNextBestActions } from '@/lib/ai-commercial/next-best-action';
import { getCommercialAttentionItems, priorityWeight } from './attention-service';
import type { CommercialCenterData, UnifiedNextBestAction, CommercialPriority } from './contracts/types';

/**
 * Returns complete Commercial Center dashboard data for an organization.
 */
export async function getCommercialCenterData(
  organizationId: string
): Promise<CommercialCenterData> {
  return runWithTenantContext({ organizationId }, async () => {
    const [
      attentionItems,
      legacyNextBestActions,
      inboxRequests,
      radarOpportunities,
      draftOffers,
      sentOffers,
      acceptedOffers,
      realizationStats,
    ] = await Promise.all([
    getCommercialAttentionItems(organizationId),
    getOrganizationNextBestActions(organizationId),
    getInboxRequests(organizationId),
    getRadarOpportunities(organizationId),
    getDraftOffers(organizationId),
    getSentOffers(organizationId),
    getAcceptedOffers(organizationId),
    getRealizationStats(organizationId),
  ]);

  // Aggregate Unified Next Best Actions
  const unifiedActions: UnifiedNextBestAction[] = [];

  // 1. Actions directly from CRM Intelligence Attention Items
  for (const item of attentionItems) {
    if (item.unifiedNextBestAction) {
      unifiedActions.push(item.unifiedNextBestAction);
    }
  }

  // 2. Actions for pending inbox inquiries (Availability check)
  for (const inbox of inboxRequests) {
    if (!inbox.offerId && inbox.requiresReview) {
      unifiedActions.push({
        id: `nba-inbox-${inbox.id}`,
        organizationId,
        source: 'MAILBOX',
        actionType: 'CHECK_AVAILABILITY',
        priority: 'HIGH',
        title: `Prověřit dostupnost: ${inbox.clientName || inbox.fromName || inbox.fromEmail}`,
        description: `Poptávka "${inbox.subject}". Zkontrolovat termín a volné reklamní kapacity.`,
        targetEntityType: 'INBOX_MESSAGE',
        targetEntityId: inbox.id,
        recommendedAt: new Date(),
        requiresHumanApproval: false,
        executableByOrchestrator: true,
        link: '/ai-inbox',
        reason: 'Nová poptávka z AI Mailboxu čeká na ověření dostupnosti.',
      });
    }
  }

  // 3. Fallback / supplementary actions from legacy commercial NBA generator
  for (const leg of legacyNextBestActions) {
    const isAutomated = leg.actionType === 'CHECK_AVAILABILITY';
    unifiedActions.push({
      id: leg.id,
      organizationId: leg.organizationId || organizationId,
      source: leg.targetEntityType === 'SALES_OPPORTUNITY' ? 'RADAR' : leg.targetEntityType === 'OFFER' ? 'OFFER' : 'CRM',
      actionType: leg.actionType,
      priority: leg.priority as CommercialPriority,
      title: leg.title,
      description: leg.description,
      targetEntityType: leg.targetEntityType,
      targetEntityId: leg.targetEntityId,
      recommendedAt: leg.recommendedAt || new Date(),
      requiresHumanApproval: !isAutomated,
      executableByOrchestrator: isAutomated,
      suggestedPayload: leg.suggestedPayload,
      link: leg.targetEntityType === 'OFFER' ? `/offers/${leg.targetEntityId}` : undefined,
    });
  }

  // Deduplicate by target entity + action type
  const seen = new Set<string>();
  const deduplicatedNba: UnifiedNextBestAction[] = [];

  for (const nba of unifiedActions) {
    const key = `${nba.targetEntityType}:${nba.targetEntityId}:${nba.actionType}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicatedNba.push(nba);
    }
  }

  // Sort by priority weight
  deduplicatedNba.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

    return {
      attentionItems,
      inboxRequests,
      radarOpportunities,
      offers: {
        drafts: draftOffers,
        sent: sentOffers,
        accepted: acceptedOffers,
      },
      realizations: realizationStats,
      nextBestActions: deduplicatedNba,
    };
  });
}

// ---------------------------------------------------------------------------
// Data fetchers
// ---------------------------------------------------------------------------

async function getInboxRequests(organizationId: string) {
  const messages = await prisma.aiInboxMessage.findMany({
    where: {
      organizationId,
      classification: { in: ['NEW_INQUIRY', 'CHANGE_REQUEST'] },
      processingStatus: { notIn: ['IGNORED'] },
    },
    select: {
      id: true, subject: true, fromEmail: true, fromName: true,
      classification: true, receivedAt: true, requiresReview: true,
      offerId: true, client: { select: { name: true } },
    },
    orderBy: { receivedAt: 'desc' },
    take: 20,
  });

  return messages.map((m) => ({
    id: m.id,
    subject: m.subject,
    fromEmail: m.fromEmail,
    fromName: m.fromName,
    clientName: m.client?.name || null,
    classification: m.classification,
    receivedAt: m.receivedAt,
    requiresReview: m.requiresReview,
    offerId: m.offerId,
  }));
}

async function getRadarOpportunities(organizationId: string) {
  const opportunities = await prisma.salesOpportunity.findMany({
    where: {
      mergedIntoId: null,
      organizationId,
      status: { in: ['NEW', 'REVIEWED', 'CONTACT_PLANNED', 'CONTACTED', 'PROPOSAL_CREATED'] },
    },
    select: {
      id: true, companyName: true, title: true, city: true,
      opportunityScore: true, status: true, createdOfferId: true, detectedAt: true,
    },
    orderBy: { opportunityScore: 'desc' },
    take: 15,
  });

  return opportunities.map((o) => ({
    id: o.id,
    companyName: o.companyName,
    title: o.title,
    city: o.city,
    score: o.opportunityScore,
    status: o.status,
    createdOfferId: o.createdOfferId,
    detectedAt: o.detectedAt,
  }));
}

async function getDraftOffers(organizationId: string) {
  return prisma.offer.findMany({
    where: { organizationId, status: 'DRAFT', archivedAt: null },
    select: {
      id: true, title: true, createdAt: true,
      totalPrice: true,
      client: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  }).then((offers) =>
    offers.map((o) => ({
      id: o.id,
      title: o.title,
      clientName: o.client?.name,
      totalPrice: o.totalPrice ? Number(o.totalPrice) : undefined,
      createdAt: o.createdAt,
    }))
  );
}

async function getSentOffers(organizationId: string) {
  return prisma.offer.findMany({
    where: { organizationId, status: 'SENT', archivedAt: null },
    select: {
      id: true, title: true, sentAt: true, validUntil: true,
      totalPrice: true,
      client: { select: { name: true } },
    },
    orderBy: { sentAt: 'desc' },
    take: 10,
  }).then((offers) =>
    offers.map((o) => ({
      id: o.id,
      title: o.title,
      clientName: o.client?.name,
      totalPrice: o.totalPrice ? Number(o.totalPrice) : undefined,
      sentAt: o.sentAt || undefined,
      validUntil: o.validUntil || undefined,
    }))
  );
}

async function getAcceptedOffers(organizationId: string) {
  return prisma.offer.findMany({
    where: { organizationId, status: 'ACCEPTED', archivedAt: null },
    select: {
      id: true, title: true, acceptedAt: true,
      totalPrice: true,
      client: { select: { name: true } },
      crmOrder: { select: { id: true } },
    },
    orderBy: { acceptedAt: 'desc' },
    take: 10,
  }).then((offers) =>
    offers.map((o) => ({
      id: o.id,
      title: o.title,
      clientName: o.client?.name,
      totalPrice: o.totalPrice ? Number(o.totalPrice) : undefined,
      acceptedAt: o.acceptedAt || undefined,
      hasCrmOrder: Boolean(o.crmOrder),
    }))
  );
}

async function getRealizationStats(organizationId: string) {
  const [activeCount, riskCount, blockedCount, billingCount] = await Promise.all([
    prisma.crmRealization.count({
      where: {
        organizationId,
        status: { in: ['SCHEDULED', 'INSTALLATION_IN_PROGRESS', 'WAITING_FOR_PRODUCTION'] },
      },
    }),
    prisma.crmRealization.count({
      where: {
        organizationId,
        status: { in: ['WAITING_FOR_MATERIALS'] },
      },
    }),
    prisma.crmRealization.count({
      where: {
        organizationId,
        status: 'CLAIM',
      },
    }),
    prisma.crmRealization.count({
      where: {
        organizationId,
        status: { in: ['COMPLETED', 'DELIVERED_TO_CLIENT'] },
      },
    }),
  ]);

  return {
    active: activeCount,
    risk: riskCount,
    blocked: blockedCount,
    readyForBilling: billingCount,
  };
}
