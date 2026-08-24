'use client';

import { CheckCircle2, Sparkles, ArrowRight, ShieldCheck, HelpCircle, Lock, CreditCard, Zap, UserCheck } from 'lucide-react';
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
        'Veřejné klientské odkazy /offer/[token]',
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
        'AI Optimalizátor tras výjezdů',
        'AI Sklad & OCR čtení účtenek',
        'Plná integrace Google Drive & Map',
        'Neomezený počet uživatelů',
        'Prioritní telefonická podpora 24/7',
      ],
    },
    {
      name: 'ENTERPRISE',
      desc: 'Pro mediální domy s tisíci plochami na míru.',
      badge: 'Individuální',
      price: 'Na míru',
      period: '',
      highlight: false,
      features: [
        'Neomezený počet nosičů & ploch',
        'Vlastní doména & branding na míru',
        'Dedikovaný manažer nasazení',
        'Zakázkový import z původního ERP',
        'SLA garantovaná dostupnost 99.9%',
      ],
    },
  ];

  return (
    <section id="cenik" className="py-24 bg-slate-950 border-t border-slate-800 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-800/80 text-purple-300 text-xs font-black uppercase tracking-widest">
            <span>FÉROVÉ MĚSÍČNÍ TARIFY</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Žádné skryté poplatky. Vyberte si tarif pro váš růst.
          </h2>

          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Všechny tarify zahrnují mapové podklady, aktualizace a bezpečný cloudový hosting.
          </p>

          {/* 14-day Risk Free Trust Strip */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-300">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>14 dní plného přístupu zdarma</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span>Žádná platební karta předem</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-sky-300">
              <UserCheck className="w-4 h-4 text-sky-400" />
              <span>Ukázkový import 20 nosičů zdarma</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((pl) => (
            <div
              key={pl.name}
              className={`rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-2xl relative transition-all duration-300 hover:scale-[1.02] ${
                pl.highlight
                  ? 'bg-gradient-to-b from-purple-950/70 via-slate-900 to-indigo-950/70 border-2 border-purple-500/80 ring-2 ring-purple-500/20'
                  : 'bg-slate-900/60 border border-slate-800'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg text-white">{pl.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      pl.highlight
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {pl.badge}
                  </span>
                </div>

                <div className="pt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">{pl.price}</span>
                    <span className="text-xs text-slate-400 font-bold">{pl.period}</span>
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
                  <span>Vyzkoušet na 14 dní zdarma</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
