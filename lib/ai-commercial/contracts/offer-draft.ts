export type OfferDraftInput = {
  /** Strict multi-tenant isolation */
  organizationId: string;

  /** Identified client in CRM (optional if prospect name is given) */
  clientId?: string;
  clientName?: string;
  contactId?: string;

  /** Campaign dates */
  dateFrom?: Date;
  dateTo?: Date;

  /** Requested media types */
  requestedMediaTypes?: string[];

  /** Strictly selected surfaces to include in the draft */
  selectedSurfaceIds: string[];

  /** Campaign and branding information */
  campaignName?: string;
  notes?: string;

  /** Traceability references */
  sourceOpportunityId?: string;
  sourceCommercialRequestId?: string;
};

export type OfferDraftResult = {
  success: boolean;

  /** ID of created draft offer */
  offerId?: string;

  /** Generated title */
  offerTitle?: string;

  /** Total price if calculated */
  totalPrice?: number;

  /** Number of included surfaces */
  surfaceCount: number;

  /** Whether all surfaces were confirmed available in the canonical engine */
  availabilityConfirmed: boolean;

  /** Whether hard or soft conflicts were detected during generation */
  conflictsDetected: boolean;

  /** Detailed collision warnings if any were discovered */
  conflictDetails?: string[];

  /** General warnings */
  warnings?: string[];
};
