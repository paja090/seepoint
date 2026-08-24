'use client';

import { XCircle, CheckCircle2, ArrowRight, Sparkles, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

export function SaaSProblemSolution() {
  const comparisonRows = [
    {
      feature: 'Přehled a stav nosičů',
      oldWay: '15 verzí tabulek Excelu (seznam_ploch_v4_final.xlsx) s duplicitami',
      newWay: 'Jediná živá mapa sítě synchronizovaná v reálném čase pro celý tým',
    },
    {
      feature: 'Tvorba klientské nabídky',
      oldWay: '3 dny ručního hledání fotek v Google Drive a skládání do PDF',
      newWay: 'AI generátor sestaví interaktivní online nabídku za méně než 60 sekund',
    },
    {
      feature: 'Práce montážníků v terénu',
      oldWay: 'Papírové zakázky, ztracené fotky ve WhatsApp chatu a zmatky s klíči',
      newWay: 'Mobilní aplikace: navigace ke sloupu, offline kešování a fotky z mobilu',
    },
    {
      feature: 'Optimalizace výjezdů',
      oldWay: 'Křižování městem bez plánu, zbytečné kilometry a přeplatky za palivo',
      newWay: 'AI Optimalizátor tras: zkrátí trasu o 57 % a seřadí nosiče za sebou',
    },
    {
      feature: 'Památkové zóny & Vyhlášky',
      oldWay: 'Riziko pokut od města kvůli neznalosti hranic zóny (např. MPZ)',
      newWay: 'Automatické vrstvy ochranných pásem a vyhlášek přímo v mapě',
    },
  ];

  return (
    <section id="srovnani" className="py-20 bg-slate-900/60 border-y border-slate-800/80 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-purple-950/80 border border-purple-800 text-purple-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>SROVNÁNÍ NÁSTROJŮ</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Starý svět Excelu vs. SeePoint OS
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Podívejte se, kolik času a zbytečných chyb ušetří přechod z rozdrobených tabulek a chatů na jediný centrální operační systém.
          </p>
        </div>

        {/* Direct Side-by-Side Comparison Table */}
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-3 sm:p-6 shadow-2xl overflow-x-auto ring-1 ring-slate-800/80">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="p-3 sm:p-4 font-black uppercase text-[11px] w-1/4">Činnost v agentuře</th>
                <th className="p-3 sm:p-4 font-black uppercase text-[11px] text-rose-400 w-3/8 bg-rose-950/20 rounded-t-2xl">
                  ❌ Starý způsob (Excel + WhatsApp + Složky)
                </th>
                <th className="p-3 sm:p-4 font-black uppercase text-[11px] text-purple-300 w-3/8 bg-purple-950/40 rounded-t-2xl border-l border-r border-purple-800/60">
                  ✨ S SeePoint OS
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {comparisonRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition">
                  <td className="p-3 sm:p-4 font-black text-white">{row.feature}</td>
                  <td className="p-3 sm:p-4 text-slate-300 bg-rose-950/10 space-y-1">
                    <div className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-rose-200/90 font-medium leading-relaxed">{row.oldWay}</span>
                    </div>
                  </td>
                  <td className="p-3 sm:p-4 text-slate-200 bg-purple-950/20 border-l border-r border-purple-800/40">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-white font-bold leading-relaxed">{row.newWay}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
