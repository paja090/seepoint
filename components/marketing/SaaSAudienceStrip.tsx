'use client';

import { Building2, Briefcase, TrendingUp, Wrench } from 'lucide-react';

export function SaaSAudienceStrip() {
  const audiences = [
    {
      icon: Building2,
      title: 'OOH provozovatelé',
      desc: 'Správa sítě nosičů, obsazenost a revize',
      color: 'text-purple-400 border-purple-800/60 bg-purple-950/40',
    },
    {
      icon: Briefcase,
      title: 'Reklamní agentury',
      desc: 'Výběr ploch, klientské koncepty a kampaňový nákup',
      color: 'text-indigo-400 border-indigo-800/60 bg-indigo-950/40',
    },
    {
      icon: TrendingUp,
      title: 'Obchodní týmy',
      desc: 'Okamžitý přehled o volných plochách a nabídka za 60 s',
      color: 'text-sky-400 border-sky-800/60 bg-sky-950/40',
    },
    {
      icon: Wrench,
      title: 'Realizační týmy',
      desc: 'Mobilní úkoly, navigace ke sloupům a fotodokumentace',
      color: 'text-emerald-400 border-emerald-800/60 bg-emerald-950/40',
    },
  ];

  return (
    <section className="py-8 bg-slate-950 border-y border-slate-850/80 relative z-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-center sm:text-left">
          <span className="text-xs font-black uppercase tracking-wider text-purple-400">
            NAVRŽENO PRO CELÝ OOH PROVOZ
          </span>
          <span className="text-sm font-medium text-slate-300">
            Jednotná data od poptávky až po montáž a fakturaci
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {audiences.map((aud) => {
            const Icon = aud.icon;
            return (
              <div
                key={aud.title}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition shadow-md"
              >
                <div className={`p-2.5 rounded-xl border ${aud.color} shrink-0 shadow-sm`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <strong className="text-sm font-black text-white block truncate">
                    {aud.title}
                  </strong>
                  <p className="text-xs text-slate-300 font-medium leading-snug line-clamp-2">
                    {aud.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
