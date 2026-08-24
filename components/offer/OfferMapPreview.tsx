'use client';

import { useMemo, useState } from 'react';
import { Maximize2, MapPin } from 'lucide-react';
import type { ProposalOffer, ProposalMediaTypeKey } from '@/lib/offers/presentation';
import { MEDIA_TYPE_META, TONE_CLASSES } from '@/lib/offers/presentation';
import { OfferMap } from '@/components/offers/OfferMap';

function Chip({
  active,
  onClick,
  children,
  dotClass,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dotClass?: string;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
      onClick={onClick}
      type="button"
    >
      {dotClass && <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />}
      {children}
    </button>
  );
}

export function OfferMapPreview({
  offer,
  selectedCarrierId,
  onSelectCarrier,
}: {
  offer: ProposalOffer;
  selectedCarrierId?: string | null;
  onSelectCarrier?: (id: string) => void;
}) {
  const cities = useMemo(() => Array.from(new Set(offer.carriers.map((c) => c.city))), [offer.carriers]);
  const mediaKeys = useMemo(
    () => Array.from(new Set(offer.carriers.map((c) => c.mediaType))) as ProposalMediaTypeKey[],
    [offer.carriers],
  );

  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [mediaFilter, setMediaFilter] = useState<ProposalMediaTypeKey | null>(null);

  const visible = offer.carriers.filter(
    (c) => (cityFilter === null || c.city === cityFilter) && (mediaFilter === null || c.mediaType === mediaFilter),
  );
  const located = visible.filter((carrier) => typeof carrier.latitude === 'number' && typeof carrier.longitude === 'number');
  const osmUrl = located.length > 0
    ? `https://www.openstreetmap.org/?mlat=${located[0].latitude}&mlon=${located[0].longitude}#map=13/${located[0].latitude}/${located[0].longitude}`
    : 'https://www.openstreetmap.org/';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Mapa vybraných lokalit</h2>
          <p className="mt-1 text-sm text-slate-500">
            Přehled rozmístění nosičů podle uložených lokalit a souřadnic.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
          <MapPin aria-hidden size={15} />
          {visible.length} vybraných lokalit
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Chip active={cityFilter === null} onClick={() => setCityFilter(null)}>
          Všechna města
        </Chip>
        {cities.map((city) => (
          <Chip active={cityFilter === city} key={city} onClick={() => setCityFilter(city)}>
            {city}
          </Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Chip active={mediaFilter === null} onClick={() => setMediaFilter(null)}>
          Všechna média
        </Chip>
        {mediaKeys.map((key) => (
          <Chip
            active={mediaFilter === key}
            dotClass={TONE_CLASSES[MEDIA_TYPE_META[key].tone].dot}
            key={key}
            onClick={() => setMediaFilter(key)}
          >
            {MEDIA_TYPE_META[key].label}
          </Chip>
        ))}
      </div>

      <OfferMap
        className="mt-5 h-[340px] sm:h-[420px]"
        target={offer.navigationTarget ? { label: offer.navigationTarget.name, latitude: offer.navigationTarget.latitude, longitude: offer.navigationTarget.longitude } : undefined}
        selectedPointId={selectedCarrierId}
        onPointClick={onSelectCarrier}
        points={visible.map((carrier) => ({
          id: carrier.id,
          code: carrier.code,
          city: carrier.city,
          latitude: carrier.latitude,
          longitude: carrier.longitude,
          selected: true,
        }))}
      />

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {mediaKeys.map((key) => {
            const meta = MEDIA_TYPE_META[key];
            const count = offer.carriers.filter((c) => c.mediaType === key).length;
            return (
              <span className="inline-flex items-center gap-2 text-sm text-slate-600" key={key}>
                <span className={`h-2.5 w-2.5 rounded-full ${TONE_CLASSES[meta.tone].dot}`} />
                {meta.label} ({count})
              </span>
            );
          })}
        </div>
        <a
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 print:hidden"
          href={osmUrl}
          rel="noreferrer"
          target="_blank"
        >
          <Maximize2 aria-hidden size={16} />
          Zobrazit detail mapy
        </a>
      </div>
    </section>
  );
}
