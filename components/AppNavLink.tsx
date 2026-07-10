'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';

type AppNavLinkProps = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
};

export function AppNavLink({ href, label, icon: Icon }: AppNavLinkProps) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));

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
