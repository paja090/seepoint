import type { AppNavIcon } from '@/components/AppNavLink';
import { canAccess, type AppRole, type AppSection } from './rbac';
import { getModuleIdForPath, isModuleEnabled } from './organization-modules';

// String icon IDs keep the server-to-client navigation payload serializable.
export type NavItem = [href: string, label: string, icon: AppNavIcon, section: AppSection];
export type NavGroup = { label: string; items: NavItem[] };
export type NavigationHub = { id: string; label: string; icon: 'sparkles' | 'briefcaseBusiness' | 'mapPinned' | 'wrench' | 'settings'; groups: NavGroup[] };

export const navigationHubs: NavigationHub[] = [
  { id: 'ai', label: 'AI Hub', icon: 'sparkles', groups: [
    { label: 'AI obchod', items: [
      ["/commercial","AI Obchodní centrum","briefcaseBusiness","commercial"],
      ["/ai-inbox","AI Inbox","mail","aiInbox"],
      ["/sales/opportunities","AI Obchodní radar","radar","clients"]
    ] }
  ] },
  { id: 'sales', label: 'Obchod & CRM', icon: 'briefcaseBusiness', groups: [
    { label: 'Obchod', items: [
      ["/dashboard","Nástěnka / Přehled","barChart3","dashboard"],
      ["/analytics","Analytics & Tržby","barChart3","clients"],
      ["/offers","Nabídky","badgeDollarSign","offers"],
      ["/network","B2B Media Network","globe","offers"]
    ] },
    { label: 'CRM', items: [
      ["/clients/dashboard","CRM Dashboard","barChart3","clients"],
      ["/clients","Klienti & Adresář","users","clients"]
    ] }
  ] },
  { id: 'spaces', label: 'Plochy & Obsazenost', icon: 'mapPinned', groups: [
    { label: 'Evidence', items: [
      ["/map","Mapa nosičů","map","map"],
      ["/carriers","Evidence nosičů","panelsTopLeft","carriers"],
      ["/mobile-surveys","Průzkum lokalit","mapPinned","navigationProjects"]
    ] },
    { label: 'Plánování', items: [
      ["/occupancy","Obsazenost ploch","calendarRange","occupancy"]
    ] },
    { label: 'Reklamní sítě & Projekty', items: [
      ["/navigation","Navigační reklama (VO)","mapPinned","navigationProjects"],
      ["/projects/city-gallery","Výstavní & Promo sítě","galleryHorizontalEnd","cityGallery"],
      ["/projects/city-inventory","Městský inventář & Mobiliář","panelsTopLeft","carriers"]
    ] }
  ] },
  { id: 'operations', label: 'Provoz & Realizace', icon: 'wrench', groups: [
    { label: 'Moje agenda', items: [
      ["/planner","Planner","calendarRange","planner"],
      ["/my-tasks","Moje úkoly","calendarCheck","myTasks"],
      ["/my-work-entries","Moje odvedená práce","clipboardCheck","myWorkEntries"],
      ["/my-settlements","Moje vyúčtování","fileText","mySettlements"],
      ["/vacations","Dovolená & Volno","calendarRange","team"]
    ] },
    { label: 'Realizace', items: [
      ["/work","Plán práce","briefcaseBusiness","work"],
      ["/work/route","Pracovní výjezd","route","work"],
      ["/tasks","Všechny úkoly","clipboardList","tasks"],
      ["/production","Výroba, Tisk & Grafika","printer","printProduction"]
    ] },
    { label: 'Interní provoz', items: [
      ["/shopping","Nákupy","shoppingBag","team"],
      ["/work-entries","Odvedená práce (všichni)","fileText","workEntries"],
      ["/settlements","Vyúčtování firemní","fileText","settlements"],
      ["/vehicles","Vozidla a vozíky","car","vehicles"],
      ["/warehouse","Sklad & Materiál","clipboardList","vehicles"]
    ] }
  ] },
  { id: 'management', label: 'Správa', icon: 'settings', groups: [
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

export const quickAccessHrefs = ['/dashboard', '/my-tasks', '/commercial'];
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
      return canAccess(user.role, section) && (moduleId !== 'planner' || Boolean(user.organization)) && (!user.organization || !moduleId || isModuleEnabled(user.organization, moduleId));
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
