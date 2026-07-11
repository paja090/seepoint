import { MapPin, ArrowUpRight } from 'lucide-react';
import { SectionHeading } from './SectionHeading';
import { mapMarkers, mediaColors, type MediaType } from '@/lib/proposal-data';

const legend: MediaType[] = ['CITY POSTER', 'PROMO BENCH', 'NAVIGATION', 'CLV', 'TOWER'];

export function LocationMap() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6 lg:mt-28">
      <SectionHeading
        eyebrow="Locations"
        title="Where your campaign will live"
        description="Carriers grouped by media type across seven Czech cities, positioned in the busiest urban corridors."
      />
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="relative aspect-[16/9] w-full">
          <img src="/proposal/map-bg.png" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-white/20" />
          {mapMarkers.map((m, i) => {
            const c = mediaColors[m.type];
            return (
              <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${m.x}%`, top: `${m.y}%` }}>
                <span className="marker-ping absolute inset-0 rounded-full" style={{ backgroundColor: c.hex }} />
                <span
                  className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-md"
                  style={{ backgroundColor: c.hex }}
                >
                  <MapPin className="h-3 w-3 text-white" strokeWidth={2.5} />
                </span>
              </div>
            );
          })}

          <div className="absolute left-4 top-4 rounded-2xl border border-white/60 bg-white/85 p-3 backdrop-blur-md">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Legend</p>
            <div className="flex flex-col gap-1.5">
              {legend.map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mediaColors[type].hex }} />
                  <span className="text-xs font-medium text-slate-700">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
          <p className="text-sm text-slate-500">43 carriers · 7 cities · 5 media types</p>
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            View all locations <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
