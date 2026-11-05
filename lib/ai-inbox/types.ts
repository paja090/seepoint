import type {
  AiInboxActionStatus,
  AiInboxActionType,
  AiInboxAttachmentClassification,
  AiInboxClassification,
  AiInboxStatus,
  IntegrationProvider,
} from '@prisma/client';

import type { DatesClarity } from '@/lib/ai-commercial/contracts/commercial-request';

export type {
  AiInboxActionStatus,
  AiInboxActionType,
  AiInboxAttachmentClassification,
  AiInboxClassification,
  AiInboxStatus,
  IntegrationProvider,
};

export type ExtractedCompanyData = {
  name: string;
  tradingName?: string | null;
  ico?: string | null;
  dic?: string | null;
  address?: string | null;
  city?: string | null;
  confidence: number;
};

export type ExtractedContactData = {
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
};

export type ExtractedRequestData = {
  projectType: 'NAVIGATION' | 'STANDARD_MEDIA' | 'CITY_GALLERY' | 'OTHER';
  location?: string | null;
  address?: string | null;
  cities?: string[];
  regions?: string[];
  requestedMediaTypes?: string[];
  requestedQuantity?: {
    min?: number | null;
    max?: number | null;
    exact?: number | null;
  } | null;
  budget?: {
    min?: number | null;
    max?: number | null;
    exact?: number | null;
    currency?: string;
  } | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  datesClarity?: DatesClarity;
  rawDateDescription?: string | null;
  openingDate?: string | null;
  deadline?: string | null;
  specificRequirements?: string[];
  notes?: string | null;
  missingRequirements?: string[];
  evidence?: {
    dateText?: string | null;
    locationText?: string | null;
    quantityText?: string | null;
    budgetText?: string | null;
    mediaTypeText?: string | null;
  } | null;
};

export type DetectedChangeItem = {
  field: string;
  label: string;
  fromValue?: string | number | null;
  toValue: string | number;
  note?: string;
};

export type AiInboxAnalysisResult = {
  classification: AiInboxClassification;
  confidence: number;
  company: ExtractedCompanyData | null;
  contact: ExtractedContactData | null;
  request: ExtractedRequestData | null;
  summary: string;
  reasoningSummary?: string;
  suggestedReply?: string;
  detectedChanges?: DetectedChangeItem[];
  extractedOrderNumber?: string | null;
  extractedClientOrderCode?: string | null;
};

export type RawInboundMessageAttachment = {
  providerAttachmentId?: string;
  filename: string;
  mimeType: string;
  size: number;
  dataBase64?: string;
  fileUrl?: string;
};

export type RawInboundMessage = {
  provider: IntegrationProvider;
  providerMessageId: string;
  providerThreadId?: string | null;
  internetMessageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  fromEmail: string;
  fromName?: string | null;
  toEmails: string[];
  ccEmails?: string[];
  subject: string;
  textBody?: string | null;
  htmlBody?: string | null;
  receivedAt: Date;
  attachments?: RawInboundMessageAttachment[];
};

export type MatchedClientCandidate = {
  id: string;
  name: string;
  companyId?: string | null;
  email?: string | null;
  matchType: 'EXACT_CONTACT_EMAIL' | 'EXACT_COMPANY_EMAIL' | 'DOMAIN_MATCH' | 'COMPANY_ID_MATCH' | 'NORMALIZED_NAME_MATCH' | 'FUZZY_NAME_MATCH';
  confidence: number;
  contactId?: string;
  contactName?: string;
};

export type CandidateOrderSummary = {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  projectType?: string;
  isNavigation?: boolean;
};

export type MatchedEntityResult = {
  client: MatchedClientCandidate | null;
  candidateClients: MatchedClientCandidate[];
  crmOrderId?: string | null;
  orderNumber?: string | null;
  orderTitle?: string | null;
  candidateOrders?: CandidateOrderSummary[];
  offerId?: string | null;
  navigationOrderId?: string | null;
  salesOpportunityId?: string | null;
  matchReason?: string;
};

export type MailboxSyncSettings = {
  syncFilter?: 'ALL' | 'INBOX_ONLY' | 'LABEL_ONLY';
  syncLabel?: string;
  preset?: 'INBOX' | 'ORDERS_ONLY' | 'ALL';
  query?: string;
  maxResults?: number;
  ignoreSpamAndPromotions?: boolean;
  lastSyncAt?: string | null;
  lastHistoryId?: string | null;
  syncError?: string | null;
};

export type UnifiedCommunicationItem = {
  id: string;
  source: 'AI_INBOX_INBOUND' | 'TEAM_REPLY' | 'TEAM_COMMUNICATION';
  type: string;
  senderName: string;
  senderEmail?: string | null;
  recipient?: string | null;
  date: string | Date;
  subject: string;
  content: string;
  aiSummary?: string | null;
  isInternal: boolean;
  isCurrentMessage?: boolean;
  isNewIncoming?: boolean;
  authorName?: string | null;
  classification?: string | null;
  attachmentsCount?: number;
};

export type OrderConversationGroup = {
  key: string;
  type: 'CRM_ORDER' | 'NAVIGATION_ORDER' | 'OFFER' | 'THREAD' | 'CLIENT' | 'UNASSIGNED';
  title: string;
  orderNumber?: string | null;
  status?: string | null;
  projectType?: string | null;
  client?: { id: string; name: string; companyId?: string | null } | null;
  items: Array<{
    id: string;
    fromEmail: string;
    fromName: string | null;
    subject: string;
    receivedAt: string | Date;
    processingStatus: AiInboxStatus;
    classification: AiInboxClassification;
    confidence: number;
    requiresReview: boolean;
    aiSummary: string | null;
    providerThreadId?: string | null;
    integrationConnection?: { accountEmail: string | null; provider: string } | null;
    client?: { id: string; name: string; companyId: string | null } | null;
    crmOrder?: { id: string; orderNumber: string; title: string; status: string } | null;
    offer?: { id: string; title: string; status: string } | null;
    navigationOrder?: { id: string; orderNumber?: string; status: string } | null;
    _count?: { attachments: number; actions: number };
    priorityTier?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'SPAM';
    maxImportanceScore?: number;
  }>;
  messageCount: number;
  attentionCount: number;
  newCount: number;
  hasNewIncoming: boolean;
  latestReceivedAt: string | Date;
  latestAiSummary?: string | null;
  participants: Array<{ name: string; email?: string | null; isTeam?: boolean }>;
  priorityTier?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW' | 'SPAM';
  maxImportanceScore?: number;
};


