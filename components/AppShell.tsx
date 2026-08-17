import { canAccess, type AppSection } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ResponsiveAppShell, type NavGroup } from './ResponsiveAppShell';

const navGroups: NavGroup[] = [
  {
    label: '📊 Přehled & Terén',
    items: [
      ['/dashboard', '📊 Nástěnka / Přehled', 'barChart3', 'dashboard'],
      ['/map', '🗺️ Mapa nosičů', 'map', 'map'],
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
      ['/analytics', '📊 Analytics & Tržby', 'barChart3', 'clients'],
      ['/clients/dashboard', '🎯 CRM Dashboard', 'barChart3', 'clients'],
      ['/clients', '👥 Klienti & Adresář', 'users', 'clients'],
      ['/offers', '📄 Nabídky', 'badgeDollarSign', 'offers'],
      ['/occupancy', '📅 Obsazenost ploch', 'calendarRange', 'occupancy'],
    ],
  },
  {
    label: '🗺️ Nosiče & Navigace',
    items: [
      ['/carriers', '🪧 Evidence nosičů', 'panelsTopLeft', 'carriers'],
      ['/navigation', '🧭 Projekty Navigace', 'mapPinned', 'navigationProjects'],
      ['/navigation/contracts', '📋 Evidence smluv VO', 'fileText', 'navigationContracts'],
      ['/navigation/contacts', '🏛️ Kontaktní osoby měst', 'users', 'navigationContacts'],
      ['/navigation/documentation', '📷 Fotodokumentace & Reporty', 'camera', 'navigationDocumentation'],
      ['/projects/city-gallery', '🖼️ Městská galerie', 'galleryHorizontalEnd', 'cityGallery'],
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
    ],
  },
  {
    label: '⚙️ Správa & Nastavení',
    items: [
      ['/employees', '👤 Zaměstnanci & Tým', 'userRound', 'employees'],
      ['/import', '📥 Import dat', 'fileUp', 'import'],
      ['/settings', '⚙️ Nastavení systému', 'settings', 'settings'],
    ],
  },
];

export async function AppShell({ children, allowPasswordChange = false }: { children: React.ReactNode; allowPasswordChange?: boolean }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.mustChangePassword && !allowPasswordChange) redirect('/profile?firstLogin=1');

  // Filter groups and eliminate duplicate links within each role's view
  const seenHrefs = new Set<string>();

  const visibleGroups = navGroups
    .map((group) => {
      const groupItems = group.items.filter(([href, , , section]) => {
        if (!canAccess(user.role, section as AppSection)) return false;
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

  const userName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.email || 'Uživatel';

  return (
    <ResponsiveAppShell
      user={{
        id: user.id,
        name: userName,
        email: user.email || '',
        role: user.role,
        allowedRoles: user.allowedRoles || [user.role],
      }}
      visibleGroups={visibleGroups}
    >
      {children}
    </ResponsiveAppShell>
  );
}
