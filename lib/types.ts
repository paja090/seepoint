export type CarrierStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
export type CarrierType = 'BILLBOARD' | 'BIGBOARD' | 'CITYLIGHT' | 'BANNER' | 'FACADE' | 'LED_SCREEN' | 'PROMO_BENCH' | 'PROMO_HORIZON' | 'CITY_POSTER' | 'NAVIGATION' | 'PROMO_TOWER' | 'PROMO_MINITOWER' | 'OTHER';
export type GpsStatus = 'MISSING' | 'UNVERIFIED' | 'VERIFIED';
export type MountingType = 'LIGHT_POLE' | 'POLE' | 'COLUMN' | 'TRACTION' | 'OTHER' | 'UNKNOWN';
export type MediaType = 'NAVIGATION_SIGN' | 'BILLBOARD' | 'BIGBOARD' | 'CITYLIGHT' | 'BANNER' | 'FACADE' | 'LED_SCREEN' | 'PROMO_BENCH' | 'PROMO_HORIZON' | 'CITY_POSTER' | 'PROMO_TOWER' | 'PROMO_MINITOWER' | 'OTHER';
export type SurfaceStatus = 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'NEGOTIATION' | 'OUT_OF_SERVICE';
export type OccupancyStatus = 'RESERVED' | 'ACTIVE' | 'FINISHED' | 'CANCELLED';
export type PhotoType = 'LOCATION' | 'CARRIER' | 'CAMPAIGN' | 'INSTALLATION' | 'CHECK' | 'ARCHIVE';

export type Client = {
  id: string;
  name: string;
  normalizedName: string;
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
};

export type Photo = {
  id: string;
  carrierId?: string;
  surfaceId?: string;
  url: string;
  type: PhotoType;
  note?: string;
};

export type Carrier = {
  id: string;
  name: string;
  code: string;
  type: CarrierType;
  latitude?: number;
  longitude?: number;
  gpsStatus: GpsStatus;
  address?: string;
  city: string;
  region?: string;
  cadastralArea?: string;
  structureCode?: string;
  mountingType: MountingType;
  status: CarrierStatus;
  note?: string;
  sourceSystem?: string;
  sourceSheet?: string;
  sourceRow?: number;
  surfaces: Surface[];
  photos: Photo[];
};
