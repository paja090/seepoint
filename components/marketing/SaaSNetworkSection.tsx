'use client';

import { Share2, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSNetworkSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const handleNotifyMe = () => {
    trackSaaSEvent('network_interest_clicked', { source: 'network_teaser' });
    onOpenDemoModal();
  };

  return (
    <section id="network" className="py-16 bg-slate-950 border-t border-slate-850 relative overflow-hidden">
      {/* Subtle Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-blue-900/15 to-purple-900/15 blur-[140px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="rounded-3xl border border-blue-900/60 bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950/30 p-6 sm:p-10 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-blue-950 text-blue-400 border border-blue-800 flex items-center justify-center font-black">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-blue-950 text-blue-300 border border-blue-800">
                  Připravujeme
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                  Jedna nabídka. Vlastní i partnerské plochy.
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleNotifyMe}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg transition cursor-pointer self-start sm:self-auto"
            >
              <span>Chci vědět o spuštění</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed max-w-3xl">
            Do budoucna chceme umožnit OOH provozovatelům bezpečně sdílet vybrané volné kapacity a vytvářet meziměstské kampaně z jednoho systému.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 text-sm">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <strong className="text-white block font-bold text-sm">1. Kontrola nad nosiči</strong>
              <span className="text-slate-300 text-xs leading-relaxed block">Sami si určíte, které plochy a za jakou cenu nabídnete do sítě.</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <strong className="text-white block font-bold text-sm">2. Žádné sdílení klientů</strong>
              <span className="text-slate-300 text-xs leading-relaxed block">Vaši klienti zůstávají výhradně vaši. Partneři vidí pouze zakázku na instalaci.</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <strong className="text-white block font-bold text-sm">3. Kampaně po celé ČR</strong>
              <span className="text-slate-300 text-xs leading-relaxed block">Možnost nabídnout klientovi plochy v dalších městech bez budování vlastních sloupů.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
