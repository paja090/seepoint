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
  client: { id: string; name: string; logoLabel: string; logoUrl?: string; contactPerson: string; email: string };
  salesperson: ProposalSalesperson;
  heroImage: string;
  heroImageAlt: string;
  stats: { carriers: number; mediaTypes: number; locations: number; photos: number; total: number; days: number };
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
const number = (value?: string | number | null) => Number(value ?? 0);

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function toProposalOffer(offer: OfferView): ProposalOffer {
  const fromValues = offer.items.map((item) => item.dateFrom).filter(Boolean) as string[];
  const toValues = offer.items.map((item) => item.dateTo).filter(Boolean) as string[];
  const from = fromValues.sort()[0] ?? null;
  const to = toValues.sort().at(-1) ?? null;
  const campaignDays = from && to ? Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1) : 0;
  const cities = [...new Set(offer.items.map((item) => item.surface.carrier.city).filter(Boolean))];
  if (offer.offerType === 'NAVIGATION' && offer.navigation?.targetName) cities.push(offer.navigation.targetName);
  if (offer.offerType === 'CITY_GALLERY' && offer.cityGallery?.projectTitle) cities.push(offer.cityGallery.projectTitle);

  const carriers: ProposalCarrier[] = offer.items.map((item, index) => {
    const key = mediaKey(item.surface.mediaType);
    const meta = MEDIA_TYPE_META[key];
    const carrier = item.surface.carrier;
    const photos = item.surface.photos.filter((photo) => photo.isClientVisible === true);
    return {
      id: item.id ?? `${carrier.code}-${index}`,
      code: carrier.code,
      mediaType: key,
      city: carrier.city,
      locality: carrier.locality || carrier.street || carrier.address || '',
      description: item.clientDescription || carrier.description || item.surface.name,
      dimensions: item.surface.size || item.surface.orientation || 'dle specifikace plochy',
      status: item.surface.status || 'AVAILABLE',
      image: photos[0]?.url || meta.image,
      imageAlt: photos[0]?.note || `${meta.label} ${carrier.code}`,
      latitude: carrier.latitude,
      longitude: carrier.longitude,
      mapX: 12 + ((index * 23) % 76),
      mapY: 20 + ((index * 17) % 65),
    };
  });

  if (offer.offerType === 'NAVIGATION' && offer.navigation) {
    const targetLat = offer.navigation.targetLatitude;
    const targetLng = offer.navigation.targetLongitude;

    offer.navigation.points.forEach((point, index) => {
      let distStr = '';
      if (point.latitude && point.longitude && targetLat && targetLng) {
        const roadM = Math.round(calculateDistanceMeters(point.latitude, point.longitude, targetLat, targetLng) * 1.28);
        distStr = `🚗 ${formatDistance(roadM)} po silnici`;
      }

      const carrierPhotos = (point as { carrier?: { photos?: Array<{ url: string; isClientVisible?: boolean }> } }).carrier?.photos?.filter((p) => p.isClientVisible !== false) || [];
      const photoUrl = carrierPhotos[0]?.url || MEDIA_TYPE_META.NAVIGATION_SIGN.image;

      carriers.push({
        id: point.id,
        code: point.label || `NAV-${String(index + 1).padStart(2, '0')}`,
        mediaType: 'NAVIGATION_SIGN',
        city: offer.navigation!.targetName,
        locality: [point.address, distStr].filter(Boolean).join(' · '),
        description: `Směr: ${point.orientation || 'Obousměrný (A/B)'}${point.clientNote ? ` — ${point.clientNote}` : ''}`,
        dimensions: point.variant || point.navigationType || '120x80 cm',
        status: point.status || 'AVAILABLE',
        image: photoUrl,
        imageAlt: point.label,
        latitude: point.latitude,
        longitude: point.longitude,
        mapX: 12 + ((index * 23) % 76),
        mapY: 20 + ((index * 17) % 65),
      });
    });
  }

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
      image: items.flatMap((item) => item.surface.photos).find((photo) => photo.isClientVisible === true)?.url || meta.image,
      imageAlt: `${meta.label} v nabídce`,
      tone: meta.tone,
      surfaceCount: items.length,
      locationCount: new Set(items.map((item) => item.surface.carrier.city)).size,
      subtotal: items.reduce((sum, item) => sum + number(item.subtotal), 0),
    };
  });

  if (offer.offerType === 'NAVIGATION' && offer.navigation) {
    mediaMix.push({
      key: 'NAVIGATION_SIGN',
      name: 'Navigační trasa',
      description: `Vytipovaný plán navigačních bodů a směrovek k cíli ${offer.navigation.targetName}.`,
      image: MEDIA_TYPE_META.NAVIGATION_SIGN.image,
      imageAlt: 'Plánované navigační body',
      tone: 'orange',
      surfaceCount: offer.navigation.points.length,
      locationCount: offer.navigation.points.length,
      subtotal: number(offer.subtotal),
    });
  }

  if (offer.offerType === 'CITY_GALLERY') {
    mediaMix.push({
      key: 'OTHER',
      name: 'Galerie venku',
      description: offer.cityGallery?.concept || 'Koncept venkovní galerie připravený podle zadání klienta.',
      image: MEDIA_TYPE_META.OTHER.image,
      imageAlt: 'Koncept Galerie venku',
      tone: 'purple',
      surfaceCount: 1,
      locationCount: offer.cityGallery?.locationBrief ? 1 : 0,
      subtotal: number(offer.subtotal),
    });
  }

  const rentalTotal = offer.offerType === 'NAVIGATION' ? number(offer.subtotal) : offer.items.reduce((sum, item) => sum + number(item.subtotal), 0);

  return {
    id: offer.id ?? 'public-offer',
    status: (['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'].includes(offer.status) ? offer.status : 'DRAFT') as ProposalStatus,
    title: offer.campaignName || offer.title,
    subtitle: offer.title,
    intro: offer.clientMessage || offer.campaignGoal || 'Návrh navigační a reklamní kampaně vytipovaný pro vaši provozovnu.',
    campaignFrom: asDate(from),
    campaignTo: asDate(to),
    campaignDays,
    validUntil: asDate(offer.validUntil),
    cities,
    client: { id: offer.clientId ?? 'client', name: offer.client.name, logoLabel: offer.client.name.slice(0, 2).toUpperCase(), logoUrl: offer.client.logoUrl, contactPerson: offer.contactPerson || offer.client.contactPerson || '', email: offer.contactEmail || offer.client.email || '' },
    salesperson: { id: offer.createdBy.id ?? 'sales', name: offer.createdBy.name, role: 'Obchodní kontakt SeePOINT', phone: '', email: offer.createdBy.email || '', avatar: undefined },
    heroImage: offer.offerType === 'NAVIGATION' ? '/offer/media-navigation.png' : offer.offerType === 'CITY_GALLERY' ? '/offer/hero-campaign.png' : '/offer/hero-city-poster.png',
    heroImageAlt: `Navigační kampaň pro ${offer.campaignName || offer.title}`,
    stats: { carriers: carriers.length, mediaTypes: mediaMix.length, locations: cities.length, photos: offer.items.reduce((sum, item) => sum + item.surface.photos.filter((photo) => photo.isClientVisible === true).length, 0), total: number(offer.totalWithTax), days: campaignDays },
    mediaMix,
    carriers,
    pricing: (() => {
      if (offer.offerType === 'NAVIGATION' && offer.navigation) {
        let rentalSum = 0;
        let productionSum = 0;
        let installationSum = 0;
        let removalSum = 0;

        for (const p of offer.navigation.points) {
          const q = number(p.quantity) || 1;
          rentalSum += q * number(p.unitPrice);
          productionSum += q * number(p.productionPrice);
          installationSum += q * number(p.installationPrice);
          removalSum += q * number(p.removalPrice);
        }

        const rows: Array<{ label: string; amount: number; emphasis?: 'discount' | 'subtotal' | 'total'; note?: string }> = [
          {
            label: 'Pronájem navigačních bodů',
            amount: rentalSum,
            note: `${offer.navigation.points.length} vytipovaných bodů na trase`,
          },
        ];

        if (productionSum > 0) {
          rows.push({
            label: 'Tisk a výroba navigačních tabulí',
            amount: productionSum,
            note: 'Výroba fólií a panelů',
          });
        }

        if (installationSum > 0) {
          rows.push({
            label: 'Montáž a instalace',
            amount: installationSum,
            note: 'Instalace na vybraná místa',
          });
        }

        if (removalSum > 0) {
          rows.push({
            label: 'Demontáž nosičů',
            amount: removalSum,
            note: 'Demontáž po ukončení kampaně',
          });
        }

        if (number(offer.discountAmount) > 0) {
          rows.push({
            label: 'Sleva',
            amount: -number(offer.discountAmount),
            emphasis: 'discount' as const,
          });
        }

        rows.push(
          { label: 'Cena bez DPH', amount: number(offer.subtotal), emphasis: 'subtotal' as const },
          { label: `DPH ${offer.taxRate ?? 21} %`, amount: number(offer.taxAmount) },
          { label: 'Celkem včetně DPH', amount: number(offer.totalWithTax), emphasis: 'total' as const },
        );

        return rows;
      }

      const printTotal = offer.charges
        .filter((charge) => charge.category === 'PRINT' || charge.category === 'PRODUCTION')
        .reduce((sum, charge) => sum + number(charge.subtotal), 0);

      const installationTotal = offer.charges
        .filter((charge) => charge.category === 'INSTALLATION' || charge.category === 'REMOVAL')
        .reduce((sum, charge) => sum + number(charge.subtotal), 0);

      const serviceTotal = offer.charges
        .filter((charge) => charge.category === 'SERVICE')
        .reduce((sum, charge) => sum + number(charge.subtotal), 0);

      const pricingRows: Array<{ label: string; amount: number; emphasis?: 'discount' | 'subtotal' | 'total'; note?: string }> = [
        {
          label: offer.offerType === 'CITY_GALLERY' ? 'Projekt Galerie venku' : 'Pronájem reklamních ploch',
          amount: offer.offerType === 'CITY_GALLERY' ? number(offer.subtotal) : rentalTotal,
          note: offer.offerType === 'CITY_GALLERY' ? offer.cityGallery?.locationBrief || 'Individuální realizace' : `${offer.items.length} vybraných ploch`,
        },
      ];

      if (printTotal > 0) {
        pricingRows.push({
          label: 'Tisk, výroba a instalace',
          amount: printTotal,
          note: offer.charges
            .filter((charge) => charge.category === 'PRINT' || charge.category === 'PRODUCTION')
            .map((charge) => charge.label)
            .join(', '),
        });
      }

      if (installationTotal > 0) {
        pricingRows.push({
          label: 'Instalace a deinstalace',
          amount: installationTotal,
          note: offer.charges
            .filter((charge) => charge.category === 'INSTALLATION' || charge.category === 'REMOVAL')
            .map((charge) => charge.label)
            .join(', '),
        });
      }

      if (serviceTotal > 0) {
        pricingRows.push({
          label: 'Ostatní služby',
          amount: serviceTotal,
          note: offer.charges
            .filter((charge) => charge.category === 'SERVICE')
            .map((charge) => charge.label)
            .join(', '),
        });
      }

      pricingRows.push(
        { label: 'Sleva', amount: -number(offer.discountAmount), emphasis: 'discount' as const },
        { label: 'Cena bez DPH', amount: number(offer.subtotal), emphasis: 'subtotal' as const },
        { label: `DPH ${offer.taxRate ?? 21} %`, amount: number(offer.taxAmount) },
        { label: 'Celkem včetně DPH', amount: number(offer.totalWithTax), emphasis: 'total' as const },
      );

      return pricingRows;
    })(),
    benefits: [
      { id: 'reach', icon: 'reach', title: 'Vytipované trasy', description: 'Trasa a navigační body jsou přesně naplánovány pro nejlepší viditelnost k vaší prodejně.' },
      { id: 'visibility', icon: 'clock', title: 'Viditelnost 24/7', description: 'Navigační cedule trvale navádějí řidiče i chodce po celou dobu kampaně.' },
      { id: 'locations', icon: 'pin', title: 'Vzdálenost k prodejně', description: 'U každého bodu uvádíme přesnou vzdálenost a orientaci směru k cíli.' },
      { id: 'traffic', icon: 'traffic', title: 'Hustá doprava', description: 'Umístění na frekventovaných křižovatkách a kruhových objezdech.' },
      { id: 'brand', icon: 'brand', title: 'Posílení značky', description: 'Jasná identifikace provozovny zvyšuje návštěvnost prodejny.' },
      { id: 'documentation', icon: 'camera', title: 'Kvartální fotodokumentace', description: 'Pravidelné dokládání stavu a fotografie všech zřízených nosičů.' },
    ],
    references: [
      { id: 'ref-1', company: 'Globus ČR', logoLabel: 'GLOBUS', testimonial: 'Dlouhodobá spolupráce na navigační reklamě a promo plochách u našich hypermarketů funguje perfektně.', cooperation: 'Dlouhodobá navigační kampaň', campaigns: 14 },
      { id: 'ref-2', company: 'Kaufland Česká republika', logoLabel: 'KAUFLAND', testimonial: 'Rychlá realizace navigačních tabulí a perfektní fotodokumentace každého kvartálu.', cooperation: 'Navigační cedule a CLV', campaigns: 22 },
      { id: 'ref-3', company: 'Decathlon CZ', logoLabel: 'DECATHLON', testimonial: 'Přehledná nabídka s přesnou mapou trasy k prodejně nám pomohla navést zákazníky přímo z křižovatek.', cooperation: 'Navádění k prodejnám', campaigns: 8 },
    ],
    caseStudies: [],
    conditions: [
      { id: 'validity', text: `Nabídka je platná do ${asDate(offer.validUntil)}.` },
      { id: 'availability', text: 'Realizace podléhá finálnímu technickému a místnímu schválení dotčených úřadů/vlastníků.' },
      { id: 'dates', text: `Navržený termín kampaně: ${asDate(from)} – ${asDate(to)}.` },
      { id: 'pricing', text: 'Uvedené ceny za pronájem, tisk, výrobu a montáž odpovídají kalkulaci zobrazené v nabídce.' },
      { id: 'production', text: 'Tisk a montáž jsou kalkulovány na základě zvolených nosičů a rozměrů.' },
      { id: 'reservation', text: 'Potvrzením nabídky klientem vzniká závazná objednávka navigační kampaně.' },
    ],
  };
}
