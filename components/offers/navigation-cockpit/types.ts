import type { OfferView } from '@/lib/offers/view-model';
import type { NavigationCarrierCategory } from '@/lib/offers/navigation-carrier-types';

export type NavigationWorkflowStep = 'BASICS' | 'TARGETS' | 'MAP_POINTS' | 'PRICING_OR_REVIEW';

export type ClientBranchOption = {
  id: string;
  name: string;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ClientOption = {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  branches?: ClientBranchOption[];
};

export type DraftTarget = {
  id: string;
  stableKey?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  note?: string;
  photoUrl?: string | null;
  color?: string;
};

export type DraftPoint = {
  id: string;
  stableKey?: string;
  label: string;
  latitude: number;
  longitude: number;
  address?: string;
  navigationType: string;
  variant: string;
  orientation?: string;
  quantity: string;
  unitPrice: string;
  installationPrice: string;
  removalPrice: string;
  productionPrice: string;
  framePrice: string;
  internalNote?: string;
  clientNote?: string;
  targetId?: string;
  targetLatitude?: number;
  targetLongitude?: number;
  calculatedDistanceMeters?: number;
  manualDistanceValue?: string;
  manualDistanceUnit?: 'METERS' | 'KILOMETERS';
  distanceSource?: 'CALCULATED' | 'MANUAL';
  routePolyline?: string;
  routeDistanceMeters?: number;
  routeDurationSeconds?: number;
  arrowDirectionEnum?:
    | 'LEFT'
    | 'RIGHT'
    | 'STRAIGHT'
    | 'SLANTED_LEFT'
    | 'SLANTED_RIGHT'
    | 'U_TURN'
    | 'TWO_WAY'
    | 'ROUNDABOUT_1'
    | 'ROUNDABOUT_2'
    | 'ROUNDABOUT_3'
    | 'ROUNDABOUT_4'
    | 'ROUNDABOUT_5'
    | 'ROUNDABOUT';
  pillarNumber?: string;
  pillarType?: string;
  sitePhotoId?: string;
  sitePhotoUrl?: string;
  visualizedPhotoUrl?: string;
  color?: string;
  isSelectedByClient?: boolean;
};

export type PresentationSettings = {
  cityConfirmed: boolean;
  showGraphicProofBadge: boolean;
  showReferences: boolean;
  showRealizations: boolean;
  showPartnershipGuarantee: boolean;
  showAboutCompany: boolean;
};

export type CatalogRates = {
  rentalPrice: string;
  framePrice: string;
  productionPrice: string;
  installationPrice: string;
  removalPrice: string;
};

export const TARGET_COLORS = [
  '#be123c', // Rose
  '#2563eb', // Blue
  '#059669', // Emerald
  '#d97706', // Amber
  '#7c3aed', // Purple
  '#db2777', // Pink
  '#0891b2', // Cyan
];
