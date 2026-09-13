/**
 * AI Commercial Orchestrator — Attention Service ("Co potřebuje moji pozornost")
 *
 * Aggregates signals from ALL modules into a unified attention view.
 * Pull-based: computes attention items on demand from existing DB state.
 * No separate notification table — follows existing NotificationProvider pattern.
 */

import { prisma } from '@/lib/db';
import { getOrganizationNextBestActions } from '@/lib/ai-commercial/next-best-action';
import type { AttentionItem, CommercialPriority } from './contracts/types';

/**
 * Returns all items that need the user's attention, sorted by priority.
 * Aggregates from: AI Mailbox, Sales Radar, Offers, Realizations, Occupancy Insights.
 */
export async function getCommercialAttentionItems(
  organizationId: string
): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  await Promise.all([
    collectMissingInfoItems(organizationId, items),
    collectDraftReviewItems(organizationId, items),
    collectFollowUpItems(organizationId, items),
    collectRealizationBlockedItems(organizationId, items),
    collectDeadlineRiskItems(organizationId, items),
    collectRenewalItems(organizationId, items),
    collectNewOpportunityItems(organizationId, items),
  ]);

  // Sort by priority weight
  const priorityWeight: Record<CommercialPriority, number> = {
    CRITICAL: 5,
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  items.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

  return items;
}

// ---------------------------------------------------------------------------
// Collectors
// ---------------------------------------------------------------------------

/** Poptávky s chybějícími údaji */
async function collectMissingInfoItems(
  organizationId: string,
  items: AttentionItem[]
): Promise<void> {
  const messages = await prisma.aiInboxMessage.findMany({
    where: {
      organizationId,
      classification: { in: ['NEW_INQUIRY'] },
      requiresReview: true,
      offerId: null,
      processingStatus: { notIn: ['IGNORED', 'ERROR'] },
    },
    select: {
      id: true, subject: true, fromEmail: true, fromName: true,
      receivedAt: true, client: { select: { name: true } },
    },
    orderBy: { receivedAt: 'desc' },
    take: 10,
  });

  for (const msg of messages) {
    items.push({
      id: `att-missing-${msg.id}`,
      organizationId,
      category: 'MISSING_INFO',
      priority: 'HIGH',
      title: `Poptávka vyžaduje upřesnění: ${msg.subject}`,
      description: `Od: ${msg.fromName || msg.fromEmail}${msg.client?.name ? ` (${msg.client.name})` : ''}. Zkontrolujte a doplňte chybějící údaje.`,
      entityType: 'AiInboxMessage',
      entityId: msg.id,
      link: `/ai-inbox?id=${msg.id}`,
      createdAt: msg.receivedAt,
    });
  }
}

/** Nabídky čekající na kontrolu */
async function collectDraftReviewItems(
  organizationId: string,
  items: AttentionItem[]
): Promise<void> {
  const drafts = await prisma.offer.findMany({
    where: {
      organizationId,
      status: 'DRAFT',
      archivedAt: null,
    },
    select: {
      id: true, title: true, createdAt: true,
      client: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  for (const draft of drafts) {
    const daysSinceCreated = Math.floor((Date.now() - draft.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const priority: CommercialPriority = daysSinceCreated > 3 ? 'HIGH' : 'MEDIUM';

    items.push({
      id: `att-draft-${draft.id}`,
      organizationId,
      category: 'DRAFT_REVIEW',
      priority,
      title: `Koncept nabídky čeká na kontrolu: ${draft.title}`,
      description: `Klient: ${draft.client?.name || 'N/A'}. Vytvořeno před ${daysSinceCreated} dny. Zkontrolujte a odešlete.`,
      entityType: 'Offer',
      entityId: draft.id,
      link: `/offers/${draft.id}`,
      createdAt: draft.createdAt,
    });
  }
}

/** Odeslané nabídky bez odpovědi (follow-up) */
async function collectFollowUpItems(
  organizationId: string,
  items: AttentionItem[]
): Promise<void> {
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

  const sentOffers = await prisma.offer.findMany({
    where: {
      organizationId,
      status: 'SENT',
      archivedAt: null,
      sentAt: { lte: fourDaysAgo },
    },
    select: {
      id: true, title: true, sentAt: true, validUntil: true,
      client: { select: { name: true } },
    },
    orderBy: { sentAt: 'asc' },
    take: 10,
  });

  for (const offer of sentOffers) {
    const daysSinceSent = offer.sentAt
      ? Math.floor((Date.now() - offer.sentAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const isExpiring = offer.validUntil && offer.validUntil.getTime() < Date.now() + 3 * 24 * 60 * 60 * 1000;
    const priority: CommercialPriority = isExpiring ? 'HIGH' : 'MEDIUM';

    items.push({
      id: `att-followup-${offer.id}`,
      organizationId,
      category: 'FOLLOW_UP',
      priority,
      title: `Nabídka bez odpovědi (${daysSinceSent} dní): ${offer.title}`,
      description: `Klient: ${offer.client?.name || 'N/A'}.${isExpiring ? ' ⚠️ Platnost brzy vyprší!' : ''} Kontaktujte klienta.`,
      entityType: 'Offer',
      entityId: offer.id,
      link: `/offers/${offer.id}`,
      createdAt: offer.sentAt || new Date(),
    });
  }
}

/** Realizace s blokací */
async function collectRealizationBlockedItems(
  organizationId: string,
  items: AttentionItem[]
): Promise<void> {
  const blockedRealizations = await prisma.crmRealization.findMany({
    where: {
      organizationId,
      status: { in: ['CLAIM', 'WAITING_FOR_MATERIALS'] },
    },
    select: {
      id: true, status: true, note: true, plannedDate: true,
      surface: { select: { name: true } },
      crmOrder: { select: { id: true, orderNumber: true, title: true } },
    },
    orderBy: { plannedDate: 'asc' },
    take: 10,
  });

  for (const r of blockedRealizations) {
    const isUrgent = r.plannedDate && r.plannedDate.getTime() < Date.now() + 3 * 24 * 60 * 60 * 1000;
    const priority: CommercialPriority = r.status === 'CLAIM' ? 'URGENT' : isUrgent ? 'HIGH' : 'MEDIUM';

    items.push({
      id: `att-realization-${r.id}`,
      organizationId,
      category: 'REALIZATION_BLOCKED',
      priority,
      title: `Realizace ${r.status}: ${r.surface?.name || 'Plocha'}`,
      description: `Zakázka: ${r.crmOrder?.orderNumber || 'N/A'}. ${r.note || 'Vyřešte blokaci realizace.'}`,
      entityType: 'CrmRealization',
      entityId: r.id,
      link: `/realization?orderId=${r.crmOrder?.id || ''}`,
      createdAt: r.plannedDate || new Date(),
    });
  }
}

/** Termínová rizika */
async function collectDeadlineRiskItems(
  organizationId: string,
  items: AttentionItem[]
): Promise<void> {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const upcomingRealizations = await prisma.crmRealization.findMany({
    where: {
      organizationId,
      status: { in: ['WAITING_FOR_MATERIALS', 'SCHEDULED', 'INSTALLATION_IN_PROGRESS'] },
      plannedDate: { lte: sevenDaysFromNow, gte: new Date() },
    },
    select: {
      id: true, status: true, plannedDate: true,
      surface: { select: { name: true } },
      crmOrder: { select: { id: true, orderNumber: true } },
    },
    orderBy: { plannedDate: 'asc' },
    take: 10,
  });

  for (const r of upcomingRealizations) {
    const daysUntil = r.plannedDate
      ? Math.ceil((r.plannedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;
    const priority: CommercialPriority = daysUntil <= 2 ? 'URGENT' : 'HIGH';

    items.push({
      id: `att-deadline-${r.id}`,
      organizationId,
      category: 'DEADLINE_RISK',
      priority,
      title: `Termín za ${daysUntil} dní: ${r.surface?.name || 'Plocha'}`,
      description: `Zakázka ${r.crmOrder?.orderNumber || 'N/A'}. Stav: ${r.status}. Plánovaný termín: ${r.plannedDate?.toISOString().slice(0, 10) || 'N/A'}.`,
      entityType: 'CrmRealization',
      entityId: r.id,
      link: `/realization?orderId=${r.crmOrder?.id || ''}`,
      createdAt: new Date(),
    });
  }
}

/** Obnovení kampaní (renewal) z AI Occupancy */
async function collectRenewalItems(
  organizationId: string,
  items: AttentionItem[]
): Promise<void> {
  const expiringInsights = await prisma.occupancyInsight.findMany({
    where: {
      organizationId,
      status: { in: ['OPEN', 'REVIEWED'] },
      type: 'EXPIRING_CAMPAIGN',
    },
    select: {
      id: true, title: true, deterministicReason: true,
      severity: true, detectedAt: true,
      surfaceId: true, clientId: true, occupancyId: true,
    },
    orderBy: { detectedAt: 'desc' },
    take: 5,
  });

  for (const ins of expiringInsights) {
    const priority: CommercialPriority = ins.severity === 'CRITICAL' ? 'CRITICAL' : ins.severity === 'HIGH' ? 'HIGH' : 'MEDIUM';

    items.push({
      id: `att-renewal-${ins.id}`,
      organizationId,
      category: 'RENEWAL',
      priority,
      title: ins.title,
      description: ins.deterministicReason,
      entityType: 'OccupancyInsight',
      entityId: ins.id,
      link: `/occupancy/ai?insightId=${ins.id}`,
      createdAt: ins.detectedAt,
    });
  }
}

/** Nové příležitosti z Sales Radaru */
async function collectNewOpportunityItems(
  organizationId: string,
  items: AttentionItem[]
): Promise<void> {
  const opportunities = await prisma.salesOpportunity.findMany({
    where: {
      organizationId,
      status: 'NEW',
      opportunityScore: { gte: 70 },
    },
    select: {
      id: true, companyName: true, title: true,
      city: true, opportunityScore: true, detectedAt: true,
    },
    orderBy: { opportunityScore: 'desc' },
    take: 5,
  });

  for (const opp of opportunities) {
    const priority: CommercialPriority = opp.opportunityScore >= 85 ? 'CRITICAL' : 'HIGH';

    items.push({
      id: `att-radar-${opp.id}`,
      organizationId,
      category: 'NEW_OPPORTUNITY',
      priority,
      title: `Radar objev (${opp.opportunityScore}b.): ${opp.companyName}`,
      description: `${opp.title}. Lokalita: ${opp.city || 'ČR'}.`,
      entityType: 'SalesOpportunity',
      entityId: opp.id,
      link: `/sales/opportunities?id=${opp.id}`,
      createdAt: opp.detectedAt,
    });
  }
}
