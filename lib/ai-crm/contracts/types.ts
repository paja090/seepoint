/**
 * AI CRM Intelligence — Domain Contracts & Types
 *
 * Provides typed definitions for Client 360, CRM Insights, Next Best Actions,
 * Relationship Health, and Explainable Prioritization.
 *
 * Source of truth remains existing CRM and business records in the database.
 */

export type CrmInsightType =
  | 'FOLLOW_UP_DUE'
  | 'STALLED_OPPORTUNITY'
  | 'MISSING_INFORMATION'
  | 'OFFER_WAITING_FOR_REVIEW'
  | 'OFFER_WAITING_FOR_CLIENT'
  | 'RENEWAL_OPPORTUNITY'
  | 'UPSELL_OPPORTUNITY'
  | 'EXPANSION_OPPORTUNITY'
  | 'REALIZATION_RISK'
  | 'READY_FOR_BILLING'
  | 'OVERDUE_TASK'
  | 'CLIENT_INACTIVE'
  | 'DUPLICATE_OPPORTUNITY';

export type CrmInsightPriority = 'CRITICAL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ClientRelationshipHealth = 'HEALTHY' | 'ATTENTION' | 'AT_RISK' | 'INACTIVE';

export type CrmActionType =
  | 'FOLLOW_UP_CLIENT'
  | 'PREPARE_RENEWAL'
  | 'REVIEW_UPSELL_OPPORTUNITY'
  | 'COMPLETE_INFORMATION'
  | 'CHECK_AVAILABILITY'
  | 'CREATE_OFFER_DRAFT'
  | 'REVIEW_AND_SEND_OFFER'
  | 'START_REALIZATION'
  | 'RESOLVE_REALIZATION_BLOCKER'
  | 'READY_FOR_BILLING'
  | 'RESOLVE_OVERDUE_TASK'
  | 'REENGAGE_CLIENT'
  | 'MERGE_DUPLICATES';

export interface ScoreExplanationBreakdown {
  urgencyScore: number;
  valueScore: number;
  relationshipScore: number;
  timeSensitivityScore: number;
  totalScore: number;
  explanation: string;
}

export interface CrmNextBestAction {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  actionType: CrmActionType;
  priority: CrmInsightPriority;
  score: number;
  scoreBreakdown: ScoreExplanationBreakdown;
  title: string;
  description: string;
  targetEntityType: 'CLIENT' | 'OFFER' | 'OCCUPANCY' | 'SALES_OPPORTUNITY' | 'CRM_ORDER' | 'CRM_TASK' | 'INBOX_MESSAGE';
  targetEntityId: string;
  suggestedCta: {
    label: string;
    href: string;
    actionKey?: string;
  };
  suggestedPayload?: Record<string, unknown>;
  recommendedAt: Date;
}

export interface CrmAttentionItem {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  insightType: CrmInsightType;
  priority: CrmInsightPriority;
  priorityScore: number;
  whyOnTopReason: string;
  title: string;
  detail: string;
  associatedValueCz?: number;
  nextBestAction: CrmNextBestAction;
  detectedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ClientRelationshipSummary {
  status: ClientRelationshipHealth;
  healthScore: number; // 0-100
  reasons: string[];
  lastContactDate?: Date | null;
  daysSinceLastContact?: number | null;
  lastContactChannel?: string | null;
  unresolvedBlockerCount: number;
  overdueInvoiceCount: number;
  activeCampaignCount: number;
  activeOfferValueCz: number;
  totalLifetimeBilledCz: number;
}

export interface Client360Data {
  identity: {
    id: string;
    organizationId: string;
    name: string;
    companyId?: string | null;
    dic?: string | null;
    website?: string | null;
    status: string;
    clientType: string;
    pricingSegment: string;
    rating?: string | null;
    contacts: Array<{
      id: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      isPrimary: boolean;
      roleDescription?: string | null;
    }>;
    branches: Array<{
      id: string;
      name: string;
      city?: string | null;
      street?: string | null;
    }>;
  };
  business: {
    openOpportunities: Array<{
      id: string;
      title: string;
      status: string;
      score: number;
      city?: string | null;
      detectedAt: Date;
    }>;
    offers: Array<{
      id: string;
      title: string;
      status: string;
      totalPrice: number;
      sentAt?: Date | null;
      acceptedAt?: Date | null;
      validUntil?: Date | null;
      createdAt: Date;
    }>;
    activeOffersCount: number;
    activeOffersValueCz: number;
    acceptedOffersCount: number;
  };
  campaigns: {
    activeCampaigns: Array<{
      id: string;
      campaignName: string;
      dateFrom: Date;
      dateTo: Date;
      surfaceName: string;
      carrierCity?: string | null;
      price?: number | null;
      status: string;
      daysRemaining: number;
    }>;
    upcomingCampaignsCount: number;
    expiringIn30DaysCount: number;
  };
  realization: {
    activeRealizations: Array<{
      id: string;
      crmOrderId: string;
      status: string;
      carrierName?: string | null;
      plannedDate?: Date | null;
      claimNote?: string | null;
      isBlocked: boolean;
    }>;
    blockedCount: number;
    completedCount: number;
  };
  finance: {
    offeredTotalCz: number;
    acceptedTotalCz: number;
    invoicedTotalCz: number;
    paidTotalCz: number;
    unpaidTotalCz: number;
    overdueTotalCz: number;
    overdueInvoicesCount: number;
  };
  communication: {
    lastInbound?: {
      id: string;
      subject: string;
      receivedAt: Date;
      fromEmail: string;
      snippet?: string | null;
    } | null;
    lastOutboundDate?: Date | null;
    lastCommercialContactDate?: Date | null;
    unansweredInboundCount: number;
  };
  tasks: {
    openTasksCount: number;
    overdueTasksCount: number;
    upcomingTasks: Array<{
      id: string;
      title: string;
      dueDate: Date;
      priority: string;
      isOverdue: boolean;
    }>;
  };
  intelligence: {
    relationship: ClientRelationshipSummary;
    nextBestActions: CrmNextBestAction[];
    insights: Array<{
      type: CrmInsightType;
      priority: CrmInsightPriority;
      title: string;
      description: string;
    }>;
    aiExplanation?: string;
  };
}

export interface ClientTimelineEvent {
  id: string;
  date: Date;
  eventType:
    | 'RADAR_SIGNAL'
    | 'INBOUND_EMAIL'
    | 'COMMUNICATION'
    | 'OFFER_CREATED'
    | 'OFFER_SENT'
    | 'OFFER_ACCEPTED'
    | 'OFFER_REJECTED'
    | 'REALIZATION_STARTED'
    | 'REALIZATION_BLOCKED'
    | 'REALIZATION_COMPLETED'
    | 'INVOICE_ISSUED'
    | 'INVOICE_PAID';
  title: string;
  description: string;
  sourceEntity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface OrganizationCrmIntelligenceProfileData {
  organizationId: string;
  followUpAfterDays: number;
  stalledOpportunityDays: number;
  inactiveClientDays: number;
  renewalWarningDays: number;
  highValueOfferThreshold: number;
  enableRenewalInsights: boolean;
  enableUpsellInsights: boolean;
  enableRadarClientInsights: boolean;
  enableRealizationRiskInsights: boolean;
}
