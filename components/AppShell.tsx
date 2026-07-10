import { BadgeDollarSign, BarChart3, BriefcaseBusiness, CalendarCheck, CalendarRange, Car, ClipboardList, FileText, FileUp, Map, PanelsTopLeft, Route, Settings, UserRound, Users } from 'lucide-react';
import { canAccess, getCurrentUser, type AppSection } from '@/lib/rbac';
import { AppNavLink } from './AppNavLink';
import { AppTopbar } from './AppTopbar';

type NavItem = [string, string, React.ComponentType<{ size?: number }>, AppSection];
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Přehled',
    items: [
      ['/dashboard', 'Dashboard', BarChart3, 'dashboard'],
      ['/map', 'Mapa', Map, 'map'],
    ],
  },
  {
    label: 'Evidence',
    items: [
      ['/carriers', 'Nosiče', PanelsTopLeft, 'carriers'],
      ['/occupancy', 'Obsazenost', CalendarRange, 'occupancy'],
      ['/clients', 'Klienti', Users, 'clients'],
      ['/offers', 'Nabídky', BadgeDollarSign, 'offers'],
    ],
  },
  {
    label: 'Interní provoz',
    items: [
      ['/employees', 'Zaměstnanci', UserRound, 'employees'],
      ['/tasks', 'Úkoly', ClipboardList, 'tasks'],
      ['/my-tasks', 'Moje úkoly', CalendarCheck, 'myTasks'],
      ['/settlements', 'Vyúčtování', FileText, 'settlements'],
      ['/my-settlements', 'Moje vyúčtování', FileText, 'mySettlements'],
      ['/vehicles', 'Vozidla a vozíky', Car, 'vehicles'],
    ],
  },
  {
    label: 'Provoz',
    items: [
      ['/work', 'Plán práce', BriefcaseBusiness, 'work'],
      ['/work/route', 'Pracovní výjezd', Route, 'work'],
    ],
  },
  {
    label: 'Data',
    items: [
      ['/import', 'Import', FileUp, 'import'],
      ['/settings', 'Nastavení', Settings, 'settings'],
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter(([, , , section]) => canAccess(user.role, section)) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:flex">
      <aside className="border-b border-slate-900 bg-slate-950 px-4 py-4 text-white lg:fixed lg:inset-y-0 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-lg font-black text-slate-950">SP</div>
          <div>
            <div className="text-xl font-semibold tracking-tight">SeePOINT</div>
            <p className="text-xs text-slate-400">Interní administrační systém</p>
          </div>
        </div>
        <nav className="space-y-6">
          {visibleGroups.map((group) => (
            <section key={group.label}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
              <div className="space-y-1">
                {group.items.map(([href, label, Icon]) => <AppNavLink href={href} icon={Icon} key={href} label={label} />)}
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
