'use client';

import { Compass, MapPin, CheckCircle2, ArrowRight, ShieldCheck, FileText, Image as ImageIcon, Zap } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSNavigationSection({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const navFeatures = [
    'Správa sloupů veřejného osvětlení (VO) a veřejných ploch',
    'AI generátor tras zohledňující dálnice a památkové zóny (Nařízení č. 2/2020)',
    'Automatická detekce orientačních směrů a šipek k cílové prodejně',
    'Klientský protokol s fotodokumentací (online odkaz bez nutnosti hesla)',
    'Evidence povolenek města, technických parametrů a výměn desek',
    'Fakturační období a automatický přepočet měsíčních nájmů',
  ];

  return (
    <section className="py-20 bg-slate-950 border-t border-slate-800 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Feature Visual Card */}
          <div className="lg:col-span-6 rounded-3xl border border-orange-900/60 bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/30 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-orange-900/40 pb-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-2xl bg-orange-950 text-orange-300 border border-orange-800 flex items-center justify-center font-black">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">SPECIALIZOVANÝ MODUL</span>
                  <h3 className="text-xl font-black text-white">Navigační reklama VO</h3>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-orange-950 text-orange-300 border border-orange-800">
                Povolení & Mapy
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>Cílová prodejna: Kaufland Ostrava</span>
                  <span className="text-orange-400">3 navigační body</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Příjezdové trasy zahuštěné na vytížených městských křižovatkách (Poděbradova, 28. října, Českobratrská).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Vyhláška MPZ</span>
                  <strong className="text-emerald-400 text-xs">✓ Auto-posun mimo MPZ</strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Klientský protokol</span>
                  <strong className="text-orange-300 text-xs">✓ Generování PDF/Link</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Right Explanation Text */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-[11px] font-black uppercase tracking-widest text-orange-400">
              SMĚROVÉ TABULE A NAVIGACE
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Navigační reklama bez chaosu.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Navigační desky na sloupech veřejného osvětlení (VO) mají svá přísná pravidla a administrativní nároky. SeePoint OS uchovává celou agendu na jednom místě.
            </p>

            <div className="space-y-3">
              {navFeatures.map((feat) => (
                <div key={feat} className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-200">{feat}</span>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  trackSaaSEvent('demo_cta_clicked', { source: 'navigation_section' });
                  onOpenDemoModal();
                }}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-xs sm:text-sm shadow-xl transition cursor-pointer"
              >
                <span>Ukázat modul navigační reklamy</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
