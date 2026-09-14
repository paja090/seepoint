/**
 * AI CRM Intelligence — Canonical Client 360 Service
 *
 * Aggregates all CRM and commercial dimensions into a single unified
 * Client 360 object without creating any duplicate source of truth.
 *
 * Strict multi-tenant isolation by organizationId.
 */

import { prisma } from '@/lib/db';
import type {
  Client360Data,
  ClientRelationshipHealth,
  ClientRelationshipSummary,
  CrmNextBestAction,
  CrmInsightType,
  CrmInsightPriority,
} from './contracts/types';
import { getOrganizationCrmProfile } from './crm-profile';

/**
 * Returns a canonical 360-degree view of a client across identity, business,
 * campaigns, realization, finance, communication, and actionable intelligence.
 */
export async function getClient360(
  clientId: string,
  organizationId: string
): Promise<Client360Data | null> {
  const profile = await getOrganizationCrmProfile(organizationId);

  // 1. Fetch Client Identity & Contacts
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      organizationId,
    },
    include: {
      contacts: {
        where: { active: true },
        orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }],
      },
      branches: {
        where: { active: true },
        orderBy: { name: 'asc' },
      },
      assignedUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!client) {
    return null;
  }

  const now = new Date();

  // 2. Fetch Offers
  const offers = await prisma.offer.findMany({
    where: {
      clientId,
      organizationId,
      archivedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      totalPrice: true,
      sentAt: true,
      acceptedAt: true,
      validUntil: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // 3. Fetch Occupancies / Campaigns
  const occupancies = await prisma.occupancy.findMany({
    where: {
      clientId,
      organizationId,
      status: { in: ['RESERVED', 'OCCUPIED', 'NEGOTIATION'] },
    },
    include: {
      surface: {
        include: {
          carrier: {
            select: { name: true, city: true },
          },
        },
      },
    },
    orderBy: { dateTo: 'asc' },
  });

  // 4. Fetch Sales Opportunities (Radar / Leads)
  const opportunities = await prisma.salesOpportunity.findMany({
    where: {
      clientId,
      organizationId,
      status: { notIn: ['DISMISSED', 'CONVERTED'] },
    },
    orderBy: { opportunityScore: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      opportunityScore: true,
      city: true,
      detectedAt: true,
    },
  });

  // 5. Fetch Realizations via CRM Orders
  const crmOrders = await prisma.crmOrder.findMany({
    where: {
      clientId,
      organizationId,
    },
    include: {
      realizations: {
        include: {
          carrier: { select: { name: true } },
        },
      },
    },
  });

  // 6. Fetch Invoices
  const invoices = await prisma.clientInvoice.findMany({
    where: {
      clientId,
      organizationId,
      status: { not: 'CANCELLED' },
    },
    orderBy: { issueDate: 'desc' },
  });

  // 7. Fetch Recent Communication (Mailbox & Phone/Meetings)
  const [inboxMessages, crmCommunications] = await Promise.all([
    prisma.aiInboxMessage.findMany({
      where: {
        clientId,
        organizationId,
      },
      orderBy: { receivedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        subject: true,
        fromEmail: true,
        receivedAt: true,
        classification: true,
        processingStatus: true,
        textBody: true,
      },
    }),
    prisma.clientCommunication.findMany({
      where: {
        clientId,
        organizationId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        subject: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    }),
  ]);

  // 8. Fetch Tasks
  const tasks = await prisma.crmTask.findMany({
    where: {
      clientId,
      organizationId,
      status: { notIn: ['DONE', 'CANCELLED'] },
    },
    orderBy: { dueDate: 'asc' },
  });

  // -------------------------------------------------------------------------
  // Aggregations & Metrics Calculation
  // -------------------------------------------------------------------------

  // Business
  const activeOffers = offers.filter((o) => o.status === 'SENT' || o.status === 'DRAFT');
  const acceptedOffers = offers.filter((o) => o.status === 'ACCEPTED');
  const activeOffersValueCz = activeOffers.reduce((sum, o) => sum + Number(o.totalPrice || 0), 0);
  const acceptedOffersValueCz = acceptedOffers.reduce((sum, o) => sum + Number(o.totalPrice || 0), 0);
  const offeredTotalCz = offers.reduce((sum, o) => sum + Number(o.totalPrice || 0), 0);

  // Campaigns
  const activeCampaigns = occupancies
    .filter((o) => o.dateFrom <= now && o.dateTo >= now && o.status === 'OCCUPIED')
    .map((o) => {
      const daysRemaining = Math.ceil((o.dateTo.getTime() - now.getTime()) / (1000 * 3600 * 24));
      return {
        id: o.id,
        campaignName: o.campaignName,
        dateFrom: o.dateFrom,
        dateTo: o.dateTo,
        surfaceName: `${o.surface?.carrier?.name || 'Nosič'} (${o.surface?.mediaType || 'Plocha'})`,
        carrierCity: o.surface?.carrier?.city || null,
        price: o.price ? Number(o.price) : null,
        status: o.status,
        daysRemaining: Math.max(0, daysRemaining),
      };
    });

  const upcomingCampaignsCount = occupancies.filter((o) => o.dateFrom > now).length;
  const expiringIn30DaysCount = activeCampaigns.filter((c) => c.daysRemaining <= profile.renewalWarningDays).length;

  // Realizations
  const allRealizations = crmOrders.flatMap((order) =>
    order.realizations.map((r) => {
      const isBlocked =
        r.status === 'CLAIM' ||
        Boolean(r.claimNote) ||
        r.status === 'WAITING_FOR_MATERIALS';
      return {
        id: r.id,
        crmOrderId: order.id,
        status: r.status,
        carrierName: r.carrier?.name || null,
        plannedDate: r.plannedDate,
        claimNote: r.claimNote,
        isBlocked,
      };
    })
  );

  const blockedRealizations = allRealizations.filter((r) => r.isBlocked);
  const completedRealizations = allRealizations.filter((r) => r.status === 'COMPLETED');

  // Finance
  const paidInvoices = invoices.filter((i) => i.status === 'PAID');
  const unpaidInvoices = invoices.filter((i) => i.status !== 'PAID');
  const overdueInvoices = unpaidInvoices.filter((i) => i.dueDate < now);

  const invoicedTotalCz = invoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
  const paidTotalCz = paidInvoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
  const unpaidTotalCz = unpaidInvoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
  const overdueTotalCz = overdueInvoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);

  // Communication Dates
  const lastInboundMsg = inboxMessages[0];
  const lastInboundDate = lastInboundMsg ? lastInboundMsg.receivedAt : null;
  const lastCommDate = crmCommunications[0] ? crmCommunications[0].createdAt : null;
  const lastContactDate = [lastInboundDate, lastCommDate, client.lastActivityAt]
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  const daysSinceLastContact = lastContactDate
    ? Math.max(0, Math.floor((now.getTime() - lastContactDate.getTime()) / (1000 * 3600 * 24)))
    : null;

  const unansweredInbounds = inboxMessages.filter(
    (m) => m.processingStatus === 'REVIEW_REQUIRED' || m.processingStatus === 'READY' || m.processingStatus === 'ANALYZING'
  );

  // Tasks
  const overdueTasks = tasks.filter((t) => t.dueDate < now);

  // -------------------------------------------------------------------------
  // Deterministic Relationship Health Evaluation
  // -------------------------------------------------------------------------
  const reasons: string[] = [];
  let status: ClientRelationshipHealth = 'HEALTHY';
  let healthScore = 85;

  if (overdueInvoices.length > 0) {
    status = 'AT_RISK';
    healthScore -= 35;
    reasons.push(`${overdueInvoices.length} po splatnosti faktur v celkové výši ${overdueTotalCz.toLocaleString('cs-CZ')} Kč.`);
  }

  if (blockedRealizations.length > 0) {
    if (status !== 'AT_RISK') status = 'ATTENTION';
    healthScore -= 20;
    reasons.push(`${blockedRealizations.length} realizací má hlášený blocker nebo čeká na materiály.`);
  }

  if (activeCampaigns.some((c) => c.daysRemaining <= profile.renewalWarningDays)) {
    if (status === 'HEALTHY') status = 'ATTENTION';
    reasons.push(`Kampaň končí v následujících ${profile.renewalWarningDays} dnech (vhodné pro renewal).`);
  }

  const waitingOffer = offers.find(
    (o) => o.status === 'SENT' && o.sentAt && Math.floor((now.getTime() - o.sentAt.getTime()) / (1000 * 3600 * 24)) >= profile.followUpAfterDays
  );
  if (waitingOffer) {
    if (status === 'HEALTHY') status = 'ATTENTION';
    reasons.push(`Odeslaná nabídka „${waitingOffer.title}“ čeká na odpověď déle než ${profile.followUpAfterDays} dní.`);
  }

  if (daysSinceLastContact !== null && daysSinceLastContact > profile.inactiveClientDays && activeCampaigns.length === 0 && activeOffers.length === 0) {
    status = 'INACTIVE';
    healthScore = Math.min(healthScore, 30);
    reasons.push(`Klient je bez interakce více než ${profile.inactiveClientDays} dní.`);
  }

  if (reasons.length === 0) {
    reasons.push('Všechny kampaně, nabídky i platby probíhají bez zaznamenaných rizik.');
  }

  const relationship: ClientRelationshipSummary = {
    status,
    healthScore: Math.max(0, Math.min(100, healthScore)),
    reasons,
    lastContactDate,
    daysSinceLastContact,
    lastContactChannel: lastInboundMsg ? 'E-mail' : lastCommDate ? 'Telefon / Schůzka' : null,
    unresolvedBlockerCount: blockedRealizations.length,
    overdueInvoiceCount: overdueInvoices.length,
    activeCampaignCount: activeCampaigns.length,
    activeOfferValueCz: activeOffersValueCz,
    totalLifetimeBilledCz: invoicedTotalCz,
  };

  // -------------------------------------------------------------------------
  // Next Best Actions for this Client
  // -------------------------------------------------------------------------
  const nextBestActions: CrmNextBestAction[] = [];

  // Priority 1: Realization blocker
  if (blockedRealizations.length > 0) {
    const firstBlocked = blockedRealizations[0];
    nextBestActions.push({
      id: `nba-blocker-${firstBlocked.id}`,
      organizationId,
      clientId: client.id,
      clientName: client.name,
      actionType: 'RESOLVE_REALIZATION_BLOCKER',
      priority: 'URGENT',
      score: 95,
      scoreBreakdown: {
        urgencyScore: 40,
        valueScore: 20,
        relationshipScore: 20,
        timeSensitivityScore: 15,
        totalScore: 95,
        explanation: 'Realizace klienta má aktivní překážku (grafika/tisk/materiál), která ohrožuje termín zahájení.',
      },
      title: `Vyřešit blocker realizace pro ${client.name}`,
      description: firstBlocked.claimNote || 'Realizace čeká na dodání podkladů nebo vyřešení reklamace.',
      targetEntityType: 'CRM_ORDER',
      targetEntityId: firstBlocked.crmOrderId,
      suggestedCta: {
        label: 'Zobrazit zakázku',
        href: `/work?orderId=${firstBlocked.crmOrderId}`,
      },
      recommendedAt: now,
    });
  }

  // Priority 2: Follow-up on waiting sent offer
  if (waitingOffer && waitingOffer.sentAt) {
    const daysWaiting = Math.floor((now.getTime() - waitingOffer.sentAt.getTime()) / (1000 * 3600 * 24));
    const isHighValue = Number(waitingOffer.totalPrice || 0) >= profile.highValueOfferThreshold;
    const priority: CrmInsightPriority = isHighValue ? 'HIGH' : 'MEDIUM';

    nextBestActions.push({
      id: `nba-followup-${waitingOffer.id}`,
      organizationId,
      clientId: client.id,
      clientName: client.name,
      actionType: 'FOLLOW_UP_CLIENT',
      priority,
      score: isHighValue ? 88 : 74,
      scoreBreakdown: {
        urgencyScore: 25,
        valueScore: isHighValue ? 35 : 20,
        relationshipScore: 15,
        timeSensitivityScore: 14,
        totalScore: isHighValue ? 88 : 74,
        explanation: `Nabídka v hodnotě ${Number(waitingOffer.totalPrice || 0).toLocaleString('cs-CZ')} Kč odeslána před ${daysWaiting} dny bez odpovědi.`,
      },
      title: `Follow-up nabídky: ${waitingOffer.title}`,
      description: `Klient obdržel nabídku před ${daysWaiting} dny. Doporučeno kontaktovat klienta a ověřit stav rozhodnutí.`,
      targetEntityType: 'OFFER',
      targetEntityId: waitingOffer.id,
      suggestedCta: {
        label: 'Připravit follow-up',
        href: `/offers/${waitingOffer.id}?action=followup`,
      },
      suggestedPayload: {
        offerId: waitingOffer.id,
        daysWaiting,
        totalPrice: Number(waitingOffer.totalPrice || 0),
      },
      recommendedAt: now,
    });
  }

  // Priority 3: Expiring campaign renewal
  const expiringCampaign = activeCampaigns.find((c) => c.daysRemaining <= profile.renewalWarningDays);
  if (expiringCampaign && profile.enableRenewalInsights) {
    nextBestActions.push({
      id: `nba-renewal-${expiringCampaign.id}`,
      organizationId,
      clientId: client.id,
      clientName: client.name,
      actionType: 'PREPARE_RENEWAL',
      priority: expiringCampaign.daysRemaining <= 14 ? 'HIGH' : 'MEDIUM',
      score: expiringCampaign.daysRemaining <= 14 ? 82 : 68,
      scoreBreakdown: {
        urgencyScore: 20,
        valueScore: 25,
        relationshipScore: 20,
        timeSensitivityScore: expiringCampaign.daysRemaining <= 14 ? 17 : 8,
        totalScore: expiringCampaign.daysRemaining <= 14 ? 82 : 68,
        explanation: `Kampaň „${expiringCampaign.campaignName}“ na ploše ${expiringCampaign.surfaceName} končí za ${expiringCampaign.daysRemaining} dní.`,
      },
      title: `Předjednat prodloužení (renewal): ${expiringCampaign.campaignName}`,
      description: `Plocha ${expiringCampaign.surfaceName} se uvolní za ${expiringCampaign.daysRemaining} dní. Zeptejte se klienta na pokračování dříve, než plochu nabídne systém jinému zájemci.`,
      targetEntityType: 'OCCUPANCY',
      targetEntityId: expiringCampaign.id,
      suggestedCta: {
        label: 'Vytvořit prodloužení',
        href: `/offers/new?clientId=${client.id}&renewalCampaignId=${expiringCampaign.id}`,
      },
      recommendedAt: now,
    });
  }

  // Priority 4: Radar Expansion / Upsell Opportunity
  if (opportunities.length > 0 && profile.enableUpsellInsights) {
    const topOpp = opportunities[0];
    nextBestActions.push({
      id: `nba-upsell-${topOpp.id}`,
      organizationId,
      clientId: client.id,
      clientName: client.name,
      actionType: 'REVIEW_UPSELL_OPPORTUNITY',
      priority: topOpp.opportunityScore >= 75 ? 'HIGH' : 'MEDIUM',
      score: topOpp.opportunityScore,
      scoreBreakdown: {
        urgencyScore: 15,
        valueScore: 30,
        relationshipScore: 20,
        timeSensitivityScore: 15,
        totalScore: topOpp.opportunityScore,
        explanation: `AI Radar zachytil expanzi klienta (${topOpp.title}) se skóre ${topOpp.opportunityScore} b.`,
      },
      title: `Prověřit upsell: ${topOpp.title}`,
      description: `Klient plánuje novou aktivitu v lokalitě ${topOpp.city || 'ČR'}. Jako stávajícímu klientovi můžete nabídnout přednostní plochy.`,
      targetEntityType: 'SALES_OPPORTUNITY',
      targetEntityId: topOpp.id,
      suggestedCta: {
        label: 'Zobrazit příležitost',
        href: `/sales/opportunities?id=${topOpp.id}`,
      },
      recommendedAt: now,
    });
  }

  // Priority 5: Overdue Tasks
  if (overdueTasks.length > 0) {
    const task = overdueTasks[0];
    nextBestActions.push({
      id: `nba-task-${task.id}`,
      organizationId,
      clientId: client.id,
      clientName: client.name,
      actionType: 'RESOLVE_OVERDUE_TASK',
      priority: 'HIGH',
      score: 75,
      scoreBreakdown: {
        urgencyScore: 30,
        valueScore: 15,
        relationshipScore: 15,
        timeSensitivityScore: 15,
        totalScore: 75,
        explanation: `Úkol „${task.title}“ měl termín splnění ${task.dueDate.toLocaleDateString('cs-CZ')}.`,
      },
      title: `Splnit úkol po termínu: ${task.title}`,
      description: task.description || 'Úkol u tohoto klienta překročil plánovaný termín realizace.',
      targetEntityType: 'CRM_TASK',
      targetEntityId: task.id,
      suggestedCta: {
        label: 'Přejít na úkol',
        href: `/clients/${client.id}?tab=tasks`,
      },
      recommendedAt: now,
    });
  }

  // Sort next best actions by totalScore descending
  nextBestActions.sort((a, b) => b.score - a.score);

  // Generate deterministic insights summary
  const insights: Array<{ type: CrmInsightType; priority: CrmInsightPriority; title: string; description: string }> = [];

  if (waitingOffer) {
    insights.push({
      type: 'FOLLOW_UP_DUE',
      priority: 'HIGH',
      title: 'Čeká na follow-up',
      description: `Odeslaná nabídka ${waitingOffer.title} čeká na rozhodnutí.`,
    });
  }

  if (expiringCampaign) {
    insights.push({
      type: 'RENEWAL_OPPORTUNITY',
      priority: 'HIGH',
      title: 'Příležitost k prodloužení kampaně',
      description: `Kampaň končí za ${expiringCampaign.daysRemaining} dní.`,
    });
  }

  if (opportunities.length > 0) {
    insights.push({
      type: 'UPSELL_OPPORTUNITY',
      priority: 'MEDIUM',
      title: 'Radar signal u klienta',
      description: `Zachycena expanze klienta: ${opportunities[0].title}`,
    });
  }

  if (blockedRealizations.length > 0) {
    insights.push({
      type: 'REALIZATION_RISK',
      priority: 'CRITICAL',
      title: 'Riziko na realizaci zakázky',
      description: blockedRealizations[0].claimNote || 'Aktivní překážka v realizaci.',
    });
  }

  return {
    identity: {
      id: client.id,
      organizationId: client.organizationId,
      name: client.name,
      companyId: client.companyId,
      dic: client.dic,
      website: client.website,
      status: client.status,
      clientType: client.clientType,
      pricingSegment: client.pricingSegment,
      rating: client.rating,
      contacts: client.contacts.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        email: c.email,
        phone: c.phone,
        isPrimary: c.isPrimary,
        roleDescription: c.title || (c.isCommercial ? 'Obchodní kontakt' : null),
      })),
      branches: client.branches.map((b) => ({
        id: b.id,
        name: b.name,
        city: b.city,
        street: b.street,
      })),
    },
    business: {
      openOpportunities: opportunities.map((opp) => ({
        id: opp.id,
        title: opp.title,
        status: opp.status,
        score: opp.opportunityScore,
        city: opp.city,
        detectedAt: opp.detectedAt,
      })),
      offers: offers.map((o) => ({
        id: o.id,
        title: o.title,
        status: o.status,
        totalPrice: Number(o.totalPrice || 0),
        sentAt: o.sentAt,
        acceptedAt: o.acceptedAt,
        validUntil: o.validUntil,
        createdAt: o.createdAt,
      })),
      activeOffersCount: activeOffers.length,
      activeOffersValueCz,
      acceptedOffersCount: acceptedOffers.length,
    },
    campaigns: {
      activeCampaigns,
      upcomingCampaignsCount,
      expiringIn30DaysCount,
    },
    realization: {
      activeRealizations: allRealizations,
      blockedCount: blockedRealizations.length,
      completedCount: completedRealizations.length,
    },
    finance: {
      offeredTotalCz,
      acceptedTotalCz: acceptedOffersValueCz,
      invoicedTotalCz,
      paidTotalCz,
      unpaidTotalCz,
      overdueTotalCz,
      overdueInvoicesCount: overdueInvoices.length,
    },
    communication: {
      lastInbound: lastInboundMsg
        ? {
            id: lastInboundMsg.id,
            subject: lastInboundMsg.subject,
            receivedAt: lastInboundMsg.receivedAt,
            fromEmail: lastInboundMsg.fromEmail,
            snippet: lastInboundMsg.textBody?.slice(0, 160) || null,
          }
        : null,
      lastOutboundDate: lastCommDate,
      lastCommercialContactDate: lastContactDate,
      unansweredInboundCount: unansweredInbounds.length,
    },
    tasks: {
      openTasksCount: tasks.length,
      overdueTasksCount: overdueTasks.length,
      upcomingTasks: tasks.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        isOverdue: t.dueDate < now,
      })),
    },
    intelligence: {
      relationship,
      nextBestActions,
      insights,
    },
  };
}
