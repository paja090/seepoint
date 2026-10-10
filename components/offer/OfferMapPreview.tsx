'use client';

import { useMemo, useState } from 'react';
import { Maximize2, MapPin, Layers } from 'lucide-react';
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
      className={`inline-flex min-h-[36px] items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:text-sm font-semibold transition cursor-pointer ${
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-700 mb-1">
            <Layers className="size-3.5" />
            <span>Přehled pokrytí a tras</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
            Velká interaktivní mapa nosičů
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Rozmístění všech {offer.carriers.length} reklamních ploch. Čísla bodů (#1, #2, ...) odpovídají kartám nosičů níže.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-700 ring-1 ring-slate-200 self-start sm:self-auto">
          <MapPin aria-hidden size={15} className="text-sky-600" />
          {visible.length} zobrazených pozic
        </span>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        <Chip active={cityFilter === null} onClick={() => setCityFilter(null)}>
          Všechna města ({cities.length})
        </Chip>
        {cities.map((city) => (
          <Chip active={cityFilter === city} key={city} onClick={() => setCityFilter(city)}>
            {city}
          </Chip>
        ))}

        <span className="hidden sm:inline-block h-5 w-px bg-slate-200 mx-1" />

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

      {/* High-visibility Full-width Leaflet Map */}
      <OfferMap
        className="h-[460px] sm:h-[540px] lg:h-[600px] w-full"
        target={offer.navigationTarget ? { label: offer.navigationTarget.name, latitude: offer.navigationTarget.latitude, longitude: offer.navigationTarget.longitude } : undefined}
        selectedPointId={selectedCarrierId}
        onPointClick={onSelectCarrier}
        points={visible.map((carrier) => ({
          id: carrier.id,
          code: carrier.code,
          city: carrier.city,
          locality: carrier.locality,
          latitude: carrier.latitude,
          longitude: carrier.longitude,
          selected: true,
          orderIndex: carrier.orderIndex,
          imageUrl: carrier.image,
          mediaTypeLabel: MEDIA_TYPE_META[carrier.mediaType]?.label,
        }))}
      />

      {/* Interactive Quick Pin Selector Strip */}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Rychlý výběr bodu na mapě:
        </p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {visible.map((carrier) => {
            const isSelected = selectedCarrierId === carrier.id;
            return (
              <button
                key={carrier.id}
                type="button"
                onClick={() => onSelectCarrier?.(carrier.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold transition cursor-pointer ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 text-amber-950 shadow-md ring-2 ring-amber-300 scale-[1.02]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className={`inline-flex size-5 items-center justify-center rounded-lg text-[10px] font-black ${
                  isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-white'
                }`}>
                  #{carrier.orderIndex}
                </span>
                <span className="font-extrabold">{carrier.code}</span>
                <span className="text-slate-400 font-normal truncate max-w-[130px]">{carrier.locality || carrier.city}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-4">
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {mediaKeys.map((key) => {
            const meta = MEDIA_TYPE_META[key];
            const count = offer.carriers.filter((c) => c.mediaType === key).length;
            return (
              <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600" key={key}>
                <span className={`h-2.5 w-2.5 rounded-full ${TONE_CLASSES[meta.tone].dot}`} />
                {meta.label} ({count})
              </span>
            );
          })}
        </div>
        <a
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 print:hidden self-start sm:self-auto"
          href={osmUrl}
          rel="noreferrer"
          target="_blank"
        >
          <Maximize2 aria-hidden size={14} />
          Otevřít v OpenStreetMap
        </a>
      </div>
    </section>
  );
}
