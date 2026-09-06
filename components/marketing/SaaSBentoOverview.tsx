'use client';

import { MapPin, Zap, CheckCircle2, Users } from 'lucide-react';

export function SaaSBentoOverview() {
  const benefits = [
    {
      icon: MapPin,
      title: 'Přehled o celé síti',
      desc: 'Okamžitý stav všech ploch, obsazenosti, termínů a revizí na interaktivní mapě bez hledání v tabulkách.',
      badge: 'Živá evidence',
      color: 'text-purple-400 border-purple-800/60 bg-purple-950/40',
    },
    {
      icon: Zap,
      title: 'Rychlejší nabídky',
      desc: 'Vytvoření klientské prezentace s fotkami, mapou a veřejným odkazem pro schválení do jedné minuty.',
      badge: 'Do 60 sekund',
      color: 'text-indigo-400 border-indigo-800/60 bg-indigo-950/40',
    },
    {
      icon: CheckCircle2,
      title: 'Kontrola realizace',
      desc: 'Předání zakázky přímo do mobilu montážníka, GPS navigace ke sloupu a fotodokumentace v reálném čase.',
      badge: 'Mobilní terén',
      color: 'text-emerald-400 border-emerald-800/60 bg-emerald-950/40',
    },
    {
      icon: Users,
      title: 'Jedna data pro celý tým',
      desc: 'Obchodníci, dispečink, montážníci i účtárna vidí stejné a vždy aktuální informace bez chaosu ve zprávách.',
      badge: '1 systém',
      color: 'text-sky-400 border-sky-800/60 bg-sky-950/40',
    },
  ];

  return (
    <section className="py-16 bg-slate-900/40 border-y border-slate-850" id="reseni">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
            PŘÍNOSY PRO VÁŠ PROVOZ
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Celá reklamní firma v jednom spolehlivém systému.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Navrženo pro rychlost obchodníka, přehled vedení i bezchybnou práci realizačního týmu v terénu.
          </p>
        </div>

        {/* 4 Compact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="rounded-3xl border border-slate-800 bg-slate-950 p-6 space-y-4 shadow-xl hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-2xl border ${b.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-900 text-slate-300 border border-slate-750">
                      {b.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-white">{b.title}</h3>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">{b.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
