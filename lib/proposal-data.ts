export type MediaType = 'CITY POSTER' | 'PROMO BENCH' | 'NAVIGATION' | 'CLV' | 'TOWER';

export const mediaColors: Record<MediaType, { hex: string; ring: string; text: string; bg: string }> = {
  'CITY POSTER': { hex: '#0B5FFF', ring: 'ring-brand/30', text: 'text-brand', bg: 'bg-brand/10' },
  'PROMO BENCH': { hex: '#10b981', ring: 'ring-emerald-300', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  NAVIGATION: { hex: '#f59e0b', ring: 'ring-amber-300', text: 'text-amber-600', bg: 'bg-amber-50' },
  CLV: { hex: '#64748b', ring: 'ring-slate-300', text: 'text-slate-600', bg: 'bg-slate-100' },
  TOWER: { hex: '#6366f1', ring: 'ring-indigo-300', text: 'text-indigo-600', bg: 'bg-indigo-50' },
};

export const campaign = {
  client: "McDonald's Czech Republic",
  title: 'Summer Campaign 2026',
  status: 'Valid',
  objective: 'Drive summer menu awareness and footfall across high-traffic urban districts.',
  audience: 'Adults 18–45, urban commuters, families, and students in major Czech cities.',
  duration: '8 weeks · 1 Jun – 26 Jul 2026',
  reach: '809,000',
  mediaMix: '5 media types · 43 carriers',
  locations: '7 cities across the Czech Republic',
};

export const stats = [
  { label: 'Advertising carriers', value: '43', tone: 'brand' },
  { label: 'Locations', value: '7', tone: 'emerald' },
  { label: 'Media types', value: '5', tone: 'amber' },
  { label: 'Estimated reach', value: '809K', tone: 'brand' },
  { label: 'Impressions', value: '2.4M', tone: 'indigo' },
  { label: 'Campaign duration', value: '8 wks', tone: 'slate' },
];

export const mediaMix: {
  type: MediaType;
  image: string;
  description: string;
  price: string;
  reach: string;
  count: number;
}[] = [
  { type: 'CITY POSTER', image: '/proposal/media-city-poster.png', description: 'Backlit large-format posters at premium pedestrian and transit hubs.', price: 'from 12,500 Kč', reach: '210,000', count: 14 },
  { type: 'PROMO BENCH', image: '/proposal/media-promo-bench.png', description: 'Street-level bench panels in parks and residential districts.', price: 'from 4,200 Kč', reach: '96,000', count: 11 },
  { type: 'NAVIGATION', image: '/proposal/media-navigation.png', description: 'Directional wayfinding signage at key intersections.', price: 'from 6,800 Kč', reach: '132,000', count: 8 },
  { type: 'CLV', image: '/proposal/media-clv.png', description: 'Illuminated city light vitrines with premium day & night visibility.', price: 'from 15,900 Kč', reach: '248,000', count: 7 },
  { type: 'TOWER', image: '/proposal/media-tower.png', description: 'Freestanding advertising columns on landmark city squares.', price: 'from 21,000 Kč', reach: '123,000', count: 3 },
];

export const carriers: {
  code: string;
  street: string;
  city: string;
  type: MediaType;
  image: string;
  description: string;
}[] = [
  { code: 'CP-1042', street: 'Václavské náměstí 12', city: 'Praha', type: 'CITY POSTER', image: '/proposal/media-city-poster.png', description: 'Prime pedestrian flow, city centre.' },
  { code: 'TW-0203', street: 'Náměstí Svobody 8', city: 'Brno', type: 'TOWER', image: '/proposal/media-tower.png', description: 'Landmark square, high dwell time.' },
  { code: 'CLV-0781', street: 'Masarykova 44', city: 'Ostrava', type: 'CLV', image: '/proposal/media-clv.png', description: 'Illuminated, 24/7 visibility.' },
  { code: 'PB-0559', street: 'Sady Pětatřicátníků 3', city: 'Plzeň', type: 'PROMO BENCH', image: '/proposal/media-promo-bench.png', description: 'Park entrance, family audience.' },
  { code: 'NAV-0324', street: 'Třída Míru 19', city: 'Pardubice', type: 'NAVIGATION', image: '/proposal/media-navigation.png', description: 'Busy intersection wayfinding.' },
  { code: 'CP-1188', street: 'Moravské náměstí 6', city: 'Brno', type: 'CITY POSTER', image: '/proposal/media-city-poster.png', description: 'Transit hub, commuter traffic.' },
];

export const mapMarkers: { x: number; y: number; type: MediaType }[] = [
  { x: 24, y: 32, type: 'CITY POSTER' },
  { x: 40, y: 55, type: 'CITY POSTER' },
  { x: 62, y: 28, type: 'TOWER' },
  { x: 72, y: 60, type: 'CLV' },
  { x: 34, y: 72, type: 'PROMO BENCH' },
  { x: 55, y: 44, type: 'NAVIGATION' },
  { x: 82, y: 38, type: 'CITY POSTER' },
  { x: 48, y: 22, type: 'CLV' },
  { x: 18, y: 58, type: 'PROMO BENCH' },
  { x: 66, y: 74, type: 'NAVIGATION' },
  { x: 30, y: 46, type: 'TOWER' },
  { x: 76, y: 50, type: 'CITY POSTER' },
];

export const pricing = [
  { label: 'Media rental', value: 612000 },
  { label: 'Printing', value: 84000 },
  { label: 'Installation', value: 46000 },
  { label: 'Graphic design', value: 38000 },
  { label: 'Monitoring', value: 24000 },
];
export const discount = 64000;
export const vatRate = 0.21;

export const whyCampaign = [
  { title: 'Maximum visibility', description: 'Premium formats placed where attention peaks throughout the day.' },
  { title: 'High-traffic locations', description: 'Carriers positioned along the busiest urban corridors.' },
  { title: '24/7 visibility', description: 'Illuminated media keeps your brand present day and night.' },
  { title: 'Regional coverage', description: 'A coordinated footprint across seven major cities.' },
  { title: 'Measured performance', description: 'Independent reach and impression tracking on every carrier.' },
];

export const references = [
  { name: "McDonald's", years: '9 years', campaigns: 42, testimonial: 'Consistently reliable placements with measurable footfall lift.' },
  { name: 'Albert', years: '6 years', campaigns: 31, testimonial: 'Strong regional coverage that supports our store launches.' },
  { name: 'Rossmann', years: '5 years', campaigns: 24, testimonial: 'Great creative execution and dependable reporting.' },
  { name: 'Billa', years: '7 years', campaigns: 28, testimonial: 'A trusted partner for seasonal retail campaigns.' },
  { name: 'KFC', years: '4 years', campaigns: 19, testimonial: 'High-impact formats that drive real awareness.' },
  { name: 'ČEZ', years: '8 years', campaigns: 22, testimonial: 'Professional planning from brief to installation.' },
  { name: 'T-Mobile', years: '6 years', campaigns: 27, testimonial: 'Nationwide reach with precise local targeting.' },
  { name: 'Škoda Auto', years: '10 years', campaigns: 38, testimonial: 'The benchmark for premium outdoor advertising.' },
];

export const caseStudies = [
  {
    client: "McDonald's",
    title: 'Summer Menu Launch 2025',
    image: '/proposal/case-study-1.png',
    objective: 'Boost awareness of the limited summer menu across urban centres.',
    result: '+28% footfall in campaign districts',
    impressions: '3.1M estimated impressions',
  },
  {
    client: 'Albert',
    title: 'Fresh & Local Rollout',
    image: '/proposal/case-study-2.png',
    objective: 'Support 40 store openings with coordinated regional media.',
    result: '+19% brand recall in surveyed regions',
    impressions: '2.6M estimated impressions',
  },
];

export const salesperson = {
  name: 'Kateřina Novotná',
  role: 'Senior Account Manager',
  phone: '+420 725 118 340',
  email: 'katerina.novotna@seepoint.cz',
  image: '/proposal/salesperson.png',
};
