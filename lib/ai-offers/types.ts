import type { ClientPricingSegment, MediaType, MountingType, OfferPriceCategory, OfferType } from '@prisma/client';

export type AiOfferRequest = {
  action?: 'preview' | 'confirm';
  offerType?: OfferType;
  prompt: string;
  clientId?: string;
  clientName?: string;
  pricingSegment?: ClientPricingSegment;
  city?: string;
  budget?: number;
  durationMonths?: number;
  quantity?: number;
  mediaType?: MediaType;
  dateFrom?: string;
  dateTo?: string;
  targetName?: string;
  targetAddress?: string;
  targetLatitude?: number;
  targetLongitude?: number;
  maxRadiusKm?: number;
  selectedSurfaceIds?: string[];
  selectedCandidateIds?: string[];
  candidateMountingTypes?: Record<string, MountingType>;
  navigationPoints?: AiNavigationPointInput[];
};

export type AiNavigationPointInput = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  score: number;
  reasons: string[];
  distanceMeters?: number;
  routeDurationSeconds?: number;
  routePolyline?: string;
  arrowDirection?: 'LEFT' | 'RIGHT' | 'STRAIGHT';
};

export type AiResolvedClient = {
  id?: string;
  name: string;
  pricingSegment: ClientPricingSegment;
  segmentLocked: boolean;
  isNew: boolean;
};

export type AiPriceSnapshot = {
  ruleId: string;
  code: string;
  category: OfferPriceCategory;
  unit: string;
  unitPrice: number;
  validFrom: string | null;
  validTo: string | null;
  mountingType: MountingType | null;
};

export type AiOfferItemPreview = {
  selectionId: string;
  surfaceId: string | null;
  carrierId: string;
  carrierCode: string;
  title: string;
  mediaType: MediaType;
  city: string;
  latitude: number | null;
  longitude: number | null;
  dateFrom: string;
  dateTo: string;
  quantity: number;
  unit: string;
  catalogPrice: number | null;
  finalPrice: number | null;
  rentalTotal?: number | null;
  mountingType?: MountingType | null;
  pricingOptions?: Array<{
    mountingType: MountingType;
    label: string;
    rentalTotal: number | null;
    total: number | null;
    componentPrices: Partial<Record<OfferPriceCategory, AiPriceSnapshot | null>>;
  }>;
  price: AiPriceSnapshot | null;
  score: number;
  reasons: string[];
  distanceMeters?: number;
  routePolyline?: string;
  routeDurationSeconds?: number;
  arrowDirection?: 'LEFT' | 'RIGHT' | 'STRAIGHT';
  componentPrices?: Partial<Record<OfferPriceCategory, AiPriceSnapshot | null>>;
};

export type AiOfferPreview = {
  mode: 'preview';
  offerType: OfferType;
  recommendedOfferType: OfferType;
  client: AiResolvedClient;
  city: string;
  dateFrom: string;
  dateTo: string;
  durationMonths: number;
  budget: number | null;
  target?: { name: string; address: string; latitude: number; longitude: number };
  items: AiOfferItemPreview[];
  catalogTotal: number | null;
  budgetDifference: number | null;
  warnings: string[];
  explanation: string;
  candidateCount: number;
};
