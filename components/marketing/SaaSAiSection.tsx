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

        {/* 4 AI Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* FEATURE 1: AI SALES RADAR */}
          <div className="rounded-3xl border border-purple-800/80 bg-gradient-to-b from-slate-900 via-slate-900 to-purple-950/40 p-6 space-y-6 shadow-2xl relative flex flex-col justify-between">
            <div className="space-y-6">
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
                  Vyhledává otevírané pobočky, stavební projekty a akce v regionu a propojuje je s vaší sítí nosičů.
                </p>
              </div>
            </div>

            {/* Visual Box */}
            <div className="rounded-2xl border border-purple-800/60 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-purple-300">NOVÁ PŘÍLEŽITOST</span>
                <span className="text-emerald-400">VYSOKÝ POTENCIÁL</span>
              </div>
              <h4 className="font-bold text-xs text-white">Nová pobočka v Ostrava-Poruba</h4>
              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800">
                <span className="text-slate-300">Vhodné plochy: 12</span>
                <span className="text-purple-300 font-bold">Nabídka →</span>
              </div>
            </div>
          </div>

          {/* FEATURE 2: AI OFFER GENERATOR */}
          <div className="rounded-3xl border border-indigo-800/80 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/40 p-6 space-y-6 shadow-2xl relative flex flex-col justify-between">
            <div className="space-y-6">
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
                  Zadejte přání klienta slovem. AI vybere křižovatky, zkontroluje vyhlášku a vytvoří klientský koncept bez cen.
                </p>
              </div>
            </div>

            {/* Visual Box */}
            <div className="rounded-2xl border border-indigo-800/60 bg-slate-950 p-4 space-y-2 font-mono text-[11px]">
              <div className="text-slate-400">Prompt: "Ostrava, rozpočet 100 tis."</div>
              <div className="text-emerald-400 font-bold">✓ Vyhláška MPZ... OK</div>
              <div className="pt-2 text-indigo-300 font-bold border-t border-slate-800">Doporučeno: 12 nosičů</div>
            </div>
          </div>

          {/* FEATURE 3: AI PURCHASING & WAREHOUSE RECEIPTS */}
          <div className="rounded-3xl border border-emerald-800/80 bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/40 p-6 space-y-6 shadow-2xl relative flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="size-12 rounded-2xl bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center justify-center font-black">
                  <Zap className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Živý modul
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">AI Sklad & Nákupy</h3>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  Montážník vyfotí mobilní účtenku za palivo či materiál. AI automaticky vytěží dodavatele, DPH a zaeviduje nákup.
                </p>
              </div>
            </div>

            {/* Visual Box */}
            <div className="rounded-2xl border border-emerald-800/60 bg-slate-950 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Účtenka z mobilu</span>
                <span className="text-emerald-400 font-bold">VYTĚŽENO AI</span>
              </div>
              <div className="text-[11px] font-mono text-emerald-300 font-bold">Barvy & Svorky: 2 450 Kč</div>
              <div className="text-[10px] text-slate-400">Zaevidováno do zakázky & skladu</div>
            </div>
          </div>

          {/* FEATURE 4: AI FOTODOKUMENTACE (PŘIPRAVUJEME) */}
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 p-6 space-y-6 shadow-2xl relative flex flex-col justify-between opacity-90">
            <div className="space-y-6">
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
                  Montér v terénu vyfotí instalovaný plakát. AI ověří správný nosič, motiv reklamy a čitelnost polepu.
                </p>
              </div>
            </div>

            {/* Visual Box */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Fotka z montáže</span>
                <span className="text-amber-400 font-bold">Koncept AI</span>
              </div>
              <div className="text-[10px] text-slate-300">✓ Kontrola čitelnosti & GPS</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
