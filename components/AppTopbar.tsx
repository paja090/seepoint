'use client';

import { LogOut, MessageSquare, PhoneCall, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@/lib/rbac';
import { NotificationBellCenter } from '@/components/notifications/NotificationBellCenter';
import { QuickSearchInput } from '@/components/QuickSearchInput';
import { WeatherClockWidget } from '@/components/WeatherClockWidget';
import { OrganizationSwitcher } from '@/components/OrganizationSwitcher';
import { RoleSwitcherButton } from '@/components/RoleSwitcherButton';

const pageTitles: Array<[string, string]> = [
  ['/sales/opportunities', 'AI Obchodní radar'],
  ['/ai-inbox', 'AI Inbox'],
  ['/occupancy/ai', 'AI Obsazenost'],
  ['/clients/dashboard', 'AI CRM Intelligence'],
  ['/dashboard', 'Dashboard'],
  ['/commercial', 'AI Obchodní centrum'],
  ['/crm/intelligence', 'AI CRM Intelligence'],
  ['/map', 'Mapa nosičů'],
  ['/carriers', 'Evidence nosičů'],
  ['/field-survey', 'Terénní průzkum ploch'],
  ['/occupancy', 'Obsazenost ploch'],
  ['/clients', 'Klienti'],
  ['/offers', 'Nabídky'],
  ['/employees', 'Zaměstnanci'],
  ['/tasks', 'Úkoly'],
  ['/my-tasks', 'Moje úkoly'],
  ['/settlements', 'Vyúčtování'],
  ['/my-settlements', 'Moje vyúčtování'],
  ['/vehicles', 'Vozidla a vozíky'],
  ['/work/dispatch', 'Dispečink práce'],
  ['/work/route', 'Pracovní výjezd'],
  ['/work', 'Plán práce'],
  ['/import', 'Import dat'],
  ['/settings', 'Nastavení'],
];

export function AppTopbar({
  user,
  canUseTeam = true,
  onAiQuickTask,
}: {
  onAiQuickTask?: () => void;
  canUseTeam?: boolean;
  user: {
    name: string;
    email: string;
    role: AppRole;
    allowedRoles?: AppRole[];
    organizationRoleLabel: string;
    isPlatformSuperAdmin: boolean;
    organizationId: string;
    organizationName: string;
    organizations: Array<{ id: string; name: string; slug: string }>;
  };
}) {
  const pathname = usePathname();
  const title =
    pageTitles.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] ??
    'Pracovní prostor';
  const initials =
    user.name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SP';

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <header className="app-topbar sticky top-0 z-30 hidden lg:flex h-16 items-center justify-between gap-2 xl:gap-3 border-b border-slate-200/90 bg-white/95 px-4 xl:px-5 backdrop-blur-md shadow-2xs">
      {/* Left: Breadcrumb / Active Module Title */}
      <div className="app-topbar-title min-w-0 shrink-0 flex items-center gap-2 max-w-[220px] xl:max-w-[280px]">
        <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 shrink-0">
          {user.organizationName}
        </span>
        <span className="text-slate-300">/</span>
        <h1 className="truncate text-sm xl:text-base font-bold text-slate-900 tracking-tight">
          {title}
        </h1>
      </div>

      {/* Center: Compact Quick Search */}
      <div className="app-topbar-search flex-1 min-w-[160px] max-w-xs xl:max-w-md mx-1 xl:mx-2">
        <QuickSearchInput />
      </div>

      {/* Right: Unified Single-Row Toolbar */}
      <div className="app-topbar-actions flex items-center gap-1.5 xl:gap-2 shrink-0">
        {onAiQuickTask && (
          <button
            type="button"
            onClick={onAiQuickTask}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-fuchsia-600 px-2.5 xl:px-3 text-xs font-bold text-white hover:bg-fuchsia-500 transition"
            aria-label="AI Rychlý Úkolníček"
          >
            <Sparkles size={14} />
            <span>AI Úkol</span>
          </button>
        )}

        <OrganizationSwitcher activeId={user.organizationId} organizations={user.organizations} />

        {user.allowedRoles && user.allowedRoles.length > 1 && (
          <RoleSwitcherButton currentRole={user.role} allowedRoles={user.allowedRoles} compact />
        )}

        <div className="hidden xl:block">
          <WeatherClockWidget compact />
        </div>

        <div className="h-5 w-px bg-slate-200 mx-0.5" />

        <NotificationBellCenter />

        {canUseTeam && (
          <Link
            href="/chat"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-2.5 xl:px-3 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition shrink-0"
            title="💬 Týmový Chat & Účtenky za palivo"
          >
            <MessageSquare size={14} />
            <span className="hidden 2xl:inline">Chat</span>
          </Link>
        )}

        {canUseTeam && (
          <Link
            href="/team"
            className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 transition shrink-0"
            title={`📞 Telefonní seznam týmu ${user.organizationName}`}
          >
            <PhoneCall size={15} />
          </Link>
        )}

        <div className="h-5 w-px bg-slate-200 mx-0.5" />

        {/* Unified User Profile Button */}
        <Link
          href="/profile"
          className="flex h-9 items-center gap-2 rounded-xl px-1.5 border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 transition group shrink-0"
          title={`Můj profil: ${user.name} (${user.email})`}
        >
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-slate-950 text-[11px] font-bold text-white shadow-xs group-hover:bg-purple-700 transition">
            {initials}
          </div>
          <div className="text-left hidden 2xl:block pr-1">
            <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[110px]">
              {user.name}
            </p>
          </div>
        </Link>

        <button
          className="flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200 text-slate-400 transition hover:bg-red-50 hover:border-red-200 hover:text-red-600 shrink-0"
          onClick={logout}
          title="Odhlásit ze systému"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
