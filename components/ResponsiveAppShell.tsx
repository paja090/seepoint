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
} from 'lucide-react';
import { AppNavLink, type AppNavIcon } from './AppNavLink';
import { AppTopbar } from './AppTopbar';
import type { AppRole } from '@/lib/rbac';
import { roleLabel } from '@/lib/rbac';

export type NavItem = [string, string, AppNavIcon, string];
export type NavGroup = { label: string; items: NavItem[] };

export function ResponsiveAppShell({
  children,
  user,
  visibleGroups,
}: {
  children: React.ReactNode;
  user: { id: string; name: string; email: string; role: AppRole };
  visibleGroups: NavGroup[];
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const pathname = usePathname();

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
      {/* MOBILE TOP BAR (hidden on lg) */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-900 bg-slate-950 px-4 text-white lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-slate-200 border border-slate-800 hover:bg-slate-800 active:scale-95 transition"
            aria-label="Otevřít menu"
          >
            <Menu size={22} />
          </button>
          <Link href="/dashboard" className="inline-flex items-center">
            <img alt="SeePOINT Logo" className="h-9 w-auto" src="/seepoint-logo.svg" />
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/mobile-photos"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-black text-slate-950 shadow-md shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition"
          >
            <Camera size={16} />
            <span>Foto</span>
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
            <img alt="SeePOINT Outdoor reklama" className="h-14 w-auto" src="/seepoint-logo.svg" />
            <p className="mt-1 text-[10px] font-medium text-slate-400">Interní administrační systém</p>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-slate-400 hover:text-white lg:hidden"
            aria-label="Zavřít menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Card in Sidebar */}
        <div className="mb-4 shrink-0 rounded-2xl border border-slate-800 bg-slate-900/80 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-xs font-black text-slate-950">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{user.name}</p>
              <p className="text-[10px] text-slate-400">{roleLabel(user.role)}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            title="Odhlásit se"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Single Clean Scrollable Navigation Area (No Double Scrollbars) */}
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
