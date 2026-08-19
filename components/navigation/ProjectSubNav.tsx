'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type SubNavItem = {
  href: string;
  label: string;
  badge?: string | number;
};

export function ProjectSubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2 mb-6">
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== '/navigation' && item.href !== '/projects/city-inventory' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              isActive
                ? 'bg-slate-900 text-white shadow-xs font-black'
                : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            <span>{item.label}</span>
            {item.badge !== undefined && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                  isActive ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
