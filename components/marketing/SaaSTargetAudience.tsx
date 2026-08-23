'use client';

import { Building2, Briefcase, TrendingUp, Wrench, ArrowRight } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSTargetAudience({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const audiences = [
    {
      title: 'OOH PROVOZOVATEL',
      desc: 'Správa vlastní reklamní sítě, obsazenosti, revizí nosičů a dlouhodobých nájemních smluv.',
      icon: Building2,
      badge: 'Vlastníci ploch',
      color: 'border-purple-800/80 bg-purple-950/30 text-purple-300',
    },
    {
      title: 'REKLAMNÍ AGENTURA',
      desc: 'Klienti, klientské koncepty bez cen i s cenovou kalkulací a realizace z jednoho prostředí.',
      icon: Briefcase,
      badge: 'Agentury & Nákup',
      color: 'border-indigo-800/80 bg-indigo-950/30 text-indigo-300',
    },
    {
      title: 'OBCHODNÍ TÝM',
      desc: 'Okamžitý přehled o dostupnosti nosičů a tvorba prezentace s mapou a fotkami do 3 minut.',
      icon: TrendingUp,
      badge: 'Obchodníci',
      color: 'border-sky-800/80 bg-sky-950/30 text-sky-300',
    },
    {
      title: 'REALIZAČNÍ TÝM',
      desc: 'Jasný seznam výlepů a montáží, GPS navigace ke sloupům a nahrávání fotodokumentace v terénu.',
      icon: Wrench,
      badge: 'Montážníci & Terén',
      color: 'border-emerald-800/80 bg-emerald-950/30 text-emerald-300',
    },
  ];

  return (
    <section id="pro-koho" className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            CÍLOVÁ SKUPINA
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Navrženo pro celou reklamní firmu.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            SeePoint OS propojuje role v kanceláři i v terénu tak, aby každý tým viděl přesně ty informace, které potřebuje k práci.
          </p>
        </div>

        {/* 4 Audience Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {audiences.map((aud) => {
            const IconComponent = aud.icon;
            return (
              <div
                key={aud.title}
                className={`rounded-3xl border ${aud.color} p-6 sm:p-8 space-y-4 shadow-xl hover:scale-[1.02] transition duration-200 flex flex-col justify-between`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="size-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center font-black">
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-900 text-slate-300 border border-slate-700">
                      {aud.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-white">{aud.title}</h3>
                  <p className="text-xs text-slate-300 font-medium leading-relaxed">{aud.desc}</p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    trackSaaSEvent('demo_cta_clicked', { source: `audience_${aud.title}` });
                    onOpenDemoModal();
                  }}
                  className="pt-4 border-t border-slate-800/80 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Chci ukázku pro můj tým</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
