'use client';

import { BadgeDollarSign, BarChart3, BriefcaseBusiness, CalendarCheck, CalendarRange, Camera, Car, ClipboardList, ClipboardCheck, FileText, FileUp, GalleryHorizontalEnd, Map, MapPinned, MessageSquare, PanelsTopLeft, PhoneCall, Route, Settings, ShoppingBag, UserRound, Users } from 'lucide-react';
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
  | 'map'
  | 'mapPinned'
  | 'galleryHorizontalEnd'
  | 'messageSquare'
  | 'panelsTopLeft'
  | 'phone'
  | 'route'
  | 'settings'
  | 'shoppingBag'
  | 'userRound'
  | 'users';

const icons = {
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
  map: Map,
  mapPinned: MapPinned,
  galleryHorizontalEnd: GalleryHorizontalEnd,
  messageSquare: MessageSquare,
  panelsTopLeft: PanelsTopLeft,
  phone: PhoneCall,
  route: Route,
  settings: Settings,
  shoppingBag: ShoppingBag,
  userRound: UserRound,
  users: Users,
} satisfies Record<AppNavIcon, React.ComponentType<{ size?: number }>>;

type AppNavLinkProps = {
  href: string;
  label: string;
  icon: AppNavIcon;
};

export function AppNavLink({ href, label, icon }: AppNavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
  const Icon = icons[icon];

  return (
    <Link
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
      href={href}
    >
      <Icon size={18} />
      <span>{label}</span>
    </Link>
  );
}
