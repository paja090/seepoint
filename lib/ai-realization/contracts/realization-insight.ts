export type RealizationInsightType =
  | 'MISSING_GRAPHICS'
  | 'GRAPHICS_NOT_APPROVED'
  | 'PRODUCTION_DELAY'
  | 'INSTALLATION_NOT_ASSIGNED'
  | 'INSTALLATION_DEADLINE_RISK'
  | 'SURFACE_TECHNICAL_ISSUE'
  | 'MISSING_PHOTO_DOCUMENTATION'
  | 'INCOMPLETE_INSTALLATION'
  | 'READY_FOR_BILLING'
  | 'BILLING_BLOCKED'
  | 'OVERDUE_TASK'
  | 'DEPENDENCY_BLOCKED';

export type RealizationInsightSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type RealizationInsight = {
  id: string;
  type: RealizationInsightType;
  severity: RealizationInsightSeverity;
  title: string;
  deterministicReason: string;
  aiExplanation?: string;
  aiRecommendation?: string;
  suggestedActionType?: string;
  surfaceId?: string;
  orderId: string;
  detectedAt: Date;
};
