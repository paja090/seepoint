'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProposalCarrier, ProposalOffer } from '@/lib/offers/presentation';
import { CarrierPreviewCard } from './CarrierPreviewCard';
import { SectionHeading } from './SectionHeading';

export function CarrierShowcase({
  offer,
  onOpenCarrier,
}: {
  offer: ProposalOffer;
  onOpenCarrier: (carrier: ProposalCarrier) => void;
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
          description={`Přehled všech ${offer.carriers.length} reklamních ploch zařazených do nabídky.`}
        />
        <div className="mb-6 hidden gap-2 sm:flex print:hidden">
          <button
            aria-label="Předchozí nosiče"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => scrollBy(-1)}
            type="button"
          >
            <ChevronLeft aria-hidden size={20} />
          </button>
          <button
            aria-label="Další nosiče"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => scrollBy(1)}
            type="button"
          >
            <ChevronRight aria-hidden size={20} />
          </button>
        </div>
      </div>

      <div
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-3"
        ref={scrollerRef}
      >
        {offer.carriers.map((carrier) => (
          <div className="snap-start" key={carrier.id}>
            <CarrierPreviewCard carrier={carrier} onOpen={onOpenCarrier} />
          </div>
        ))}
      </div>
    </section>
  );
}
