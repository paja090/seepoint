'use client';

import { Car, ShoppingBag, Utensils, Sparkles, Building2, Store } from 'lucide-react';

export function SaaSSegmentsBar() {
  const segments = [
    {
      icon: Car,
      label: 'Autoservisy & Salony',
      sub: 'Navigační koridory z dálnic & billboardy',
      color: 'text-sky-400',
    },
    {
      icon: ShoppingBag,
      label: 'Retail Parky & Prodejny',
      sub: 'Promo Tower, CLP a CLP sítě',
      color: 'text-purple-400',
    },
    {
      icon: Utensils,
      label: 'Restaurace & Fast Food',
      sub: 'Směrové tabule na sloupech VO',
      color: 'text-amber-400',
    },
    {
      icon: Sparkles,
      label: 'Festivaly & Akce měst',
      sub: 'Kampaňové zásahy na 14 až 30 dní',
      color: 'text-pink-400',
    },
    {
      icon: Building2,
      label: 'Developeři & Reality',
      sub: 'Velkoformátové plachty & směrovky',
      color: 'text-emerald-400',
    },
  ];

  return (
    <section className="py-8 bg-slate-950/80 border-b border-slate-850 relative z-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            SEKTORY & TYPICKÉ OOH KAMPANĚ V SYSTÉMU SEEPOINT OS
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {segments.map((seg, idx) => {
            const Icon = seg.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-purple-700/60 transition group backdrop-blur-sm"
              >
                <div className={`p-2 rounded-xl bg-slate-950 border border-slate-800 ${seg.color} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <strong className="text-xs font-black text-white block truncate">{seg.label}</strong>
                  <span className="text-[10px] text-slate-400 font-medium block truncate">{seg.sub}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
