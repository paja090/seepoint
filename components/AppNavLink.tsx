'use client';

import {
  BadgeDollarSign,
  BarChart3,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarRange,
  Camera,
  Car,
  ClipboardList,
  ClipboardCheck,
  FileText,
  FileUp,
  GalleryHorizontalEnd,
  Globe,
  Map,
  MapPinned,
  MessageSquare,
  PanelsTopLeft,
  PhoneCall,
  Radar,
  Route,
  Settings,
  ShoppingBag,
  UserRound,
  Users,
  Printer,
  Mail,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type AppNavIcon =
  | 'badgeDollarSign'
  | 'barChart3'
  | 'briefcaseBusiness'
  | 'calendarCheck'
  | 'calendarRange'
  | 'camera'
  | 'car'
  | 'clipboardList'
  | 'clipboardCheck'
  | 'fileText'
  | 'fileUp'
  | 'globe'
  | 'map'
  | 'mapPinned'
  | 'galleryHorizontalEnd'
  | 'messageSquare'
  | 'panelsTopLeft'
  | 'phone'
  | 'radar'
  | 'route'
  | 'settings'
  | 'shoppingBag'
  | 'userRound'
  | 'users'
  | 'printer'
  | 'mail'
  | 'sparkles';

export const navigationIcons = {
  badgeDollarSign: BadgeDollarSign,
  barChart3: BarChart3,
  briefcaseBusiness: BriefcaseBusiness,
  calendarCheck: CalendarCheck,
  calendarRange: CalendarRange,
  camera: Camera,
  car: Car,
  clipboardList: ClipboardList,
  clipboardCheck: ClipboardCheck,
  fileText: FileText,
  fileUp: FileUp,
  globe: Globe,
  map: Map,
  mapPinned: MapPinned,
  galleryHorizontalEnd: GalleryHorizontalEnd,
  messageSquare: MessageSquare,
  panelsTopLeft: PanelsTopLeft,
  phone: PhoneCall,
  radar: Radar,
  route: Route,
  settings: Settings,
  shoppingBag: ShoppingBag,
  userRound: UserRound,
  users: Users,
  printer: Printer,
  mail: Mail,
  sparkles: Sparkles,
} satisfies Record<AppNavIcon, React.ComponentType<{ size?: number }>>;

type AppNavLinkProps = {
  href: string;
  label: string;
  icon: AppNavIcon;
  active?: boolean;
  ai?: boolean;
};

export function AppNavLink({ href, label, icon, active: activeOverride, ai = false }: AppNavLinkProps) {
  const pathname = usePathname();
  const active = activeOverride ?? (pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`)));
  const Icon = navigationIcons[icon] || PanelsTopLeft;

  return (
    <Link
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${ai ? 'bg-gradient-to-r from-emerald-950/30 to-violet-950/20' : ''} ${
        active ? 'bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/25' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
      href={href}
    >
      <span className="shrink-0"><Icon size={16} /></span>
      <span className="min-w-0 flex-1">{label}</span>
      {ai && <span className="rounded border border-violet-400/25 px-1 text-[10px] leading-4 text-violet-300">AI</span>}
    </Link>
  );
}
