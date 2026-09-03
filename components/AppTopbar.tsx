'use client';

import { LogOut, MessageSquare, PhoneCall } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/rbac';
import { NotificationBellCenter } from '@/components/notifications/NotificationBellCenter';
import { QuickSearchInput } from '@/components/QuickSearchInput';
import { WeatherClockWidget } from '@/components/WeatherClockWidget';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';

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

export function AppTopbar({ user }: { user: { name: string; email: string; role: AppRole; allowedRoles?: AppRole[]; organizationRoleLabel: string; isPlatformSuperAdmin: boolean; organizationId: string; organizations: Array<{ id: string; name: string; slug: string }> } }) {
  const pathname = usePathname();
  const title = pageTitles.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] ?? 'SeePOINT';
  const initials = user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SP';
  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }

  return (
    <header className="sticky top-0 z-30 hidden lg:flex min-h-16 items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-5 backdrop-blur-md shadow-2xs">
      <div className="min-w-0 flex items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 shrink-0">
          SeePoint OS
        </span>
        <span className="text-slate-300">/</span>
        <h1 className="truncate text-base font-bold text-slate-900 tracking-tight">{title}</h1>
      </div>

      <div className="flex-1 max-w-md mx-2">
        <QuickSearchInput />
      </div>

      <div className="flex items-center gap-2.5">
        <OrganizationSwitcher activeId={user.organizationId} organizations={user.organizations} />
        <WeatherClockWidget />

        <div className="h-6 w-px bg-slate-200 mx-0.5" />

        <NotificationBellCenter />

        <Link
          href="/chat"
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition shrink-0"
          title="💬 Týmový Chat & Účtenky za palivo"
        >
          <MessageSquare size={15} />
          <span className="hidden xl:inline">Chat</span>
        </Link>

        <Link
          href="/team"
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition shrink-0"
          title="📞 Telefonní seznam týmu SeePOINT"
        >
          <PhoneCall size={16} />
        </Link>

        <div className="h-6 w-px bg-slate-200 mx-0.5" />

        {/* Unified User Profile Button */}
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-xl p-1 pr-2.5 border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 transition group shrink-0"
          title={`Můj profil: ${user.name} (${user.email})`}
        >
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-xs font-bold text-white shadow-xs group-hover:bg-purple-700 transition">
            {initials}
          </div>
          <div className="text-left hidden 2xl:block">
            <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">{user.name}</p>
          </div>
        </Link>

        <button
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600 shrink-0"
          onClick={logout}
          title="Odhlásit ze systému"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
