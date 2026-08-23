'use client';

import { Smartphone, CheckCircle2, Navigation, Camera, MapPin, Upload, ShieldCheck } from 'lucide-react';

export function SaaSFieldMobileSection() {
  return (
    <section className="py-20 bg-slate-900/40 border-t border-slate-800 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Explanation */}
          <div className="lg:col-span-6 space-y-6">
            <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
              MOBILNÍ APLIKACE PRO TERÉN
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Kancelář a terén pracují se stejnými daty.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Montážníci a technici nepotřebují papírové složky. Všechny pracovní úkoly, navigaci k nosičům i okamžité nahrávání fotodokumentace mají přímo v mobilu.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <strong className="text-sm font-bold text-white">Pracovní úkoly</strong>
                </div>
                <p className="text-xs text-slate-400">Jasný výkaz výlepů a oprav na daný den</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <strong className="text-sm font-bold text-white">GPS Navigace</strong>
                </div>
                <p className="text-xs text-slate-400">1-kliková navigace přímo ke sloupu či nosiči</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <strong className="text-sm font-bold text-white">Fotodokumentace</strong>
                </div>
                <p className="text-xs text-slate-400">Foto před a po instalaci s automatickou kompresí</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-400" />
                  <strong className="text-sm font-bold text-white">Offline podpora</strong>
                </div>
                <p className="text-xs text-slate-400">Funguje i v místech s slabým signálem</p>
              </div>
            </div>
          </div>

          {/* Right Smartphone UI Mockup */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-full max-w-[340px] rounded-[44px] border-[8px] border-slate-800 bg-slate-950 p-4 shadow-2xl ring-1 ring-purple-900/50">
              {/* Phone Notch */}
              <div className="w-32 h-4 bg-slate-800 mx-auto rounded-b-xl mb-4" />

              {/* Mobile Screen Header */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-purple-400 font-bold uppercase">Terénní výkaz #104</span>
                    <h4 className="font-black text-sm text-white">DNEŠNÍ PRÁCE: Výlepy Ostrava</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    3 z 5 hotovo
                  </span>
                </div>

                {/* Active Task Card */}
                <div className="rounded-2xl border border-purple-800/80 bg-slate-900 p-4 space-y-3 shadow-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">Nosič: Promo Tower Místecká</span>
                    <span className="text-purple-300 font-bold">KFC Kampaň</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950 text-[11px] font-mono text-slate-300 flex items-center justify-between">
                    <span>GPS: 49.8355, 18.2835</span>
                    <span className="text-sky-400 font-bold flex items-center gap-1">
                      <Navigation className="w-3 h-3" /> Navigovat
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button type="button" className="py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold flex items-center justify-center gap-1.5 border border-slate-700">
                      <Camera className="w-3.5 h-3.5 text-slate-400" />
                      <span>Foto před</span>
                    </button>
                    <button type="button" className="py-2.5 rounded-xl bg-purple-950 text-purple-200 font-bold flex items-center justify-center gap-1.5 border border-purple-800">
                      <Camera className="w-3.5 h-3.5 text-purple-400" />
                      <span>Foto po</span>
                    </button>
                  </div>

                  <button type="button" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg transition">
                    ✓ Dokončit práci & Odeslat
                  </button>
                </div>

                {/* Completed Task Card */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 flex items-center justify-between text-xs opacity-75">
                  <div>
                    <strong className="text-slate-300 block">CLP 28. října / Pošta</strong>
                    <span className="text-[10px] text-slate-500">Fotografie nahrána v 10:14</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-xs">✓ Hotovo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
