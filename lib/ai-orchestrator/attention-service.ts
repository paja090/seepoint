/**
 * AI Commercial Orchestrator — Attention Service ("Co potřebuje moji pozornost")
 *
 * Agreguje signály z celého obchodního ekosystému do sjednoceného přehledu.
 *
 * ZDROJE ROZHODOVÁNÍ:
 * - Primární zdroj CRM business inteligence (follow-up, renewals, rizika realizací,
 *   fakturace, drafty): AI CRM Intelligence (lib/ai-crm/crm-intelligence-service).
 * - Technické / operativní signály: AI Mailbox (neúplné poptávky), operativní termíny montáží.
 *
 * Pull-based: vyhodnocuje položky on-demand nad databází bez redundantních tabulek.
 */

import { prisma } from '@/lib/db';
import { getMyAttentionItems } from '@/lib/ai-crm/crm-intelligence-service';
import type { CrmAttentionItem, CrmNextBestAction } from '@/lib/ai-crm/contracts/types';
import type {
  AttentionItem,
  CommercialPriority,
  UnifiedNextBestAction,
} from './contracts/types';
import { ALWAYS_REQUIRES_HUMAN, type AutomationAction } from './automation-policy';

import { runWithTenantContext } from '@/lib/tenant-context';

// Priority weight mapping (CRITICAL > URGENT > HIGH > MEDIUM > LOW)
export const priorityWeight: Record<CommercialPriority, number> = {
  CRITICAL: 5,
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Returns all items that need the user's attention, sorted by priority.
 * Aggregates from: AI CRM Intelligence, AI Mailbox, Sales Radar, Realizations.
 */
export async function getCommercialAttentionItems(
  organizationId: string
): Promise<AttentionItem[]> {
  return runWithTenantContext({ organizationId }, async () => {
    const items: AttentionItem[] = [];

    // 1. Fetch canonical CRM intelligence attention items (Single Source of Truth)
    const crmItems = await getMyAttentionItems(organizationId).catch((err) => {
      console.error('[attention-service] Chyba načtení CRM Intelligence attention items:', err);
      return [];
    });

    // 2. Aggregate across all collectors
    await Promise.all([
      collectMissingInfoItems(organizationId, items),
      collectDraftReviewItems(organizationId, items, crmItems),
      collectFollowUpItems(organizationId, items, crmItems),
      collectRealizationBlockedItems(organizationId, items, crmItems),
      collectDeadlineRiskItems(organizationId, items),
      collectRenewalItems(organizationId, items, crmItems),
      collectNewOpportunityItems(organizationId, items, crmItems),
      collectReadyForBillingItems(organizationId, items, crmItems),
    ]);

    // Deduplicate by target entity + category to avoid duplicate cards
    const seen = new Set<string>();
    const deduplicated: AttentionItem[] = [];

    for (const item of items) {
      const key = `${item.entityType}:${item.entityId}:${item.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(item);
      }
    }

    deduplicated.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

    return deduplicated;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapCrmToUnifiedAction(nba: CrmNextBestAction): UnifiedNextBestAction {
  const isHumanRequired =
    ALWAYS_REQUIRES_HUMAN.has(nba.actionType as AutomationAction) ||
    [
      'FOLLOW_UP_CLIENT',
      'RESOLVE_REALIZATION_BLOCKER',
      'PROPOSE_CAMPAIGN_RENEWAL',
      'PREPARE_RENEWAL',
      'READY_FOR_BILLING',
      'RESOLVE_OVERDUE_TASK',
      'REVIEW_UPSELL_OPPORTUNITY',
      'REVIEW_AND_SEND_OFFER',
    ].includes(nba.actionType);

  return {
    id: nba.id,
    organizationId: nba.organizationId,
    source: 'CRM',
    actionType: nba.actionType,
    priority: nba.priority as CommercialPriority,
    title: nba.title,
    description: nba.description,
    targetEntityType: nba.targetEntityType,
    targetEntityId: nba.targetEntityId,
    recommendedAt: nba.recommendedAt,
    reason: nba.scoreBreakdown?.explanation,
    requiresHumanApproval: isHumanRequired,
    executableByOrchestrator: false,
    link: nba.suggestedCta?.href,
    suggestedPayload: nba.suggestedPayload,
  };
}

// ---------------------------------------------------------------------------
// Collectors
// ---------------------------------------------------------------------------

/** Poptávky s chybějícími údaji (AI Mailbox) */
export async function collectMissingInfoItems(
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
      id: true,
      subject: true,
      fromEmail: true,
      fromName: true,
      receivedAt: true,
      client: { select: { name: true } },
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
      source: 'MAILBOX',
      title: `Poptávka vyžaduje upřesnění: ${msg.subject}`,
      description: `Od: ${msg.fromName || msg.fromEmail}${msg.client?.name ? ` (${msg.client.name})` : ''}. Zkontrolujte a doplňte chybějící údaje.`,
      entityType: 'AiInboxMessage',
      entityId: msg.id,
      link: `/ai-inbox?id=${msg.id}`,
      createdAt: msg.receivedAt,
      unifiedNextBestAction: {
        id: `nba-msg-${msg.id}`,
        organizationId,
        source: 'MAILBOX',
        actionType: 'COMPLETE_INFORMATION',
        priority: 'HIGH',
        title: 'Doplnit chybějící údaje v poptávce',
        description: `Upřesněte termín a lokalitu pro ${msg.fromName || msg.fromEmail}.`,
        targetEntityType: 'AiInboxMessage',
        targetEntityId: msg.id,
        recommendedAt: msg.receivedAt,
        requiresHumanApproval: true,
        executableByOrchestrator: false,
        link: `/ai-inbox?id=${msg.id}`,
      },
    });
  }
}

/** Nabídky čekající na kontrolu — zdrojováno z AI CRM Intelligence */
export async function collectDraftReviewItems(
  organizationId: string,
  items: AttentionItem[],
  crmItems?: CrmAttentionItem[]
): Promise<void> {
  const draftItems = (crmItems || await getMyAttentionItems(organizationId))
    .filter((i) => i.insightType === 'OFFER_WAITING_FOR_REVIEW');

  for (const item of draftItems) {
    items.push({
      id: `att-draft-${item.id}`,
      organizationId,
      category: 'DRAFT_REVIEW',
      priority: item.priority as CommercialPriority,
      source: 'CRM',
      title: item.title,
      description: item.detail,
      whyReason: item.whyOnTopReason,
      entityType: item.nextBestAction.targetEntityType,
      entityId: item.nextBestAction.targetEntityId,
      link: item.nextBestAction.suggestedCta.href,
      createdAt: item.detectedAt,
      unifiedNextBestAction: mapCrmToUnifiedAction(item.nextBestAction),
    });
  }
}

/** Odeslané nabídky bez odpovědi (follow-up) — výhradně dle AI CRM Intelligence profilu */
export async function collectFollowUpItems(
  organizationId: string,
  items: AttentionItem[],
  crmItems?: CrmAttentionItem[]
): Promise<void> {
  const followUpItems = (crmItems || await getMyAttentionItems(organizationId))
    .filter((i) => i.insightType === 'FOLLOW_UP_DUE');

  for (const item of followUpItems) {
    items.push({
      id: `att-followup-${item.id}`,
      organizationId,
      category: 'FOLLOW_UP',
      priority: item.priority as CommercialPriority,
      source: 'CRM',
      title: item.title,
      description: item.detail,
      whyReason: item.whyOnTopReason,
      entityType: item.nextBestAction.targetEntityType,
      entityId: item.nextBestAction.targetEntityId,
      link: item.nextBestAction.suggestedCta.href,
      createdAt: item.detectedAt,
      unifiedNextBestAction: mapCrmToUnifiedAction(item.nextBestAction),
    });
  }
}

/** Realizace s blokací a reklamace — zdrojováno z AI CRM Intelligence (CRITICAL) */
export async function collectRealizationBlockedItems(
  organizationId: string,
  items: AttentionItem[],
  crmItems?: CrmAttentionItem[]
): Promise<void> {
  const blockedItems = (crmItems || await getMyAttentionItems(organizationId))
    .filter((i) => i.insightType === 'REALIZATION_RISK');

  for (const item of blockedItems) {
    items.push({
      id: `att-realization-${item.id}`,
      organizationId,
      category: 'REALIZATION_BLOCKED',
      priority: item.priority as CommercialPriority,
      source: 'REALIZATION',
      title: item.title,
      description: item.detail,
      whyReason: item.whyOnTopReason,
      entityType: item.nextBestAction.targetEntityType,
      entityId: item.nextBestAction.targetEntityId,
      link: item.nextBestAction.suggestedCta.href,
      createdAt: item.detectedAt,
      unifiedNextBestAction: mapCrmToUnifiedAction(item.nextBestAction),
    });
  }
}

/** Termínová rizika montáží a realizací v terénu (provozní horizont 7 dní) */
export async function collectDeadlineRiskItems(
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
      id: true,
      status: true,
      plannedDate: true,
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
      source: 'REALIZATION',
      title: `Termín za ${daysUntil} dní: ${r.surface?.name || 'Plocha'}`,
      description: `Zakázka ${r.crmOrder?.orderNumber || 'N/A'}. Stav: ${r.status}. Plánovaný termín: ${r.plannedDate?.toISOString().slice(0, 10) || 'N/A'}.`,
      entityType: 'CrmRealization',
      entityId: r.id,
      link: `/realization?orderId=${r.crmOrder?.id || ''}`,
      createdAt: new Date(),
    });
  }
}

/** Obnovení kampaní (renewals) — zdrojováno z AI CRM Intelligence */
export async function collectRenewalItems(
  organizationId: string,
  items: AttentionItem[],
  crmItems?: CrmAttentionItem[]
): Promise<void> {
  const renewalItems = (crmItems || await getMyAttentionItems(organizationId))
    .filter((i) => i.insightType === 'RENEWAL_OPPORTUNITY');

  for (const item of renewalItems) {
    items.push({
      id: `att-renewal-${item.id}`,
      organizationId,
      category: 'RENEWAL',
      priority: item.priority as CommercialPriority,
      source: 'CRM',
      title: item.title,
      description: item.detail,
      whyReason: item.whyOnTopReason,
      entityType: item.nextBestAction.targetEntityType,
      entityId: item.nextBestAction.targetEntityId,
      link: item.nextBestAction.suggestedCta.href,
      createdAt: item.detectedAt,
      unifiedNextBestAction: mapCrmToUnifiedAction(item.nextBestAction),
    });
  }
}

/** Nové příležitosti z Sales Radaru (propojeno s CRM Intelligence pro klienty + nové prospects) */
export async function collectNewOpportunityItems(
  organizationId: string,
  items: AttentionItem[],
  crmItems?: CrmAttentionItem[]
): Promise<void> {
  // 1. Zahrnout upsell příležitosti u existujících klientů z CRM Intelligence
  const upsellItems = (crmItems || await getMyAttentionItems(organizationId))
    .filter((i) => i.insightType === 'UPSELL_OPPORTUNITY');

  for (const item of upsellItems) {
    items.push({
      id: `att-upsell-${item.id}`,
      organizationId,
      category: 'NEW_OPPORTUNITY',
      priority: item.priority as CommercialPriority,
      source: 'CRM',
      title: item.title,
      description: item.detail,
      whyReason: item.whyOnTopReason,
      entityType: item.nextBestAction.targetEntityType,
      entityId: item.nextBestAction.targetEntityId,
      link: item.nextBestAction.suggestedCta.href,
      createdAt: item.detectedAt,
      unifiedNextBestAction: mapCrmToUnifiedAction(item.nextBestAction),
    });
  }

  // 2. Nové neznámé prospects bez přiřazeného klienta (čistý Radar discovery)
  const opportunities = await prisma.salesOpportunity.findMany({
    where: {
      mergedIntoId: null,
      organizationId,
      status: 'NEW',
      clientId: null,
      opportunityScore: { gte: 70 },
    },
    select: {
      id: true,
      companyName: true,
      title: true,
      city: true,
      opportunityScore: true,
      detectedAt: true,
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
      source: 'RADAR',
      title: `Radar objev (${opp.opportunityScore}b.): ${opp.companyName}`,
      description: `${opp.title}. Lokalita: ${opp.city || 'ČR'}.`,
      entityType: 'SalesOpportunity',
      entityId: opp.id,
      link: `/sales/opportunities?id=${opp.id}`,
      createdAt: opp.detectedAt,
    });
  }
}

/** Příležitosti k fakturaci dokončených zakázek z AI CRM Intelligence */
export async function collectReadyForBillingItems(
  organizationId: string,
  items: AttentionItem[],
  crmItems?: CrmAttentionItem[]
): Promise<void> {
  const billingItems = (crmItems || await getMyAttentionItems(organizationId))
    .filter((i) => i.insightType === 'READY_FOR_BILLING');

  for (const item of billingItems) {
    items.push({
      id: `att-billing-${item.id}`,
      organizationId,
      category: 'REALIZATION_BLOCKED',
      priority: item.priority as CommercialPriority,
      source: 'CRM',
      title: item.title,
      description: item.detail,
      whyReason: item.whyOnTopReason,
      entityType: item.nextBestAction.targetEntityType,
      entityId: item.nextBestAction.targetEntityId,
      link: item.nextBestAction.suggestedCta.href,
      createdAt: item.detectedAt,
      unifiedNextBestAction: mapCrmToUnifiedAction(item.nextBestAction),
    });
  }
}
