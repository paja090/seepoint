'use client';

import { CheckCircle2, Sparkles, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSPricingSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const plans = [
    {
      name: 'START',
      desc: 'Pro menší provozovatele reklamních ploch.',
      badge: 'Do 100 nosičů',
      price: '1 900 Kč',
      period: '/ měsíc',
      highlight: false,
      features: [
        'Katalog nosičů & GPS mapa',
        'Kalendář obsazenosti nosičů',
        'Tvorba standardních nabídek',
        'Základní kartotéka klientů',
        'Až 3 uživatelé v organizaci',
        'E-mailová podpora',
      ],
    },
    {
      name: 'BUSINESS',
      desc: 'Pro rostoucí reklamní společnosti a agentury.',
      badge: 'DOPORUČUJEME',
      price: '4 900 Kč',
      period: '/ měsíc',
      highlight: true,
      features: [
        'Vše z tarifu START',
        'AI Generátor klientských nabídek',
        'Podpora konceptů bez cen',
        'Veřejné klientské odkaz /offer/[token]',
        'Mobilní výkazy pro montážníky',
        'Modul Navigace VO na sloupech',
        'Až 500 spravovaných nosičů & 10 uživatelů',
      ],
    },
    {
      name: 'PRO',
      desc: 'Pro rozsáhlé OOH sítě a navigační systémy.',
      badge: 'Až 2000 nosičů',
      price: '9 900 Kč',
      period: '/ měsíc',
      highlight: false,
      features: [
        'Vše z tarifu BUSINESS',
        'AI Sales Radar (Příležitosti)',
        'Klientský protokol fotodokumentace',
        'Vlastní logo & branding na nabídkách',
        'Rozšířené uživatelské role (RBAC)',
        'Až 30 uživatelů v organizaci',
        'Prioritní technická podpora',
      ],
    },
    {
      name: 'ENTERPRISE',
      desc: 'Individuální řešení na míru vašim procesům.',
      badge: 'Neomezeně',
      price: 'Individuální',
      period: 'kalkulace',
      highlight: false,
      features: [
        'Neomezený počet nosičů & uživatelů',
        'Asistovaná migrace dat z Excelu',
        'Vlastní doména & SLA dostupnost',
        'Možnost úprav rozhraní na míru',
        'Dedikovaný manažer účtu',
      ],
    },
  ];

  return (
    <section id="cenik" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            TARIFY A CENÍK
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Řešení podle velikosti vaší reklamní sítě.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Vyberte si úroveň systému odpovídající vašemu provozu. Cenu nastavíme individuálně podle počtu nosičů a roz rozsahu modulů.
          </p>
        </div>

        {/* 4 Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((pl) => (
            <div
              key={pl.name}
              className={`rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between transition duration-200 relative ${
                pl.highlight
                  ? 'border-2 border-purple-600 bg-gradient-to-b from-slate-900 via-slate-900 to-purple-950/60 shadow-2xl scale-[1.03] ring-1 ring-purple-500/50'
                  : 'border border-slate-800 bg-slate-950 shadow-xl'
              }`}
            >
              {pl.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-[10px] uppercase tracking-wider shadow-md">
                  DOPORUČENÁ VOLBA
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-xl font-black text-white">{pl.name}</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-800">
                    {pl.badge}
                  </span>
                </div>

                <div className="py-2 border-b border-slate-800/80">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white tracking-tight">{pl.price}</span>
                    <span className="text-xs text-slate-400 font-semibold">{pl.period}</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-medium leading-relaxed">{pl.desc}</p>

                <div className="pt-2 space-y-2">
                  {pl.features.map((ft) => (
                    <div key={ft} className="flex items-start gap-2 text-xs text-slate-200 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span>{ft}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    trackSaaSEvent('demo_cta_clicked', { source: `pricing_${pl.name}` });
                    onOpenDemoModal();
                  }}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 ${
                    pl.highlight
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                  <span>Domluvit konzultaci</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
