'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isAiWorkspace } from '@/lib/ai-theme';
import { Menu, LogOut, MessageSquare, PhoneCall, Sparkles } from 'lucide-react';
import { AiQuickTaskModal } from './tasks/AiQuickTaskModal';
import { AiQuickTaskContext } from './tasks/AiQuickTaskContext';
import { AppNavigation } from './AppNavigation';
import type { NavigationHub } from '@/lib/navigation';
import { useSidebarPreference } from '@/lib/sidebar-preference';
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
import { OrganizationSwitcher } from './OrganizationSwitcher';

export function ResponsiveAppShell({
  children,
  user,
  employees = [],
  visibleHubs,
  utilityAccess,
}: {
  children: React.ReactNode;
  user: { id: string; name: string; email: string; role: AppRole; allowedRoles?: AppRole[]; organizationRoleLabel: string; isPlatformSuperAdmin: boolean; avatarUrl?: string | null; organizationId: string; organizations: Array<{ id: string; name: string; slug: string }> };
  employees?: Array<{ id: string; firstName: string; lastName: string; position: string | null }>;
  visibleHubs: NavigationHub[];
  utilityAccess: { photos: boolean; team: boolean };
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isAiTaskModalOpen, setIsAiTaskModalOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const aiWorkspace = isAiWorkspace(pathname);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
    setIsAiTaskModalOpen(false);
  }, [pathname]);

  const [collapsed, toggleSidebar] = useSidebarPreference();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const initials = user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'SP';

  return (
    <AiQuickTaskContext.Provider value={() => setIsAiTaskModalOpen(true)}>
    <OfferBasketProvider>
      <div className={`flex min-h-screen max-w-full overflow-x-hidden ${aiWorkspace ? 'bg-[#090f1d]' : 'bg-slate-100'} text-slate-900 font-sans antialiased`}>
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
              <img src="/seepoint-logo.svg" alt="SeePOINT Outdoor reklama" className="h-7 w-auto max-w-[90px]" />
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
            {utilityAccess.team && <Link
              href="/chat"
              className="hidden h-9 w-9 place-items-center rounded-full bg-slate-800 text-emerald-400 hover:text-white border border-slate-700 transition shadow-2xs sm:grid"
              title="💬 Týmový Chat & Nákupy"
            >
              <MessageSquare size={17} />
            </Link>}
            <NotificationBellCenter />
            {utilityAccess.team && <Link
              href="/team"
              className="hidden h-9 w-9 place-items-center rounded-full bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition sm:grid"
              title="📞 Kontakty týmu SeePOINT"
            >
              <PhoneCall size={17} />
            </Link>}
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

        <AppNavigation hubs={visibleHubs} pathname={pathname} collapsed={collapsed} onToggle={toggleSidebar}
          mobileOpen={mobileDrawerOpen} onOpen={() => setMobileDrawerOpen(true)} onClose={() => setMobileDrawerOpen(false)}
          user={user} logout={logout} utilityAccess={utilityAccess}>
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
                  <p className="text-[10px] font-medium text-slate-400">Aktivní role: {roleLabel(user.role)}</p>
                  <p className="text-[10px] font-medium text-slate-500">Členství: {user.organizationRoleLabel}</p>
                </div>
              </Link>
              <button
                onClick={logout}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                title="Odhlásit se"
                aria-label="Odhlásit se"
              >
                <LogOut size={16} />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-2">
              {user.isPlatformSuperAdmin && (
                <p className="rounded-lg border border-purple-700/60 bg-purple-950/60 px-2 py-1 text-center text-[10px] font-bold text-purple-200">
                  Platforma: Superadmin
                </p>
              )}
              {user.organizations && user.organizations.length > 1 && (
                <div className="flex justify-center text-xs">
                  <OrganizationSwitcher activeId={user.organizationId} organizations={user.organizations} />
                </div>
              )}
              <div className="lg:hidden flex justify-center">
                <WeatherClockWidget compact />
              </div>
              <RoleSwitcherButton currentRole={user.role} allowedRoles={user.allowedRoles} />
            </div>
          </div>


        </AppNavigation>

        {/* MAIN CONTENT AREA */}
        <main className={`${aiWorkspace ? 'ai-theme ai-workspace' : ''} min-w-0 max-w-full overflow-x-hidden flex-1 pt-14 lg:pt-0 pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 ${collapsed ? 'lg:pl-[60px]' : 'lg:pl-[292px]'}`}>
          <AppTopbar user={user} canUseTeam={utilityAccess.team} onAiQuickTask={() => setIsAiTaskModalOpen(true)} />
          <div className="w-full px-3 py-4 sm:px-4 sm:py-6 lg:px-8">{children}</div>
        </main>

        {/* Floating Offer Basket Bar */}
        <OfferBasketBar />

        <AiQuickTaskModal
          key={user.organizationId}
          isOpen={isAiTaskModalOpen}
          onClose={() => setIsAiTaskModalOpen(false)}
          employees={employees}
          onTasksCreated={() => router.refresh()}
        />
      </div>
    </OfferBasketProvider>
    </AiQuickTaskContext.Provider>
  );
}
