/**
 * AI Commercial Orchestrator — Commercial Center Data Service
 *
 * Provides aggregated data for the Commercial Center UI.
 * Combines attention items, inbox requests, radar opportunities,
 * offers lifecycle, realizations, and next best actions.
 */

import { prisma } from '@/lib/db';
import { getOrganizationNextBestActions } from '@/lib/ai-commercial/next-best-action';
import { getCommercialAttentionItems } from './attention-service';
import type { CommercialCenterData } from './contracts/types';

/**
 * Returns complete Commercial Center dashboard data for an organization.
 */
export async function getCommercialCenterData(
  organizationId: string
): Promise<CommercialCenterData> {
  const [
    attentionItems,
    nextBestActions,
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
    nextBestActions,
  };
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
