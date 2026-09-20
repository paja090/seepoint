import type { CrmOrderStatus, CrmProjectType } from '@prisma/client';

export type RealizationPhase =
  | 'PREPARATION'
  | 'GRAPHICS'
  | 'PRODUCTION'
  | 'INSTALLATION'
  | 'PHOTO_DOCUMENTATION'
  | 'READY_FOR_BILLING'
  | 'INVOICED'
  | 'COMPLETED';

export type RealizationPhotoContext = {
  id: string;
  url: string;
  type: string;
  createdAt: Date;
  surfaceId?: string;
  carrierId?: string;
  crmRealizationId?: string;
  isRelevantForRealization: boolean;
};

export type RealizationItemContext = {
  id: string;
  surfaceId?: string;
  surfaceName?: string;
  carrierId?: string;
  carrierCode?: string;
  carrierCity?: string;
  carrierAddress?: string;
  mediaType?: string;
  status: string;
  isInstalled: boolean;
  isPhotographed: boolean;
  hasDefect: boolean;
  defectReason?: string;
  photos: RealizationPhotoContext[];
  plannedDate?: Date;
  actualDate?: Date;
  assignedUserId?: string;
  assignedUserName?: string;
  note?: string;
};

export type RealizationTaskContext = {
  id: string;
  title: string;
  status: string;
  dueDate?: Date;
  assignedToName?: string;
};

export type RealizationPrintJobContext = {
  id: string;
  title: string;
  status: string;
  formatType?: string;
  materialType?: string;
  quantity: number;
  artworkUrl?: string;
  isApproved: boolean;
  approvedAt?: Date;
  approvedBy?: string;
  deliveredAt?: Date;
  deliveryDeadline?: Date;
};

export type RealizationRequirementCategory =
  | 'GRAPHICS'
  | 'PRODUCTION'
  | 'INSTALLATION'
  | 'PHOTOS'
  | 'BILLING';

export type RealizationRequirementStatus =
  | 'FULFILLED'
  | 'PENDING'
  | 'BLOCKED'
  | 'NOT_APPLICABLE';

export type RealizationRequirement = {
  id: string;
  label: string;
  category: RealizationRequirementCategory;
  status: RealizationRequirementStatus;
  detail?: string;
};

export type RealizationBlockerCode =
  | 'MISSING_GRAPHICS'
  | 'GRAPHICS_NOT_APPROVED'
  | 'PRODUCTION_DELAY'
  | 'INSTALLATION_NOT_ASSIGNED'
  | 'INSTALLATION_DEADLINE_RISK'
  | 'SURFACE_TECHNICAL_ISSUE'
  | 'MISSING_PHOTO_DOCUMENTATION'
  | 'INCOMPLETE_INSTALLATION'
  | 'BILLING_BLOCKED'
  | 'DEPENDENCY_BLOCKED'
  | 'SCOPE_CHANGE_PENDING';

export type RealizationBlockerSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

export type RealizationBlocker = {
  code: RealizationBlockerCode;
  severity: RealizationBlockerSeverity;
  title: string;
  message: string;
  entityId?: string;
  entityType?: 'SURFACE' | 'CARRIER' | 'PRINT_JOB' | 'ORDER' | 'WORK_ORDER' | 'POINT';
};

export type RealizationBillingReadiness = {
  isReady: boolean;
  missingRequirements: string[];
  blockerCount: number;
  warningCount: number;
  totalPrice?: number;
  currency: string;
  explanation: string;
};

export type DeadlineRiskEvaluation = {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  daysUntilCampaign?: number;
  estimatedRequiredDays: number;
  isAtRisk: boolean;
  reason: string;
};

export type RealizationContext = {
  organizationId: string;
  orderId: string;
  orderNumber: string;
  offerId?: string;
  offerTitle?: string;
  offerAcceptedAt?: Date;
  offerAcceptedBy?: string;
  clientId: string;
  clientName: string;
  clientContactPerson?: string;
  clientContactEmail?: string;
  clientContactPhone?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  projectType: CrmProjectType | string;
  status: CrmOrderStatus | string;
  campaign: {
    dateFrom?: Date;
    dateTo?: Date;
    daysUntilStart?: number;
    daysUntilEnd?: number;
  };
  items: RealizationItemContext[];
  tasks: RealizationTaskContext[];
  printJobs: RealizationPrintJobContext[];
  photos: RealizationPhotoContext[];
  requirements: RealizationRequirement[];
  blockers: RealizationBlocker[];
  billingReadiness: RealizationBillingReadiness;
  overallPhase: RealizationPhase;
  deadlineRisk: DeadlineRiskEvaluation;
  hasPendingChangeSet?: boolean;
  createdAt: Date;
  updatedAt: Date;
};
