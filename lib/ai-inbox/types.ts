import type {
  AiInboxActionStatus,
  AiInboxActionType,
  AiInboxAttachmentClassification,
  AiInboxClassification,
  AiInboxStatus,
  IntegrationProvider,
} from '@prisma/client';

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
  requestedQuantity?: {
    min?: number | null;
    max?: number | null;
    exact?: number | null;
  } | null;
  openingDate?: string | null;
  deadline?: string | null;
  specificRequirements?: string[];
  notes?: string | null;
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
