import type { OpportunityEventType, OpportunityStatus } from '@prisma/client';

export type OpportunityScoreReason = {
  factor: string;
  points: number;
  reason: string;
};

export type OpportunityScoreBreakdown = {
  trigger: number;
  customerFit: number;
  timing: number;
  geo: number;
  mediaFit: number;
  evidence: number;
};

export type OpportunityScoreComponents = {
  relevance: number;   // max 25
  freshness: number;   // max 20
  locationFit: number; // max 25
  companyFit: number;  // max 20
  confidence: number;  // max 10
};

export type OpportunityScoreMeta = {
  score: number;
  components: OpportunityScoreComponents;
  breakdown: OpportunityScoreBreakdown;
  reasons: OpportunityScoreReason[];
  evidenceFact?: string;
  aiInterpretation?: string;
  aiRecommendation?: string;
};

export type CampaignPhase = {
  phase: 'TEASER' | 'OPENING' | 'FOLLOW_UP';
  name: string;
  timeframe: string;
  recommendedMediaTypes: string[];
  description: string;
};

export type CreateOpportunityInput = {
  semanticData?: import("./semantic-core").Facts;
  companyName: string;
  companyId?: string;
  website?: string;
  eventType?: OpportunityEventType;
  title: string;
  summary: string;
  evidenceFact?: string;
  aiInterpretation?: string;
  aiRecommendation?: string;
  city?: string | null;
  region?: string | null;
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
  radarSignalId?: string | null;
  scoreTrigger?: number | null;
  scoreCustomerFit?: number | null;
  scoreTiming?: number | null;
  scoreGeo?: number | null;
  scoreMediaFit?: number | null;
  scoreEvidence?: number | null;
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

export type OrganizationRadarProfileData = {
  id?: string;
  organizationId: string;
  enabled: boolean;
  targetRegions: string[];
  targetCities: string[];
  focusEventTypes: string[];
  preferredMediaTypes: string[];
  customKeywords: string[];
  customRssSources: string[];
  targetIndustries?: string[];
  excludedCompanies?: string[];
  excludedDomains?: string[];
  minScoreThreshold: number;
  scoringWeights?: Record<string, unknown> | null;
};

