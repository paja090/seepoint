import Link from 'next/link';
import { BadgeDollarSign, BarChart3, BriefcaseBusiness, CalendarRange, FileUp, LogOut, Map, PanelsTopLeft, Route, Settings, Users } from 'lucide-react';

const nav = [
  ['/dashboard', 'Dashboard', BarChart3],
  ['/map', 'Mapa', Map],
  ['/carriers', 'Nosiče', PanelsTopLeft],
  ['/occupancy', 'Obsazenost', CalendarRange],
  ['/clients', 'Klienti', Users],
  ['/offers', 'Nabídky', BadgeDollarSign],
  ['/work', 'Plán práce', BriefcaseBusiness],
  ['/work/route', 'Pracovní výjezd', Route],
  ['/import', 'Import', FileUp],
  ['/settings', 'Nastavení', Settings],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-slate-950 p-4 text-white md:w-64">
        <div className="mb-8 text-2xl font-bold">SeePoint</div>
        <nav className="space-y-2">
          {nav.map(([href, label, Icon]) => (
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
            <p className="text-xs text-slate-500">Mock přihlášený uživatel: obchodník</p>
          </div>
          <Link href="/login" className="flex gap-2 text-sm"><LogOut size={16} />Odhlásit</Link>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
