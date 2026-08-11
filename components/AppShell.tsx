import { canAccess, type AppSection } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ResponsiveAppShell, type NavGroup } from './ResponsiveAppShell';

const navGroups: NavGroup[] = [
  {
    label: '📱 Terénní práce (Montážníci)',
    items: [
      ['/mobile-photos', '📱 Mobilní foto z terénu', 'camera', 'work'],
      ['/work/route', '🚗 Pracovní výjezd', 'route', 'work'],
      ['/my-tasks', '📋 Moje úkoly', 'calendarCheck', 'myTasks'],
      ['/my-work-entries', '⏱️ Moje odvedená práce', 'clipboardCheck', 'myWorkEntries'],
      ['/my-settlements', '💰 Moje vyúčtování', 'fileText', 'mySettlements'],
      ['/vehicles', '🚘 Vozidla a vozíky', 'car', 'vehicles'],
    ],
  },
  {
    label: 'Přehled',
    items: [
      ['/dashboard', 'Dashboard', 'barChart3', 'dashboard'],
      ['/map', 'Mapa', 'map', 'map'],
    ],
  },
  {
    label: 'Projekty Navigace',
    items: [
      ['/navigation', ' Navigace (Přehled)', 'mapPinned', 'navigationProjects'],
      ['/navigation/contracts', '📄 Evidence smluv', 'fileText', 'navigationContracts'],
      ['/navigation/contacts', '👥 Kontaktní osoby', 'users', 'navigationContacts'],
      ['/navigation/documentation', '📷 Fotodokumentace reporty', 'camera', 'navigationDocumentation'],
      ['/projects/city-gallery', 'Galerie venku', 'galleryHorizontalEnd', 'cityGallery'],
    ],
  },
  {
    label: 'Evidence',
    items: [
      ['/clients/dashboard', 'CRM Dashboard', 'barChart3', 'clients'],
      ['/clients', 'Klienti', 'users', 'clients'],
      ['/carriers', 'Nosiče', 'panelsTopLeft', 'carriers'],
      ['/occupancy', 'Obsazenost', 'calendarRange', 'occupancy'],
      ['/offers', 'Nabídky', 'badgeDollarSign', 'offers'],
    ],
  },
  {
    label: 'Interní provoz',
    items: [
      ['/employees', 'Zaměstnanci', 'userRound', 'employees'],
      ['/tasks', 'Úkoly', 'clipboardList', 'tasks'],
      ['/work-entries', 'Odvedená práce (všichni)', 'fileText', 'workEntries'],
      ['/settlements', 'Vyúčtování (všichni)', 'fileText', 'settlements'],
      ['/vehicles', 'Vozidla a vozíky', 'car', 'vehicles'],
    ],
  },
  {
    label: 'Provoz & Plánování',
    items: [
      ['/work', 'Plán práce', 'briefcaseBusiness', 'work'],
      ['/work/route', 'Pracovní výjezd', 'route', 'work'],
      ['/mobile-photos', 'Mobilní fotodokumentace', 'camera', 'work'],
    ],
  },
  {
    label: 'Data',
    items: [
      ['/import', 'Import', 'fileUp', 'import'],
      ['/settings', 'Nastavení', 'settings', 'settings'],
    ],
  },
];

export async function AppShell({ children, allowPasswordChange = false }: { children: React.ReactNode; allowPasswordChange?: boolean }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.mustChangePassword && !allowPasswordChange) redirect('/profile?firstLogin=1');

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(([, , , section]) => canAccess(user.role, section as AppSection)),
    }))
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
