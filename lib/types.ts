export type CarrierStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type CarrierType = 'BILLBOARD' | 'BIGBOARD' | 'CITYLIGHT' | 'BANNER' | 'FACADE' | 'LED_SCREEN' | 'PROMO_BENCH' | 'PROMO_HORIZON' | 'CITY_POSTER' | 'NAVIGATION' | 'PROMO_TOWER' | 'PROMO_MINITOWER' | 'OTHER';
export type GpsStatus = 'MISSING' | 'UNVERIFIED' | 'VERIFIED';
export type MountingType = 'LIGHT_POLE' | 'POLE' | 'COLUMN' | 'TRACTION' | 'OTHER' | 'UNKNOWN';
export type MediaType = 'NAVIGATION_SIGN' | 'BILLBOARD' | 'BIGBOARD' | 'CITYLIGHT' | 'BANNER' | 'FACADE' | 'LED_SCREEN' | 'PROMO_BENCH' | 'PROMO_HORIZON' | 'CITY_POSTER' | 'PROMO_TOWER' | 'PROMO_MINITOWER' | 'OTHER';
export type SurfaceStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'NEGOTIATION' | 'OUT_OF_SERVICE';
export type Role = 'ADMIN' | 'SALES' | 'TECHNICIAN' | 'WORKER' | 'VIEWER';
export type OccupancyStatus = 'AVAILABLE' | 'NEGOTIATION' | 'RESERVED' | 'OCCUPIED' | 'FINISHED' | 'CANCELLED' | 'OUT_OF_SERVICE';
export type OfferStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type PhotoType = 'LOCATION' | 'CARRIER' | 'CAMPAIGN' | 'INSTALLATION' | 'CHECK' | 'ARCHIVE' | 'EMPLOYEE_PROFILE' | 'EXPENSE_RECEIPT';

export type Client = {
  id: string;
  name: string;
  normalizedName: string;
  companyId?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  externalCode?: string;
  note?: string;
  active: boolean;
};

export type Surface = {
  id: string;
  carrierId: string;
  currentClientId?: string;
  currentClient?: Pick<Client, 'id' | 'name'>;
  name: string;
  mediaType: MediaType;
  sourcePosition?: string;
  directionDescription?: string;
  rawMediaType?: string;
  size?: string;
  orientation?: string;
  status: SurfaceStatus;
  price?: number;
  note?: string;
  occupancies: Occupancy[];
  photos: Photo[];
};

export type Occupancy = {
  id: string;
  surfaceId: string;
  clientId?: string;
  clientName: string;
  campaignName: string;
  dateFrom: string;
  dateTo: string;
  status: OccupancyStatus;
  price?: number;
  note?: string;
  createdBy?: string;
  updatedBy?: string;
  reservedUntil?: string;
  offerId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type OfferItem = {
  id: string;
  offerId: string;
  surfaceId: string;
  surface?: Pick<Surface, 'id' | 'name' | 'mediaType' | 'status'> & {
    carrier?: Pick<Carrier, 'id' | 'name' | 'code' | 'city' | 'locality' | 'address'>;
  };
  dateFrom: string;
  dateTo: string;
  price?: number;
  note?: string;
};

export type Offer = {
  id: string;
  clientId: string;
  client?: Pick<Client, 'id' | 'name'>;
  title: string;
  status: OfferStatus;
  validUntil?: string;
  note?: string;
  totalPrice?: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  items: OfferItem[];
};

export type Photo = {
  id: string;
  carrierId?: string;
  surfaceId?: string;
  url: string;
  type: PhotoType;
  note?: string;
  sortOrder?: number;
  isPrimary?: boolean;
  isClientVisible?: boolean;
  isPrivate?: boolean;
  driveFileId?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  taskId?: string;
  workEntryId?: string;
};

export type Carrier = {
  id: string;
  name: string;
  code: string;
  type: CarrierType;
  latitude?: number;
  longitude?: number;
  gpsStatus: GpsStatus;
  street?: string;
  address?: string;
  locality?: string;
  city: string;
  region?: string;
  cadastralArea?: string;
  structureCode?: string;
  mountingType: MountingType;
  status: CarrierStatus;
  description?: string;
  placementDescription?: string;
  note?: string;
  archivedAt?: string;
  archivedBy?: string;
  archiveReason?: string;
  sourceSystem?: string;
  sourceSheet?: string;
  sourceRow?: number;
  importBatchId?: string;
  surfaces: Surface[];
  photos: Photo[];
};
