'use client';

import { useState } from 'react';
import { Calculator, Clock, Sparkles } from 'lucide-react';
import { trackSaaSEvent } from '@/lib/analytics';

export function SaaSRoiCalculator({ onOpenDemoModal }: { onOpenDemoModal: () => void }) {
  const [carrierCount, setCarrierCount] = useState<number>(150);
  const [salesPersonCount, setSalesPersonCount] = useState<number>(3);

  // Model assumptions:
  // Avg time saved per generated offer: ~30 mins.
  // Estimated monthly offers per carrier: 0.35
  const monthlyOffers = Math.round(carrierCount * 0.35);
  const savedHoursPerMonth = Math.round((monthlyOffers * 30) / 60);

  const getSalesPersonLabel = (count: number) => {
    if (count === 1) return '1 osoba';
    if (count >= 2 && count <= 4) return `${count} osoby`;
    return `${count} osob`;
  };

  return (
    <section className="py-20 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-b border-slate-800 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Section Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950 text-purple-300 text-xs font-black uppercase tracking-wider border border-purple-800">
            <Calculator className="w-3.5 h-3.5" />
            <span>ORIENTAČNÍ MODEL ÚSPORY</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Kolik hodin měsíčně vám systém ušetří?
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Orientační kalkulace založená na úspoře času při vyhledávání v Excelu, skládání PDF nabídek a zjišťování obsazenosti.
          </p>
        </div>

        {/* Calculator Interactive Box */}
        <div className="max-w-4xl mx-auto rounded-3xl border border-purple-800/80 bg-slate-950 p-6 sm:p-10 shadow-2xl space-y-8 relative">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Sliders */}
            <div className="space-y-6">
              {/* Slider 1: Carrier Count */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-bold">
                  <label className="text-slate-200">Počet spravovaných nosičů & ploch</label>
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
                <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                  <span>20 nosičů</span>
                  <span>500 nosičů</span>
                  <span>1 500 nosičů</span>
                </div>
              </div>

              {/* Slider 2: Sales Team Count */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm font-bold">
                  <label className="text-slate-200">Počet obchodníků & dispečerů</label>
                  <span className="text-base font-black text-indigo-400 font-mono">{getSalesPersonLabel(salesPersonCount)}</span>
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
                <div className="flex items-center justify-between text-xs text-slate-300 font-mono">
                  <span>1 osoba</span>
                  <span>10 osob</span>
                  <span>20 osob</span>
                </div>
              </div>
            </div>

            {/* Result Box */}
            <div className="rounded-2xl border border-purple-800/80 bg-gradient-to-br from-purple-950/60 via-slate-900 to-indigo-950/60 p-6 space-y-5 shadow-xl">
              <div className="space-y-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-purple-400 shrink-0" />
                  <div>
                    <span className="text-xs font-black uppercase text-purple-300 tracking-wider">Odhadovaná úspora času</span>
                    <h3 className="text-3xl font-black text-white font-mono">~{savedHoursPerMonth} hodin / měs</h3>
                  </div>
                </div>
                <p className="text-sm text-slate-200 font-medium leading-relaxed">
                  Eliminace ručního dohledávání fotek, ověřování termínů na telefonu a opakovaného přepisování tabulek.
                </p>
              </div>

              <div className="space-y-3">
                <span className="text-xs text-slate-300 block italic leading-relaxed">
                  * Jedná se o orientační model vycházející z průměrné úspory 30 minut na jednu sestavenou klientskou nabídku a eliminaci telefonických dotazů na obsazenost. Skutečná úspora se odvíjí od konkrétních procesů firmy.
                </span>

                <button
                  type="button"
                  onClick={() => {
                    trackSaaSEvent('demo_cta_clicked', { source: 'roi_calculator', carrierCount, salesPersonCount });
                    onOpenDemoModal();
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>Vyzkoušet na vlastních datech</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
