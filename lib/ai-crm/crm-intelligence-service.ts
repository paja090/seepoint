/**
 * AI CRM Intelligence — Central Intelligence & Evaluation Engine
 *
 * Deterministic analysis across the entire commercial lifecycle:
 * Mailbox -> Radar -> CRM -> Occupancy -> Offers -> Realization -> Billing.
 *
 * Strict multi-tenant isolation by organizationId.
 */

import { prisma } from '@/lib/db';
import type {
  CrmAttentionItem,
  CrmNextBestAction,
  CrmInsightType,
  CrmInsightPriority,
} from './contracts/types';
import { getOrganizationCrmProfile } from './crm-profile';
import { getClient360 } from './client-360-service';

export interface PipelineIntelligenceSummary {
  attentionItems: CrmAttentionItem[];
  followUpsDueCount: number;
  renewalOpportunitiesCount: number;
  upsellOpportunitiesCount: number;
  stalledDealsCount: number;
  realizationRisksCount: number;
  readyForBillingCount: number;
  inactiveClientsCount: number;
  overdueTasksCount: number;
  totalAttentionValueCz: number;
}

/**
 * Returns prioritized attention items for an organization or salesperson ("My Day").
 * Fully explainable: every item has a transparent score and "whyOnTopReason".
 */
export async function getMyAttentionItems(
  organizationId: string,
  userId?: string
): Promise<CrmAttentionItem[]> {
  const profile = await getOrganizationCrmProfile(organizationId);
  const now = new Date();
  const items: CrmAttentionItem[] = [];

  // 1. EVALUATE REALIZATION RISKS (Top Priority - Critical/Urgent)
  if (profile.enableRealizationRiskInsights) {
    const blockedRealizations = await prisma.crmRealization.findMany({
      where: {
        organizationId,
        OR: [
          { status: { in: ['CLAIM', 'WAITING_FOR_MATERIALS'] } },
          { claimNote: { not: null } },
        ],
      },
      include: {
        crmOrder: {
          include: {
            client: { select: { id: true, name: true } },
          },
        },
        carrier: { select: { name: true } },
      },
      take: 10,
    });

    for (const r of blockedRealizations) {
      if (!r.crmOrder?.client) continue;
      const client = r.crmOrder.client;
      const whyReason = `Realizace zakázky č. ${r.crmOrder.orderNumber} je blokována${r.claimNote ? ` (${r.claimNote})` : ''}. Hrozí nedodržení termínu kampaně.`;
      
      const nextBestAction: CrmNextBestAction = {
        id: `nba-risk-${r.id}`,
        organizationId,
        clientId: client.id,
        clientName: client.name,
        actionType: 'RESOLVE_REALIZATION_BLOCKER',
        priority: 'CRITICAL',
        score: 98,
        scoreBreakdown: {
          urgencyScore: 45,
          valueScore: 20,
          relationshipScore: 20,
          timeSensitivityScore: 13,
          totalScore: 98,
          explanation: whyReason,
        },
        title: `Vyřešit překážku realizace pro ${client.name}`,
        description: r.claimNote || 'Realizace čeká na dodání tiskových podkladů nebo vyřešení reklamace.',
        targetEntityType: 'CRM_ORDER',
        targetEntityId: r.crmOrderId,
        suggestedCta: {
          label: 'Otevřít realizaci',
          href: `/work?orderId=${r.crmOrderId}`,
        },
        recommendedAt: now,
      };

      items.push({
        id: `att-risk-${r.id}`,
        organizationId,
        clientId: client.id,
        clientName: client.name,
        insightType: 'REALIZATION_RISK',
        priority: 'CRITICAL',
        priorityScore: 98,
        whyOnTopReason: 'Kritické riziko: Realizace je blokována a ohrožuje spuštění kampaně.',
        title: `Blokovaná realizace: ${client.name}`,
        detail: whyReason,
        associatedValueCz: Number(r.crmOrder.totalPrice || 0),
        nextBestAction,
        detectedAt: r.updatedAt,
      });
    }
  }

  // 2. EVALUATE FOLLOW-UPS DUE (Offer SENT > threshold days, no recent reply)
  const cutoffDate = new Date(now.getTime() - profile.followUpAfterDays * 86400000);
  const sentOffers = await prisma.offer.findMany({
    where: {
      organizationId,
      status: 'SENT',
      sentAt: { lte: cutoffDate },
      archivedAt: null,
      ...(userId ? { createdByUserId: userId } : {}),
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          aiInboxMessages: {
            where: { organizationId },
            orderBy: { receivedAt: 'desc' },
            take: 1,
            select: { receivedAt: true, subject: true },
          },
          communications: {
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
    take: 20,
  });

  for (const offer of sentOffers) {
    if (!offer.client || !offer.sentAt) continue;

    // Check if client replied AFTER offer was sent
    const lastInbound = offer.client.aiInboxMessages[0];
    const lastComm = offer.client.communications[0];
    const latestClientActivity = [lastInbound?.receivedAt, lastComm?.createdAt]
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    // If client responded AFTER offer was sent, do NOT trigger false follow-up!
    if (latestClientActivity && latestClientActivity > offer.sentAt) {
      continue;
    }

    const daysWaiting = Math.floor((now.getTime() - offer.sentAt.getTime()) / 86400000);
    const offerPrice = Number(offer.totalPrice || 0);
    const isHighValue = offerPrice >= profile.highValueOfferThreshold;
    const priority: CrmInsightPriority = isHighValue ? 'HIGH' : 'MEDIUM';
    const score = isHighValue ? 88 : 72;
    const whyReason = `Nabídka odeslána před ${daysWaiting} dny (${offerPrice.toLocaleString('cs-CZ')} Kč). Klient doposud neodpověděl.`;

    const nextBestAction: CrmNextBestAction = {
      id: `nba-fo-${offer.id}`,
      organizationId,
      clientId: offer.client.id,
      clientName: offer.client.name,
      actionType: 'FOLLOW_UP_CLIENT',
      priority,
      score,
      scoreBreakdown: {
        urgencyScore: 25,
        valueScore: isHighValue ? 35 : 20,
        relationshipScore: 15,
        timeSensitivityScore: 12,
        totalScore: score,
        explanation: whyReason,
      },
      title: `Připomenout nabídku: ${offer.title}`,
      description: `Klient ${offer.client.name} má nabídku v hodnotě ${offerPrice.toLocaleString('cs-CZ')} Kč bez reakce ${daysWaiting} dní.`,
      targetEntityType: 'OFFER',
      targetEntityId: offer.id,
      suggestedCta: {
        label: 'Připravit follow-up',
        href: `/offers/${offer.id}?action=followup`,
      },
      suggestedPayload: {
        offerId: offer.id,
        daysWaiting,
        totalPrice: offerPrice,
      },
      recommendedAt: now,
    };

    items.push({
      id: `att-fo-${offer.id}`,
      organizationId,
      clientId: offer.client.id,
      clientName: offer.client.name,
      insightType: 'FOLLOW_UP_DUE',
      priority,
      priorityScore: score,
      whyOnTopReason: whyReason,
      title: `Follow-up nabídky: ${offer.client.name}`,
      detail: `${offer.title} (${daysWaiting} dní bez odpovědi)`,
      associatedValueCz: offerPrice,
      nextBestAction,
      detectedAt: offer.sentAt,
    });
  }

  // 3. EVALUATE RENEWALS (Campaigns ending within renewalWarningDays)
  if (profile.enableRenewalInsights) {
    const warningDate = new Date(now.getTime() + profile.renewalWarningDays * 86400000);
    const expiringOccupancies = await prisma.occupancy.findMany({
      where: {
        organizationId,
        status: 'OCCUPIED',
        dateTo: {
          gte: now,
          lte: warningDate,
        },
        clientId: { not: null },
      },
      include: {
        client: { select: { id: true, name: true } },
        surface: {
          include: {
            carrier: { select: { name: true, city: true } },
          },
        },
      },
      take: 15,
    });

    for (const occ of expiringOccupancies) {
      if (!occ.client) continue;
      const daysRemaining = Math.max(0, Math.ceil((occ.dateTo.getTime() - now.getTime()) / 86400000));
      const surfaceName = `${occ.surface?.carrier?.name || 'Nosič'} (${occ.surface?.carrier?.city || 'ČR'})`;
      const isUrgent = daysRemaining <= 10;
      const score = isUrgent ? 84 : 69;
      const priority: CrmInsightPriority = isUrgent ? 'HIGH' : 'MEDIUM';
      const whyReason = `Kampaň „${occ.campaignName}“ na ploše ${surfaceName} končí za ${daysRemaining} dní.`;

      const nextBestAction: CrmNextBestAction = {
        id: `nba-ren-${occ.id}`,
        organizationId,
        clientId: occ.client.id,
        clientName: occ.client.name,
        actionType: 'PREPARE_RENEWAL',
        priority,
        score,
        scoreBreakdown: {
          urgencyScore: isUrgent ? 30 : 15,
          valueScore: 25,
          relationshipScore: 20,
          timeSensitivityScore: isUrgent ? 9 : 9,
          totalScore: score,
          explanation: whyReason,
        },
        title: `Předjednat prodloužení: ${occ.client.name}`,
        description: `Plocha ${surfaceName} bude za ${daysRemaining} dní volná. Kontaktujte klienta ohledně pokračování dříve, než plochu zarezervuje někdo jiný.`,
        targetEntityType: 'OCCUPANCY',
        targetEntityId: occ.id,
        suggestedCta: {
          label: 'Vytvořit renewal nabídku',
          href: `/offers/new?clientId=${occ.client.id}&renewalCampaignId=${occ.id}`,
        },
        recommendedAt: now,
      };

      items.push({
        id: `att-ren-${occ.id}`,
        organizationId,
        clientId: occ.client.id,
        clientName: occ.client.name,
        insightType: 'RENEWAL_OPPORTUNITY',
        priority,
        priorityScore: score,
        whyOnTopReason: whyReason,
        title: `Prodloužení kampaně (renewal): ${occ.client.name}`,
        detail: `${occ.campaignName} – končí za ${daysRemaining} dní`,
        associatedValueCz: Number(occ.price || 0),
        nextBestAction,
        detectedAt: occ.dateTo,
      });
    }
  }

  // 4. EVALUATE RADAR UPSELL / EXPANSION ON EXISTING CLIENTS
  if (profile.enableRadarClientInsights) {
    const radarOpportunities = await prisma.salesOpportunity.findMany({
      where: {
        organizationId,
        clientId: { not: null },
        status: { in: ['NEW', 'REVIEWED', 'CONTACT_PLANNED'] },
        opportunityScore: { gte: 65 },
      },
      include: {
        client: { select: { id: true, name: true } },
      },
      take: 10,
    });

    for (const opp of radarOpportunities) {
      if (!opp.client) continue;
      const score = opp.opportunityScore;
      const whyReason = `AI Radar zachytil novou aktivitu stávajícího klienta (${opp.title}) se skóre ${score} b.`;

      const nextBestAction: CrmNextBestAction = {
        id: `nba-rad-${opp.id}`,
        organizationId,
        clientId: opp.client.id,
        clientName: opp.client.name,
        actionType: 'REVIEW_UPSELL_OPPORTUNITY',
        priority: score >= 75 ? 'HIGH' : 'MEDIUM',
        score,
        scoreBreakdown: {
          urgencyScore: 15,
          valueScore: 30,
          relationshipScore: 20,
          timeSensitivityScore: 10,
          totalScore: score,
          explanation: whyReason,
        },
        title: `Prověřit upsell expanze: ${opp.client.name}`,
        description: `${opp.summary} – nabídněte přednostní plochy v lokalitě ${opp.city || 'ČR'}.`,
        targetEntityType: 'SALES_OPPORTUNITY',
        targetEntityId: opp.id,
        suggestedCta: {
          label: 'Zobrazit příležitost',
          href: `/sales/opportunities?id=${opp.id}`,
        },
        recommendedAt: now,
      };

      items.push({
        id: `att-rad-${opp.id}`,
        organizationId,
        clientId: opp.client.id,
        clientName: opp.client.name,
        insightType: 'UPSELL_OPPORTUNITY',
        priority: score >= 75 ? 'HIGH' : 'MEDIUM',
        priorityScore: score,
        whyOnTopReason: whyReason,
        title: `Upsell / Expanze klienta: ${opp.client.name}`,
        detail: opp.title,
        nextBestAction,
        detectedAt: opp.detectedAt,
      });
    }
  }

  // 5. EVALUATE READY FOR BILLING (Realization completed, no invoice issued)
  const completedOrdersWithoutInvoice = await prisma.crmOrder.findMany({
    where: {
      organizationId,
      status: { in: ['CONFIRMED', 'IN_REALIZATION', 'ACTIVE', 'COMPLETED'] },
      realizations: {
        some: { status: 'COMPLETED' },
        every: { status: { in: ['COMPLETED', 'DELIVERED_TO_CLIENT'] } },
      },
      clientInvoices: {
        none: {},
      },
    },
    include: {
      client: { select: { id: true, name: true } },
    },
    take: 10,
  });

  for (const order of completedOrdersWithoutInvoice) {
    if (!order.client) continue;
    const orderPrice = Number(order.totalPrice || 0);
    const whyReason = `Zakázka č. ${order.orderNumber} (${order.title}) je realizačně dokončena, ale nebyla ještě vystavena faktura.`;

    const nextBestAction: CrmNextBestAction = {
      id: `nba-bill-${order.id}`,
      organizationId,
      clientId: order.client.id,
      clientName: order.client.name,
      actionType: 'READY_FOR_BILLING',
      priority: 'HIGH',
      score: 80,
      scoreBreakdown: {
        urgencyScore: 25,
        valueScore: 30,
        relationshipScore: 15,
        timeSensitivityScore: 10,
        totalScore: 80,
        explanation: whyReason,
      },
      title: `Vystavit fakturu za zakázku: ${order.orderNumber}`,
      description: `Všechny montáže a realizace u zakázky jsou hotové. Vystavte klientskou fakturu na částku ${orderPrice.toLocaleString('cs-CZ')} Kč.`,
      targetEntityType: 'CRM_ORDER',
      targetEntityId: order.id,
      suggestedCta: {
        label: 'Přejít k fakturaci',
        href: `/clients/${order.client.id}?tab=invoices&orderId=${order.id}`,
      },
      recommendedAt: now,
    };

    items.push({
      id: `att-bill-${order.id}`,
      organizationId,
      clientId: order.client.id,
      clientName: order.client.name,
      insightType: 'READY_FOR_BILLING',
      priority: 'HIGH',
      priorityScore: 80,
      whyOnTopReason: whyReason,
      title: `Připraveno k fakturaci: ${order.client.name}`,
      detail: `Zakázka ${order.orderNumber} – realizace hotová`,
      associatedValueCz: orderPrice,
      nextBestAction,
      detectedAt: order.updatedAt,
    });
  }

  // 6. EVALUATE DRAFT OFFERS WAITING FOR SALES REVIEW (> 24 hours)
  const draftCutoff = new Date(now.getTime() - 86400000);
  const draftOffers = await prisma.offer.findMany({
    where: {
      organizationId,
      status: 'DRAFT',
      createdAt: { lte: draftCutoff },
      archivedAt: null,
      ...(userId ? { createdByUserId: userId } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
    },
    take: 10,
  });

  for (const draft of draftOffers) {
    if (!draft.client) continue;
    const whyReason = `Koncept nabídky „${draft.title}“ čeká na kontrolu a odeslání déle než 24 hodin.`;

    const nextBestAction: CrmNextBestAction = {
      id: `nba-draft-${draft.id}`,
      organizationId,
      clientId: draft.client.id,
      clientName: draft.client.name,
      actionType: 'REVIEW_AND_SEND_OFFER',
      priority: 'MEDIUM',
      score: 65,
      scoreBreakdown: {
        urgencyScore: 15,
        valueScore: 25,
        relationshipScore: 15,
        timeSensitivityScore: 10,
        totalScore: 65,
        explanation: whyReason,
      },
      title: `Zkontrolovat a odeslat nabídku: ${draft.title}`,
      description: 'Zkontrolujte položky nabídky a odešlete ji klientovi.',
      targetEntityType: 'OFFER',
      targetEntityId: draft.id,
      suggestedCta: {
        label: 'Zkontrolovat draft',
        href: `/offers/${draft.id}`,
      },
      recommendedAt: now,
    };

    items.push({
      id: `att-draft-${draft.id}`,
      organizationId,
      clientId: draft.client.id,
      clientName: draft.client.name,
      insightType: 'OFFER_WAITING_FOR_REVIEW',
      priority: 'MEDIUM',
      priorityScore: 65,
      whyOnTopReason: whyReason,
      title: `Draft nabídky čeká na odeslání: ${draft.client.name}`,
      detail: draft.title,
      associatedValueCz: Number(draft.totalPrice || 0),
      nextBestAction,
      detectedAt: draft.createdAt,
    });
  }

  // 7. EVALUATE OVERDUE CRM TASKS
  const overdueTasks = await prisma.crmTask.findMany({
    where: {
      organizationId,
      status: { notIn: ['DONE', 'CANCELLED'] },
      dueDate: { lt: now },
      ...(userId ? { assignedUserId: userId } : {}),
    },
    include: {
      client: { select: { id: true, name: true } },
    },
    take: 10,
  });

  for (const task of overdueTasks) {
    if (!task.client) continue;
    const whyReason = `Úkol „${task.title}“ měl termín splnění ${task.dueDate.toLocaleDateString('cs-CZ')}.`;

    const nextBestAction: CrmNextBestAction = {
      id: `nba-task-${task.id}`,
      organizationId,
      clientId: task.client.id,
      clientName: task.client.name,
      actionType: 'RESOLVE_OVERDUE_TASK',
      priority: 'HIGH',
      score: 76,
      scoreBreakdown: {
        urgencyScore: 30,
        valueScore: 15,
        relationshipScore: 15,
        timeSensitivityScore: 16,
        totalScore: 76,
        explanation: whyReason,
      },
      title: `Splnit úkol po termínu: ${task.title}`,
      description: task.description || 'Úkol u klienta překročil plánovaný termín realizace.',
      targetEntityType: 'CRM_TASK',
      targetEntityId: task.id,
      suggestedCta: {
        label: 'Přejít na úkol',
        href: `/clients/${task.client.id}?tab=tasks`,
      },
      recommendedAt: now,
    };

    items.push({
      id: `att-task-${task.id}`,
      organizationId,
      clientId: task.client.id,
      clientName: task.client.name,
      insightType: 'OVERDUE_TASK',
      priority: 'HIGH',
      priorityScore: 76,
      whyOnTopReason: whyReason,
      title: `Úkol po termínu: ${task.client.name}`,
      detail: task.title,
      nextBestAction,
      detectedAt: task.dueDate,
    });
  }

  // Sort strictly by priorityScore descending (URGENT/CRITICAL > HIGH > MEDIUM > LOW)
  items.sort((a, b) => b.priorityScore - a.priorityScore);

  // Deduplicate by target entity to prevent spammy alerts
  const seenTargets = new Set<string>();
  const deduplicatedItems: CrmAttentionItem[] = [];

  for (const item of items) {
    const key = `${item.nextBestAction.targetEntityType}:${item.nextBestAction.targetEntityId}:${item.insightType}`;
    if (!seenTargets.has(key)) {
      seenTargets.add(key);
      deduplicatedItems.push(item);
    }
  }

  return deduplicatedItems;
}

/**
 * Returns complete pipeline intelligence metrics for dashboard view.
 */
export async function getPipelineIntelligence(
  organizationId: string,
  userId?: string
): Promise<PipelineIntelligenceSummary> {
  const attentionItems = await getMyAttentionItems(organizationId, userId);

  const followUpsDueCount = attentionItems.filter((i) => i.insightType === 'FOLLOW_UP_DUE').length;
  const renewalOpportunitiesCount = attentionItems.filter((i) => i.insightType === 'RENEWAL_OPPORTUNITY').length;
  const upsellOpportunitiesCount = attentionItems.filter((i) => i.insightType === 'UPSELL_OPPORTUNITY').length;
  const stalledDealsCount = attentionItems.filter((i) => i.insightType === 'STALLED_OPPORTUNITY').length;
  const realizationRisksCount = attentionItems.filter((i) => i.insightType === 'REALIZATION_RISK').length;
  const readyForBillingCount = attentionItems.filter((i) => i.insightType === 'READY_FOR_BILLING').length;
  const overdueTasksCount = attentionItems.filter((i) => i.insightType === 'OVERDUE_TASK').length;
  const inactiveClientsCount = attentionItems.filter((i) => i.insightType === 'CLIENT_INACTIVE').length;

  const totalAttentionValueCz = attentionItems.reduce(
    (sum, item) => sum + (item.associatedValueCz || 0),
    0
  );

  return {
    attentionItems,
    followUpsDueCount,
    renewalOpportunitiesCount,
    upsellOpportunitiesCount,
    stalledDealsCount,
    realizationRisksCount,
    readyForBillingCount,
    inactiveClientsCount,
    overdueTasksCount,
    totalAttentionValueCz,
  };
}

/**
 * Returns client intelligence & Next Best Actions for a single client.
 */
export async function getClientIntelligence(clientId: string, organizationId: string) {
  return getClient360(clientId, organizationId);
}
