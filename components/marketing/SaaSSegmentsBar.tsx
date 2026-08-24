'use client';

import Image from 'next/image';
import { Car, ShoppingBag, Utensils, Sparkles, Building2 } from 'lucide-react';

export function SaaSSegmentsBar() {
  const segments = [
    {
      icon: Car,
      label: 'Autoservisy & Salony',
      sub: 'Navigace z dálnic & billboardy',
      image: '/images/segments/auto_service.jpg',
      badge: 'Navigační koridory',
      color: 'text-sky-400',
    },
    {
      icon: ShoppingBag,
      label: 'Retail Parky & Prodejny',
      sub: 'Promo Tower, CLP a sítě',
      image: '/images/segments/retail_park.jpg',
      badge: 'Promo Tower & CLP',
      color: 'text-purple-400',
    },
    {
      icon: Utensils,
      label: 'Restaurace & Fast Food',
      sub: 'Směrové tabule na sloupech VO',
      image: '/images/segments/restaurant.jpg',
      badge: 'Sloupy VO & Trasy',
      color: 'text-amber-400',
    },
    {
      icon: Sparkles,
      label: 'Festivaly & Akce měst',
      sub: 'Kampaňové zásahy na 14 dní',
      image: '/images/segments/festival.jpg',
      badge: '14denní kampaň',
      color: 'text-pink-400',
    },
    {
      icon: Building2,
      label: 'Developeři & Reality',
      sub: 'Velkoformátové plachty',
      image: '/images/segments/real_estate.jpg',
      badge: 'Velkoformát OOH',
      color: 'text-emerald-400',
    },
  ];

  return (
    <section className="py-10 bg-slate-950/90 border-b border-slate-800 relative z-20 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
              SEKTORY & VYUŽITÍ V PRAXI
            </span>
            <h3 className="text-base sm:text-lg font-black text-white">
              Pro koho SeePoint OS automatizuje nabídky a kampaně
            </h3>
          </div>
          <span className="text-xs font-bold text-slate-400">
            Reálné vizualizace nosičů v terénu
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {segments.map((seg, idx) => {
            const Icon = seg.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl hover:border-purple-600/80 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Image Container with Hover Zoom */}
                <div className="relative h-36 w-full overflow-hidden bg-slate-950">
                  <Image
                    src={seg.image}
                    alt={seg.label}
                    fill
                    unoptimized
                    priority
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    sizes="(max-width: 768px) 100vw, 20vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                  {/* Top Badge */}
                  <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-950/80 text-white border border-slate-700/80 backdrop-blur-md">
                    {seg.badge}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 space-y-1 relative bg-slate-950/90">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-slate-900 border border-slate-800 ${seg.color} shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <strong className="text-xs font-black text-white block truncate">{seg.label}</strong>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed pl-8">{seg.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
