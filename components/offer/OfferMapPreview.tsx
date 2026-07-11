'use client';

import { useMemo, useState } from 'react';
import { Maximize2, MapPin } from 'lucide-react';
import type { MockOffer, MockMediaTypeKey } from '@/lib/mock-offer-data';
import { MEDIA_TYPE_META, TONE_CLASSES } from '@/lib/mock-offer-data';

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

export function OfferMapPreview({ offer }: { offer: MockOffer }) {
  const cities = useMemo(() => Array.from(new Set(offer.carriers.map((c) => c.city))), [offer.carriers]);
  const mediaKeys = useMemo(
    () => Array.from(new Set(offer.carriers.map((c) => c.mediaType))) as MockMediaTypeKey[],
    [offer.carriers],
  );

  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MockMediaTypeKey | null>(null);

  const visible = offer.carriers.filter(
    (c) => (cityFilter === null || c.city === cityFilter) && (mediaFilter === null || c.mediaType === mediaFilter),
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Mapa vybraných lokalit</h2>
          <p className="mt-1 text-sm text-slate-500">
            Přehled rozmístění nosičů podle typu média. Interaktivní mapa bude propojena později.
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

      {/* Map placeholder — structured so it can later be swapped for a real Google Maps / Leaflet component. */}
      <div
        className="relative mt-5 h-[340px] w-full overflow-hidden rounded-2xl border border-slate-200 sm:h-[420px]"
        role="img"
        aria-label="Zástupná mapa s rozmístěním reklamních nosičů"
      >
        <div className="absolute inset-0 bg-[#eef2f6]" />
        {/* Subtle street-grid pattern (decorative placeholder, not real cartography) */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              'linear-gradient(#dbe2ea 1px, transparent 1px), linear-gradient(90deg, #dbe2ea 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(115deg, transparent 46%, #d3dbe4 46%, #d3dbe4 54%, transparent 54%), linear-gradient(35deg, transparent 60%, #dfe6ee 60%, #dfe6ee 66%, transparent 66%)',
          }}
        />
        <div aria-hidden className="absolute left-6 top-6 rounded-md bg-white/70 px-2 py-1 text-xs font-medium text-slate-400">
          Ostrava a okolí
        </div>

        {visible.map((carrier) => {
          const tone = TONE_CLASSES[MEDIA_TYPE_META[carrier.mediaType].tone];
          return (
            <div
              className="group absolute -translate-x-1/2 -translate-y-full"
              key={carrier.id}
              style={{ left: `${carrier.mapX}%`, top: `${carrier.mapY}%` }}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md ring-4 ${tone.marker}`}
                title={`${carrier.code} · ${carrier.city}`}
              >
                <MapPin aria-hidden size={15} />
              </div>
              <div className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white group-hover:block">
                {carrier.code} · {carrier.locality}
              </div>
            </div>
          );
        })}
      </div>

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
        <button
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 print:hidden"
          type="button"
        >
          <Maximize2 aria-hidden size={16} />
          Zobrazit detail mapy
        </button>
      </div>
    </section>
  );
}
