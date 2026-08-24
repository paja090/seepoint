import { MapPin, CheckCircle } from 'lucide-react';
import type { ProposalCarrier } from '@/lib/offers/presentation';
import { MEDIA_TYPE_META, TONE_CLASSES } from '@/lib/offers/presentation';

const statusMeta: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: 'Volný', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  RESERVED: { label: 'Rezervovaný', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  VERIFIED: { label: 'Ověřený', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
};

export function CarrierPreviewCard({
  carrier,
  isSelected = false,
  onOpen,
}: {
  carrier: ProposalCarrier;
  isSelected?: boolean;
  onOpen: (carrier: ProposalCarrier) => void;
}) {
  const meta = MEDIA_TYPE_META[carrier.mediaType];
  const tone = TONE_CLASSES[meta.tone];
  const status = statusMeta[carrier.status] ?? { label: carrier.status, className: 'bg-slate-50 text-slate-700 ring-slate-200' };

  return (
    <article
      id={`carrier-card-${carrier.id}`}
      className={`flex w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border transition-all duration-300 sm:w-full ${
        isSelected
          ? 'border-amber-500 bg-amber-50/40 shadow-2xl ring-4 ring-amber-400/50 scale-[1.02]'
          : 'border-slate-200 bg-white shadow-sm hover:border-slate-300'
      }`}
    >
      <div className="relative h-44 w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={carrier.imageAlt} className="h-full w-full object-cover" src={carrier.image || '/placeholder.svg'} />
        <span
          className={`absolute left-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white ${tone.bg}`}
        >
          {meta.label}
        </span>
        <span
          className={`absolute right-3 top-3 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${status.className}`}
        >
          {status.label}
        </span>
        {isSelected && (
          <span className="absolute bottom-2 left-3 inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[11px] font-black text-slate-950 shadow-md">
            <CheckCircle size={12} /> Zvoleno na mapě
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">{carrier.code}</p>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
            <MapPin aria-hidden size={14} />
            {carrier.city}, {carrier.locality}
          </p>
        </div>
        <p className="text-sm leading-5 text-slate-600">{carrier.description}</p>
        <button
          className={`mt-auto inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition cursor-pointer print:hidden ${
            isSelected
              ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-md hover:bg-amber-400'
              : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
          }`}
          onClick={() => onOpen(carrier)}
          type="button"
        >
          <MapPin aria-hidden size={15} />
          {isSelected ? 'Vycentrovat na mapě' : 'Zobrazit na mapě'}
        </button>
      </div>
    </article>
  );
}
