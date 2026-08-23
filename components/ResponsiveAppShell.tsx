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
  Package,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';
import { AiQuickTaskModal } from './tasks/AiQuickTaskModal';
import { AppNavLink, type AppNavIcon } from './AppNavLink';
import { AppTopbar } from './AppTopbar';
import { RoleSwitcherButton } from './RoleSwitcherButton';
import { NotificationBellCenter } from './notifications/NotificationBellCenter';
import { InAppToastNotifier } from './notifications/InAppToastNotifier';
import { PwaInstallPrompt } from './PwaInstallPrompt';
import { WeatherClockWidget } from './WeatherClockWidget';
import type { AppRole } from '@/lib/rbac';
import { roleLabel } from '@/lib/rbac';
import { OfferBasketProvider } from '@/context/OfferBasketContext';
import { OfferBasketBar } from './offers/OfferBasketBar';

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
  employees = [],
  visibleGroups,
}: {
  children: React.ReactNode;
  user: { id: string; name: string; email: string; role: AppRole; allowedRoles?: AppRole[]; avatarUrl?: string | null; organizationId: string; organizations: Array<{ id: string; name: string; slug: string }> };
  employees?: Array<{ id: string; firstName: string; lastName: string; position: string | null }>;
  visibleGroups: NavGroup[];
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isAiTaskModalOpen, setIsAiTaskModalOpen] = useState(false);
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
    <OfferBasketProvider>
      <div className="flex min-h-screen bg-slate-100 text-slate-900 font-sans antialiased">
        <InAppToastNotifier />
        <PwaInstallPrompt />

        {/* MOBILE COMPACT HEADER (< lg) */}
        <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-label="Otevřít menu"
            >
              <Menu size={22} />
            </button>

            <Link href="/dashboard" className="flex items-center gap-2">
              <img src="/seepoint-logo.svg" alt="SeePOINT Outdoor reklama" className="h-7 w-auto" />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAiTaskModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-1.5 text-xs font-black text-white shadow-md hover:from-fuchsia-500 hover:to-pink-500 transition active:scale-95"
              title="🎙️ Zadání AI provozního úkolu"
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">AI Úkol</span>
            </button>
            <Link
              href="/chat"
              className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-emerald-400 hover:text-white border border-slate-700 transition shadow-2xs"
              title="💬 Týmový Chat & Nákupy"
            >
              <MessageSquare size={17} />
            </Link>
            <NotificationBellCenter />
            <Link
              href="/team"
              className="grid h-9 w-9 place-items-center rounded-full bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition"
              title="📞 Kontakty týmu SeePOINT"
            >
              <PhoneCall size={17} />
            </Link>
            <Link
              href="/profile"
              className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-emerald-500 text-xs font-black text-slate-950 ring-2 ring-emerald-500/30 shrink-0"
              title="Můj profil"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
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

        {/* SIDEBAR NAVIGATION */}
        <aside
          className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col bg-slate-950 border-r border-slate-800/80 p-4 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-4 flex items-center justify-between px-2">
            <Link href="/dashboard" className="flex items-center gap-3">
              <img src="/seepoint-logo.svg" alt="SeePOINT Outdoor reklama" className="h-10 w-auto" />
            </Link>

            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            >
              <X size={20} />
            </button>
          </div>

          {/* USER CARD WITH PROFILE LINK */}
          <div className="mb-4 rounded-2xl bg-slate-900/90 border border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Link href="/profile" className="flex items-center gap-2.5 min-w-0 group">
                <div className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-500 text-xs font-black text-slate-950 group-hover:scale-105 transition-transform">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition">{user.name}</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase">{roleLabel(user.role)}</p>
                </div>
              </Link>
              <button
                onClick={logout}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                title="Odhlásit se"
              >
                <LogOut size={16} />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
              <div className="lg:hidden flex justify-center">
                <WeatherClockWidget compact />
              </div>
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
        <main className="min-w-0 flex-1 lg:pl-72 pt-14 lg:pt-0 pb-16 lg:pb-0">
          <AppTopbar user={user} />
          <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6 lg:px-8">{children}</div>
        </main>

        {/* Floating Offer Basket Bar */}
        <OfferBasketBar />

        {/* MOBILE BOTTOM TOOLBAR (< lg) */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-slate-800 bg-slate-950/95 px-2 backdrop-blur-md lg:hidden">
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
            href="/warehouse"
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition ${
              pathname.startsWith('/warehouse') ? 'text-amber-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package size={20} />
            <span>Sklad</span>
          </Link>

          <Link
            href="/mobile-photos"
            className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/30 border-4 border-slate-950 active:scale-95 transition"
            title="Mobilní foto"
          >
            <Camera size={22} />
          </Link>

          <Link
            href="/my-tasks"
            className={`flex flex-col items-center gap-1 text-[10px] font-bold transition ${
              pathname === '/my-tasks' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardCheck size={20} />
            <span>Moje úkoly</span>
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

        <AiQuickTaskModal
          isOpen={isAiTaskModalOpen}
          onClose={() => setIsAiTaskModalOpen(false)}
          employees={employees}
        />
      </div>
    </OfferBasketProvider>
  );
}
