import { MapPin } from 'lucide-react';
import { SectionHeading } from './SectionHeading';
import { carriers, mediaColors } from '@/lib/proposal-data';

export function SelectedCarriers() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6 lg:mt-28">
      <SectionHeading
        eyebrow="Selected carriers"
        title="A closer look at key placements"
        description="Hand-picked carriers representing the strongest positions in your campaign footprint."
      />
      <div className="-mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {carriers.map((carrier) => {
          const c = mediaColors[carrier.type];
          return (
            <article
              key={carrier.code}
              className="group w-[300px] shrink-0 snap-start overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <img
                  src={carrier.image || '/placeholder.svg'}
                  alt={`Carrier ${carrier.code}`}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}>
                  {carrier.type}
                </span>
              </div>
              <div className="p-5">
                <p className="font-mono text-xs font-semibold text-brand">{carrier.code}</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{carrier.street}</p>
                <p className="text-sm text-slate-500">{carrier.city}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{carrier.description}</p>
                <button className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                  <MapPin className="h-3.5 w-3.5" /> View on map
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
