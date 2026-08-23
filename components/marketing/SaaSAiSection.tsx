'use client';

import { Sparkles, Radar, FileSpreadsheet, Camera, CheckCircle2, ArrowRight, Zap, ShieldAlert } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSAiSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  return (
    <section id="ai" className="py-24 bg-slate-950 border-t border-slate-800 relative overflow-hidden">
      {/* Glow gradient background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-pink-900/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-950/80 border border-purple-800/80 text-purple-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
            <span>SEEPOINT AI ENGINE</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Nejen evidence. Systém, který pomáhá pracovat.
          </h2>

          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            SeePoint AI aktivně vyhledává nové obchodní příležitosti v regionu a pomáhá sestavovat optimální trasy a nabídky během několika sekund.
          </p>
        </div>

        {/* 3 AI Sub-features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FEATURE 1: AI SALES RADAR */}
          <div className="rounded-3xl border border-purple-800/80 bg-gradient-to-b from-slate-900 via-slate-900 to-purple-950/40 p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="size-12 rounded-2xl bg-purple-950 text-purple-300 border border-purple-700 flex items-center justify-center font-black">
                <Radar className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple-950 text-purple-300 border border-purple-800">
                Živý modul
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">AI Sales Radar</h3>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                SeePoint OS průběžně vyhledává nově otevírané provozovny, stavební projekty a akce v regionu a propojuje je s vašimi nosiči.
              </p>
            </div>

            {/* Visual Box */}
            <div className="rounded-2xl border border-purple-800/60 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-purple-300">NOVÁ PŘÍLEŽITOST</span>
                <span className="text-emerald-400">Potenciál: VYSOKÝ</span>
              </div>
              <h4 className="font-bold text-xs text-white">Nová pobočka obchodu (Ostrava)</h4>
              <p className="text-[11px] text-slate-400">Předpokládané otevření: Říjen</p>
              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800">
                <span className="text-slate-300">Vhodné plochy: 12</span>
                <span className="text-purple-300 font-bold">Připravit nabídku →</span>
              </div>
            </div>
          </div>

          {/* FEATURE 2: AI OFFER GENERATOR */}
          <div className="rounded-3xl border border-indigo-800/80 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/40 p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="size-12 rounded-2xl bg-indigo-950 text-indigo-300 border border-indigo-700 flex items-center justify-center font-black">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-indigo-950 text-indigo-300 border border-indigo-800">
                Živý modul
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">AI Generátor Nabídek</h3>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Zadejte zadání klienta přirozenou řečí (rozpočet, cílové město, typ nosičů). AI analyzuje trasy a vybere nejlepší křižovatky mimo památkové zóny.
              </p>
            </div>

            {/* Visual Box */}
            <div className="rounded-2xl border border-indigo-800/60 bg-slate-950 p-4 space-y-3 font-mono text-xs">
              <div className="text-slate-400">Prompt: "Připrav kampaň pro novou prodejnu v Ostravě. Rozpočet 100 000 Kč."</div>
              <div className="text-emerald-400 font-bold">✓ Analýza dostupnosti... OK</div>
              <div className="text-emerald-400 font-bold">✓ Kontrola vyhlášky č. 2/2020... OK</div>
              <div className="pt-2 text-indigo-300 font-bold border-t border-slate-800">Doporučeno: 12 nosičů</div>
            </div>
          </div>

          {/* FEATURE 3: AI FOTODOKUMENTACE (PŘIPRAVUJEME) */}
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-8 space-y-6 shadow-2xl relative opacity-90">
            <div className="flex items-center justify-between">
              <div className="size-12 rounded-2xl bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-black">
                <Camera className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-amber-950 text-amber-300 border border-amber-800">
                PŘIPRAVUJEME
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white">AI Fotodokumentace</h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Montér v terénu vyfotí instalaci na mobil. AI automaticky ověří správný nosič, motiv reklamy, kvalitu snímku a přiřadí fotografii ke kampani.
              </p>
            </div>

            {/* Visual Box */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Montér nahraje fotografii</span>
                <span className="text-amber-400 font-bold">Koncept</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-300">
                <div>✓ Správný nosič & GPS</div>
                <div>✓ Kontrola čitelnosti plakátu</div>
                <div>✓ Automatické zařazení do výkazu</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
