export type ModuleCategory = 'overview' | 'sales' | 'networks' | 'operations' | 'management';

export interface SystemModule {
  id: string;
  name: string;
  description: string;
  category: ModuleCategory;
  badge?: string;
  routes: string[];
}

export const SYSTEM_MODULES: SystemModule[] = [
  // Overview
  {
    id: 'dashboard',
    name: 'Nástěnka & Rychlý přehled',
    description: 'Hlavní souhrnný dashboard a metriky pro manažery, obchodníky a techniky',
    category: 'overview',
    routes: ['/dashboard'],
  },
  {
    id: 'carriers',
    name: 'Evidence & Mapa nosičů',
    description: 'Interaktivní mapa nosičů, detailní karty, GPS souřadnice, fotodokumentace a filtry',
    category: 'overview',
    routes: ['/map', '/carriers'],
  },
  {
    id: 'mobileSurveys',
    name: 'Průzkum lokalit v terénu',
    description: 'Mobilní terénní průzkum a pasportizace nových reklamních míst',
    category: 'overview',
    badge: 'Mobilní',
    routes: ['/mobile-surveys'],
  },
  {
    id: 'myTasks',
    name: 'Moje úkoly',
    description: 'Osobní seznam úkolů, montáží, kontrol a revizí pro techniky a pracovníky',
    category: 'overview',
    routes: ['/my-tasks'],
  },
  {
    id: 'workRoute',
    name: 'Pracovní výjezdy & Trasy',
    description: 'Optimalizace denních výjezdů, trasa k nosičům a mobilní odbavení',
    category: 'overview',
    routes: ['/work/route'],
  },
  {
    id: 'vacations',
    name: 'Dovolená & Absence',
    description: 'Evidence nepřítomností, plánování volna a schvalování žádostí o dovolenou',
    category: 'overview',
    routes: ['/vacations'],
  },

  // Sales
  {
    id: 'salesRadar',
    name: 'AI Obchodní radar',
    description: 'Automatické vyhledávání obchodních příležitostí, tendrů a monitoring konkurence',
    category: 'sales',
    badge: 'AI Engine',
    routes: ['/sales/opportunities'],
  },
  {
    id: 'crm',
    name: 'CRM & Adresář klientů',
    description: 'Evidence klientů, kontaktních osob, poboček, komunikační historie a obratů',
    category: 'sales',
    routes: ['/clients', '/clients/dashboard'],
  },
  {
    id: 'analytics',
    name: 'Analytics & Tržby',
    description: 'Finanční přehledy, tržby z ploch, grafy výkonu a predikce obsazenosti',
    category: 'sales',
    routes: ['/analytics'],
  },
  {
    id: 'offers',
    name: 'Cenové nabídky & Prezentace',
    description: 'Generování profesionálních klientských nabídek, webové prezentace a PDF export',
    category: 'sales',
    routes: ['/offers'],
  },
  {
    id: 'network',
    name: 'B2B Media Network',
    description: 'Propojení s partnerskými agenturami, sdílení volných kapacit a poptávky',
    category: 'sales',
    badge: 'B2B Síť',
    routes: ['/network'],
  },
  {
    id: 'occupancy',
    name: 'Obsazenost ploch & Rezervace',
    description: 'Časová osa obsazenosti, kalendářní blokace a rychlá hromadná rezervace',
    category: 'sales',
    routes: ['/occupancy'],
  },

  // Networks
  {
    id: 'navigation',
    name: 'Navigační systémy (VO)',
    description: 'Plánování navigačních šipek na sloupech VO, AI trasování a zónová regulace',
    category: 'networks',
    badge: 'Specializace',
    routes: ['/navigation', '/navigation/contracts', '/navigation/documentation'],
  },
  {
    id: 'cityGallery',
    name: 'Výstavní & Promo sítě',
    description: 'Správa putovních venkovních výstav, promo stojanů a městských kampaní',
    category: 'networks',
    routes: ['/projects/city-gallery'],
  },
  {
    id: 'cityInventory',
    name: 'Městský inventář & Mobiliář',
    description: 'Správa reklamních laviček, přístřešků MHD a městského mobiliáře',
    category: 'networks',
    routes: ['/projects/city-inventory'],
  },

  // Operations
  {
    id: 'shopping',
    name: 'Firemní nákupy & Pokladna',
    description: 'Sdílený nákupní košík, nákupy materiálu a evidence účtenek s AI OCR',
    category: 'operations',
    routes: ['/shopping'],
  },
  {
    id: 'work',
    name: 'Plán práce & Zakázky',
    description: 'Tvorba pracovních příkazů, výkazy práce (hodinové i úkolové) a schvalování',
    category: 'operations',
    routes: ['/work', '/work-entries', '/my-work-entries'],
  },
  {
    id: 'printProduction',
    name: 'Výroba, Tisk & Grafika',
    description: 'Správa tiskových dat, portál pro schvalování klientem a Kanban nástěnka tisku',
    category: 'operations',
    routes: ['/production'],
  },
  {
    id: 'tasks',
    name: 'Správa všech úkolů',
    description: 'Globální dispečink úkolů pro manažery a zadávání úkolů celému týmu',
    category: 'operations',
    routes: ['/tasks'],
  },
  {
    id: 'settlements',
    name: 'Vyúčtování & Provize',
    description: 'Měsíční uzávěrky práce techniků, provize obchodníků a export výplat',
    category: 'operations',
    routes: ['/settlements', '/my-settlements'],
  },
  {
    id: 'vehicles',
    name: 'Vozový park & Rezervace',
    description: 'Evidence aut, přívěsných vozíků, STK, servisní termíny a kniha jízd',
    category: 'operations',
    routes: ['/vehicles', '/vehicle-reservations'],
  },
  {
    id: 'warehouse',
    name: 'Sklad, Nářadí & AI Skenování',
    description: 'Skladové zásoby, tisk QR štítků, mobilní výdej a AI rozpoznávání materiálu z fotky',
    category: 'operations',
    badge: 'AI Vision',
    routes: ['/warehouse'],
  },
  {
    id: 'printProduction',
    name: 'Výroba, Tisk & Grafická data',
    description: 'Schvalování grafiky s klienty, objednávky do tiskáren a sledování doručení materiálů na sklad',
    category: 'operations',
    badge: 'Novinka',
    routes: ['/production'],
  },

  // Management
  {
    id: 'employees',
    name: 'Zaměstnanci & Tým',
    description: 'Správa uživatelských účtů, sazeb, oprávnění a telefonní seznam',
    category: 'management',
    routes: ['/employees', '/team'],
  },
  {
    id: 'import',
    name: 'Import dat (Excel / CSV)',
    description: 'Hromadný import nosičů, navigačních bodů a fotografií ze souborů',
    category: 'management',
    routes: ['/import'],
  },
];

export const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  overview: '📊 Přehled & Terén',
  sales: '🏢 Obchod & CRM',
  networks: '🗺️ Reklamní sítě & Projekty',
  operations: '🔧 Provoz & Logistika',
  management: '⚙️ Správa & Nástroje',
};

export const PLAN_MODULE_PRESETS: Record<string, string[]> = {
  START: [
    'dashboard',
    'carriers',
    'crm',
    'offers',
    'occupancy',
    'myTasks',
    'import',
  ],
  BUSINESS: [
    'dashboard',
    'carriers',
    'crm',
    'offers',
    'occupancy',
    'myTasks',
    'workRoute',
    'vacations',
    'shopping',
    'work',
    'tasks',
    'settlements',
    'vehicles',
    'warehouse',
    'printProduction',
    'employees',
    'import',
  ],
  PRO: [
    'dashboard',
    'carriers',
    'mobileSurveys',
    'myTasks',
    'workRoute',
    'vacations',
    'salesRadar',
    'crm',
    'analytics',
    'offers',
    'network',
    'occupancy',
    'navigation',
    'cityGallery',
    'cityInventory',
    'shopping',
    'work',
    'tasks',
    'settlements',
    'vehicles',
    'warehouse',
    'printProduction',
    'employees',
    'import',
  ],
  ENTERPRISE: SYSTEM_MODULES.map((m) => m.id),
  INTERNAL: SYSTEM_MODULES.map((m) => m.id),
};

export function getOrganizationEnabledModules(
  organization?: { plan?: string | null; enabledModules?: unknown } | null
): Record<string, boolean> {
  const plan = organization?.plan?.toUpperCase() || 'START';
  const defaultModules = new Set(PLAN_MODULE_PRESETS[plan] || PLAN_MODULE_PRESETS.PRO);

  const result: Record<string, boolean> = {};
  SYSTEM_MODULES.forEach((mod) => {
    result[mod.id] = defaultModules.has(mod.id);
  });

  if (organization?.enabledModules && typeof organization.enabledModules === 'object') {
    const overrides = organization.enabledModules as Record<string, unknown>;
    Object.entries(overrides).forEach(([key, val]) => {
      if (typeof val === 'boolean' && key in result) {
        result[key] = val;
      }
    });
  }

  return result;
}

export function isModuleEnabled(
  organization: { plan?: string | null; enabledModules?: unknown } | null | undefined,
  moduleId: string
): boolean {
  if (!organization) return true;
  const enabledMap = getOrganizationEnabledModules(organization);
  return enabledMap[moduleId] ?? true;
}

export function getModuleIdForPath(pathname: string): string | null {
  for (const mod of SYSTEM_MODULES) {
    if (mod.routes.some((route) => pathname === route || pathname.startsWith(route + '/'))) {
      return mod.id;
    }
  }
  return null;
}
