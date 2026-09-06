'use client';

import { ArrowRight, ShieldCheck, Sparkles, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSOnboardingSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const steps = [
    {
      num: '01',
      title: 'Předáte nám vaše data',
      desc: 'Nemusíte mít tabulky v našem formátu. Pomůžeme vám převést vaše současné tabulky, GPS, názvy nosičů i klientská data.',
    },
    {
      num: '02',
      title: 'Nastavíme systém',
      desc: 'Připravíme ceníky, mapové podklady, organizační strukturu a firemní šablony nabídek.',
    },
    {
      num: '03',
      title: 'Zapojíme váš tým',
      desc: 'Obchodníci, dispečink i montážníci dostanou přístupy a krátké zaškolení přímo na vašich datech.',
    },
    {
      num: '04',
      title: 'Začnete pracovat',
      desc: 'Okamžitě generujete nabídky klientům, plánujete výjezdy a řídíte obsazenost bez duplicit.',
    },
  ];

  return (
    <section id="migrace" className="py-20 bg-slate-900/50 border-t border-slate-800 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-black uppercase tracking-wider text-purple-400">
            ASISTOVANÁ MIGRACE DAT
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Nemusíte začínat od nuly.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Máte data v Excelu, na Google Disku nebo ve složkách? Pomůžeme vám je bezpečně a asistovaně převést do SeePoint OS.
          </p>
        </div>

        {/* Visual Migration Flow Banner */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center text-center">
            <div className="md:col-span-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
              <span className="text-xs sm:text-sm font-mono font-bold text-rose-400">PŮVODNÍ STAV</span>
              <h4 className="font-black text-base text-white">Excel, Drive & Složky</h4>
              <p className="text-sm text-slate-300">Rozptýlené soubory, různé verze a nejasná obsazenost</p>
            </div>

            <div className="md:col-span-4 flex flex-col items-center justify-center">
              <div className="size-12 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-xl">
                <ArrowRight className="w-6 h-6" />
              </div>
              <span className="mt-2 text-sm font-bold text-purple-300">Asistovaný převod a strukturování dat</span>
            </div>

            <div className="md:col-span-4 p-4 rounded-2xl bg-purple-950/60 border border-purple-800/80 space-y-1.5">
              <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400">CÍLOVÝ STAV</span>
              <h4 className="font-black text-base text-white">SeePoint OS</h4>
              <p className="text-sm text-purple-200">Jedna mapa, přehledná evidence a nabídky za 60 s</p>
            </div>
          </div>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((st) => (
            <div key={st.num} className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 shadow-lg">
              <span className="text-2xl font-black text-purple-400 font-mono">{st.num}</span>
              <h3 className="text-base font-black text-white">{st.title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{st.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
