import { canAccess, roleLabel, type AppSection } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ResponsiveAppShell, type NavGroup } from './ResponsiveAppShell';

const navGroups: NavGroup[] = [
  {
    label: '📊 Přehled & Terén',
    items: [
      ['/dashboard', '📊 Nástěnka / Přehled', 'barChart3', 'dashboard'],
      ['/map', '🗺️ Mapa nosičů', 'map', 'map'],
      ['/carriers', '📦 Evidence nosičů', 'panelsTopLeft', 'carriers'],
      ['/mobile-surveys', '📍 Průzkum lokalit', 'mapPinned', 'navigationProjects'],
      ['/my-tasks', '📋 Moje úkoly', 'calendarCheck', 'myTasks'],
      ['/work/route', '🚗 Pracovní výjezd', 'route', 'work'],
      ['/my-work-entries', '⏱️ Moje odvedená práce', 'clipboardCheck', 'myWorkEntries'],
      ['/my-settlements', '💰 Moje vyúčtování', 'fileText', 'mySettlements'],
      ['/vacations', '🌴 Dovolená & Volno', 'calendarRange', 'team'],
    ],
  },
  {
    label: '🏢 Obchod & CRM',
    items: [
      ['/sales/opportunities', '📡 AI Obchodní radar', 'radar', 'clients'],
      ['/analytics', '📊 Analytics & Tržby', 'barChart3', 'clients'],
      ['/clients/dashboard', '🎯 CRM Dashboard', 'barChart3', 'clients'],
      ['/clients', '👥 Klienti & Adresář', 'users', 'clients'],
      ['/offers', '📄 Nabídky', 'badgeDollarSign', 'offers'],
      ['/network', '🌐 B2B Media Network', 'globe', 'offers'],
      ['/occupancy', '📅 Obsazenost ploch', 'calendarRange', 'occupancy'],
    ],
  },
  {
    label: '🗺️ Reklamní sítě & Projekty',
    items: [
      ['/navigation', '🧭 Navigační reklama (VO)', 'mapPinned', 'navigationProjects'],
      ['/projects/city-gallery', '🖼️ Výstavní & Promo sítě', 'galleryHorizontalEnd', 'cityGallery'],
      ['/projects/city-inventory', '🪧 Městský inventář & Mobiliář', 'panelsTopLeft', 'carriers'],
    ],
  },
  {
    label: '🔧 Provoz & Logistika',
    items: [
      ['/shopping', '🛍️ Nákupy', 'shoppingBag', 'team'],
      ['/work', '🗓️ Plán práce', 'briefcaseBusiness', 'work'],
      ['/tasks', '📋 Všechny úkoly', 'clipboardList', 'tasks'],
      ['/work-entries', '⏱️ Odvedená práce (všichni)', 'fileText', 'workEntries'],
      ['/settlements', '💰 Vyúčtování firemní', 'fileText', 'settlements'],
      ['/vehicles', '🚘 Vozidla a vozíky', 'car', 'vehicles'],
      ['/warehouse', '📦 Sklad & Materiál', 'clipboardList', 'vehicles'],
    ],
  },
  {
    label: '⚙️ Správa & Nastavení',
    items: [
      ['/employees', '👤 Zaměstnanci & Tým', 'userRound', 'employees'],
      ['/import', '📥 Import dat', 'fileUp', 'import'],
      ['/settings', '⚙️ Nastavení systému', 'settings', 'settings'],
      ['/settings/company', '🏢 Nastavení firmy', 'settings', 'settings'],
      ['/settings/members', '👥 Uživatelé organizace', 'users', 'settings'],
      ['/settings/integrations', '🔌 Integrace', 'settings', 'settings'],
    ],
  },
];

import { isModuleEnabled, getModuleIdForPath } from '@/lib/organization-modules';

export async function AppShell({ children, allowPasswordChange = false }: { children: React.ReactNode; allowPasswordChange?: boolean }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.mustChangePassword && !allowPasswordChange) redirect('/profile?firstLogin=1');

  const activeOrg = user.organization;

  // Filter groups and eliminate duplicate links within each role's view
  const seenHrefs = new Set<string>();

  const visibleGroups = navGroups
    .map((group) => {
      const groupItems = group.items.filter(([href, , , section]) => {
        if (!canAccess(user.role, section as AppSection)) return false;
        // Check organization-level module feature flag
        if (activeOrg) {
          const modId = getModuleIdForPath(href);
          if (modId && !isModuleEnabled(activeOrg, modId)) {
            return false;
          }
        }
        // Don't show duplicate links
        if (seenHrefs.has(href)) return false;
        seenHrefs.add(href);
        return true;
      });

      return {
        ...group,
        items: groupItems,
      };
    })
    .filter((group) => group.items.length > 0);

  if (user.role === 'ADMIN' && user.platformRole === 'SUPER_ADMIN') {
    visibleGroups.push({
      label: '🛡️ Platforma SeePoint',
      items: [
        ['/admin/organizations', 'Organizace', 'settings', 'settings'],
        ['/onboarding', 'Onboarding agentury', 'userRound', 'settings'],
      ],
    });
  } else if (user.role === 'ADMIN' && (user.membership?.role === 'OWNER' || user.membership?.roles.includes('ADMIN'))) {
    const settingsGroup = visibleGroups.find((group) => group.label === '⚙️ Správa & Nastavení');
    settingsGroup?.items.push(['/onboarding', 'Onboarding agentury', 'userRound', 'settings']);
  }

  const userName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.email || 'Uživatel';

  const employeePhoto = user.employee?.id
    ? await prisma.photo.findFirst({
        where: { employeeId: user.employee.id, isPrimary: true },
        select: { url: true },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null)
    : null;

  const avatarUrl = employeePhoto?.url || null;

  const employees = user.organizationId
    ? await prisma.employee.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true, position: true },
        orderBy: { firstName: 'asc' },
      }).catch(() => [])
    : [];

  return (
    <ResponsiveAppShell
      user={{
        id: user.id,
        name: userName,
        email: user.email || '',
        role: user.role,
        allowedRoles: user.allowedRoles || [user.role],
        organizationRoleLabel: user.membership?.role === 'OWNER' ? 'Vlastník organizace' : roleLabel(user.primaryRole),
        isPlatformSuperAdmin: user.platformRole === 'SUPER_ADMIN',
        avatarUrl,
        organizationId: user.organizationId || '',
        organizations: (user.memberships || []).map((membership) => ({
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
        })),
      }}
      employees={employees}
      visibleGroups={visibleGroups}
    >
      {children}
    </ResponsiveAppShell>
  );
}
