'use client';

import { LogOut, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/rbac';
import { roleLabel } from '@/lib/rbac';

const pageTitles: Array<[string, string]> = [
  ['/dashboard', 'Dashboard'],
  ['/map', 'Mapa nosičů'],
  ['/carriers', 'Evidence nosičů'],
  ['/occupancy', 'Obsazenost ploch'],
  ['/clients', 'Klienti'],
  ['/offers', 'Nabídky'],
  ['/employees', 'Zaměstnanci'],
  ['/tasks', 'Úkoly'],
  ['/my-tasks', 'Moje úkoly'],
  ['/settlements', 'Vyúčtování'],
  ['/my-settlements', 'Moje vyúčtování'],
  ['/vehicles', 'Vozidla a vozíky'],
  ['/work/route', 'Pracovní výjezd'],
  ['/work', 'Plán práce'],
  ['/import', 'Import dat'],
  ['/settings', 'Nastavení'],
];

export function AppTopbar({ user }: { user: { name: string; email: string; role: AppRole } }) {
  const pathname = usePathname();
  const title = pageTitles.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] ?? 'SeePOINT';
  const initials = user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SP';

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-6">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aktuální stránka</p>
        <h2 className="truncate text-lg font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="hidden min-w-72 max-w-xl flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 md:flex">
        <Search size={16} className="mr-2 text-slate-400" />
        Rychlé hledání bude napojené v další iteraci
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{roleLabel(user.role)}</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white" title={user.email}>{initials}</div>
        <Link className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" href="/login" title="Odhlásit">
          <LogOut size={18} />
        </Link>
      </div>
    </header>
  );
}
