'use client';

import React, { useState } from 'react';
import { FileText, Sparkles, X, Trash2 } from 'lucide-react';
import { useOfferBasket } from '@/context/OfferBasketContext';
import { QuickCreateOfferModal } from './QuickCreateOfferModal';

export function OfferBasketBar() {
  const { selectedSurfaces, selectedCount, clearBasket } = useOfferBasket();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (selectedCount === 0) return null;

  const totalMonthlyPrice = selectedSurfaces.reduce((sum, s) => sum + (s.price ?? 2000), 0);

  return (
    <>
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl rounded-2xl border border-sky-300/80 bg-slate-900/95 p-3 text-white shadow-2xl backdrop-blur-md animate-slideUp">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 font-bold border border-sky-500/40">
              <FileText size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs text-white">
                  Vybráno pro nabídku:
                </span>
                <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-black text-slate-950">
                  {selectedCount} {selectedCount === 1 ? 'plocha' : selectedCount >= 5 ? 'ploch' : 'plochy'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                Odhad nájmu: <strong className="text-emerald-400 font-extrabold">{totalMonthlyPrice.toLocaleString('cs-CZ')} Kč / měsíc</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearBasket}
              type="button"
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-rose-300 transition"
              title="Vysypat košík"
            >
              <Trash2 size={16} />
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2 text-xs font-black text-slate-950 shadow-md hover:brightness-110 transition cursor-pointer"
            >
              <Sparkles size={15} />
              <span>📄 Sestavit nabídku</span>
            </button>
          </div>
        </div>
      </div>

      <QuickCreateOfferModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
