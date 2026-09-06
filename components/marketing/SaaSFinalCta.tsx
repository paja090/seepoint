'use client';

import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSFinalCta({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Glowing Ambient */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-slate-950 -z-10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-purple-600/20 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-purple-800 text-purple-300 text-xs font-black uppercase tracking-widest">
          <Sparkles className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
          <span>UKÁZKA NA VAŠICH DATECH</span>
        </div>

        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
          Podívejte se na SeePoint OS <br />
          <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-sky-400 bg-clip-text text-transparent">
            na vašich vlastních datech.
          </span>
        </h2>

        <p className="text-base sm:text-lg text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed">
          Pošlete nám Excel s 20 nosiči. Připravíme ukázkovou mapu a klientskou nabídku, abyste neviděli jen univerzální demo, ale svůj vlastní provoz v SeePointu.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <button
            type="button"
            onClick={() => {
              trackSaaSEvent('demo_cta_clicked', { source: 'final_cta_custom_data' });
              onOpenDemoModal();
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-black text-base shadow-2xl transition transform active:scale-95 cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-purple-200" />
            <span>Chci ukázku na svých datech</span>
          </button>

          <button
            type="button"
            onClick={() => {
              trackSaaSEvent('demo_cta_clicked', { source: 'final_cta_online_demo' });
              onOpenDemoModal();
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-extrabold text-sm border border-slate-700 shadow-xl transition cursor-pointer"
          >
            <span>Domluvit online demo</span>
            <ArrowRight className="w-4 h-4 text-purple-400" />
          </button>
        </div>

        <div className="pt-4 flex items-center justify-center gap-2 text-sm text-slate-300 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Bezplatná příprava · Bez závazků · Pomoc s převodem tabulek</span>
        </div>
      </div>
    </section>
  );
}
