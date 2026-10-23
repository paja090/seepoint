import type { AppNavIcon } from '@/components/AppNavLink';
import { canAccess, type AppRole, type AppSection } from './rbac';
import { getModuleIdForPath, isModuleAvailable } from './organization-modules';

// String icon IDs keep the server-to-client navigation payload serializable.
export type NavItem = [href: string, label: string, icon: AppNavIcon, section: AppSection];
export type NavGroup = { label: string; items: NavItem[] };
export type NavigationHubIcon =
  | 'sparkles'
  | 'briefcaseBusiness'
  | 'mapPinned'
  | 'wrench'
  | 'calendarCheck'
  | 'package'
  | 'settings';

export type NavigationHub = {
  id: string;
  label: string;
  shortLabel?: string;
  icon: NavigationHubIcon;
  groups: NavGroup[];
};

export const navigationHubs: NavigationHub[] = [
  { id: 'ai', label: 'AI Hub', shortLabel: 'AI', icon: 'sparkles', groups: [
    { label: 'AI obchod', items: [
      ["/commercial","AI Obchodní centrum","briefcaseBusiness","commercial"],
      ["/ai-inbox","AI Inbox","mail","aiInbox"],
      ["/sales/opportunities","AI Obchodní radar","radar","clients"],
      ["/occupancy/ai","AI Obsazenost","calendarRange","aiOccupancy"]
    ] },
    { label: 'AI provoz', items: [
      ["/realization","AI Řízení realizace","workflow","realization"]
    ] }
  ] },
  { id: 'sales', label: 'Obchod & CRM', shortLabel: 'Obchod', icon: 'briefcaseBusiness', groups: [
    { label: 'Obchod & Přehled', items: [
      ["/dashboard","Nástěnka / Přehled","barChart3","dashboard"],
      ["/offers","Nabídky","badgeDollarSign","offers"],
      ["/analytics","Analytics & Tržby","barChart3","clients"],
      ["/network","B2B Media Network","globe","offers"]
    ] },
    { label: 'CRM & Podpora', items: [
      ["/clients/dashboard","CRM Dashboard","barChart3","clients"],
      ["/clients","Klienti & Adresář","users","clients"],
      ["/academy","Návody & Akademie","fileText","academy"]
    ] }
  ] },
  { id: 'spaces', label: 'Plochy & Sítě', shortLabel: 'Plochy', icon: 'mapPinned', groups: [
    { label: 'Evidence & Obsazenost', items: [
      ["/map","Mapa nosičů","map","map"],
      ["/carriers","Evidence nosičů","panelsTopLeft","carriers"],
      ["/occupancy","Obsazenost ploch","calendarRange","occupancy"],
      ["/field-survey","Terénní průzkum ploch","camera","fieldSurvey"],
      ["/mobile-surveys","Průzkum lokalit","mapPinned","navigationProjects"]
    ] },
    { label: 'Reklamní sítě & Projekty', items: [
      ["/navigation","Navigační reklama (VO)","mapPinned","navigationProjects"],
      ["/projects/city-gallery","Výstavní & Promo sítě","galleryHorizontalEnd","cityGallery"],
      ["/projects/city-inventory","Městský inventář & Mobiliář","panelsTopLeft","carriers"]
    ] }
  ] },
  { id: 'operations', label: 'Realizace & Terén', shortLabel: 'Realizace', icon: 'wrench', groups: [
    { label: 'Terén & Fotodokumentace', items: [
      ["/fotodokumentace","Fotodokumentace","camera","photoDocumentation"],
      ["/election-removal","Terénní práce","truck","electionRemoval"],
      ["/work/dispatch","Dispečink práce","route","work"]
    ] },
    { label: 'Zakázky & Výroba', items: [
      ["/work","Plán práce","briefcaseBusiness","work"],
      ["/production","Výroba, Tisk & Grafika","printer","printProduction"],
      ["/tasks","Všechny úkoly","clipboardList","tasks"]
    ] }
  ] },
  { id: 'agenda', label: 'Plánovač & Moje agenda', shortLabel: 'Agenda', icon: 'calendarCheck', groups: [
    { label: 'Můj plán & Úkoly', items: [
      ["/planner","Planner","calendarRange","planner"],
      ["/my-tasks","Moje úkoly","calendarCheck","myTasks"]
    ] },
    { label: 'Moje výkazy & Volno', items: [
      ["/my-work-entries","Moje odvedená práce","clipboardCheck","myWorkEntries"],
      ["/my-settlements","Moje vyúčtování","fileText","mySettlements"],
      ["/vacations","Dovolená & Volno","calendarRange","team"]
    ] }
  ] },
  { id: 'backoffice', label: 'Sklad, Flotila & Výkazy', shortLabel: 'Zázemí', icon: 'package', groups: [
    { label: 'Sklad, Flotila & Nákupy', items: [
      ["/warehouse","Sklad & Materiál","clipboardList","warehouse"],
      ["/vehicles","Vozidla a vozíky","car","vehicles"],
      ["/shopping","Nákupy","shoppingBag","team"]
    ] },
    { label: 'Firemní výkazy', items: [
      ["/work-entries","Odvedená práce (všichni)","fileText","workEntries"],
      ["/settlements","Vyúčtování firemní","fileText","settlements"]
    ] }
  ] },
  { id: 'management', label: 'Správa', shortLabel: 'Správa', icon: 'settings', groups: [
    { label: 'Tým & Data', items: [
      ["/employees","Zaměstnanci & Tým","userRound","employees"],
      ["/import","Import dat","fileUp","import"]
    ] },
    { label: 'Nastavení', items: [
      ["/settings/planner","Calendar & Planner","calendarRange","planner"],
      ["/settings","Nastavení systému","settings","settings"],
      ["/settings/company","Nastavení firmy","settings","settings"],
      ["/settings/email","Firemní e-mail","mail","settings"],
      ["/settings/members","Uživatelé organizace","users","settings"],
      ["/settings/integrations","Integrace","settings","settings"]
    ] }
  ] }
];

export const quickAccessHrefs = ['/dashboard', '/my-tasks', '/commercial', '/fotodokumentace'];
export const mobileHrefs = ['/dashboard', '/warehouse', '/my-tasks'];

export function matchesNavigationPath(pathname: string, href: string) {
  const path = pathname.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  const route = href.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  return path === route || path.startsWith(`${route}/`);
}

export function findActiveNavigation(hubs: NavigationHub[], pathname: string) {
  return hubs.flatMap(hub => hub.groups.flatMap(group => group.items.map(item => ({ hub, item }))))
    .filter(({ item }) => matchesNavigationPath(pathname, item[0]))
    .sort((a, b) => b.item[0].length - a.item[0].length)[0];
}

export function getVisibleNavigation(user: {
  role: AppRole;
  platformRole?: string | null;
  organization?: { plan?: string | null; enabledModules?: unknown } | null;
  membership?: { role: string; roles: string[] } | null;
}): NavigationHub[] {
  const hubs = navigationHubs.map(hub => ({ ...hub, groups: hub.groups.map(group => ({ ...group,
    items: group.items.filter(([href, , , section]) => {
      const moduleId = getModuleIdForPath(href);
      if (href === '/academy') return canAccess(user.role, 'academy') && Boolean(user.organization);
      return canAccess(user.role, section) && (moduleId !== 'planner' || Boolean(user.organization)) && (!user.organization || !moduleId || isModuleAvailable(user.organization, moduleId));
    }),
  })).filter(group => group.items.length > 0) })).filter(hub => hub.groups.length > 0);
  const management = hubs.find(hub => hub.id === 'management');
  if (user.role === 'ADMIN' && user.platformRole === 'SUPER_ADMIN') {
    management?.groups.push({ label: 'Platforma SeePoint', items: [
      ['/admin/organizations', 'Organizace', 'settings', 'settings'],
      ['/onboarding', 'Onboarding agentury', 'userRound', 'settings'],
    ] });
  } else if (user.role === 'ADMIN' && (user.membership?.role === 'OWNER' || user.membership?.roles.includes('ADMIN'))) {
    management?.groups.find(group => group.label === 'Nastavení')?.items.push(['/onboarding', 'Onboarding agentury', 'userRound', 'settings']);
  }
  return hubs;
}
