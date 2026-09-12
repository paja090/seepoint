export type NextBestActionType =
  | 'COMPLETE_INFORMATION'
  | 'CHECK_AVAILABILITY'
  | 'CREATE_OFFER_DRAFT'
  | 'REVIEW_AND_SEND_OFFER'
  | 'FOLLOW_UP'
  | 'CONFIRM_ORDER'
  | 'RENEWAL_CONTACT'
  | 'DISMISS_OR_ARCHIVE';

export type NextBestActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type CommercialNextBestAction = {
  id: string;

  /** Multi-tenant isolation */
  organizationId: string;

  /** Action classification */
  actionType: NextBestActionType;
  priority: NextBestActionPriority;

  /** Clear Czech title and instructions for the salesperson */
  title: string;
  description: string;

  /** Target entity to act upon */
  targetEntityType:
    | 'COMMERCIAL_REQUEST'
    | 'SALES_OPPORTUNITY'
    | 'OFFER'
    | 'OCCUPANCY';
  targetEntityId: string;

  /** Suggested parameters/payload for the action */
  suggestedPayload?: Record<string, unknown>;

  /** Timestamps */
  recommendedAt: Date;
  dueAt?: Date | null;
};
