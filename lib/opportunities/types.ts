import type { OpportunityEventType, OpportunityStatus } from '@prisma/client';

export type OpportunityScoreReason = {
  factor: string;
  points: number;
  reason: string;
};

export type CampaignPhase = {
  phase: 'TEASER' | 'OPENING' | 'FOLLOW_UP';
  name: string;
  timeframe: string;
  recommendedMediaTypes: string[];
  description: string;
};

export type CreateOpportunityInput = {
  companyName: string;
  companyId?: string;
  website?: string;
  eventType?: OpportunityEventType;
  title: string;
  summary: string;
  city: string;
  region?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  eventDate?: string | Date;
  sourceUrl: string;
  sourceTitle: string;
  sourcePublishedAt?: string | Date;
  suggestedMediaTypes?: string[];
  suggestedCampaignPhases?: CampaignPhase[];
  clientId?: string;
  assignedToUserId?: string;
};

export type OpportunityFilterParams = {
  search?: string;
  city?: string;
  region?: string;
  eventType?: OpportunityEventType;
  status?: OpportunityStatus;
  minScore?: number;
  maxScore?: number;
  assignedToUserId?: string;
  take?: number;
  skip?: number;
};
