'use client';

import { useState } from 'react';
import { Calculator, Clock, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSRoiCalculator({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const [carrierCount, setCarrierCount] = useState<number>(150);
  const [salesPersonCount, setSalesPersonCount] = useState<number>(3);

  // Time Savings Calculation logic
  // Avg time to create 1 offer manually: 35 mins. With SeePoint OS: 3 mins. Savings = 32 mins per offer.
  // Estimated monthly offers per carrier: 0.4 offers/month
  const monthlyOffers = Math.round(carrierCount * 0.35);
  const savedHoursPerMonth = Math.round((monthlyOffers * 32) / 60);
  const estimatedRevenueSpeedup = Math.round(savedHoursPerMonth * 850);

  return (
    <section className="py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-b border-slate-800 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950 text-purple-300 text-[11px] font-black uppercase tracking-wider border border-purple-800">
            <Calculator className="w-3.5 h-3.5" />
            <span>KALKULAČKA NÁVRATNOSTI A ÚSPORY ČASU</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Spočítejte si, kolik hodin měsíčně vám SeePoint OS ušetří.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Zadejte velikost vaší reklamní sítě a počet obchodníků. Spočítáme vám okamžitou úsporu času a zrychlení prodejního cyklu.
          </p>
        </div>

        {/* Calculator Interactive Box */}
        <div className="max-w-4xl mx-auto rounded-3xl border border-purple-800/80 bg-slate-950 p-6 sm:p-10 shadow-2xl space-y-8 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Sliders */}
            <div className="space-y-6">
              {/* Slider 1: Carrier Count */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <label className="text-slate-300">Počet spravovaných nosičů & ploch</label>
                  <span className="text-base font-black text-purple-400 font-mono">{carrierCount} nosičů</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="1500"
                  step="10"
                  value={carrierCount}
                  onChange={(e) => setCarrierCount(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>20 nosičů</span>
                  <span>500 nosičů</span>
                  <span>1 500 nosičů</span>
                </div>
              </div>

              {/* Slider 2: Sales Team Count */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <label className="text-slate-300">Počet obchodníků & správců sítě</label>
                  <span className="text-base font-black text-indigo-400 font-mono">{salesPersonCount} lidi</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={salesPersonCount}
                  onChange={(e) => setSalesPersonCount(Number(e.target.value))}
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>1 osoba</span>
                  <span>10 lidí</span>
                  <span>20 lidí</span>
                </div>
              </div>
            </div>

            {/* Live Result Cards */}
            <div className="rounded-2xl border border-purple-800/80 bg-gradient-to-br from-purple-950/60 via-slate-900 to-indigo-950/60 p-6 space-y-6 shadow-xl">
              <div className="space-y-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-purple-400 shrink-0" />
                  <div>
                    <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Ušetřený čas týmu</span>
                    <h3 className="text-3xl font-black text-white font-mono">{savedHoursPerMonth} hodin / měs</h3>
                  </div>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  Eliminace ručního vyhledávání v Excelu, skládání PDF nabídek a zjišťování obsazenosti.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Odhadovaný měsíční počet nabídek</span>
                  <span className="font-mono text-purple-300">{monthlyOffers} nabídek / měs</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Odhadovaná hodnota úspory kapacit</span>
                  <span className="font-mono text-emerald-400">~ {estimatedRevenueSpeedup.toLocaleString('cs-CZ')} Kč / měs</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  trackSaaSEvent('demo_cta_clicked', { source: 'roi_calculator', carrierCount, salesPersonCount });
                  onOpenDemoModal();
                }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-xl transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-purple-200" />
                <span>Vyzkoušet na mých {carrierCount} nosičích</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
