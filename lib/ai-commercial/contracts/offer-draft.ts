import type { CommercialRequest } from './commercial-request';
import type { AvailabilityResult, AvailableSurfaceMatch } from './availability';
import type { CommercialOpportunityContext } from './commercial-opportunity';
import type { CommercialNextBestAction } from './next-best-action';

export type OfferDraftItemResult = {
  surfaceId: string;
  surfaceName: string;
  carrierCode?: string;
  carrierCity?: string;
  mediaType: string;
  isAlternative: boolean;
  alternativeReason?: string;
  unitPrice: number;
  catalogPrice?: number | null;
  priceSource: 'SURFACE_CATALOG' | 'OFFER_PRICE_RULE' | 'MANUAL';
  priceRuleId?: string | null;
};

export type OfferReviewChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: 'ok' | 'warning' | 'error';
};

export type OfferDraftInput = {
  /** Strict multi-tenant isolation */
  organizationId: string;

  /** Identified client in CRM (optional if prospect name is given) */
  clientId?: string;
  clientName?: string;
  contactId?: string;
  contactEmail?: string;
  contactPhone?: string;

  /** Campaign dates */
  dateFrom?: Date;
  dateTo?: Date;

  /** Requested media types */
  requestedMediaTypes?: string[];

  /** Strictly selected surfaces to include in the draft (optional if using availabilityResult/commercialRequest) */
  selectedSurfaceIds?: string[];

  /** Optional full canonical CommercialRequest input */
  commercialRequest?: CommercialRequest;

  /** Optional canonical AvailabilityResult input from Occupancy Engine */
  availabilityResult?: AvailabilityResult;

  /** Optional CommercialOpportunityContext from Sales Radar or CRM */
  opportunityContext?: CommercialOpportunityContext;

  /** Campaign and branding information */
  campaignName?: string;
  notes?: string;

  /** Whether to automatically incorporate suggested alternatives if requested quantity is unmet */
  includeAlternatives?: boolean;

  /** Desired discount percent (strictly validated against rules, defaults to 0) */
  targetDiscountPercent?: number;

  /** Traceability references */
  sourceOpportunityId?: string;
  sourceCommercialRequestId?: string;
};

export type OfferDraftResult = {
  success: boolean;

  /** ID of created draft offer */
  offerId?: string;

  /** Offer status - always strictly DRAFT */
  status?: 'DRAFT';

  /** Generated title */
  offerTitle?: string;

  /** Total price if calculated */
  totalPrice?: number;

  /** Currency (defaults to CZK) */
  currency?: string;

  /** Number of included surfaces */
  surfaceCount: number;

  /** Number of exact match surfaces */
  exactMatchesCount?: number;

  /** Number of alternative surfaces */
  alternativesCount?: number;

  /** Detailed breakdown of included items */
  items?: OfferDraftItemResult[];

  /** Whether all surfaces were confirmed available in the canonical engine */
  availabilityConfirmed: boolean;

  /** Whether hard or soft conflicts were detected during generation */
  conflictsDetected: boolean;

  /** Detailed collision warnings if any were discovered */
  conflictDetails?: string[];

  /** Suggested alternative surfaces if conflicts or shortages were encountered */
  suggestedAlternatives?: AvailableSurfaceMatch[];

  /** Actionable checklist of items a salesperson must review before sending */
  humanReviewChecklist?: OfferReviewChecklistItem[];

  /** Generated executive summary / pitch copy */
  campaignSummary?: string;

  /** Next best commercial action recommended for this offer */
  nextBestAction?: CommercialNextBestAction;

  /** Source traceability mapping */
  sourceTraceability?: {
    commercialRequestId?: string;
    opportunityId?: string;
    availabilityCheckedAt?: Date;
  };

  /** General warnings */
  warnings?: string[];
};

