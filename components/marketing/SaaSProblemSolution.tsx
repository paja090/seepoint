'use client';

import { XCircle, CheckCircle2, ArrowRight, Sparkles, Zap, Clock, ShieldCheck, MapPin, FileSpreadsheet, Smartphone, TrendingUp } from 'lucide-react';

export function SaaSProblemSolution() {
  const comparisonList = [
    {
      title: 'Evidence sítě a obsazenost',
      old: '15 verzí tabulek v Excelu, duplicity a nejasný stav volných ploch',
      new: 'Jedna živá evidence sítě a synchronizovaný kalendář obsazenosti',
      metric: '100% přehled',
    },
    {
      title: 'Tvorba nabídek klientům',
      old: 'Ruční hledání fotek na Disku a skládání PDF několik hodin',
      new: 'Klientská nabídka s interaktivní mapou a fotkami do 60 sekund',
      metric: 'Do 60 sekund',
    },
    {
      title: 'Práce v terénu a realizace',
      old: 'Ztracené fotky ve WhatsAppu, papírové zakázky a nejasné adresy',
      new: 'Mobilní aplikace pro montážníky s GPS navigací a fotodokumentací',
      metric: 'Mobilní appka',
    },
    {
      title: 'Plánování výjezdů a tras',
      old: 'Křižování města bez plánu a zbytečně najeté kilometry',
      new: 'Optimalizované pořadí výjezdů a logické trasování montáží',
      metric: 'Efektivní trasy',
    },
    {
      title: 'Předpisy a ochranná pásma',
      old: 'Riziko chyb a sankcí kvůli neznalosti hranic zón a vyhlášek',
      new: 'Přehled ochranných pásem a městských pravidel přímo v mapě',
      metric: 'Soulad s pravidly',
    },
  ];

  return (
    <section id="srovnani" className="py-20 bg-slate-900/40 border-y border-slate-800/80 relative overflow-hidden">
      {/* Glow ambient background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-purple-900/15 blur-[140px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-800 text-purple-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
            <span>TRANSFORMACE VAŠEHO PROVOZU</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Z Excelu, složek a WhatsAppu do jednoho systému.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Podívejte se na rozdíl mezi roztříštěným provozem v tabulkách a jediným přehledným systémem pro venkovní reklamu.
          </p>
        </div>

        {/* 2 Big High-Contrast Comparison Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch max-w-6xl mx-auto">
          {/* LEFT: OLD WAY (CHAOS & EXCEL) */}
          <div className="lg:col-span-6 rounded-3xl border border-rose-900/50 bg-slate-950/90 p-6 sm:p-8 space-y-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-rose-950 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-rose-950 text-rose-400 border border-rose-800 flex items-center justify-center font-black text-sm">
                    ✕
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">STARÝ ZPŮSOB PRÁCE</span>
                    <h3 className="text-xl font-black text-white">Rozdrobené tabulky & chaty</h3>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-900">
                  Ztráta času
                </span>
              </div>

              <div className="space-y-3.5">
                {comparisonList.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-rose-950/15 border border-rose-900/30 flex items-start gap-3 space-y-0.5"
                  >
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-xs font-bold text-slate-200 block">{item.title}</strong>
                      <span className="text-[11px] font-medium text-rose-200/80 leading-relaxed">{item.old}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-rose-950/80 text-center">
              <span className="text-xs text-slate-400 font-semibold">❌ Výsledek: Zmatky v týmu, pomalé nabídky a zbytečné náklady</span>
            </div>
          </div>

          {/* RIGHT: NEW WAY (SEEPOINT OS) */}
          <div className="lg:col-span-6 rounded-3xl border-2 border-purple-500/80 bg-gradient-to-b from-purple-950/50 via-slate-950 to-indigo-950/40 p-6 sm:p-8 space-y-6 shadow-2xl ring-2 ring-purple-500/20 flex flex-col justify-between relative">
            {/* Top Recommended Tag */}
            <span className="absolute -top-3.5 right-6 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
              ✨ SEEPOINT OS 2.0
            </span>

            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-purple-800/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-2xl bg-purple-900 text-purple-200 border border-purple-600 flex items-center justify-center font-black text-sm">
                    ✓
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">MODERNÍ STANDARD OOH</span>
                    <h3 className="text-xl font-black text-white">Vše v jednom systému</h3>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Rychlost & Růst
                </span>
              </div>

              <div className="space-y-3.5">
                {comparisonList.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-800/60 hover:border-purple-600 transition flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-xs font-bold text-white block">{item.title}</strong>
                        <span className="text-[11px] font-medium text-purple-200/90 leading-relaxed">{item.new}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-900 text-emerald-300 border border-slate-750 shrink-0">
                      {item.metric}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-purple-900/60 text-center">
              <span className="text-xs text-purple-200 font-bold">✨ Výsledek: Více prodaných ploch, klidný tým a spokojenější klienti</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
