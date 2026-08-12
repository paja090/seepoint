import { CalendarDays, CheckCircle2, HelpCircle, Layers, MapPin, PencilLine, Timer } from 'lucide-react';
import Image from 'next/image';
import type { ProposalOffer } from '@/lib/offers/presentation';
import { MEDIA_TYPE_META } from '@/lib/offers/presentation';
import { LogoPlaceholder } from './LogoPlaceholder';
import { OfferStatusBadge } from './OfferStatusBadge';

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="mt-0.5 rounded-lg bg-sky-100 p-2 text-sky-800 ring-1 ring-sky-200">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700">{label}</p>
        <p className="mt-0.5 text-sm font-black text-slate-950">{value}</p>
      </div>
    </div>
  );
}

export function OfferHero({
  offer,
  actionsEnabled = true,
  onApprove,
  onRevision,
  onQuestion,
}: {
  offer: ProposalOffer;
  actionsEnabled?: boolean;
  onApprove: () => void;
  onRevision: () => void;
  onQuestion: () => void;
}) {
  const mediaLabels = offer.mediaMix.map((media) => MEDIA_TYPE_META[media.key].label).join(', ');

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="order-2 flex flex-col gap-6 p-6 lg:order-1 lg:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {offer.client.logoUrl
                ? <span className="relative block size-12 overflow-hidden rounded-xl border border-slate-200 bg-white"><Image alt={`Logo ${offer.client.name}`} className="object-contain p-1" fill sizes="48px" src={offer.client.logoUrl} unoptimized /></span>
                : <LogoPlaceholder label={offer.client.logoLabel} size="md" />}
              <div>
                <p className="text-sm font-medium text-slate-500">Nabídka pro</p>
                <p className="text-base font-semibold text-slate-900">{offer.client.name}</p>
              </div>
            </div>
            <OfferStatusBadge status={offer.status} />
          </div>

          <div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl lg:text-5xl">
              {offer.title}
            </h1>
            <p className="mt-2 text-lg font-medium text-slate-500">{offer.subtitle}</p>
            <p className="mt-4 max-w-xl text-pretty text-sm leading-6 text-slate-600">{offer.intro}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetaItem
              icon={<CalendarDays size={18} />}
              label="Termín kampaně"
              value={`${offer.campaignFrom} – ${offer.campaignTo}`}
            />
            <MetaItem icon={<Timer size={18} />} label="Platnost nabídky" value={offer.validUntil} />
            <MetaItem icon={<MapPin size={18} />} label="Lokality" value={offer.cities.join(', ')} />
            <MetaItem icon={<Layers size={18} />} label="Typy médií" value={mediaLabels} />
          </div>

          {actionsEnabled && <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap print:hidden">
            <button
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 sm:flex-none"
              onClick={onApprove}
              type="button"
            >
              <CheckCircle2 aria-hidden size={18} />
              Mám zájem o nabídku
            </button>
            <button
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/50"
              onClick={onRevision}
              type="button"
            >
              <PencilLine aria-hidden size={18} />
              Požádat o úpravu
            </button>
            <button
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/50"
              onClick={onQuestion}
              type="button"
            >
              <HelpCircle aria-hidden size={18} />
              Prostor pro dotaz
            </button>
          </div>}
        </div>

        <div className="relative order-1 min-h-[260px] lg:order-2 lg:min-h-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={offer.heroImageAlt}
            className="h-full w-full object-cover"
            src={offer.heroImage || '/placeholder.svg'}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/20 to-transparent" />
        </div>
      </div>
    </section>
  );
}
