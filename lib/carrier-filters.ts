import type { CarrierFilters } from './db';
import type { CarrierType, MediaType, SurfaceStatus } from './types';

export const carrierTypeOptions: Array<{ value: CarrierType; label: string }> = [
  { value: 'BILLBOARD', label: 'Billboard' },
  { value: 'BIGBOARD', label: 'Bigboard' },
  { value: 'CITYLIGHT', label: 'City Light' },
  { value: 'BANNER', label: 'Banner' },
  { value: 'FACADE', label: 'Fasáda' },
  { value: 'LED_SCREEN', label: 'LED obrazovka' },
  { value: 'PROMO_BENCH', label: 'Promolavička' },
  { value: 'PROMO_HORIZON', label: 'Promohorizont' },
  { value: 'CITY_POSTER', label: 'City Poster' },
  { value: 'NAVIGATION', label: 'Navigace' },
  { value: 'PROMO_TOWER', label: 'Tower' },
  { value: 'PROMO_MINITOWER', label: 'Minitower' },
  { value: 'OTHER', label: 'Jiný typ' },
];

export const mediaTypeOptions: Array<{ value: MediaType; label: string }> = [
  { value: 'NAVIGATION_SIGN', label: 'Navigace' },
  { value: 'BILLBOARD', label: 'Billboard' },
  { value: 'BIGBOARD', label: 'Bigboard' },
  { value: 'CITYLIGHT', label: 'City Light' },
  { value: 'BANNER', label: 'Banner' },
  { value: 'FACADE', label: 'Fasáda' },
  { value: 'LED_SCREEN', label: 'LED obrazovka' },
  { value: 'PROMO_BENCH', label: 'Promolavička' },
  { value: 'PROMO_HORIZON', label: 'Promohorizont' },
  { value: 'CITY_POSTER', label: 'City Poster' },
  { value: 'PROMO_TOWER', label: 'Tower' },
  { value: 'PROMO_MINITOWER', label: 'Minitower' },
  { value: 'OTHER', label: 'Jiné médium' },
];

export const surfaceStatusOptions: Array<{ value: SurfaceStatus; label: string }> = [
  { value: 'AVAILABLE', label: 'Volné' },
  { value: 'RESERVED', label: 'Rezervované' },
  { value: 'OCCUPIED', label: 'Obsazené' },
  { value: 'NEGOTIATION', label: 'V jednání' },
  { value: 'OUT_OF_SERVICE', label: 'Mimo provoz' },
];

const carrierTypes = new Set(carrierTypeOptions.map((option) => option.value));
const mediaTypes = new Set(mediaTypeOptions.map((option) => option.value));
const surfaceStatuses = new Set(surfaceStatusOptions.map((option) => option.value));
const gpsValues = new Set(['missing', 'present', 'MISSING', 'UNVERIFIED', 'VERIFIED']);
const simpleValues = new Set(['missing', 'present']);
const archivedValues = new Set(['active', 'archived', 'all']);

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: string | string[] | undefined) {
  const trimmed = first(value)?.trim();
  return trimmed || undefined;
}

export function parseCarrierFilters(searchParams: Record<string, string | string[] | undefined>): CarrierFilters {
  const carrierType = clean(searchParams.carrierType);
  const mediaType = clean(searchParams.mediaType);
  const surfaceStatus = clean(searchParams.surfaceStatus);
  const gps = clean(searchParams.gps);
  const photo = clean(searchParams.photo);
  const description = clean(searchParams.description);
  const occupancy = clean(searchParams.occupancy);
  const archived = clean(searchParams.archived);
  const page = Number(clean(searchParams.page));
  const pageSize = Number(clean(searchParams.pageSize));

  return {
    q: clean(searchParams.q),
    carrierType: carrierType && carrierTypes.has(carrierType as CarrierType) ? carrierType as CarrierType : undefined,
    mediaType: mediaType && mediaTypes.has(mediaType as MediaType) ? mediaType as MediaType : undefined,
    city: clean(searchParams.city),
    locality: clean(searchParams.locality),
    street: clean(searchParams.street),
    client: clean(searchParams.client),
    surfaceStatus: surfaceStatus && surfaceStatuses.has(surfaceStatus as SurfaceStatus) ? surfaceStatus as SurfaceStatus : undefined,
    gps: gps && gpsValues.has(gps) ? gps as CarrierFilters['gps'] : undefined,
    photo: photo && simpleValues.has(photo) ? photo as CarrierFilters['photo'] : undefined,
    description: description && simpleValues.has(description) ? description as CarrierFilters['description'] : undefined,
    occupancy: occupancy && simpleValues.has(occupancy) ? occupancy as CarrierFilters['occupancy'] : undefined,
    archived: archived && archivedValues.has(archived) ? archived as CarrierFilters['archived'] : 'active',
    importBatchId: clean(searchParams.importBatchId),
    page: Number.isFinite(page) && page > 0 ? page : undefined,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : undefined,
  };
}

export function carrierTypeLabel(value: string) {
  return carrierTypeOptions.find((option) => option.value === value)?.label ?? value;
}

export function mediaTypeLabel(value: string) {
  return mediaTypeOptions.find((option) => option.value === value)?.label ?? value;
}
