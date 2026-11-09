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
      take: 20,
    });

    // Group blocked realizations by crmOrderId to avoid multi-surface alert spam
    const blockedByOrder = new Map<string, typeof blockedRealizations>();
    for (const r of blockedRealizations) {
      if (!r.crmOrder?.client) continue;
      const existing = blockedByOrder.get(r.crmOrderId);
      if (existing) {
        existing.push(r);
      } else {
        blockedByOrder.set(r.crmOrderId, [r]);
      }
    }

    for (const [orderId, group] of blockedByOrder) {
      const primary = group[0];
      const client = primary.crmOrder.client!;
      const surfaceCount = group.length;
      const notes = group.map((g) => g.claimNote).filter(Boolean) as string[];
      const uniqueNotes = Array.from(new Set(notes));
      const reasonDetail = uniqueNotes.length > 0 ? ` (${uniqueNotes.join('; ')})` : '';
      const surfaceLabel = surfaceCount === 1 ? '1 plocha' : surfaceCount < 5 ? `${surfaceCount} plochy` : `${surfaceCount} ploch`;
      const whyReason = `Realizace zakázky č. ${primary.crmOrder.orderNumber} je blokována na ${surfaceLabel}${reasonDetail}. Hrozí nedodržení termínu kampaně.`;

      const nextBestAction: CrmNextBestAction = {
        id: `nba-risk-${orderId}`,
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
        description: uniqueNotes.join('; ') || 'Realizace čeká na dodání tiskových podkladů nebo vyřešení reklamace.',
        targetEntityType: 'CRM_ORDER',
        targetEntityId: orderId,
        suggestedCta: {
          label: 'Otevřít realizaci',
          href: `/work?orderId=${orderId}`,
        },
        recommendedAt: now,
      };

      items.push({
        id: `att-risk-${orderId}`,
        organizationId,
        clientId: client.id,
        clientName: client.name,
        insightType: 'REALIZATION_RISK',
        priority: 'CRITICAL',
        priorityScore: 98,
        whyOnTopReason: 'Kritické riziko: Realizace je blokována a ohrožuje spuštění kampaně.',
        title: `Blokovaná realizace (${surfaceLabel}): ${client.name}`,
        detail: whyReason,
        associatedValueCz: Number(primary.crmOrder.totalPrice || 0),
        nextBestAction,
        detectedAt: primary.updatedAt,
        metadata: {
          surfaceCount,
          blockedRealizationIds: group.map((g) => g.id),
        },
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

  // 3. EVALUATE RENEWALS (Campaigns ending within renewalWarningDays or recently ended)
  if (profile.enableRenewalInsights) {
    const warningDays = profile.renewalWarningDays || 30;
    const warningDate = new Date(now.getTime() + warningDays * 86400000);
    const pastWarningDate = new Date(now.getTime() - warningDays * 86400000);

    const relevantOccupancies = await prisma.occupancy.findMany({
      where: {
        organizationId,
        status: { in: ['OCCUPIED', 'FINISHED'] },
        dateTo: {
          gte: pastWarningDate,
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
      orderBy: {
        dateTo: 'desc',
      },
      take: 60,
    });

    // Group occupancies by client and campaign name so that multiple benches/surfaces for the same client
    // are unified into a single high-value opportunity card instead of spamming identical rows.
    const campaignGroups = new Map<string, typeof relevantOccupancies>();

    for (const occ of relevantOccupancies) {
      if (!occ.client) continue;
      const rawName = (occ.campaignName || '').trim();
      const normalizedCampaignName = rawName.toLowerCase();
      const isGenericName = !normalizedCampaignName || normalizedCampaignName === 'bez názvu' || normalizedCampaignName === '-';

      const groupKey = !isGenericName
        ? `${occ.clientId}:camp:${normalizedCampaignName}`
        : occ.offerId
          ? `${occ.clientId}:offer:${occ.offerId}`
          : `${occ.clientId}:occ:${occ.id}`;

      const existing = campaignGroups.get(groupKey);
      if (existing) {
        existing.push(occ);
      } else {
        campaignGroups.set(groupKey, [occ]);
      }
    }

    for (const [, group] of campaignGroups) {
      const primaryOcc = group[0];
      const client = primaryOcc.client;
      if (!client) continue;

      const campaignName = (primaryOcc.campaignName || '').trim() || 'Kampaň bez názvu';
      const surfaceCount = group.length;
      const totalPrice = group.reduce((sum, o) => sum + Number(o.price || 0), 0);

      // Determine latest dateTo in group
      let maxDateTo = group[0].dateTo;
      let newestOcc = group[0];
      for (const o of group) {
        if (o.dateTo.getTime() > maxDateTo.getTime()) {
          maxDateTo = o.dateTo;
          newestOcc = o;
        }
      }

      // Collect distinct carrier cities
      const citiesSet = new Set<string>();
      for (const o of group) {
        if (o.surface?.carrier?.city) {
          citiesSet.add(o.surface.carrier.city.trim());
        }
      }
      const cities = Array.from(citiesSet);
      const citiesLabel = cities.length > 0 ? cities.slice(0, 3).join(', ') + (cities.length > 3 ? ' a další' : '') : null;

      const surfacePlural = surfaceCount === 1
        ? '1 plocha/lavička'
        : surfaceCount < 5
          ? `${surfaceCount} plochy/lavičky`
          : `${surfaceCount} ploch/laviček`;

      const daysRemaining = Math.ceil((maxDateTo.getTime() - now.getTime()) / 86400000);
      const isEnded = daysRemaining < 0;
      const daysPast = isEnded ? Math.abs(daysRemaining) : 0;

      let score: number;
      let priority: CrmInsightPriority;
      let title: string;
      let detail: string;
      let whyReason: string;
      let nbaTitle: string;
      let nbaDesc: string;

      if (isEnded) {
        const isRecentlyEnded = daysPast <= 14;
        score = isRecentlyEnded ? 84 : 70;
        priority = isRecentlyEnded ? 'HIGH' : 'MEDIUM';

        title = `Obnova skončené kampaně: ${client.name}`;
        const daysLabel = daysPast === 1 ? 'před 1 dnem' : `před ${daysPast} dny`;
        detail = `${campaignName} (${surfacePlural}) – skončila ${daysLabel}${citiesLabel ? ` · ${citiesLabel}` : ''}`;
        whyReason = `Kampaň „${campaignName}“ (${surfacePlural}${citiesLabel ? `, ${citiesLabel}` : ''}) skončila ${daysLabel}. Kontaktujte klienta s nabídkou na obnovení dříve, než plochy obsadí konkurence.`;
        nbaTitle = `Předjednat obnovení: ${client.name}`;
        nbaDesc = `Kampaň na ${surfacePlural} je ukončená (${daysLabel}). Ověřte dostupnost ploch a nabídněte klientovi další období.`;
      } else {
        const isUrgent = daysRemaining <= 10;
        score = isUrgent ? 86 : 69;
        priority = isUrgent ? 'HIGH' : 'MEDIUM';

        title = `Prodloužení kampaně (renewal): ${client.name}`;
        const daysLabel = daysRemaining === 0 ? 'končí dnes' : daysRemaining === 1 ? 'končí zítra' : `končí za ${daysRemaining} dní`;
        detail = `${campaignName} (${surfacePlural}) – ${daysLabel}${citiesLabel ? ` · ${citiesLabel}` : ''}`;
        whyReason = `Kampaň „${campaignName}“ (${surfacePlural}${citiesLabel ? `, ${citiesLabel}` : ''}) ${daysLabel}. Připravte včas renewal nabídku, než plochy zarezervuje jiný zájemce.`;
        nbaTitle = `Předjednat prodloužení: ${client.name}`;
        nbaDesc = `${surfacePlural} budou ${daysLabel} volné. Kontaktujte klienta ohledně pokračování dříve, než plochy zarezervuje někdo jiný.`;
      }

      const nextBestAction: CrmNextBestAction = {
        id: `nba-ren-${newestOcc.id}`,
        organizationId,
        clientId: client.id,
        clientName: client.name,
        actionType: 'PREPARE_RENEWAL',
        priority,
        score,
        scoreBreakdown: {
          urgencyScore: isEnded ? (daysPast <= 14 ? 30 : 18) : (daysRemaining <= 10 ? 30 : 15),
          valueScore: totalPrice > 50000 ? 30 : 25,
          relationshipScore: 20,
          timeSensitivityScore: 11,
          totalScore: score,
          explanation: whyReason,
        },
        title: nbaTitle,
        description: nbaDesc,
        targetEntityType: 'OCCUPANCY',
        targetEntityId: newestOcc.id,
        suggestedCta: {
          label: isEnded ? 'Vytvořit nabídku obnovení' : 'Vytvořit renewal nabídku',
          href: `/offers/new?clientId=${client.id}&renewalCampaignId=${newestOcc.id}`,
        },
        recommendedAt: now,
      };

      items.push({
        id: `att-ren-${newestOcc.id}`,
        organizationId,
        clientId: client.id,
        clientName: client.name,
        insightType: 'RENEWAL_OPPORTUNITY',
        priority,
        priorityScore: score,
        whyOnTopReason: whyReason,
        title,
        detail,
        associatedValueCz: totalPrice,
        nextBestAction,
        detectedAt: maxDateTo,
        metadata: {
          surfaceCount,
          isEnded,
          daysRemaining: isEnded ? 0 : daysRemaining,
          daysPast,
          carrierCities: cities,
          campaignName,
          occupancyIds: group.map((o) => o.id),
        },
      });
    }
  }

  // 4. EVALUATE RADAR UPSELL / EXPANSION ON EXISTING CLIENTS
  if (profile.enableRadarClientInsights) {
    const radarOpportunities = await prisma.salesOpportunity.findMany({
      where: {
      mergedIntoId: null,
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
