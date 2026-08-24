export type OfferPhotoView = { id: string; url: string; note?: string | null; isPrimary: boolean; isClientVisible?: boolean };
export type OfferItemView = {
  id?: string;
  surfaceId?: string;
  dateFrom: string | null;
  dateTo: string | null;
  quantity: string;
  unit: string;
  unitPrice: string | null;
  discountPercent: string | null;
  discountAmount: string | null;
  fixedDiscountAmount?: string;
  subtotal: string | null;
  note?: string | null;
  groupLabel: string;
  customTitle?: string | null;
  clientDescription?: string | null;
  surface: {
    name: string;
    mediaType: string;
    size?: string | null;
    orientation?: string | null;
    status?: string;
    carrier: {
      code: string;
      name: string;
      city: string;
      locality?: string | null;
      street?: string | null;
      address?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      description?: string | null;
    };
    photos: OfferPhotoView[];
  };
};

export type OfferChargeView = {
  id?: string;
  priceRuleId?: string | null;
  category: 'RENTAL' | 'PRINT' | 'INSTALLATION' | 'REMOVAL' | 'PRODUCTION' | 'SERVICE';
  code: string;
  label: string;
  description?: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  subtotal: string;
};

export type OfferView = {
  branding?: {
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
  } | null;
  id?: string;
  clientId?: string;
  title: string;
  campaignName: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  campaignGoal?: string | null;
  budget?: string | null;
  status: string;
  pricingTier: string;
  offerType?: 'STANDARD_MEDIA' | 'NAVIGATION' | 'CITY_GALLERY';
  validUntil: string | null;
  internalNote?: string | null;
  clientMessage?: string | null;
  currency: string;
  taxRate: string | null;
  subtotalBeforeDiscount: string;
  subtotal: string | null;
  discountAmount: string | null;
  taxAmount: string | null;
  totalWithTax: string | null;
  hasPublicLink?: boolean;
  isNoPriceConcept?: boolean;
  publicToken?: string | null;
  publishedAt?: string | null;
  sentAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id?: string; name: string; email?: string };
  client: { name: string; logoUrl?: string; companyId?: string | null; contactPerson?: string | null; email?: string | null; phone?: string | null };
  items: OfferItemView[];
  charges: OfferChargeView[];
  navigation?: {
    targetName: string;
    targetAddress?: string | null;
    targetLatitude: number;
    targetLongitude: number;
    targetNote?: string | null;
    points: Array<{ id: string; label: string; latitude: number; longitude: number; address?: string | null; navigationType: string; variant?: string | null; orientation?: string | null; quantity: string; unitPrice: string; subtotal: string; installationPrice: string; removalPrice: string; productionPrice: string; internalNote?: string | null; clientNote?: string | null; status: string; sitePhotoId?: string | null; sitePhotoUrl?: string | null }>;
  } | null;
  cityGallery?: { projectId?: string | null; projectTitle?: string | null; concept?: string | null; locationBrief?: string | null; realizationNote?: string | null } | null;
  packageSelections?: Array<{ id: string; packageId?: string | null; packageName: string; selectionMode: string; standardPrice?: string | null; packagePrice?: string | null }>;
  events?: Array<{ id: string; type: string; fromStatus?: string | null; toStatus?: string | null; actorName?: string | null; actorEmail?: string | null; message?: string | null; createdAt: string }>;
  converted?: boolean;
};

export type OfferClientOption = { id: string; name: string; logoUrl?: string; companyId?: string | null; contactPerson?: string | null; email?: string | null; phone?: string | null; note?: string | null };

export type OfferPriceRuleOption = {
  id: string;
  code: string;
  category: 'RENTAL' | 'PRINT' | 'INSTALLATION' | 'REMOVAL' | 'PRODUCTION' | 'SERVICE';
  label: string;
  description?: string | null;
  mediaType?: string | null;
  mountingType?: string | null;
  pricingSegment: 'COMMERCIAL' | 'CULTURE_SPORT' | 'PUBLIC_NONPROFIT' | 'CUSTOM';
  city?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  minDurationMonths?: number | null;
  maxDurationMonths?: number | null;
  calculation: 'PER_SURFACE' | 'FLAT';
  unit: string;
  unitPrice: string;
  defaultSelected: boolean;
};

export type OfferSurfaceOption = {
  id: string;
  name: string;
  mediaType: string;
  status: string;
  price: string;
  priceSource?: 'SURFACE' | 'CATALOG' | 'MISSING';
  currentClient?: string | null;
  photos: Array<{ id: string; url: string }>;
  carrier: { id: string; code: string; name: string; city: string; type: string; locality?: string | null; street?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null; description?: string | null };
  isPartner?: boolean;
  partnerName?: string;
  partnerDiscountPercent?: number;
  wholesaleB2BPrice?: string;
};

export type MediaPackageOption = {
  id: string;
  name: string;
  description?: string | null;
  standardPrice?: string | null;
  packagePrice?: string | null;
  defaultDuration?: number | null;
  rules: Array<{ id: string; mediaType: string; city?: string | null; locality?: string | null; quantity: number; sortOrder: number }>;
};
