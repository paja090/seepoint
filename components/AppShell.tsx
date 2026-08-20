import { canAccess, type AppSection } from '@/lib/rbac';
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
      ['/mobile-surveys', '📍 Průzkum lokalit', 'compass', 'navigationProjects'],
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
    label: '🗺️ Městské projekty & Inventář',
    items: [
      ['/navigation', '🧭 Městská Navigace', 'mapPinned', 'navigationProjects'],
      ['/projects/city-gallery', '🖼️ Galerie VENKU', 'galleryHorizontalEnd', 'cityGallery'],
      ['/projects/city-inventory', '🪧 Městský Inventář (Postery/Lavičky)', 'panelsTopLeft', 'carriers'],
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

  const employeePhoto = user.employee?.id
    ? await prisma.photo.findFirst({
        where: { employeeId: user.employee.id, isPrimary: true },
        select: { url: true },
        orderBy: { createdAt: 'desc' },
      })
    : null;

  const avatarUrl = employeePhoto?.url || null;

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, firstName: true, lastName: true, position: true },
    orderBy: { firstName: 'asc' },
  });

  return (
    <ResponsiveAppShell
      user={{
        id: user.id,
        name: userName,
        email: user.email || '',
        role: user.role,
        allowedRoles: user.allowedRoles || [user.role],
        avatarUrl,
      }}
      employees={employees}
      visibleGroups={visibleGroups}
    >
      {children}
    </ResponsiveAppShell>
  );
}
