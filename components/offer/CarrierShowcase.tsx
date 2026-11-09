'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProposalCarrier, ProposalOffer } from '@/lib/offers/presentation';
import { CarrierPreviewCard } from './CarrierPreviewCard';
import { SectionHeading } from './SectionHeading';

export function CarrierShowcase({
  offer,
  selectedCarrierId,
  selectedCarrierIds,
  onOpenCarrier,
  onOpenPhoto,
  onToggleCarrier,
  onSelectAll,
  onSelectNone,
  onSelectRecommended,
}: {
  offer: ProposalOffer;
  selectedCarrierId?: string | null;
  selectedCarrierIds?: string[];
  onOpenCarrier: (carrier: ProposalCarrier) => void;
  onOpenPhoto?: (photoUrl: string, title: string) => void;
  onToggleCarrier?: (carrierId: string) => void;
  onSelectAll?: () => void;
  onSelectNone?: () => void;
  onSelectRecommended?: () => void;
}) {

  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * (el.clientWidth * 0.8), behavior: 'smooth' });
  };

  return (
    <section aria-labelledby="carriers-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          id="carriers-heading"
          eyebrow="Ukázka nosičů"
          title="Vybrané reklamní nosiče"
          description={`Přehled všech ${offer.carriers.length} reklamních ploch zařazených do nabídky s přesným umístěním a odůvodněním výběru.`}
        />
        <div className="mb-6 hidden gap-2 sm:flex print:hidden">
          <button
            aria-label="Předchozí nosiče"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
            onClick={() => scrollBy(-1)}
            type="button"
          >
            <ChevronLeft aria-hidden size={20} />
          </button>
          <button
            aria-label="Další nosiče"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
            onClick={() => scrollBy(1)}
            type="button"
          >
            <ChevronRight aria-hidden size={20} />
          </button>
        </div>
      </div>

      {/* Interactive Selection Presets Bar */}
      {onToggleCarrier && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-white to-sky-50/90 p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white font-black text-xs shadow-xs">
              ✓
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-black text-slate-950">
                  Poskládejte si kampaň podle svých představ
                </h3>
                <span className="rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs px-2.5 py-0.5">
                  Vybráno: {selectedCarrierIds ? selectedCarrierIds.length : offer.carriers.length} z {offer.carriers.length} ploch
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nemusíte realizovat celou navrženou síť. Kliknutím na <strong>„+ Přidat do kampaně“</strong> nebo <strong>„✓ Zahrnuto v kampani“</strong> u každé plochy si kampaň přizpůsobíte svému rozpočtu.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onSelectNone && (
              <button
                type="button"
                onClick={onSelectNone}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-800 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                title="Vynulovat a začít od 0 Kč – vyberete si jen to, co opravdu chcete"
              >
                0️⃣ Začít od 0
              </button>
            )}
            {onSelectRecommended && (
              <button
                type="button"
                onClick={onSelectRecommended}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-900 hover:bg-sky-100 transition shadow-2xs cursor-pointer"
                title="Předvybrat doporučené nosiče"
              >
                🎯 Doporučené ({Math.min(3, offer.carriers.length)} plochy)
              </button>
            )}
            {onSelectAll && (
              <button
                type="button"
                onClick={onSelectAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100/70 transition shadow-2xs cursor-pointer"
              >
                ✓ Označit všech {offer.carriers.length} ploch
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-3"
        ref={scrollerRef}
      >
        {offer.carriers.map((carrier) => (
          <div className="snap-start" key={carrier.id}>
            <CarrierPreviewCard
              carrier={carrier}
              isSelected={selectedCarrierId === carrier.id}
              isIncluded={selectedCarrierIds ? selectedCarrierIds.includes(carrier.id) : true}
              onOpen={onOpenCarrier}
              onOpenPhoto={onOpenPhoto}
              onToggleInclude={onToggleCarrier}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

