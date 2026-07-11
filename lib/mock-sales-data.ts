/**
 * Frontend-only mock data for the end-to-end SeePOINT sales workflow.
 *
 * IMPORTANT: This file contains ILLUSTRATIVE sample data only. It is intentionally
 * decoupled from the production database utilities (`lib/db.ts`, Prisma, API routes).
 * Codex can later replace these typed mock objects with real Deal / Client / Contact /
 * Campaign / Offer / Reservation data.
 *
 * Do NOT import production database code here, and do NOT import this file into
 * production data paths.
 */

import { formatCzk, formatNumber, type MockAccentTone } from './mock-offer-data';

export { formatCzk, formatNumber };
export type { MockAccentTone };

/* ------------------------------------------------------------------ */
/* Sales pipeline                                                      */
/* ------------------------------------------------------------------ */

export type PipelineStageKey =
  | 'ENQUIRY'
  | 'DRAFT'
  | 'SENT'
  | 'VIEWED'
  | 'APPROVED'
  | 'EXPIRED';

export type PipelineStageMeta = {
  key: PipelineStageKey;
  label: string;
  description: string;
  tone: MockAccentTone | 'slate' | 'amber' | 'red' | 'emerald';
};

export const PIPELINE_STAGES: PipelineStageMeta[] = [
  { key: 'ENQUIRY', label: 'Nové poptávky', description: 'Čeká na zpracování', tone: 'amber' },
  { key: 'DRAFT', label: 'Rozpracované nabídky', description: 'Připravuje obchodník', tone: 'slate' },
  { key: 'SENT', label: 'Odeslané nabídky', description: 'Doručeno klientovi', tone: 'blue' },
  { key: 'VIEWED', label: 'Zobrazené nabídky', description: 'Klient otevřel odkaz', tone: 'indigo' },
  { key: 'APPROVED', label: 'Schválené nabídky', description: 'Připraveno k převodu', tone: 'emerald' },
  { key: 'EXPIRED', label: 'Expirované nabídky', description: 'Vyžaduje obnovení', tone: 'red' },
];

export type PipelineDeal = {
  id: string;
  stage: PipelineStageKey;
  client: string;
  clientId: string;
  campaign: string;
  value: number;
  surfaces: number;
  owner: string;
  ownerAvatar?: string;
  /** Relative time label, illustrative. */
  updatedLabel: string;
  /** For SENT/VIEWED: days until offer validity expires. */
  validDays?: number;
  /** For VIEWED: how many times the client opened the link. */
  views?: number;
  priority?: 'high' | 'normal';
};

export const pipelineDeals: PipelineDeal[] = [
  { id: 'deal-1', stage: 'ENQUIRY', client: 'Kaufland ČR', clientId: 'cli-kaufland', campaign: 'Otevření prodejny Ostrava-Jih', value: 96000, surfaces: 34, owner: 'Jan Novák', updatedLabel: 'před 20 min', priority: 'high' },
  { id: 'deal-2', stage: 'ENQUIRY', client: 'Fitness Express', clientId: 'cli-fitness', campaign: 'Nábor členů – jaro', value: 42000, surfaces: 18, owner: 'Jan Novák', updatedLabel: 'před 2 hod' },
  { id: 'deal-3', stage: 'ENQUIRY', client: 'Auto Heller', clientId: 'cli-heller', campaign: 'Jarní servisní akce', value: 61500, surfaces: 22, owner: 'Petra Malá', updatedLabel: 'včera' },
  { id: 'deal-4', stage: 'DRAFT', client: 'Albert Česká republika', clientId: 'cli-albert', campaign: 'Letní čerstvé potraviny', value: 128000, surfaces: 46, owner: 'Jan Novák', updatedLabel: 'před 1 hod' },
  { id: 'deal-5', stage: 'DRAFT', client: 'Rossmann', clientId: 'cli-rossmann', campaign: 'Drogerie – sezónní sleva', value: 74000, surfaces: 28, owner: 'Petra Malá', updatedLabel: 'před 3 hod' },
  { id: 'deal-6', stage: 'SENT', client: "McDonald's ČR", clientId: 'cli-mcd', campaign: 'Letní kampaň 2026', value: 84397, surfaces: 43, owner: 'Jan Novák', updatedLabel: 'před 2 dny', validDays: 12 },
  { id: 'deal-7', stage: 'SENT', client: 'BILLA', clientId: 'cli-billa', campaign: 'Znovuotevření pobočky', value: 53200, surfaces: 19, owner: 'Petra Malá', updatedLabel: 'před 4 dny', validDays: 5, priority: 'high' },
  { id: 'deal-8', stage: 'VIEWED', client: 'KFC', clientId: 'cli-kfc', campaign: 'Nové menu – uvedení', value: 67800, surfaces: 25, owner: 'Jan Novák', updatedLabel: 'před 6 hod', validDays: 9, views: 4 },
  { id: 'deal-9', stage: 'VIEWED', client: 'Sportisimo', clientId: 'cli-sportisimo', campaign: 'Zpět do školy', value: 58900, surfaces: 21, owner: 'Petra Malá', updatedLabel: 'včera', validDays: 7, views: 2 },
  { id: 'deal-10', stage: 'APPROVED', client: 'Alza.cz', clientId: 'cli-alza', campaign: 'Black Friday teaser', value: 142500, surfaces: 52, owner: 'Jan Novák', updatedLabel: 'před 1 dnem' },
  { id: 'deal-11', stage: 'APPROVED', client: 'Notino', clientId: 'cli-notino', campaign: 'Valentýn – parfémy', value: 61200, surfaces: 23, owner: 'Petra Malá', updatedLabel: 'před 2 dny' },
  { id: 'deal-12', stage: 'EXPIRED', client: 'Datart', clientId: 'cli-datart', campaign: 'Výprodej elektro', value: 48000, surfaces: 17, owner: 'Jan Novák', updatedLabel: 'před 9 dny' },
];

export function dealsByStage(stage: PipelineStageKey) {
  return pipelineDeals.filter((deal) => deal.stage === stage);
}

export function stageTotals() {
  return PIPELINE_STAGES.map((stage) => {
    const deals = dealsByStage(stage.key);
    return {
      ...stage,
      count: deals.length,
      value: deals.reduce((sum, deal) => sum + deal.value, 0),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Upcoming campaign endings                                           */
/* ------------------------------------------------------------------ */

export type CampaignEnding = {
  id: string;
  client: string;
  campaign: string;
  endsOn: string;
  daysLeft: number;
  surfaces: number;
  renewalValue: number;
};

export const upcomingEndings: CampaignEnding[] = [
  { id: 'end-1', client: 'Albert Česká republika', campaign: 'Jarní kampaň 2026', endsOn: '18. 7. 2026', daysLeft: 6, surfaces: 38, renewalValue: 112000 },
  { id: 'end-2', client: 'Rossmann', campaign: 'Drogerie Q2', endsOn: '25. 7. 2026', daysLeft: 13, surfaces: 24, renewalValue: 68000 },
  { id: 'end-3', client: "McDonald's ČR", campaign: 'Snídaňové menu', endsOn: '31. 7. 2026', daysLeft: 19, surfaces: 30, renewalValue: 74500 },
  { id: 'end-4', client: 'KFC', campaign: 'Letní boxy', endsOn: '9. 8. 2026', daysLeft: 28, surfaces: 16, renewalValue: 41000 },
];

/* ------------------------------------------------------------------ */
/* Sales activity feed                                                 */
/* ------------------------------------------------------------------ */

export type SalesActivity = {
  id: string;
  type: 'view' | 'approve' | 'message' | 'enquiry' | 'send';
  text: string;
  time: string;
};

export const salesActivity: SalesActivity[] = [
  { id: 'act-1', type: 'approve', text: 'Alza.cz schválila nabídku „Black Friday teaser“.', time: 'před 40 min' },
  { id: 'act-2', type: 'view', text: 'KFC otevřel nabídku „Nové menu – uvedení“ (4×).', time: 'před 6 hod' },
  { id: 'act-3', type: 'enquiry', text: 'Nová poptávka od Kaufland ČR.', time: 'před 20 min' },
  { id: 'act-4', type: 'message', text: 'Sportisimo poslalo dotaz k lokalitám.', time: 'včera' },
  { id: 'act-5', type: 'send', text: 'Odeslána nabídka BILLA – „Znovuotevření pobočky“.', time: 'před 4 dny' },
];

/* ------------------------------------------------------------------ */
/* Client CRM                                                          */
/* ------------------------------------------------------------------ */

export type CrmContact = {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  primary?: boolean;
};

export type CrmCommunication = {
  id: string;
  channel: 'email' | 'call' | 'meeting' | 'note';
  subject: string;
  summary: string;
  date: string;
  author: string;
};

export type CrmCampaign = {
  id: string;
  name: string;
  period: string;
  status: 'active' | 'previous';
  surfaces: number;
  value: number;
  mediaTypes: string[];
};

export type CrmFile = {
  id: string;
  name: string;
  kind: 'pdf' | 'image' | 'sheet' | 'doc';
  size: string;
  date: string;
};

export type CrmNote = {
  id: string;
  text: string;
  author: string;
  date: string;
  pinned?: boolean;
};

export type CrmClient = {
  id: string;
  name: string;
  logoLabel: string;
  industry: string;
  companyId: string;
  vatId: string;
  address: string;
  website: string;
  since: string;
  owner: string;
  status: 'active' | 'prospect' | 'inactive';
  healthScore: number;
  totalRevenue: number;
  openValue: number;
  contacts: CrmContact[];
  communications: CrmCommunication[];
  campaigns: CrmCampaign[];
  files: CrmFile[];
  notes: CrmNote[];
};

export const crmClients: CrmClient[] = [
  {
    id: 'cli-mcd',
    name: "McDonald's ČR s.r.o.",
    logoLabel: "McDonald's",
    industry: 'Rychlé občerstvení',
    companyId: '61565709',
    vatId: 'CZ61565709',
    address: 'Řevnická 170/4, 155 21 Praha 5',
    website: 'mcdonalds.cz',
    since: '2019',
    owner: 'Jan Novák',
    status: 'active',
    healthScore: 92,
    totalRevenue: 2145000,
    openValue: 84397,
    contacts: [
      { id: 'c-mcd-1', name: 'Lucie Dvořáková', role: 'Marketing Manager', email: 'lucie.dvorakova@example.com', phone: '+420 771 220 110', primary: true },
      { id: 'c-mcd-2', name: 'Tomáš Beneš', role: 'Regionální koordinátor', email: 'tomas.benes@example.com', phone: '+420 771 220 220' },
    ],
    communications: [
      { id: 'm-mcd-1', channel: 'email', subject: 'Letní kampaň 2026 – nabídka', summary: 'Odeslán odkaz na nabídku s 43 plochami v MSK.', date: '10. 7. 2026', author: 'Jan Novák' },
      { id: 'm-mcd-2', channel: 'call', subject: 'Telefonát k rozpočtu', summary: 'Domluven cílový rozpočet do 90 000 Kč bez DPH.', date: '8. 7. 2026', author: 'Jan Novák' },
      { id: 'm-mcd-3', channel: 'meeting', subject: 'Plánovací schůzka Q3', summary: 'Diskuse o pokrytí Ostravy a Frýdku-Místku.', date: '2. 7. 2026', author: 'Jan Novák' },
    ],
    campaigns: [
      { id: 'cmp-mcd-1', name: 'Letní kampaň 2026', period: '1. 8. – 31. 8. 2026', status: 'active', surfaces: 43, value: 84397, mediaTypes: ['City Poster', 'CLV', 'Navigace'] },
      { id: 'cmp-mcd-2', name: 'Snídaňové menu', period: '1. 5. – 31. 5. 2026', status: 'previous', surfaces: 30, value: 74500, mediaTypes: ['City Poster', 'Promo lavička'] },
      { id: 'cmp-mcd-3', name: 'McMenu podzim', period: '1. 10. – 31. 10. 2025', status: 'previous', surfaces: 36, value: 88000, mediaTypes: ['CLV', 'Tower'] },
    ],
    files: [
      { id: 'f-mcd-1', name: 'Nabidka_Letni_2026.pdf', kind: 'pdf', size: '2,4 MB', date: '10. 7. 2026' },
      { id: 'f-mcd-2', name: 'Vizual_leto_final.png', kind: 'image', size: '5,1 MB', date: '9. 7. 2026' },
      { id: 'f-mcd-3', name: 'Kalkulace_leto.xlsx', kind: 'sheet', size: '48 kB', date: '8. 7. 2026' },
    ],
    notes: [
      { id: 'n-mcd-1', text: 'Preferují podsvícené plochy v centru. Fakturace vždy po ukončení kampaně.', author: 'Jan Novák', date: '8. 7. 2026', pinned: true },
      { id: 'n-mcd-2', text: 'Grafiku dodává centrála, nutná korektura loga.', author: 'Petra Malá', date: '2. 7. 2026' },
    ],
  },
  {
    id: 'cli-albert',
    name: 'Albert Česká republika, s.r.o.',
    logoLabel: 'Albert',
    industry: 'Maloobchod – potraviny',
    companyId: '44012373',
    vatId: 'CZ44012373',
    address: 'Radlická 520/117, 158 00 Praha 5',
    website: 'albert.cz',
    since: '2020',
    owner: 'Jan Novák',
    status: 'active',
    healthScore: 88,
    totalRevenue: 1680000,
    openValue: 128000,
    contacts: [
      { id: 'c-alb-1', name: 'Martin Kučera', role: 'Trade Marketing', email: 'martin.kucera@example.com', phone: '+420 772 330 110', primary: true },
    ],
    communications: [
      { id: 'm-alb-1', channel: 'email', subject: 'Letní čerstvé potraviny', summary: 'Připravujeme draft nabídky na 46 ploch.', date: '11. 7. 2026', author: 'Jan Novák' },
      { id: 'm-alb-2', channel: 'note', subject: 'Interní poznámka', summary: 'Chtějí důraz na sídlištní lokality.', date: '9. 7. 2026', author: 'Jan Novák' },
    ],
    campaigns: [
      { id: 'cmp-alb-1', name: 'Jarní kampaň 2026', period: '1. 4. – 18. 7. 2026', status: 'active', surfaces: 38, value: 112000, mediaTypes: ['City Poster', 'Promo lavička'] },
      { id: 'cmp-alb-2', name: 'Vánoční pečivo', period: '1. 12. – 24. 12. 2025', status: 'previous', surfaces: 42, value: 134000, mediaTypes: ['CLV', 'City Poster'] },
    ],
    files: [
      { id: 'f-alb-1', name: 'Brief_leto_2026.pdf', kind: 'pdf', size: '1,1 MB', date: '9. 7. 2026' },
    ],
    notes: [
      { id: 'n-alb-1', text: 'Rozhodují o rozpočtu čtvrtletně. Klíčový je zásah v obytných zónách.', author: 'Jan Novák', date: '9. 7. 2026', pinned: true },
    ],
  },
  {
    id: 'cli-kfc',
    name: 'KFC (AmRest s.r.o.)',
    logoLabel: 'KFC',
    industry: 'Rychlé občerstvení',
    companyId: '25843151',
    vatId: 'CZ25843151',
    address: 'Fričova 2094/2, 130 00 Praha 3',
    website: 'kfc.cz',
    since: '2022',
    owner: 'Jan Novák',
    status: 'active',
    healthScore: 79,
    totalRevenue: 640000,
    openValue: 67800,
    contacts: [
      { id: 'c-kfc-1', name: 'Aneta Horáková', role: 'Brand Manager', email: 'aneta.horakova@example.com', phone: '+420 773 440 110', primary: true },
    ],
    communications: [
      { id: 'm-kfc-1', channel: 'email', subject: 'Nové menu – uvedení', summary: 'Klient otevřel nabídku 4×, čekáme na reakci.', date: '11. 7. 2026', author: 'Jan Novák' },
    ],
    campaigns: [
      { id: 'cmp-kfc-1', name: 'Letní boxy', period: '1. 6. – 9. 8. 2026', status: 'active', surfaces: 16, value: 41000, mediaTypes: ['City Poster'] },
    ],
    files: [],
    notes: [
      { id: 'n-kfc-1', text: 'Rychlá komunikace přes e-mail, rozhodují operativně.', author: 'Jan Novák', date: '11. 7. 2026' },
    ],
  },
  {
    id: 'cli-rossmann',
    name: 'Rossmann, spol. s r.o.',
    logoLabel: 'Rossmann',
    industry: 'Drogerie',
    companyId: '61246093',
    vatId: 'CZ61246093',
    address: 'Na Pankráci 1683/127, 140 00 Praha 4',
    website: 'rossmann.cz',
    since: '2021',
    owner: 'Petra Malá',
    status: 'active',
    healthScore: 84,
    totalRevenue: 910000,
    openValue: 74000,
    contacts: [
      { id: 'c-ros-1', name: 'Jana Veselá', role: 'Marketing Specialist', email: 'jana.vesela@example.com', phone: '+420 774 550 110', primary: true },
    ],
    communications: [
      { id: 'm-ros-1', channel: 'call', subject: 'Sezónní sleva', summary: 'Domluven termín kampaně na srpen.', date: '10. 7. 2026', author: 'Petra Malá' },
    ],
    campaigns: [
      { id: 'cmp-ros-1', name: 'Drogerie Q2', period: '1. 4. – 25. 7. 2026', status: 'active', surfaces: 24, value: 68000, mediaTypes: ['City Poster', 'Navigace'] },
    ],
    files: [],
    notes: [],
  },
  {
    id: 'cli-alza',
    name: 'Alza.cz a.s.',
    logoLabel: 'Alza',
    industry: 'E-commerce – elektro',
    companyId: '27082440',
    vatId: 'CZ27082440',
    address: 'Jankovcova 1522/53, 170 00 Praha 7',
    website: 'alza.cz',
    since: '2023',
    owner: 'Jan Novák',
    status: 'active',
    healthScore: 95,
    totalRevenue: 1240000,
    openValue: 142500,
    contacts: [
      { id: 'c-alz-1', name: 'Petr Svoboda', role: 'Head of Offline Marketing', email: 'petr.svoboda@example.com', phone: '+420 775 660 110', primary: true },
    ],
    communications: [
      { id: 'm-alz-1', channel: 'email', subject: 'Black Friday teaser – schváleno', summary: 'Klient digitálně schválil nabídku.', date: '11. 7. 2026', author: 'Jan Novák' },
    ],
    campaigns: [
      { id: 'cmp-alz-1', name: 'Black Friday teaser', period: '10. 11. – 27. 11. 2026', status: 'active', surfaces: 52, value: 142500, mediaTypes: ['Tower', 'CLV', 'City Poster'] },
    ],
    files: [],
    notes: [
      { id: 'n-alz-1', text: 'Nejrychleji rostoucí klient. Zajímá je dominance na hlavních tazích.', author: 'Jan Novák', date: '11. 7. 2026', pinned: true },
    ],
  },
];

export function getCrmClient(id: string): CrmClient | undefined {
  return crmClients.find((client) => client.id === id);
}

/* ------------------------------------------------------------------ */
/* New campaign wizard                                                 */
/* ------------------------------------------------------------------ */

export type WizardStep = {
  key: string;
  label: string;
  description: string;
};

export const wizardSteps: WizardStep[] = [
  { key: 'client', label: 'Klient', description: 'Pro koho kampaň připravujeme' },
  { key: 'objective', label: 'Cíl kampaně', description: 'Čeho chce klient dosáhnout' },
  { key: 'budget', label: 'Rozpočet', description: 'Orientační investice' },
  { key: 'dates', label: 'Termín', description: 'Období kampaně' },
  { key: 'region', label: 'Region', description: 'Kde chceme být vidět' },
  { key: 'audience', label: 'Cílová skupina', description: 'Koho oslovujeme' },
  { key: 'media', label: 'Výběr médií', description: 'Skladba nosičů' },
];

export type CampaignObjective = {
  id: string;
  icon: 'store' | 'users' | 'tag' | 'megaphone' | 'trending' | 'calendar';
  title: string;
  description: string;
};

export const campaignObjectives: CampaignObjective[] = [
  { id: 'obj-awareness', icon: 'megaphone', title: 'Budování povědomí', description: 'Maximální zásah a viditelnost značky v regionu.' },
  { id: 'obj-opening', icon: 'store', title: 'Otevření pobočky', description: 'Navigace a lokální podpora nové provozovny.' },
  { id: 'obj-promo', icon: 'tag', title: 'Podpora akce / slevy', description: 'Krátkodobá kampaň k prodejní akci.' },
  { id: 'obj-recruit', icon: 'users', title: 'Nábor zaměstnanců', description: 'Oslovení uchazečů v dojezdové vzdálenosti.' },
  { id: 'obj-launch', icon: 'trending', title: 'Uvedení produktu', description: 'Podpora launche nového produktu nebo menu.' },
  { id: 'obj-seasonal', icon: 'calendar', title: 'Sezónní kampaň', description: 'Opakovaná sezónní komunikace.' },
];

export type BudgetTier = {
  id: string;
  label: string;
  range: string;
  surfaces: string;
  recommended?: boolean;
};

export const budgetTiers: BudgetTier[] = [
  { id: 'bud-s', label: 'Lokální', range: 'do 40 000 Kč', surfaces: '10–20 ploch' },
  { id: 'bud-m', label: 'Regionální', range: '40 000 – 90 000 Kč', surfaces: '20–45 ploch', recommended: true },
  { id: 'bud-l', label: 'Krajská dominance', range: '90 000 – 180 000 Kč', surfaces: '45–80 ploch' },
  { id: 'bud-xl', label: 'Nadregionální', range: '180 000 Kč a více', surfaces: '80+ ploch' },
];

export type RegionOption = {
  id: string;
  name: string;
  surfaces: number;
  selected?: boolean;
};

export const regionOptions: RegionOption[] = [
  { id: 'reg-ostrava', name: 'Ostrava', surfaces: 142, selected: true },
  { id: 'reg-fm', name: 'Frýdek-Místek', surfaces: 58, selected: true },
  { id: 'reg-havirov', name: 'Havířov', surfaces: 46 },
  { id: 'reg-karvina', name: 'Karviná', surfaces: 38 },
  { id: 'reg-orlova', name: 'Orlová', surfaces: 21 },
  { id: 'reg-opava', name: 'Opava', surfaces: 44 },
  { id: 'reg-trinec', name: 'Třinec', surfaces: 29 },
];

export type AudienceOption = {
  id: string;
  label: string;
  hint: string;
};

export const audienceOptions: AudienceOption[] = [
  { id: 'aud-commuters', label: 'Dojíždějící / řidiči', hint: 'Hlavní tahy a výpadovky' },
  { id: 'aud-families', label: 'Rodiny s dětmi', hint: 'Obytné zóny a sídliště' },
  { id: 'aud-shoppers', label: 'Nakupující', hint: 'Okolí prodejen a OC' },
  { id: 'aud-young', label: 'Mladí 18–34', hint: 'Centrum a univerzity' },
  { id: 'aud-workers', label: 'Zaměstnanci', hint: 'Průmyslové zóny' },
];

export type MediaOption = {
  key: string;
  name: string;
  tone: MockAccentTone;
  image: string;
  available: number;
  pricePerSurface: number;
  reachPerSurface: number;
  description: string;
};

export const mediaOptions: MediaOption[] = [
  { key: 'CITY_POSTER', name: 'City Poster', tone: 'blue', image: '/offer/media-city-poster.png', available: 62, pricePerSurface: 1500, reachPerSurface: 26000, description: 'Frekventované městské lokality.' },
  { key: 'PROMO_BENCH', name: 'Promo lavička', tone: 'purple', image: '/offer/media-promo-bench.png', available: 40, pricePerSurface: 1200, reachPerSurface: 14000, description: 'Dlouhodobá viditelnost v zónách.' },
  { key: 'NAVIGATION', name: 'Navigace', tone: 'orange', image: '/offer/media-navigation.png', available: 24, pricePerSurface: 1500, reachPerSurface: 9950, description: 'Směrovky u prodejen.' },
  { key: 'CLV', name: 'CLV', tone: 'green', image: '/offer/media-clv.png', available: 18, pricePerSurface: 1800, reachPerSurface: 29000, description: 'Podsvícené vitríny v centru.' },
  { key: 'TOWER', name: 'Tower', tone: 'indigo', image: '/offer/media-tower.png', available: 9, pricePerSurface: 2833, reachPerSurface: 32600, description: 'Dominantní nosiče na křižovatkách.' },
];

export type RecommendedPackage = {
  id: string;
  name: string;
  tagline: string;
  surfaces: number;
  price: number;
  reach: number;
  mix: { name: string; count: number; tone: MockAccentTone }[];
  recommended?: boolean;
};

export const recommendedPackages: RecommendedPackage[] = [
  {
    id: 'pkg-starter',
    name: 'Lokální start',
    tagline: 'Vhodné pro jednu lokalitu a kratší kampaň.',
    surfaces: 18,
    price: 38000,
    reach: 310000,
    mix: [
      { name: 'City Poster', count: 12, tone: 'blue' },
      { name: 'Navigace', count: 6, tone: 'orange' },
    ],
  },
  {
    id: 'pkg-regional',
    name: 'Regionální mix',
    tagline: 'Vyvážená kombinace pro krajský zásah.',
    surfaces: 43,
    price: 84000,
    reach: 809600,
    recommended: true,
    mix: [
      { name: 'City Poster', count: 20, tone: 'blue' },
      { name: 'Promo lavička', count: 15, tone: 'purple' },
      { name: 'Navigace', count: 8, tone: 'orange' },
    ],
  },
  {
    id: 'pkg-dominance',
    name: 'Krajská dominance',
    tagline: 'Maximální viditelnost napříč regionem.',
    surfaces: 72,
    price: 156000,
    reach: 1480000,
    mix: [
      { name: 'City Poster', count: 34, tone: 'blue' },
      { name: 'CLV', count: 14, tone: 'green' },
      { name: 'Tower', count: 6, tone: 'indigo' },
      { name: 'Promo lavička', count: 18, tone: 'purple' },
    ],
  },
];

export type AutoSuggestion = {
  id: string;
  code: string;
  mediaType: string;
  tone: MockAccentTone;
  city: string;
  locality: string;
  reason: string;
  reach: number;
  price: number;
};

export const autoSuggestions: AutoSuggestion[] = [
  { id: 'sug-1', code: 'CP0738', mediaType: 'City Poster', tone: 'blue', city: 'Ostrava', locality: 'Výškovická', reason: 'Nejvyšší frekvence dopravy ve vybrané zóně', reach: 32000, price: 1500 },
  { id: 'sug-2', code: 'CLV0210', mediaType: 'CLV', tone: 'green', city: 'Frýdek-Místek', locality: 'Beskydská', reason: 'Podsvícená plocha odpovídá cíli povědomí', reach: 29000, price: 1800 },
  { id: 'sug-3', code: 'LAV0156', mediaType: 'Promo lavička', tone: 'purple', city: 'Ostrava', locality: 'Hlavní třída', reason: 'Vysoký pěší provoz v cílové skupině', reach: 15000, price: 1200 },
  { id: 'sug-4', code: 'TOW0044', mediaType: 'Tower', tone: 'indigo', city: 'Havířov', locality: 'Dlouhá třída', reason: 'Dominantní zásah na hlavní křižovatce', reach: 32600, price: 2833 },
  { id: 'sug-5', code: 'NAV0102', mediaType: 'Navigace', tone: 'orange', city: 'Ostrava', locality: 'Karolina', reason: 'Navádí k nejbližší prodejně klienta', reach: 9950, price: 1500 },
];

/* ------------------------------------------------------------------ */
/* Campaign planner                                                    */
/* ------------------------------------------------------------------ */

export type PlannerTrack = {
  id: string;
  mediaType: string;
  tone: MockAccentTone;
  surfaces: number;
  /** Start / end offsets as % of the timeline width (illustrative). */
  start: number;
  width: number;
  label: string;
};

export const plannerTracks: PlannerTrack[] = [
  { id: 'trk-cp', mediaType: 'City Poster', tone: 'blue', surfaces: 20, start: 0, width: 100, label: '1. 8. – 31. 8.' },
  { id: 'trk-lav', mediaType: 'Promo lavička', tone: 'purple', surfaces: 15, start: 0, width: 100, label: '1. 8. – 31. 8.' },
  { id: 'trk-nav', mediaType: 'Navigace', tone: 'orange', surfaces: 8, start: 16, width: 84, label: '6. 8. – 31. 8.' },
  { id: 'trk-clv', mediaType: 'CLV', tone: 'green', surfaces: 5, start: 0, width: 65, label: '1. 8. – 20. 8.' },
];

export const plannerWeeks = ['Týden 31', 'Týden 32', 'Týden 33', 'Týden 34', 'Týden 35'];

export type AvailabilityCell = {
  surface: string;
  city: string;
  tone: MockAccentTone;
  /** Availability per planner week: 'free' | 'booked' | 'selected' | 'conflict'. */
  weeks: ('free' | 'booked' | 'selected' | 'conflict')[];
};

export const availabilityMatrix: AvailabilityCell[] = [
  { surface: 'CP0738', city: 'Ostrava', tone: 'blue', weeks: ['selected', 'selected', 'selected', 'selected', 'free'] },
  { surface: 'CP0412', city: 'Orlová', tone: 'blue', weeks: ['selected', 'selected', 'selected', 'selected', 'free'] },
  { surface: 'LAV0156', city: 'Ostrava', tone: 'purple', weeks: ['booked', 'conflict', 'selected', 'selected', 'free'] },
  { surface: 'NAV0102', city: 'Ostrava', tone: 'orange', weeks: ['free', 'selected', 'selected', 'selected', 'selected'] },
  { surface: 'CLV0210', city: 'Frýdek-Místek', tone: 'green', weeks: ['selected', 'selected', 'selected', 'free', 'free'] },
  { surface: 'TOW0044', city: 'Havířov', tone: 'indigo', weeks: ['selected', 'selected', 'conflict', 'selected', 'free'] },
];

export type PlannerConflict = {
  id: string;
  surface: string;
  city: string;
  client: string;
  period: string;
  severity: 'hard' | 'soft';
  suggestion: string;
};

export const plannerConflicts: PlannerConflict[] = [
  { id: 'cf-1', surface: 'LAV0156', city: 'Ostrava', client: 'Rossmann', period: 'Týden 32 (4.–10. 8.)', severity: 'hard', suggestion: 'Nahradit plochou LAV0161 (Ostrava, 300 m)' },
  { id: 'cf-2', surface: 'TOW0044', city: 'Havířov', client: 'Datart', period: 'Týden 33 (11.–17. 8.)', severity: 'soft', suggestion: 'Posunout začátek o 5 dní nebo sdílet plochu' },
];

export const plannerReach = {
  netReach: 809600,
  frequency: 8.4,
  impressions: 2400000,
  surfaces: 48,
  cities: 5,
};

/* ------------------------------------------------------------------ */
/* Pricing builder                                                     */
/* ------------------------------------------------------------------ */

export type PricingLine = {
  id: string;
  category: 'media' | 'production' | 'service';
  label: string;
  detail: string;
  qty: number;
  unit: string;
  unitPrice: number;
};

export const pricingLines: PricingLine[] = [
  { id: 'pl-cp', category: 'media', label: 'City Poster', detail: '20 ploch × 31 dní', qty: 20, unit: 'plocha', unitPrice: 1500 },
  { id: 'pl-lav', category: 'media', label: 'Promo lavička', detail: '15 ploch × 31 dní', qty: 15, unit: 'plocha', unitPrice: 1200 },
  { id: 'pl-nav', category: 'media', label: 'Navigace', detail: '8 ploch × 31 dní', qty: 8, unit: 'plocha', unitPrice: 1500 },
  { id: 'pl-print', category: 'production', label: 'Tisk', detail: 'Latexový tisk, 43 ks', qty: 43, unit: 'ks', unitPrice: 174 },
  { id: 'pl-install', category: 'production', label: 'Instalace', detail: 'Výlep a montáž', qty: 43, unit: 'ks', unitPrice: 116 },
  { id: 'pl-graphic', category: 'service', label: 'Grafické zpracování', detail: 'Příprava a korektura', qty: 1, unit: 'projekt', unitPrice: 3000 },
  { id: 'pl-monitor', category: 'service', label: 'Servis a monitoring', detail: 'Kontrola a fotodokumentace', qty: 1, unit: 'projekt', unitPrice: 2000 },
];

export const pricingCategoryLabels: Record<PricingLine['category'], string> = {
  media: 'Pronájem ploch',
  production: 'Výroba a instalace',
  service: 'Služby',
};

export const pricingConfig = {
  discountPercent: 10,
  vatPercent: 21,
  /** Illustrative internal figures (not shown to client). */
  costBase: 52000,
};

export function computePricing() {
  const subtotal = pricingLines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0);
  const discount = Math.round((subtotal * pricingConfig.discountPercent) / 100);
  const afterDiscount = subtotal - discount;
  const vat = Math.round(afterDiscount * (pricingConfig.vatPercent / 100) * 100) / 100;
  const total = afterDiscount + vat;
  const margin = afterDiscount - pricingConfig.costBase;
  const marginPercent = Math.round((margin / afterDiscount) * 100);
  return { subtotal, discount, afterDiscount, vat, total, margin, marginPercent };
}

/* ------------------------------------------------------------------ */
/* Internal approval                                                   */
/* ------------------------------------------------------------------ */

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: 'ok' | 'warning' | 'error';
};

export const approvalChecklist: ChecklistItem[] = [
  { id: 'chk-client', label: 'Klient a fakturační údaje', detail: 'IČO, DIČ a kontaktní osoba vyplněny.', status: 'ok' },
  { id: 'chk-dates', label: 'Termín kampaně', detail: '1. 8. – 31. 8. 2026 (31 dní).', status: 'ok' },
  { id: 'chk-avail', label: 'Dostupnost ploch', detail: '46 z 48 ploch volných ve zvoleném termínu.', status: 'warning' },
  { id: 'chk-photos', label: 'Fotodokumentace ploch', detail: 'Chybí fotky u 3 ploch (LAV0156, NAV0102, TOW0044).', status: 'error' },
  { id: 'chk-gps', label: 'GPS souřadnice', detail: 'Chybí GPS u plochy CP0412.', status: 'error' },
  { id: 'chk-price', label: 'Kalkulace a marže', detail: 'Marže 25 % nad interním minimem.', status: 'ok' },
  { id: 'chk-conflict', label: 'Kontrola kolizí', detail: '2 kolize k vyřešení (1 tvrdá, 1 měkká).', status: 'warning' },
  { id: 'chk-graphic', label: 'Grafické podklady', detail: 'Vizuál dodán a schválen klientem.', status: 'ok' },
];

export type MissingAsset = {
  id: string;
  surface: string;
  city: string;
  type: 'photo' | 'gps';
  tone: MockAccentTone;
};

export const missingAssets: MissingAsset[] = [
  { id: 'ma-1', surface: 'LAV0156', city: 'Ostrava', type: 'photo', tone: 'purple' },
  { id: 'ma-2', surface: 'NAV0102', city: 'Ostrava', type: 'photo', tone: 'orange' },
  { id: 'ma-3', surface: 'TOW0044', city: 'Havířov', type: 'photo', tone: 'indigo' },
  { id: 'ma-4', surface: 'CP0412', city: 'Orlová', type: 'gps', tone: 'blue' },
];

/* ------------------------------------------------------------------ */
/* Client feedback                                                     */
/* ------------------------------------------------------------------ */

export type FeedbackEvent = {
  id: string;
  type: 'sent' | 'viewed' | 'question' | 'revision' | 'approved';
  actor: string;
  text: string;
  time: string;
};

export const feedbackTimeline: FeedbackEvent[] = [
  { id: 'fb-1', type: 'sent', actor: 'Jan Novák', text: 'Nabídka odeslána klientovi odkazem.', time: '10. 7. 2026 09:12' },
  { id: 'fb-2', type: 'viewed', actor: "McDonald's ČR", text: 'Klient otevřel nabídku (1. zobrazení).', time: '10. 7. 2026 11:40' },
  { id: 'fb-3', type: 'question', actor: "McDonald's ČR", text: 'Dotaz: Je možné přidat plochu u OC Forum Nová Karolina?', time: '10. 7. 2026 12:05' },
  { id: 'fb-4', type: 'revision', actor: 'Jan Novák', text: 'Doplněna plocha CLV0233 a upravena kalkulace.', time: '10. 7. 2026 14:20' },
  { id: 'fb-5', type: 'viewed', actor: "McDonald's ČR", text: 'Klient znovu otevřel nabídku (4. zobrazení).', time: '11. 7. 2026 08:30' },
];

export type FeedbackRequest = {
  id: string;
  status: 'open' | 'resolved';
  author: string;
  text: string;
  date: string;
};

export const feedbackRequests: FeedbackRequest[] = [
  { id: 'req-1', status: 'resolved', author: 'Lucie Dvořáková', text: 'Přidat plochu u OC Forum Nová Karolina.', date: '10. 7. 2026' },
  { id: 'req-2', status: 'open', author: 'Lucie Dvořáková', text: 'Prosím o posun začátku kampaně na 3. 8.', date: '11. 7. 2026' },
];

/* ------------------------------------------------------------------ */
/* Campaign conversion                                                 */
/* ------------------------------------------------------------------ */

export type ConversionStep = {
  id: string;
  label: string;
  detail: string;
  status: 'done' | 'active' | 'pending';
};

export const conversionSteps: ConversionStep[] = [
  { id: 'cv-1', label: 'Vytvoření kampaně', detail: 'Založení kampaně v systému', status: 'done' },
  { id: 'cv-2', label: 'Rezervace ploch', detail: '48 ploch → rezervace v obsazenosti', status: 'active' },
  { id: 'cv-3', label: 'Pracovní příkazy', detail: 'Tisk, výlep a instalace', status: 'pending' },
  { id: 'cv-4', label: 'Fakturace', detail: 'Vytvoření zálohové faktury', status: 'pending' },
  { id: 'cv-5', label: 'Notifikace týmu', detail: 'Informování provozu a klienta', status: 'pending' },
];

export type ReservationRow = {
  id: string;
  surface: string;
  city: string;
  tone: MockAccentTone;
  period: string;
  status: 'created' | 'processing';
};

export const conversionReservations: ReservationRow[] = [
  { id: 'rv-1', surface: 'CP0738', city: 'Ostrava', tone: 'blue', period: '1. 8. – 31. 8.', status: 'created' },
  { id: 'rv-2', surface: 'CP0412', city: 'Orlová', tone: 'blue', period: '1. 8. – 31. 8.', status: 'created' },
  { id: 'rv-3', surface: 'LAV0156', city: 'Ostrava', tone: 'purple', period: '1. 8. – 31. 8.', status: 'processing' },
  { id: 'rv-4', surface: 'NAV0102', city: 'Ostrava', tone: 'orange', period: '6. 8. – 31. 8.', status: 'processing' },
  { id: 'rv-5', surface: 'CLV0210', city: 'Frýdek-Místek', tone: 'green', period: '1. 8. – 20. 8.', status: 'created' },
];

/* ------------------------------------------------------------------ */
/* Success screen                                                      */
/* ------------------------------------------------------------------ */

export const successSummary = {
  campaign: 'Letní kampaň 2026',
  client: "McDonald's ČR s.r.o.",
  campaignId: 'CMP-2026-0142',
  surfaces: 48,
  reservations: 48,
  value: 84397.5,
  period: '1. 8. 2026 – 31. 8. 2026',
  owner: 'Jan Novák',
  ownerRole: 'Obchodní zástupce',
  ownerAvatar: '/offer/salesperson.png',
};

export type SuccessMilestone = {
  id: string;
  label: string;
  date: string;
  owner: string;
  done?: boolean;
};

export const successTimeline: SuccessMilestone[] = [
  { id: 'ms-1', label: 'Kampaň schválena klientem', date: '11. 7. 2026', owner: "McDonald's ČR", done: true },
  { id: 'ms-2', label: 'Rezervace ploch vytvořeny', date: '11. 7. 2026', owner: 'Systém', done: true },
  { id: 'ms-3', label: 'Dodání grafiky do tisku', date: '18. 7. 2026', owner: 'Klient' },
  { id: 'ms-4', label: 'Tisk a příprava materiálů', date: '24. 7. 2026', owner: 'Produkce' },
  { id: 'ms-5', label: 'Instalace ploch', date: '29. 7. – 31. 7. 2026', owner: 'Provoz' },
  { id: 'ms-6', label: 'Zahájení kampaně', date: '1. 8. 2026', owner: 'Provoz' },
];

export type NextAction = {
  id: string;
  label: string;
  detail: string;
  href: string;
  icon: 'calendar' | 'briefcase' | 'file' | 'users' | 'bell';
};

export const successNextActions: NextAction[] = [
  { id: 'na-1', label: 'Naplánovat pracovní výjezd', detail: 'Přiřadit instalaci technikům', href: '/work', icon: 'briefcase' },
  { id: 'na-2', label: 'Vytvořit zálohovou fakturu', detail: 'Fakturace 50 % předem', href: '/settlements', icon: 'file' },
  { id: 'na-3', label: 'Zkontrolovat obsazenost', detail: '48 nových rezervací', href: '/occupancy', icon: 'calendar' },
  { id: 'na-4', label: 'Informovat klienta', detail: 'Potvrzení termínu instalace', href: '/sales/crm/cli-mcd', icon: 'bell' },
];

/* ------------------------------------------------------------------ */
/* Workflow stepper                                                    */
/* ------------------------------------------------------------------ */

export type WorkflowStage = {
  key: string;
  label: string;
  href: string;
  step: number;
};

export const workflowStages: WorkflowStage[] = [
  { key: 'new', label: 'Zadání', href: '/sales/new', step: 1 },
  { key: 'planner', label: 'Plánování', href: '/sales/planner', step: 2 },
  { key: 'pricing', label: 'Cenotvorba', href: '/sales/pricing', step: 3 },
  { key: 'approval', label: 'Interní schválení', href: '/sales/approval', step: 4 },
  { key: 'proposal', label: 'Nabídka klientovi', href: '/offers/preview', step: 5 },
  { key: 'feedback', label: 'Zpětná vazba', href: '/sales/feedback', step: 6 },
  { key: 'conversion', label: 'Převod', href: '/sales/conversion', step: 7 },
  { key: 'success', label: 'Hotovo', href: '/sales/success', step: 8 },
];
