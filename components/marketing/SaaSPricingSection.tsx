'use client';

import { CheckCircle2, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSPricingSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const plans = [
    {
      name: 'START',
      desc: 'Pro menší provozovatele nosičů a menší týmy.',
      badge: 'Do 100 nosičů',
      price: '1 900 Kč',
      period: '/ měsíc',
      highlight: false,
      carriers: 'Až 100 nosičů',
      users: 'Až 3 uživatelé',
      modules: 'Katalog, mapa sítě, obsazenost a základní nabídky',
      ai: 'Ne',
      support: 'E-mailová podpora',
    },
    {
      name: 'BUSINESS',
      desc: 'Pro rostoucí reklamní agentury a provozovatele.',
      badge: 'DOPORUČUJEME',
      price: '4 900 Kč',
      period: '/ měsíc',
      highlight: true,
      carriers: 'Až 500 nosičů',
      users: 'Až 10 uživatelů',
      modules: 'Veřejné klientské odkazy, mobilní terén, navigace VO',
      ai: 'AI Generátor nabídek v ceně',
      support: 'Prioritní e-mail i telefon',
    },
    {
      name: 'PRO',
      desc: 'Pro rozsáhlejší OOH sítě s vyšší dynamikou.',
      badge: 'Až 2 000 nosičů',
      price: '9 900 Kč',
      period: '/ měsíc',
      highlight: false,
      carriers: 'Až 2 000 nosičů',
      users: 'Neomezeně uživatelů',
      modules: 'Kompletní systém včetně trasování a skladu',
      ai: 'Kompletní AI balíček (Radar, nabídky, účtenky)',
      support: 'Dedikovaný kontakt',
    },
    {
      name: 'ENTERPRISE',
      desc: 'Pro mediální domy a velké sítě s individuálními požadavky.',
      badge: 'Individuální',
      price: 'Na míru',
      period: '',
      highlight: false,
      carriers: 'Neomezeně nosičů',
      users: 'Neomezeně uživatelů',
      modules: 'Vlastní integrace, zakázkový import dat a branding',
      ai: 'AI moduly na míru',
      support: 'Dedikovaný account manažer',
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
            Přehledné tarify pro každou velikost sítě.
          </h2>

          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Všechny tarify zahrnují mapové podklady, aktualizace a bezpečný cloudový hosting bez skrytých poplatků.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-300">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Nezávazná ukázka a vyzkoušení</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
              <span>Bez platební karty předem</span>
            </div>
          </div>
        </div>

        {/* 4 Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl p-6 flex flex-col justify-between space-y-6 transition relative ${
                plan.highlight
                  ? 'border-2 border-purple-500 bg-gradient-to-b from-purple-950/60 via-slate-900 to-slate-950 shadow-2xl ring-2 ring-purple-500/20'
                  : 'border border-slate-800 bg-slate-950 shadow-xl hover:border-slate-700'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
                  {plan.badge}
                </span>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-white">{plan.name}</h3>
                  {!plan.highlight && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-400 border border-slate-800">
                      {plan.badge}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">{plan.desc}</p>

                <div className="pt-2 border-t border-slate-800">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-white font-mono">{plan.price}</span>
                    <span className="text-xs font-semibold text-slate-400">{plan.period}</span>
                  </div>
                </div>

                {/* Key Facts Summary */}
                <div className="space-y-2.5 pt-2 text-xs">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200 font-bold">{plan.carriers}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300 font-medium">{plan.users}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300 font-medium">{plan.modules}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300 font-medium">AI: <strong className="text-white">{plan.ai}</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300 font-medium">{plan.support}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    trackSaaSEvent('demo_cta_clicked', { source: `pricing_${plan.name}` });
                    onOpenDemoModal();
                  }}
                  className={`w-full py-3 rounded-2xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  <span>Zvolit tarif {plan.name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
