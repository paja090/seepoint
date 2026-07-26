import { canAccess, type AppSection } from '@/lib/rbac';
import { getCurrentUser } from '@/lib/auth';
import { AppNavLink, type AppNavIcon } from './AppNavLink';
import { AppTopbar } from './AppTopbar';
import { redirect } from 'next/navigation';

type NavItem = [string, string, AppNavIcon, AppSection];
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Přehled',
    items: [
      ['/dashboard', 'Dashboard', 'barChart3', 'dashboard'],
      ['/map', 'Mapa', 'map', 'map'],
    ],
  },
  {
    label: 'Projekty',
    items: [
      ['/navigation', 'Navigace', 'mapPinned', 'navigationProjects'],
      ['/navigation/documentation', 'Fotodokumentace navigací', 'camera', 'navigationDocumentation'],
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
      ['/my-tasks', 'Moje úkoly', 'calendarCheck', 'myTasks'],
      ['/work-entries', 'Odvedená práce', 'fileText', 'workEntries'],
      ['/my-work-entries', 'Moje odvedená práce', 'clipboardCheck', 'myWorkEntries'],
      ['/settlements', 'Vyúčtování', 'fileText', 'settlements'],
      ['/my-settlements', 'Moje vyúčtování', 'fileText', 'mySettlements'],
      ['/vehicles', 'Vozidla a vozíky', 'car', 'vehicles'],
    ],
  },
  {
    label: 'Provoz',
    items: [
      ['/work', 'Plán práce', 'briefcaseBusiness', 'work'],
      ['/work/route', 'Pracovní výjezd', 'route', 'work'],
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
    .map((group) => ({ ...group, items: group.items.filter(([, , , section]) => canAccess(user.role, section)) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:flex">
      <aside className="border-b border-slate-900 bg-slate-950 px-4 py-4 text-white lg:fixed lg:inset-y-0 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="mb-6 px-2">
          <div className="inline-flex max-w-full">
            <img alt="SeePOINT Outdoor reklama" className="h-20 w-auto max-w-full" src="/seepoint-logo.svg" />
          </div>
          <p className="mt-3 text-xs text-slate-400">Interní administrační systém</p>
        </div>
        <nav className="space-y-6">
          {visibleGroups.map((group) => (
            <section key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
              <div className="space-y-1">
                {group.items.map(([href, label, icon]) => <AppNavLink href={href} icon={icon} key={href} label={label} />)}
              </div>
            </section>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 lg:pl-72">
        <AppTopbar user={user} />
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
