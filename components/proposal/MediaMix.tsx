import { SectionHeading } from './SectionHeading';
import { mediaMix, mediaColors } from '@/lib/proposal-data';

export function MediaMix() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6 lg:mt-28">
      <SectionHeading
        eyebrow="Media mix"
        title="Five formats working together"
        description="A balanced combination of high-impact and street-level media engineered for reach and frequency."
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {mediaMix.map((m) => {
          const c = mediaColors[m.type];
          return (
            <article
              key={m.type}
              className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <img
                  src={m.image || '/placeholder.svg'}
                  alt={`${m.type} advertising carrier`}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className={`absolute left-3 top-3 rounded-lg px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text}`}>
                  {m.type}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-sm leading-relaxed text-slate-600">{m.description}</p>
                <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Price</p>
                    <p className="text-sm font-semibold text-slate-900">{m.price}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reach</p>
                    <p className="text-sm font-semibold text-slate-900">{m.reach}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Carriers</p>
                    <p className="text-sm font-semibold text-slate-900">{m.count}</p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
