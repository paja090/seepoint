import type { OfferView } from './view-model';

export type ProposalMediaTypeKey =
  | 'CITY_POSTER'
  | 'PROMO_BENCH'
  | 'NAVIGATION_SIGN'
  | 'CITYLIGHT'
  | 'PROMO_TOWER'
  | 'PROMO_MINITOWER'
  | 'LED_SCREEN'
  | 'BILLBOARD'
  | 'BIGBOARD'
  | 'BANNER'
  | 'FACADE'
  | 'PROMO_HORIZON'
  | 'OTHER';
export type ProposalAccentTone = 'blue' | 'purple' | 'orange' | 'green' | 'indigo';
export type ProposalStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type ProposalSalesperson = { id: string; name: string; role: string; phone: string; email: string; avatar?: string };
export type ProposalCarrier = {
  id: string;
  code: string;
  mediaType: ProposalMediaTypeKey;
  city: string;
  locality: string;
  description: string;
  dimensions: string;
  status: string;
  image: string;
  imageAlt: string;
  latitude?: number | null;
  longitude?: number | null;
  mapX: number;
  mapY: number;
};
export type ProposalMediaType = {
  key: ProposalMediaTypeKey;
  name: string;
  description: string;
  image: string;
  imageAlt: string;
  tone: ProposalAccentTone;
  surfaceCount: number;
  locationCount: number;
  subtotal: number;
};
export type ProposalBenefit = { id: string; icon: 'reach' | 'clock' | 'pin' | 'traffic' | 'brand' | 'camera'; title: string; description: string };
export type ProposalReference = { id: string; company: string; logoLabel: string; testimonial: string; cooperation: string; campaigns: number };
export type ProposalCaseStudy = { id: string; title: string; clientLabel: string; image: string; imageAlt: string; objective: string; mediaTypes: string[]; cities: string[]; surfaces: number; result: string };
export type ProposalOffer = {
  id: string;
  status: ProposalStatus;
  title: string;
  subtitle: string;
  intro: string;
  campaignFrom: string;
  campaignTo: string;
  campaignDays: number;
  validUntil: string;
  cities: string[];
  client: { id: string; name: string; logoLabel: string; contactPerson: string; email: string };
  salesperson: ProposalSalesperson;
  heroImage: string;
  heroImageAlt: string;
  stats: { carriers: number; mediaTypes: number; locations: number; days: number };
  mediaMix: ProposalMediaType[];
  carriers: ProposalCarrier[];
  pricing: Array<{ label: string; amount: number; emphasis?: 'discount' | 'subtotal' | 'total'; note?: string }>;
  benefits: ProposalBenefit[];
  references: ProposalReference[];
  caseStudies: ProposalCaseStudy[];
  conditions: Array<{ id: string; text: string }>;
};

export const MEDIA_TYPE_META: Record<ProposalMediaTypeKey, { label: string; tone: ProposalAccentTone; image: string }> = {
  CITY_POSTER: { label: 'City Poster', tone: 'blue', image: '/offer/media-city-poster.png' },
  PROMO_BENCH: { label: 'Promo lavička', tone: 'purple', image: '/offer/media-promo-bench.png' },
  NAVIGATION_SIGN: { label: 'Navigace', tone: 'orange', image: '/offer/media-navigation.png' },
  CITYLIGHT: { label: 'Citylight', tone: 'green', image: '/offer/media-clv.png' },
  PROMO_TOWER: { label: 'Promo Tower', tone: 'indigo', image: '/offer/media-tower.png' },
  PROMO_MINITOWER: { label: 'Promo Minitower', tone: 'indigo', image: '/offer/media-tower.png' },
  LED_SCREEN: { label: 'LED obrazovka', tone: 'blue', image: '/offer/media-clv.png' },
  BILLBOARD: { label: 'Billboard', tone: 'green', image: '/offer/media-city-poster.png' },
  BIGBOARD: { label: 'Bigboard', tone: 'green', image: '/offer/media-city-poster.png' },
  BANNER: { label: 'Banner', tone: 'purple', image: '/offer/media-city-poster.png' },
  FACADE: { label: 'Fasáda', tone: 'orange', image: '/offer/media-city-poster.png' },
  PROMO_HORIZON: { label: 'Promo Horizon', tone: 'indigo', image: '/offer/media-tower.png' },
  OTHER: { label: 'Ostatní', tone: 'blue', image: '/offer/hero-campaign.png' },
};

export const TONE_CLASSES: Record<ProposalAccentTone, { text: string; bg: string; softBg: string; ring: string; dot: string; marker: string }> = {
  blue: { text: 'text-sky-700', bg: 'bg-sky-600', softBg: 'bg-sky-50', ring: 'ring-sky-200', dot: 'bg-sky-500', marker: 'bg-sky-500 ring-sky-200' },
  purple: { text: 'text-purple-700', bg: 'bg-purple-600', softBg: 'bg-purple-50', ring: 'ring-purple-200', dot: 'bg-purple-500', marker: 'bg-purple-500 ring-purple-200' },
  orange: { text: 'text-orange-700', bg: 'bg-orange-500', softBg: 'bg-orange-50', ring: 'ring-orange-200', dot: 'bg-orange-500', marker: 'bg-orange-500 ring-orange-200' },
  green: { text: 'text-emerald-700', bg: 'bg-emerald-600', softBg: 'bg-emerald-50', ring: 'ring-emerald-200', dot: 'bg-emerald-500', marker: 'bg-emerald-500 ring-emerald-200' },
  indigo: { text: 'text-indigo-700', bg: 'bg-indigo-600', softBg: 'bg-indigo-50', ring: 'ring-indigo-200', dot: 'bg-indigo-500', marker: 'bg-indigo-500 ring-indigo-200' },
};

export const formatCzk = (amount: number) => `${amount.toLocaleString('cs-CZ')} Kč`;
export const formatCzkDecimal = (amount: number) => `${amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč`;
export const formatNumber = (value: number) => value.toLocaleString('cs-CZ');

const asDate = (value?: string | null) => value ? new Intl.DateTimeFormat('cs-CZ').format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : 'neuvedeno';
const mediaKey = (value: string): ProposalMediaTypeKey => value in MEDIA_TYPE_META ? value as ProposalMediaTypeKey : 'OTHER';
const number = (value?: string | null) => Number(value ?? 0);

export function toProposalOffer(offer: OfferView): ProposalOffer {
  const fromValues = offer.items.map((item) => item.dateFrom).filter(Boolean) as string[];
  const toValues = offer.items.map((item) => item.dateTo).filter(Boolean) as string[];
  const from = fromValues.sort()[0] ?? null;
  const to = toValues.sort().at(-1) ?? null;
  const campaignDays = from && to ? Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1) : 0;
  const cities = [...new Set(offer.items.map((item) => item.surface.carrier.city).filter(Boolean))];
  const carriers: ProposalCarrier[] = offer.items.map((item, index) => {
    const key = mediaKey(item.surface.mediaType);
    const meta = MEDIA_TYPE_META[key];
    const carrier = item.surface.carrier;
    return {
      id: item.id ?? `${carrier.code}-${index}`,
      code: carrier.code,
      mediaType: key,
      city: carrier.city,
      locality: carrier.locality || carrier.street || carrier.address || '',
      description: item.clientDescription || carrier.description || item.surface.name,
      dimensions: item.surface.size || item.surface.orientation || 'dle specifikace plochy',
      status: item.surface.status || 'AVAILABLE',
      image: item.surface.photos[0]?.url || meta.image,
      imageAlt: item.surface.photos[0]?.note || `${meta.label} ${carrier.code}`,
      latitude: carrier.latitude,
      longitude: carrier.longitude,
      mapX: 12 + ((index * 23) % 76),
      mapY: 20 + ((index * 17) % 65),
    };
  });
  const geocoded = carriers.filter((carrier) => carrier.latitude != null && carrier.longitude != null);
  if (geocoded.length > 0) {
    const latitudes = geocoded.map((carrier) => carrier.latitude as number);
    const longitudes = geocoded.map((carrier) => carrier.longitude as number);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    for (const carrier of geocoded) {
      carrier.mapX = 10 + (((carrier.longitude as number) - minLng) / Math.max(maxLng - minLng, 0.0001)) * 80;
      carrier.mapY = 90 - (((carrier.latitude as number) - minLat) / Math.max(maxLat - minLat, 0.0001)) * 80;
    }
  }
  const grouped = new Map<ProposalMediaTypeKey, typeof offer.items>();
  for (const item of offer.items) {
    const key = mediaKey(item.surface.mediaType);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  const mediaMix = [...grouped].map(([key, items]): ProposalMediaType => {
    const meta = MEDIA_TYPE_META[key];
    return {
      key,
      name: meta.label,
      description: `Vybrané plochy typu ${meta.label} v lokalitách ${[...new Set(items.map((item) => item.surface.carrier.city))].join(', ')}.`,
      image: items.find((item) => item.surface.photos[0])?.surface.photos[0]?.url || meta.image,
      imageAlt: `${meta.label} v nabídce`,
      tone: meta.tone,
      surfaceCount: items.length,
      locationCount: new Set(items.map((item) => item.surface.carrier.city)).size,
      subtotal: items.reduce((sum, item) => sum + number(item.subtotal), 0),
    };
  });
  const firstPhoto = offer.items.find((item) => item.surface.photos[0])?.surface.photos[0];
  return {
    id: offer.id ?? 'public-offer',
    status: (['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].includes(offer.status) ? offer.status : 'DRAFT') as ProposalStatus,
    title: offer.campaignName || offer.title,
    subtitle: offer.title,
    intro: offer.clientMessage || offer.campaignGoal || 'Návrh reklamní kampaně sestavený z vybraných ploch SeePOINT.',
    campaignFrom: asDate(from),
    campaignTo: asDate(to),
    campaignDays,
    validUntil: asDate(offer.validUntil),
    cities,
    client: { id: offer.clientId ?? 'client', name: offer.client.name, logoLabel: offer.client.name.slice(0, 2).toUpperCase(), contactPerson: offer.contactPerson || offer.client.contactPerson || '', email: offer.contactEmail || offer.client.email || '' },
    salesperson: { id: offer.createdBy.id ?? 'sales', name: offer.createdBy.name, role: 'Obchodní kontakt SeePOINT', phone: '', email: offer.createdBy.email || '', avatar: undefined },
    heroImage: firstPhoto?.url || '/offer/hero-campaign.png',
    heroImageAlt: firstPhoto?.note || `Reklamní kampaň ${offer.campaignName}`,
    stats: { carriers: carriers.length, mediaTypes: mediaMix.length, locations: cities.length, days: campaignDays },
    mediaMix,
    carriers,
    pricing: [
      { label: 'Cena před slevou', amount: number(offer.subtotalBeforeDiscount) },
      { label: 'Sleva', amount: -number(offer.discountAmount), emphasis: 'discount' },
      { label: 'Cena bez DPH', amount: number(offer.subtotal), emphasis: 'subtotal' },
      { label: `DPH ${offer.taxRate ?? 0} %`, amount: number(offer.taxAmount) },
      { label: 'Celkem včetně DPH', amount: number(offer.totalWithTax), emphasis: 'total' },
    ],
    benefits: [
      { id: 'locations', icon: 'pin', title: 'Konkrétní lokality', description: 'Každá položka nabídky je navázaná na konkrétní reklamní plochu a termín.' },
      { id: 'pricing', icon: 'brand', title: 'Transparentní kalkulace', description: 'Ceny, slevy a DPH jsou vypočtené serverově a uvedené v souhrnu.' },
      { id: 'availability', icon: 'clock', title: 'Kontrola dostupnosti', description: 'Před realizací se ověřují kolize obsazenosti vybraných ploch.' },
    ],
    references: [],
    caseStudies: [],
    conditions: [
      { id: 'validity', text: `Nabídka je platná do ${asDate(offer.validUntil)}.` },
      { id: 'availability', text: 'Realizace podléhá finálnímu potvrzení dostupnosti vybraných ploch.' },
      { id: 'dates', text: `Navržený termín kampaně: ${asDate(from)} – ${asDate(to)}.` },
    ],
  };
}
