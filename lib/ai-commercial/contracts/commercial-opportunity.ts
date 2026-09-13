export type OpportunitySource =
  | 'SALES_RADAR'
  | 'AI_MAILBOX'
  | 'OCCUPANCY_RENEWAL'
  | 'MANUAL'
  | 'WEBSITE'
  | 'EXISTING_CLIENT'
  | 'IMPORT';

export type CommercialOpportunityType =
  | 'NEW_ACQUISITION'
  | 'UPSELL'
  | 'EXPANSION'
  | 'RENEWAL';

export type CommercialOpportunityContext = {
  /** Strict multi-tenant isolation */
  organizationId: string;

  /** Universal opportunity ID */
  opportunityId: string;

  /** Origin of the opportunity */
  source: OpportunitySource;

  /** Type of commercial motion (Upsell/Expansion for existing client, New acquisition for prospect) */
  opportunityType: CommercialOpportunityType;

  /** Existing client ID in CRM if matched */
  clientId?: string | null;

  /** Normalized company name */
  companyName: string;

  /** Company business identifier (IČO) if available */
  companyId?: string | null;

  /** Title and explanation of why this is a good opportunity */
  title: string;
  reason?: string | null;

  /** Geography */
  city?: string | null;
  region?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  /** Timing of the trigger event */
  eventDate?: Date | null;

  /** Commercial score (0-100) */
  score: number;

  /** Recommended media types for this opportunity */
  suggestedMediaTypes: string[];

  /** Source reference details */
  sourceUrl?: string | null;
  sourceTitle?: string | null;

  /** Assigned salesperson */
  assignedToUserId?: string | null;

  /** Timestamps */
  createdAt: Date;
};
