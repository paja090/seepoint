/**
 * Frontend-only mock data for the client-facing advertising proposal template.
 *
 * IMPORTANT: This file contains ILLUSTRATIVE sample data only. It is intentionally
 * decoupled from the production database utilities (`lib/db.ts`, Prisma, API routes).
 * Codex can later replace these typed mock objects with real Offer / OfferItem /
 * Client / AdvertisingCarrier / AdvertisingSurface / Occupancy / Photo data.
 *
 * Do NOT import production database code here, and do NOT import this file into
 * production data paths.
 */

export type MockMediaTypeKey = 'CITY_POSTER' | 'PROMO_BENCH' | 'NAVIGATION' | 'CLV' | 'TOWER';

/** Tone keys map to the accent color used across cards, chips and markers. */
export type MockAccentTone = 'blue' | 'purple' | 'orange' | 'green' | 'indigo';

export type MockMediaType = {
  key: MockMediaTypeKey;
  name: string;
  /** Short practical description shown to the client. */
  description: string;
  image: string;
  imageAlt: string;
  tone: MockAccentTone;
  /** Number of selected surfaces of this media type. */
  surfaceCount: number;
  /** Estimated reach (impressions) contributed by this media type. */
  estimatedReach: number;
  /** Subtotal price in CZK (without VAT). */
  subtotal: number;
};

export type MockClient = {
  id: string;
  name: string;
  /** Short label used for the logo placeholder. */
  logoLabel: string;
  contactPerson: string;
  email: string;
};

export type MockSalesperson = {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  avatar: string;
};

export type MockCarrierStatus = 'AVAILABLE' | 'RESERVED' | 'VERIFIED';

export type MockCarrier = {
  id: string;
  code: string;
  mediaType: MockMediaTypeKey;
  city: string;
  locality: string;
  description: string;
  dimensions: string;
  status: MockCarrierStatus;
  image: string;
  imageAlt: string;
  /** Relative position (0-100) on the map placeholder, purely illustrative. */
  mapX: number;
  mapY: number;
};

export type MockPricingRow = {
  label: string;
  amount: number;
  /** Highlighted rows render with stronger emphasis. */
  emphasis?: 'discount' | 'subtotal' | 'total';
  note?: string;
};

export type MockOfferItem = {
  id: string;
  mediaType: MockMediaTypeKey;
  surfaceCount: number;
  price: number;
};

export type MockBenefit = {
  id: string;
  icon: 'reach' | 'clock' | 'pin' | 'traffic' | 'brand' | 'camera';
  title: string;
  description: string;
};

export type MockReference = {
  id: string;
  company: string;
  logoLabel: string;
  /** Sample testimonial – NOT a verified real quote. */
  testimonial: string;
  cooperation: string;
  campaigns: number;
};

export type MockCaseStudy = {
  id: string;
  title: string;
  clientLabel: string;
  image: string;
  imageAlt: string;
  objective: string;
  mediaTypes: string[];
  cities: string[];
  surfaces: number;
  estimatedReach: number;
  result: string;
};

export type MockCondition = {
  id: string;
  text: string;
};

export type MockOfferStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export type MockOffer = {
  id: string;
  publicToken: string;
  status: MockOfferStatus;
  title: string;
  subtitle: string;
  intro: string;
  campaignFrom: string;
  campaignTo: string;
  campaignDays: number;
  validUntil: string;
  cities: string[];
  client: MockClient;
  salesperson: MockSalesperson;
  heroImage: string;
  heroImageAlt: string;
  stats: {
    carriers: number;
    mediaTypes: number;
    locations: number;
    estimatedReach: number;
    estimatedImpressions: number;
    days: number;
  };
  mediaMix: MockMediaType[];
  carriers: MockCarrier[];
  items: MockOfferItem[];
  pricing: MockPricingRow[];
  benefits: MockBenefit[];
  references: MockReference[];
  caseStudies: MockCaseStudy[];
  conditions: MockCondition[];
};

/** Media type meta used for labels and accent colors across the UI. */
export const MEDIA_TYPE_META: Record<MockMediaTypeKey, { label: string; tone: MockAccentTone }> = {
  CITY_POSTER: { label: 'City Poster', tone: 'blue' },
  PROMO_BENCH: { label: 'Promo lavička', tone: 'purple' },
  NAVIGATION: { label: 'Navigace', tone: 'orange' },
  CLV: { label: 'CLV', tone: 'green' },
  TOWER: { label: 'Tower', tone: 'indigo' },
};

/** Tailwind class helpers for each accent tone (kept in one place for consistency). */
export const TONE_CLASSES: Record<
  MockAccentTone,
  { text: string; bg: string; softBg: string; ring: string; dot: string; marker: string }
> = {
  blue: {
    text: 'text-sky-700',
    bg: 'bg-sky-600',
    softBg: 'bg-sky-50',
    ring: 'ring-sky-200',
    dot: 'bg-sky-500',
    marker: 'bg-sky-500 ring-sky-200',
  },
  purple: {
    text: 'text-purple-700',
    bg: 'bg-purple-600',
    softBg: 'bg-purple-50',
    ring: 'ring-purple-200',
    dot: 'bg-purple-500',
    marker: 'bg-purple-500 ring-purple-200',
  },
  orange: {
    text: 'text-orange-700',
    bg: 'bg-orange-500',
    softBg: 'bg-orange-50',
    ring: 'ring-orange-200',
    dot: 'bg-orange-500',
    marker: 'bg-orange-500 ring-orange-200',
  },
  green: {
    text: 'text-emerald-700',
    bg: 'bg-emerald-600',
    softBg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    dot: 'bg-emerald-500',
    marker: 'bg-emerald-500 ring-emerald-200',
  },
  indigo: {
    text: 'text-indigo-700',
    bg: 'bg-indigo-600',
    softBg: 'bg-indigo-50',
    ring: 'ring-indigo-200',
    dot: 'bg-indigo-500',
    marker: 'bg-indigo-500 ring-indigo-200',
  },
};

export function formatCzk(amount: number): string {
  return `${amount.toLocaleString('cs-CZ')} Kč`;
}

export function formatCzkDecimal(amount: number): string {
  return `${amount.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kč`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('cs-CZ');
}

const mediaMix: MockMediaType[] = [
  {
    key: 'CITY_POSTER',
    name: 'City Poster',
    description: 'Frekventované městské lokality s vysokým počtem kontaktů pěších i řidičů.',
    image: '/offer/media-city-poster.png',
    imageAlt: 'City Poster reklamní plocha na městské ulici',
    tone: 'blue',
    surfaceCount: 20,
    estimatedReach: 520000,
    subtotal: 30000,
  },
  {
    key: 'PROMO_BENCH',
    name: 'Promo lavička',
    description: 'Dlouhodobá viditelnost pro chodce i projíždějící dopravu v obytných zónách.',
    image: '/offer/media-promo-bench.png',
    imageAlt: 'Reklamní promo lavička u silnice',
    tone: 'purple',
    surfaceCount: 15,
    estimatedReach: 210000,
    subtotal: 18000,
  },
  {
    key: 'NAVIGATION',
    name: 'Navigace',
    description: 'Směrová komunikace v blízkosti prodejen a nákupních míst.',
    image: '/offer/media-navigation.png',
    imageAlt: 'Navigační reklamní tabule u prodejny',
    tone: 'orange',
    surfaceCount: 8,
    estimatedReach: 79600,
    subtotal: 12000,
  },
  {
    key: 'CLV',
    name: 'CLV',
    description: 'Prémiová podsvícená viditelnost v centru města po celý den i večer.',
    image: '/offer/media-clv.png',
    imageAlt: 'Podsvícená CLV vitrína na zastávce',
    tone: 'green',
    surfaceCount: 5,
    estimatedReach: 145000,
    subtotal: 9000,
  },
  {
    key: 'TOWER',
    name: 'Tower',
    description: 'Dominantní reklamní nosič s viditelností na velkou vzdálenost.',
    image: '/offer/media-tower.png',
    imageAlt: 'Reklamní tower na křižovatce',
    tone: 'indigo',
    surfaceCount: 3,
    estimatedReach: 98000,
    subtotal: 8500,
  },
];

const carriers: MockCarrier[] = [
  {
    id: 'car-cp-0738',
    code: 'CP0738',
    mediaType: 'CITY_POSTER',
    city: 'Ostrava',
    locality: 'Výškovická',
    description: 'Rušná výpadovka s vysokou frekvencí automobilové dopravy.',
    dimensions: '118,5 × 175 cm',
    status: 'AVAILABLE',
    image: '/offer/media-city-poster.png',
    imageAlt: 'City Poster CP0738 na ulici Výškovická v Ostravě',
    mapX: 46,
    mapY: 62,
  },
  {
    id: 'car-lav-0156',
    code: 'LAV0156',
    mediaType: 'PROMO_BENCH',
    city: 'Ostrava',
    locality: 'Hlavní třída',
    description: 'Pěší zóna v centru s vysokou koncentrací chodců.',
    dimensions: '200 × 60 cm',
    status: 'RESERVED',
    image: '/offer/media-promo-bench.png',
    imageAlt: 'Promo lavička LAV0156 na Hlavní třídě',
    mapX: 54,
    mapY: 40,
  },
  {
    id: 'car-nav-0102',
    code: 'NAV0102',
    mediaType: 'NAVIGATION',
    city: 'Ostrava',
    locality: 'Karolina',
    description: 'Navigace u vjezdu do nákupního centra Karolina.',
    dimensions: '100 × 40 cm',
    status: 'AVAILABLE',
    image: '/offer/media-navigation.png',
    imageAlt: 'Navigační tabule NAV0102 u OC Karolina',
    mapX: 60,
    mapY: 52,
  },
  {
    id: 'car-clv-0210',
    code: 'CLV0210',
    mediaType: 'CLV',
    city: 'Frýdek-Místek',
    locality: 'Beskydská',
    description: 'Podsvícená vitrína na frekventované zastávce MHD.',
    dimensions: '118,5 × 175 cm',
    status: 'VERIFIED',
    image: '/offer/media-clv.png',
    imageAlt: 'CLV vitrína CLV0210 na ulici Beskydská',
    mapX: 70,
    mapY: 70,
  },
  {
    id: 'car-tow-0044',
    code: 'TOW0044',
    mediaType: 'TOWER',
    city: 'Havířov',
    locality: 'Dlouhá třída',
    description: 'Dominantní tower na hlavní křižovatce města.',
    dimensions: '340 × 240 cm',
    status: 'AVAILABLE',
    image: '/offer/media-tower.png',
    imageAlt: 'Reklamní tower TOW0044 na Dlouhé třídě',
    mapX: 38,
    mapY: 30,
  },
  {
    id: 'car-cp-0412',
    code: 'CP0412',
    mediaType: 'CITY_POSTER',
    city: 'Orlová',
    locality: 'Masarykova',
    description: 'Vstup do města s vysokou frekvencí dopravy.',
    dimensions: '118,5 × 175 cm',
    status: 'AVAILABLE',
    image: '/offer/media-city-poster.png',
    imageAlt: 'City Poster CP0412 na Masarykově ulici',
    mapX: 30,
    mapY: 55,
  },
];

const pricing: MockPricingRow[] = [
  { label: 'Pronájem reklamních ploch', amount: 60000, note: 'City Poster, Promo lavičky, Navigace, CLV, Tower' },
  { label: 'Tisk', amount: 7500 },
  { label: 'Instalace', amount: 5000 },
  { label: 'Grafické zpracování', amount: 3000 },
  { label: 'Servis a monitoring', amount: 2000 },
  { label: 'Individuální položky', amount: 0, note: 'Dle dohody' },
  { label: 'Mezisoučet', amount: 77500, emphasis: 'subtotal' },
  { label: 'Sleva 10 %', amount: -7750, emphasis: 'discount' },
  { label: 'Celkem bez DPH', amount: 69750, emphasis: 'subtotal' },
  { label: 'DPH 21 %', amount: 14647.5 },
  { label: 'Celkem s DPH', amount: 84397.5, emphasis: 'total' },
];

const benefits: MockBenefit[] = [
  {
    id: 'ben-reach',
    icon: 'reach',
    title: 'Vysoký zásah',
    description: 'Kombinace médií oslovuje široké publikum ve všech vybraných lokalitách.',
  },
  {
    id: 'ben-clock',
    icon: 'clock',
    title: 'Viditelnost 24/7',
    description: 'Reklama komunikuje bez přestávky, včetně podsvícených nočních ploch.',
  },
  {
    id: 'ben-pin',
    icon: 'pin',
    title: 'Pokrytí klíčových lokalit',
    description: 'Nosiče jsou umístěny v místech s nejvyšší frekvencí pohybu.',
  },
  {
    id: 'ben-traffic',
    icon: 'traffic',
    title: 'Pěší i automobilová doprava',
    description: 'Média cílí současně na chodce i řidiče pro maximální efekt.',
  },
  {
    id: 'ben-brand',
    icon: 'brand',
    title: 'Dlouhodobé působení značky',
    description: 'Opakovaný kontakt buduje povědomí a důvěru ve značku.',
  },
  {
    id: 'ben-camera',
    icon: 'camera',
    title: 'Doložení realizace fotografiemi',
    description: 'Každou plochu zdokumentujeme fotografiemi po instalaci.',
  },
];

const references: MockReference[] = [
  {
    id: 'ref-mcd',
    company: "McDonald's",
    logoLabel: "McDonald's",
    testimonial: 'Dlouhodobě oceňujeme spolehlivost, rychlou realizaci a přehlednou komunikaci.',
    cooperation: 'Spolupráce od 2019',
    campaigns: 24,
  },
  {
    id: 'ref-albert',
    company: 'Albert',
    logoLabel: 'Albert',
    testimonial: 'SeePOINT nám pomohl efektivně pokrýt klíčové lokality v Moravskoslezském kraji.',
    cooperation: 'Spolupráce od 2020',
    campaigns: 18,
  },
  {
    id: 'ref-rossmann',
    company: 'Rossmann',
    logoLabel: 'Rossmann',
    testimonial: 'Profesionální přístup a flexibilita při plánování kampaní.',
    cooperation: 'Spolupráce od 2021',
    campaigns: 12,
  },
  {
    id: 'ref-billa',
    company: 'BILLA',
    logoLabel: 'BILLA',
    testimonial: 'Přehledné nabídky a rychlá realizace nám usnadňují plánování.',
    cooperation: 'Spolupráce od 2018',
    campaigns: 21,
  },
  {
    id: 'ref-kfc',
    company: 'KFC',
    logoLabel: 'KFC',
    testimonial: 'Vysoká viditelnost kampaní a spolehlivé doložení realizace.',
    cooperation: 'Spolupráce od 2022',
    campaigns: 9,
  },
];

const caseStudies: MockCaseStudy[] = [
  {
    id: 'case-retail',
    title: 'Otevření nové prodejny',
    clientLabel: 'Retailový řetězec',
    image: '/offer/case-retail.png',
    imageAlt: 'Kampaň k otevření nové prodejny',
    objective: 'Maximální povědomí o otevření nové pobočky v regionu.',
    mediaTypes: ['City Poster', 'CLV', 'Navigace'],
    cities: ['Ostrava', 'Havířov'],
    surfaces: 38,
    estimatedReach: 640000,
    result: 'Vysoká návštěvnost v prvním týdnu po otevření.',
  },
  {
    id: 'case-recruitment',
    title: 'Regionální náborová kampaň',
    clientLabel: 'Výrobní společnost',
    image: '/offer/case-recruitment.png',
    imageAlt: 'Regionální náborová kampaň',
    objective: 'Oslovit uchazeče o práci v dojezdové vzdálenosti závodu.',
    mediaTypes: ['Tower', 'City Poster'],
    cities: ['Ostrava', 'Orlová', 'Karviná'],
    surfaces: 26,
    estimatedReach: 410000,
    result: 'Výrazný nárůst počtu relevantních uchazečů.',
  },
  {
    id: 'case-seasonal',
    title: 'Sezónní produktová kampaň',
    clientLabel: 'FMCG značka',
    image: '/offer/case-seasonal.png',
    imageAlt: 'Sezónní produktová kampaň',
    objective: 'Podpořit prodej sezónního produktu v letních měsících.',
    mediaTypes: ['Promo lavička', 'City Poster', 'CLV'],
    cities: ['Ostrava', 'Frýdek-Místek', 'Šenov'],
    surfaces: 44,
    estimatedReach: 720000,
    result: 'Nárůst prodejů oproti předchozí sezóně.',
  },
];

const conditions: MockCondition[] = [
  { id: 'cond-1', text: 'Cena zahrnuje pronájem reklamních ploch po celou dobu kampaně.' },
  { id: 'cond-2', text: 'Tisk a instalace jsou zahrnuty dle uvedené kalkulace.' },
  { id: 'cond-3', text: 'Kampaň probíhá ve zvoleném termínu 1. 8. 2026 – 31. 8. 2026.' },
  { id: 'cond-4', text: 'Uvedené ceny jsou bez DPH, není-li stanoveno jinak.' },
  { id: 'cond-5', text: 'Lokality lze upravit po ověření dostupnosti ploch.' },
  { id: 'cond-6', text: 'Finální rezervace ploch se vytvoří po schválení nabídky.' },
];

/** The primary illustrative offer used by both the public and internal demo routes. */
export const mockOffer: MockOffer = {
  id: 'offer-demo-2026-summer',
  publicToken: 'demo-token',
  status: 'SENT',
  title: 'Letní kampaň 2026',
  subtitle: 'Návrh venkovní reklamní kampaně',
  intro:
    'Připravili jsme pro vás návrh venkovní reklamní kampaně zaměřené na maximální viditelnost ve vybraných lokalitách Moravskoslezského kraje. Kombinace City Posterů, Promo laviček, Navigace, CLV a Tower nosičů zajistí dlouhodobou přítomnost vaší značky v místech s vysokou frekvencí pohybu lidí i dopravy.',
  campaignFrom: '1. 8. 2026',
  campaignTo: '31. 8. 2026',
  campaignDays: 31,
  validUntil: '30. 6. 2026',
  cities: ['Ostrava', 'Frýdek-Místek', 'Havířov', 'Orlová', 'Šenov'],
  client: {
    id: 'client-mcd',
    name: "McDonald's ČR s.r.o.",
    logoLabel: "McDonald's",
    contactPerson: 'Marketingové oddělení',
    email: 'marketing@example.com',
  },
  salesperson: {
    id: 'sales-jan-novak',
    name: 'Jan Novák',
    role: 'Obchodní zástupce',
    phone: '+420 777 123 456',
    email: 'jan.novak@seepoint.cz',
    avatar: '/offer/salesperson.png',
  },
  heroImage: '/offer/hero-campaign.png',
  heroImageAlt: 'Vizualizace venkovní reklamní kampaně ve městě',
  stats: {
    carriers: 43,
    mediaTypes: 5,
    locations: 7,
    estimatedReach: 809600,
    estimatedImpressions: 2400000,
    days: 31,
  },
  mediaMix,
  carriers,
  items: [
    { id: 'item-cp', mediaType: 'CITY_POSTER', surfaceCount: 20, price: 30000 },
    { id: 'item-lav', mediaType: 'PROMO_BENCH', surfaceCount: 15, price: 18000 },
    { id: 'item-nav', mediaType: 'NAVIGATION', surfaceCount: 8, price: 12000 },
  ],
  pricing,
  benefits,
  references,
  caseStudies,
  conditions,
};

/** Lookup used by the dynamic public route. Returns the demo offer for any token in this template. */
export function getMockOfferByToken(_token: string): MockOffer {
  return mockOffer;
}
