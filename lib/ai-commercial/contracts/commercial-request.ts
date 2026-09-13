export type CommercialRequestSource =
  | 'AI_MAILBOX'
  | 'SALES_RADAR'
  | 'OCCUPANCY_RENEWAL'
  | 'MANUAL'
  | 'CRM'
  | 'WEBSITE'
  | 'IMPORT';

export type DatesClarity = 'EXACT' | 'APPROXIMATE' | 'UNSPECIFIED';

export type CommercialRequestStatus =
  | 'NEW'
  | 'NEEDS_MORE_INFORMATION'
  | 'READY_FOR_AVAILABILITY'
  | 'AVAILABILITY_CHECKED'
  | 'OFFER_DRAFTED'
  | 'CONVERTED'
  | 'DISMISSED';

export type CommercialRequest = {
  /** Strict multi-tenant isolation */
  organizationId: string;

  /** Unique identifier of the commercial request */
  id: string;

  /** Origin of the commercial demand */
  source: CommercialRequestSource;

  /** Stable reference to the source entity (e.g. AiInboxMessage.id or SalesOpportunity.id) */
  sourceReference: {
    type: string;
    id: string;
    threadId?: string | null;
  };

  /** Matched or existing client ID in CRM */
  clientId?: string | null;

  /** Matched or existing contact ID in CRM */
  contactId?: string | null;

  /** Company or prospect name */
  companyName?: string | null;

  /** Contact person details */
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;

  /** Geographic targets */
  cities: string[];
  regions: string[];
  targetAddress?: string | null;

  /** Campaign timing - strictly verified without hallucinating */
  dateFrom: Date | null;
  dateTo: Date | null;
  datesClarity: DatesClarity;
  rawDateDescription?: string | null;

  /** Requested media types (e.g. BILLBOARD, BIGBOARD, NAVIGATION_SIGN, CITYLIGHT) */
  mediaTypes: string[];

  /** Volume of requested inventory */
  quantity?: {
    min?: number | null;
    max?: number | null;
    exact?: number | null;
  } | null;

  /** Budget if explicitly mentioned */
  budget?: {
    min?: number | null;
    max?: number | null;
    exact?: number | null;
    currency?: string;
  } | null;

  /** Specific client notes or requirements */
  campaignTitle?: string | null;
  notes?: string | null;
  specificRequirements?: string[];

  /** Missing required information that blocks automated offer generation */
  missingRequirements: string[];

  /** Current commercial lifecycle status */
  status: CommercialRequestStatus;

  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
};
