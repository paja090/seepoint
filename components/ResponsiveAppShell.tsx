'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  X,
  Camera,
  LayoutDashboard,
  Map,
  Route,
  LogOut,
  MessageSquare,
  UserRound,
  PhoneCall,
} from 'lucide-react';
import { AppNavLink, type AppNavIcon } from './AppNavLink';
import { AppTopbar } from './AppTopbar';
import { RoleSwitcherButton } from './RoleSwitcherButton';
import { NotificationBellCenter } from './notifications/NotificationBellCenter';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { WeatherClockWidget } from './WeatherClockWidget';
import type { AppRole } from '@/lib/rbac';
import { roleLabel } from '@/lib/rbac';

export type NavItem = [string, string, AppNavIcon, string];
export type NavGroup = { label: string; items: NavItem[] };

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
  ['/chat', 'Týmový Chat'],
  ['/vacations', 'Dovolená & Volno'],
  ['/import', 'Import dat'],
  ['/settings', 'Nastavení'],
];

export function ResponsiveAppShell({
  children,
  user,
  visibleGroups,
}: {
  children: React.ReactNode;
  user: { id: string; name: string; email: string; role: AppRole; allowedRoles?: AppRole[] };
  visibleGroups: NavGroup[];
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const pathname = usePathname();

  const title = pageTitles.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))?.[1] ?? 'SeePOINT';

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const initials = user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'SP';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:flex">
      {/* 🚀 SINGLE MOBILE TOP HEADER BAR (hidden on desktop lg) */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-900 bg-slate-950 px-3.5 text-white lg:hidden">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-slate-200 border border-slate-800 hover:bg-slate-800 active:scale-95 transition"
            aria-label="Otevřít menu"
          >
            <Menu size={20} />
          </button>
          <Link href="/dashboard" className="inline-flex items-center shrink-0">
            <img alt="SeePOINT Logo" className="h-7 w-auto" src="/seepoint-logo.svg" />
          </Link>
          <span className="truncate text-xs font-bold text-slate-300 border-l border-slate-800 pl-2">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <WeatherClockWidget compact />
          <NotificationBellCenter />
          <Link
            href="/team"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-emerald-400 border border-slate-800 hover:bg-slate-800 active:scale-95 transition"
            title="📞 Kontakty týmu SeePOINT"
          >
            <PhoneCall size={17} />
          </Link>
          <Link
            href="/profile"
            className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500 text-xs font-black text-slate-950 ring-2 ring-emerald-500/30"
            title="Můj profil"
          >
            {initials}
          </Link>
        </div>
      </header>

      {/* MOBILE SLIDE-OVER DRAWER BACKDROP */}
      {mobileDrawerOpen && (
        <div
          onClick={() => setMobileDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity animate-in fade-in duration-200"
        />
      )}

      {/* SLIDE-OVER DRAWER (Mobile) / FIXED SIDEBAR (Desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-80 max-w-[85vw] flex-col bg-slate-950 px-4 py-4 text-white transition-transform duration-300 ease-in-out lg:translate-x-0 lg:w-72 lg:border-r lg:border-slate-900 ${
          mobileDrawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between px-2">
          <div>
            <img alt="SeePOINT Outdoor reklama" className="h-12 w-auto" src="/seepoint-logo.svg" />
            <p className="mt-0.5 text-[10px] font-medium text-slate-400">Interní administrační systém</p>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-slate-400 hover:text-white lg:hidden"
            aria-label="Zavřít menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Card & Role Switcher in Sidebar Drawer */}
        <div className="mb-4 shrink-0 rounded-2xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-xs font-black text-slate-950">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{user.name}</p>
                <p className="text-[10px] text-slate-400">{roleLabel(user.role)}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                href="/profile"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                title="Profil"
              >
                <UserRound size={16} />
              </Link>
              <button
                onClick={logout}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                title="Odhlásit se"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            <RoleSwitcherButton currentRole={user.role} allowedRoles={user.allowedRoles} />
          </div>
        </div>

        {/* Single Clean Scrollable Navigation Area */}
        <nav className="flex-1 space-y-5 overflow-y-auto pr-1 pb-6 text-xs scrollbar-thin scrollbar-thumb-slate-800">
          {visibleGroups.map((group) => (
            <section key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(([href, label, icon]) => (
                  <AppNavLink href={href} icon={icon} key={href} label={label} />
                ))}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="min-w-0 flex-1 lg:pl-72 pb-16 lg:pb-0">
        <AppTopbar user={user} />
        <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6 lg:px-8">{children}</div>
      </main>

      {/* 📱 PWA Mobile Install Prompt */}
      <PwaInstallPrompt />

      {/* 💬 FLOATING CHAT BUTTON (FAB) IN BOTTOM RIGHT */}
      <Link
        href="/chat"
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 text-white shadow-2xl hover:scale-105 active:scale-95 transition-transform group border-2 border-white/20"
        title="💬 Týmový Chat & Účtenky paliva"
      >
        <MessageSquare size={24} className="group-hover:rotate-6 transition-transform" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
        </span>
      </Link>

      {/* MOBILE BOTTOM QUICK BAR (Sticky at bottom on mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-slate-800 bg-slate-950 px-2 text-white shadow-2xl backdrop-blur-xl lg:hidden">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition ${
            pathname === '/dashboard' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard size={20} />
          <span>Přehled</span>
        </Link>

        <Link
          href="/map"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition ${
            pathname === '/map' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Map size={20} />
          <span>Mapa</span>
        </Link>

        <Link
          href="/mobile-photos"
          className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/30 border-4 border-slate-950 active:scale-95 transition"
          title="Mobilní foto"
        >
          <Camera size={22} />
        </Link>

        <Link
          href="/work/route"
          className={`flex flex-col items-center gap-1 text-[10px] font-bold transition ${
            pathname === '/work/route' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Route size={20} />
          <span>Výjezd</span>
        </Link>

        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-200"
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
