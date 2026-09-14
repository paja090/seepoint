'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BriefcaseBusiness, Camera, ChevronDown, ChevronLeft, ChevronRight, LogOut, MapPin, Menu, Settings, Sparkles, Star, Wrench, X } from 'lucide-react';
import { AppNavLink, navigationIcons } from './AppNavLink';
import { findActiveNavigation, mobileHrefs, quickAccessHrefs, type NavigationHub, type NavGroup, type NavItem } from '@/lib/navigation';

const hubIcons = { sparkles: Sparkles, briefcaseBusiness: BriefcaseBusiness, mapPinned: MapPin, wrench: Wrench, settings: Settings };
const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400';
const scrollStyle = { colorScheme: 'dark', scrollbarWidth: 'thin', scrollbarColor: '#475569 #020617' } as const;

function NavigationGroup({ group, activeHref, ai }: { group: NavGroup; activeHref?: string; ai: boolean }) {
  const [closed, setClosed] = useState(false);
  // Reopen when navigating into a closed group, while allowing manual collapse.
  const [previousHref, setPreviousHref] = useState(activeHref);
  if (previousHref !== activeHref) {
    setPreviousHref(activeHref);
    if (group.items.some(item => item[0] === activeHref)) setClosed(false);
  }
  return <section>
    <button type="button" aria-expanded={!closed} onClick={() => setClosed(!closed)} className={`mb-1 flex min-h-9 w-full items-center justify-between rounded px-2 text-xs font-semibold text-slate-300 hover:text-white ${focusClass}`}>
      {group.label}<ChevronDown size={13} className={`transition-transform duration-150 ${closed ? '-rotate-90' : ''}`} />
    </button>
    {!closed && <div className="space-y-1">{group.items.map(([href, label, icon]) => <AppNavLink key={href} href={href} label={label} icon={icon} ai={ai} active={activeHref === href} />)}</div>}
  </section>;
}

function QuickAccess({ items, activeHref }: { items: NavItem[]; activeHref?: string }) {
  if (!items.length) return null;
  return <section className="mb-4 border-b border-slate-800 pb-4">
    <p className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold text-slate-300"><Star size={14} />Rychlý přístup</p>
    {items.map(([href, label, icon]) => <AppNavLink key={href} href={href} label={label} icon={icon} ai={href === '/commercial'} active={activeHref === href} />)}
  </section>;
}

export function AppNavigation({ hubs, pathname, collapsed, onToggle, mobileOpen, onOpen, onClose, user, logout, children, utilityAccess }: {
  hubs: NavigationHub[]; pathname: string; collapsed: boolean; onToggle: () => void;
  mobileOpen: boolean; onOpen: () => void; onClose: () => void;
  user: { name: string; avatarUrl?: string | null }; logout: () => Promise<void>;
  children: React.ReactNode; utilityAccess: { photos: boolean; team: boolean };
}) {
  const active = findActiveNavigation(hubs, pathname);
  const [selection, setSelection] = useState<{ path: string; id: string } | null>(null);
  const hub = hubs.find(h => h.id === (selection?.path === pathname ? selection.id : active?.hub.id)) ?? hubs[0];
  const items = hubs.flatMap(h => h.groups.flatMap(g => g.items));
  const quick = quickAccessHrefs.flatMap(href => items.filter(i => i[0] === href));
  // Pinned destinations remain reachable above; do not repeat them in the same menu.
  const contextualGroups = (h: NavigationHub) => h.groups.map(group => ({ ...group,
    items: group.items.filter(item => !quick.some(pin => pin[0] === item[0])),
  })).filter(group => group.items.length > 0);
  const [mobileSelection, setMobileSelection] = useState<{ path: string; id: string | null } | null>(null);
  const mobileHubId = mobileSelection?.path === pathname ? mobileSelection.id : active?.hub.id;
  const bottom = mobileHrefs.flatMap(href => items.filter(i => i[0] === href));
  const bottomLeft = bottom.slice(0, 2);
  const bottomRight = bottom.slice(2);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    if (!mobileOpen || !element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1024px)');
    const handleResize = () => { if (desktop.matches) closeRef.current(); };
    desktop.addEventListener('change', handleResize);
    return () => {
      desktop.removeEventListener('change', handleResize);
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mobileOpen]);
  const initials = user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'SP';
  const railButton = (h: NavigationHub) => {
    const Icon = hubIcons[h.icon];
    return <button key={h.id} type="button" aria-label={h.label} aria-pressed={hub?.id === h.id} title={h.label}
      onClick={() => { setSelection({ path: pathname, id: h.id }); if (collapsed) onToggle(); }}
      className={`group relative grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors duration-150 ${focusClass} ${hub?.id === h.id ? 'bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_-6px_rgba(52,211,153,0.45)] ring-1 ring-inset ring-emerald-400/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
      <Icon size={21} />
      <span aria-hidden="true" className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white shadow-xl group-hover:block group-focus-visible:block">{h.label}</span>
    </button>;
  };
  return <>
    <nav aria-label="Hlavní huby" className="fixed inset-y-0 left-0 z-50 hidden w-[60px] flex-col items-center gap-2 border-r border-slate-800 bg-slate-950 py-3 lg:flex">
      <Link href="/profile" aria-label="SeePoint – můj profil" title="SeePoint OS" className={`mb-5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400 text-sm font-black text-slate-950 ${focusClass}`}>SP</Link>
      {hubs.filter(h => h.id !== 'management').map(railButton)}
      <button type="button" onClick={onToggle} aria-label={collapsed ? 'Rozbalit navigaci' : 'Sbalit navigaci'} aria-expanded={!collapsed} aria-controls="context-sidebar" title={collapsed ? 'Rozbalit navigaci' : 'Sbalit navigaci'} className={`grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 ${focusClass}`}>
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
      <div className="mt-auto flex flex-col items-center gap-2">
        {hubs.filter(h => h.id === 'management').map(railButton)}
        <Link href="/profile" title={user.name} aria-label={`Můj profil: ${user.name}`} className={`grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-emerald-400 text-xs font-bold text-slate-950 ${focusClass}`}>
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
        </Link>
        <button type="button" onClick={logout} title="Odhlásit se" aria-label="Odhlásit se" className={`grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:text-red-300 ${focusClass}`}><LogOut size={17} /></button>
      </div>
    </nav>
    <aside id="context-sidebar" aria-label="Kontextová navigace" className={`fixed inset-y-0 left-[60px] z-40 w-[232px] flex-col border-r border-slate-800 bg-slate-950 ${collapsed ? 'hidden' : 'hidden lg:flex'}`}>
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-4">
        <h2 className="text-sm font-semibold text-white">{hub?.label ?? 'SeePoint OS'}</h2>
        <button type="button" onClick={onToggle} aria-label="Sbalit navigaci" className={`rounded p-2 text-slate-400 hover:text-white ${focusClass}`}><ChevronLeft size={16} /></button>
      </div>
      <nav aria-label={hub?.label} style={scrollStyle} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <QuickAccess items={quick} activeHref={active?.item[0]} />
        {hub && contextualGroups(hub).map(group => <NavigationGroup key={`${hub.id}-${group.label}`} group={group} activeHref={active?.item[0]} ai={hub.id === 'ai'} />)}
      </nav>
      <div style={scrollStyle} className="max-h-[35vh] overflow-y-auto border-t border-slate-800 p-3">{children}</div>
    </aside>
    <dialog ref={dialog} aria-labelledby="mobile-navigation-title" onCancel={onClose} onClose={onClose}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
          .filter(element => element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(360px,100vw)] max-w-none border-r border-slate-800 bg-slate-950 p-0 text-white backdrop:bg-slate-950/75 backdrop:backdrop-blur-sm lg:hidden">
      <div className="flex h-full flex-col" onClick={event => { if ((event.target as HTMLElement).closest('a')) onClose(); }}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-400 text-xs font-black text-slate-950">SP</span>
            <h2 id="mobile-navigation-title" className="font-semibold text-white">SeePoint OS</h2>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="Zavřít menu" className={`grid h-11 w-11 place-items-center rounded-lg ${focusClass}`}><X size={20} /></button>
        </div>
        <div className="shrink-0 border-b border-slate-800 bg-slate-950/90 p-3">
          {children}
        </div>
        <nav aria-label="Mobilní navigace" style={scrollStyle} className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
          <QuickAccess items={quick} activeHref={active?.item[0]} />
          {hubs.map(h => {
            const Icon = hubIcons[h.icon];
            const open = mobileHubId === h.id;
            return <section key={h.id}>
              <h3><button type="button" aria-expanded={open} aria-controls={`mobile-hub-${h.id}`}
                onClick={() => setMobileSelection({ path: pathname, id: open ? null : h.id })}
                className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-semibold transition-colors duration-150 ${focusClass} ${open ? 'bg-slate-900 text-white' : 'text-slate-300 hover:bg-slate-900'} ${h.id === 'ai' ? 'text-emerald-300' : ''}`}>
                <Icon size={19} /><span className="flex-1 text-left">{h.label}</span><ChevronDown size={16} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
              </button></h3>
              <div id={`mobile-hub-${h.id}`} hidden={!open} className="mb-2 ml-4 space-y-0.5 border-l border-slate-800 py-1 pl-2">
                {contextualGroups(h).flatMap(group => group.items).map(([href, label, icon]) => <AppNavLink key={href} href={href} label={label} icon={icon} ai={h.id === 'ai'} active={active?.item[0] === href} />)}
              </div>
            </section>;
          })}
          <section className="space-y-1 border-t border-slate-800 pt-3">
            {utilityAccess.photos && <AppNavLink href="/mobile-photos" label="Mobilní foto" icon="camera" />}
            {utilityAccess.team && <><AppNavLink href="/chat" label="Týmový chat" icon="messageSquare" /><AppNavLink href="/team" label="Kontakty týmu" icon="phone" /></>}
          </section>
        </nav>
      </div>
    </dialog>
    <nav aria-label="Rychlá mobilní navigace" className="fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-center justify-around border-t border-slate-800 bg-slate-950 px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {bottomLeft.map(([href, label, icon]) => {
        const Icon = navigationIcons[icon];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active?.item[0] === href ? 'page' : undefined}
            className={`flex min-h-14 min-w-12 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px] ${focusClass} ${
              active?.item[0] === href ? 'text-emerald-300 font-bold' : 'text-slate-400'
            }`}
          >
            <Icon size={20} />
            <span>{href === '/dashboard' ? 'Přehled' : href === '/warehouse' ? 'Sklad' : label}</span>
          </Link>
        );
      })}
      {utilityAccess.photos && (
        <Link
          href="/mobile-photos"
          aria-label="Mobilní foto"
          title="Mobilní foto"
          className={`flex h-12 w-12 -translate-y-3 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/30 border-4 border-slate-950 transition active:scale-95 ${focusClass}`}
        >
          <Camera size={22} />
        </Link>
      )}
      {bottomRight.map(([href, label, icon]) => {
        const Icon = navigationIcons[icon];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active?.item[0] === href ? 'page' : undefined}
            className={`flex min-h-14 min-w-12 flex-col items-center justify-center gap-1 rounded-lg px-2 text-[10px] ${focusClass} ${
              active?.item[0] === href ? 'text-emerald-300 font-bold' : 'text-slate-400'
            }`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onOpen}
        aria-label="Otevřít menu"
        aria-expanded={mobileOpen}
        className={`flex min-h-14 min-w-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] text-slate-400 ${focusClass}`}
      >
        <Menu size={20} />
        <span>Menu</span>
      </button>
    </nav>
  </>;
}
