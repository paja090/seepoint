import Link from 'next/link';
import { BadgeDollarSign, BarChart3, BriefcaseBusiness, CalendarCheck, CalendarRange, Car, ClipboardList, FileText, FileUp, LogOut, Map, PanelsTopLeft, Route, Settings, UserRound, Users } from 'lucide-react';
import { canAccess, getCurrentUser, roleLabel, type AppSection } from '@/lib/rbac';

const nav: Array<[string, string, React.ComponentType<{ size?: number }>, AppSection]> = [
  ['/dashboard', 'Dashboard', BarChart3, 'dashboard'],
  ['/map', 'Mapa', Map, 'map'],
  ['/carriers', 'Nosiče', PanelsTopLeft, 'carriers'],
  ['/occupancy', 'Obsazenost', CalendarRange, 'occupancy'],
  ['/clients', 'Klienti', Users, 'clients'],
  ['/offers', 'Nabídky', BadgeDollarSign, 'offers'],
  ['/employees', 'Zaměstnanci', UserRound, 'employees'],
  ['/tasks', 'Úkoly', ClipboardList, 'tasks'],
  ['/my-tasks', 'Moje úkoly', CalendarCheck, 'myTasks'],
  ['/settlements', 'Vyúčtování', FileText, 'settlements'],
  ['/my-settlements', 'Moje vyúčtování', FileText, 'mySettlements'],
  ['/vehicles', 'Vozidla a vozíky', Car, 'vehicles'],
  ['/work', 'Plán práce', BriefcaseBusiness, 'work'],
  ['/work/route', 'Pracovní výjezd', Route, 'work'],
  ['/import', 'Import', FileUp, 'import'],
  ['/settings', 'Nastavení', Settings, 'settings'],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  const visibleNav = nav.filter(([, , , section]) => canAccess(user.role, section));

  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-slate-950 p-4 text-white md:w-64">
        <div className="mb-8 text-2xl font-bold">SeePoint</div>
        <nav className="space-y-2">
          {visibleNav.map(([href, label, Icon]) => (
            <Link className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-slate-800" href={href} key={href}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1">
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <div>
            <b>Správa reklamních nosičů</b>
            <p className="text-xs text-slate-500">Mock přihlášený uživatel: {user.name} · {roleLabel(user.role)}</p>
          </div>
          <Link href="/login" className="flex gap-2 text-sm"><LogOut size={16} />Odhlásit</Link>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
