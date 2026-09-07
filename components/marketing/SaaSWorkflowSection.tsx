'use client';

import { Sparkles, FileText, CheckSquare, Wrench, Receipt, ArrowRight } from 'lucide-react';

export function SaaSWorkflowSection() {
  const stages = [
    {
      num: '01',
      title: 'Poptávka',
      desc: 'AI Radar nebo příchozí klientský kontakt v CRM',
      icon: Sparkles,
      color: 'text-purple-400 border-purple-800 bg-purple-950/60',
      details: 'Přiřazení ke klientovi, vyhledání volných termínů',
    },
    {
      num: '02',
      title: 'Nabídka',
      desc: 'Výběr ploch, mapa a veřejný klientský odkaz',
      icon: FileText,
      color: 'text-indigo-400 border-indigo-800 bg-indigo-950/60',
      details: 'Koncept s cenami i bez cen, schválení do 60 s',
    },
    {
      num: '03',
      title: 'Zakázka',
      desc: 'Zarezervování termínů v síti a schválení',
      icon: CheckSquare,
      color: 'text-sky-400 border-sky-800 bg-sky-950/60',
      details: 'Automatická blokace termínů a vytvoření zakázky',
    },
    {
      num: '04',
      title: 'Realizace',
      desc: 'Grafika, výroba, instalace a fotodokumentace',
      icon: Wrench,
      color: 'text-amber-400 border-amber-800 bg-amber-950/60',
      details: 'Grafika → Tisk → Mobilní výjezd → Foto z mobilu',
    },
    {
      num: '05',
      title: 'Fakturace',
      desc: 'Podklady k vyúčtování a klientský report',
      icon: Receipt,
      color: 'text-emerald-400 border-emerald-800 bg-emerald-950/60',
      details: 'Předávací protokol s fotkami a fakturační období',
    },
  ];

  return (
    <section id="workflow" className="py-20 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-black uppercase tracking-wider text-purple-400">
            KOMPLETNÍ WORKFLOW PROCES
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Od poptávky až po vyúčtování.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Předvídatelný řetězec 5 kroků, ve kterém se neztratí žádný úkol, fotografie z terénu ani podklad k fakturaci.
          </p>
        </div>

        {/* Desktop 5 Stages Timeline Grid */}
        <div className="hidden lg:grid grid-cols-5 gap-4 relative pt-4">
          {stages.map((st, idx) => {
            const Icon = st.icon;
            return (
              <div
                key={st.title}
                className="relative z-10 rounded-3xl border border-slate-800 bg-slate-950 p-5 space-y-3 shadow-xl hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`size-11 rounded-2xl border ${st.color} flex items-center justify-center font-black shadow-md`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono text-purple-300 font-bold">{st.num}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-white">{st.title}</h3>
                    <p className="text-sm text-slate-300 font-medium leading-relaxed mt-1">{st.desc}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-850">
                  <span className="text-xs font-bold text-slate-300 block leading-normal">{st.details}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile & Tablet Compact Steps */}
        <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl mx-auto">
          {stages.map((st) => {
            const Icon = st.icon;
            return (
              <div
                key={st.title}
                className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-md"
              >
                <div className={`size-10 rounded-xl border ${st.color} flex items-center justify-center font-black shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-purple-400">{st.num}</span>
                    <strong className="text-sm font-bold text-white">{st.title}</strong>
                  </div>
                  <p className="text-sm text-slate-300 leading-snug">{st.desc}</p>
                  <span className="text-xs text-slate-300 font-semibold block pt-0.5">{st.details}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
