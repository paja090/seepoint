/**
 * AI Commercial Orchestrator V1 — Contracts & Types
 *
 * Orchestrator je ŘÍDICÍ A PROPOJOVACÍ VRSTVA.
 * NEOBSAHUJE business logiku jednotlivých modulů.
 * Pouze odpovídá: "CO SE MÁ STÁT DÁL?"
 */

import type { CommercialRequest } from '@/lib/ai-commercial/contracts/commercial-request';
import type { AvailabilityResult } from '@/lib/ai-commercial/contracts/availability';
import type { CommercialNextBestAction } from '@/lib/ai-commercial/contracts/next-best-action';
import type { OfferDraftResult } from '@/lib/ai-commercial/contracts/offer-draft';

// ---------------------------------------------------------------------------
// Automation Level
// ---------------------------------------------------------------------------

/** Úroveň automatizace orchestrátoru per tenant */
export type AutomationLevel = 'ASSISTED' | 'SEMI_AUTOMATIC' | 'ADVANCED';

/**
 * SEMI_AUTOMATIC (výchozí):
 *   SMÍ automaticky: analyzovat email, vytvořit CommercialRequest, kontrolovat dostupnost,
 *                     připravit Offer DRAFT, vypočítat Next Best Action
 *   NESMÍ automaticky: odeslat nabídku, změnit cenu, rezervovat plochu mimo schvalovací workflow,
 *                      kontaktovat klienta, vystavit/odeslat fakturu
 */

// ---------------------------------------------------------------------------
// Orchestration Run
// ---------------------------------------------------------------------------

export type CommercialRunTrigger =
  | 'MAILBOX'
  | 'RADAR'
  | 'OFFER_ACCEPTED'
  | 'RENEWAL'
  | 'MANUAL';

export type CommercialRunStatus =
  | 'STARTED'
  | 'ANALYZING'
  | 'AVAILABILITY_CHECK'
  | 'OFFER_DRAFTING'
  | 'COMPLETED'
  | 'NEEDS_INFORMATION'
  | 'BLOCKED'
  | 'FAILED';

export type CommercialRunStepStatus = 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'BLOCKED';

export type CommercialRunStep = {
  step: string;
  status: CommercialRunStepStatus;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  timestamp: Date;
};

export type CorrelationChain = {
  correlationId: string;
  inboxMessageId?: string;
  salesOpportunityId?: string;
  commercialRequestId?: string;
  availabilityCheckedAt?: Date;
  offerId?: string;
  crmOrderId?: string;
  realizationIds?: string[];
};

export type CommercialRun = {
  /** Unique correlation ID pro celý orchestrační run */
  id: string;

  /** Multi-tenant isolation */
  organizationId: string;

  /** Typ triggeru, který run spustil */
  triggerType: CommercialRunTrigger;

  /** ID entity, která run vyvolala */
  triggerEntityId: string;

  /** Aktuální stav orchestrace */
  status: CommercialRunStatus;

  /** Úroveň automatizace */
  automationLevel: AutomationLevel;

  /** Kroky orchestrace — zachovány i při chybě */
  steps: CommercialRunStep[];

  /** Výsledky orchestrace */
  commercialRequest?: CommercialRequest;
  availabilityResult?: AvailabilityResult;
  offerDraftResult?: OfferDraftResult;
  nextBestActions: CommercialNextBestAction[];

  /** Correlation chain pro traceability */
  correlationChain: CorrelationChain;

  /** Chybová zpráva pokud run selhal */
  error?: string;

  /** Timestamps */
  startedAt: Date;
  completedAt?: Date;
};

// ---------------------------------------------------------------------------
// Commercial Timeline
// ---------------------------------------------------------------------------

export type TimelineEntryType =
  | 'EMAIL_RECEIVED'
  | 'EMAIL_ANALYZED'
  | 'COMMERCIAL_REQUEST_CREATED'
  | 'AVAILABILITY_CHECKED'
  | 'OFFER_DRAFT_CREATED'
  | 'OFFER_SENT'
  | 'OFFER_ACCEPTED'
  | 'OFFER_REJECTED'
  | 'OFFER_EXPIRED'
  | 'ORDER_CREATED'
  | 'REALIZATION_STARTED'
  | 'REALIZATION_COMPLETED'
  | 'READY_FOR_BILLING'
  | 'RADAR_OPPORTUNITY_DETECTED'
  | 'STATUS_CHANGED'
  | 'NOTE_ADDED';

export type TimelineEntry = {
  id: string;
  timestamp: Date;
  type: TimelineEntryType;
  actor: string;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Attention / "Co potřebuje moji pozornost"
// ---------------------------------------------------------------------------

export type AttentionCategory =
  | 'MISSING_INFO'
  | 'DRAFT_REVIEW'
  | 'AVAILABILITY_CHANGED'
  | 'REALIZATION_BLOCKED'
  | 'DEADLINE_RISK'
  | 'FOLLOW_UP'
  | 'RENEWAL'
  | 'NEW_OPPORTUNITY';

/** Sjednocená priorita pro orchestrátor — mapuje z CommercialNextBestAction i RealizationNextBestAction */
export type CommercialPriority = 'CRITICAL' | 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AttentionItem = {
  id: string;
  organizationId: string;
  category: AttentionCategory;
  priority: CommercialPriority;
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  link: string;
  createdAt: Date;
  nextBestAction?: CommercialNextBestAction;
};

// ---------------------------------------------------------------------------
// Commercial Center Dashboard
// ---------------------------------------------------------------------------

export type CommercialCenterData = {
  /** Položky vyžadující pozornost */
  attentionItems: AttentionItem[];

  /** Nové poptávky z AI Mailboxu */
  inboxRequests: Array<{
    id: string;
    subject: string;
    fromEmail: string;
    fromName?: string | null;
    clientName?: string | null;
    classification: string;
    receivedAt: Date;
    requiresReview: boolean;
    offerId?: string | null;
  }>;

  /** Příležitosti z Sales Radaru */
  radarOpportunities: Array<{
    id: string;
    companyName: string;
    title: string;
    city?: string | null;
    score: number;
    status: string;
    createdOfferId?: string | null;
    detectedAt: Date;
  }>;

  /** Nabídky v různých stavech */
  offers: {
    drafts: Array<{
      id: string;
      title: string;
      clientName?: string;
      totalPrice?: number;
      createdAt: Date;
    }>;
    sent: Array<{
      id: string;
      title: string;
      clientName?: string;
      totalPrice?: number;
      sentAt?: Date;
      validUntil?: Date;
    }>;
    accepted: Array<{
      id: string;
      title: string;
      clientName?: string;
      totalPrice?: number;
      acceptedAt?: Date;
      hasCrmOrder: boolean;
    }>;
  };

  /** Realizace */
  realizations: {
    active: number;
    risk: number;
    blocked: number;
    readyForBilling: number;
  };

  /** Next Best Actions (centrální resolver) */
  nextBestActions: CommercialNextBestAction[];
};

// ---------------------------------------------------------------------------
// Orchestrator Profile (per-tenant konfigurace)
// ---------------------------------------------------------------------------

export type OrchestratorProfile = {
  automationLevel: AutomationLevel;
  autoAnalyzeEmails: boolean;
  autoCheckAvailability: boolean;
  autoCreateOfferDraft: boolean;
  /** Nikdy automaticky neposílat nabídku */
  autoSendOffer: false;
  /** Nikdy automaticky nefakturovat */
  autoInvoice: false;
};

export const DEFAULT_ORCHESTRATOR_PROFILE: OrchestratorProfile = {
  automationLevel: 'SEMI_AUTOMATIC',
  autoAnalyzeEmails: true,
  autoCheckAvailability: true,
  autoCreateOfferDraft: true,
  autoSendOffer: false,
  autoInvoice: false,
};
