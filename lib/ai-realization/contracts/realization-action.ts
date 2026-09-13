export type RealizationActionType =
  | 'REQUEST_GRAPHICS'
  | 'APPROVE_GRAPHICS'
  | 'START_PRODUCTION'
  | 'ASSIGN_INSTALLATION'
  | 'COMPLETE_INSTALLATION'
  | 'UPLOAD_PHOTOS'
  | 'REVIEW_DOCUMENTATION'
  | 'READY_FOR_BILLING'
  | 'RESOLVE_BLOCKER';

export type RealizationActionPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RealizationNextBestAction = {
  id: string;
  actionType: RealizationActionType;
  priority: RealizationActionPriority;
  title: string;
  description: string;
  targetOrderId: string;
  targetSurfaceId?: string;
  targetUrl?: string;
  recommendedAt: Date;
};
