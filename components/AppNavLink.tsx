'use client';

import { BadgeDollarSign, BarChart3, BriefcaseBusiness, CalendarCheck, CalendarRange, Car, ClipboardList, ContactRound, FilePlus2, FileText, FileUp, Gauge, Map, PanelsTopLeft, Route, Settings, UserRound, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type AppNavIcon =
  | 'badgeDollarSign'
  | 'barChart3'
  | 'briefcaseBusiness'
  | 'calendarCheck'
  | 'calendarRange'
  | 'car'
  | 'clipboardList'
  | 'contactRound'
  | 'filePlus2'
  | 'fileText'
  | 'fileUp'
  | 'gauge'
  | 'map'
  | 'panelsTopLeft'
  | 'route'
  | 'settings'
  | 'userRound'
  | 'users';

const icons = {
  badgeDollarSign: BadgeDollarSign,
  barChart3: BarChart3,
  briefcaseBusiness: BriefcaseBusiness,
  calendarCheck: CalendarCheck,
  calendarRange: CalendarRange,
  car: Car,
  clipboardList: ClipboardList,
  contactRound: ContactRound,
  filePlus2: FilePlus2,
  fileText: FileText,
  fileUp: FileUp,
  gauge: Gauge,
  map: Map,
  panelsTopLeft: PanelsTopLeft,
  route: Route,
  settings: Settings,
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
