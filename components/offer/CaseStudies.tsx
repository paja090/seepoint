import { Eye, MapPin, PanelsTopLeft, Target } from 'lucide-react';
import type { MockOffer } from '@/lib/mock-offer-data';
import { formatNumber } from '@/lib/mock-offer-data';
import { SectionHeading } from './SectionHeading';

export function CaseStudies({ offer }: { offer: MockOffer }) {
  return (
    <section aria-labelledby="cases-heading">
      <SectionHeading
        id="cases-heading"
        eyebrow="Případové studie"
        title="Ukázky realizovaných kampaní"
        description="Ilustrační příklady toho, jak podobné kampaně stavíme a vyhodnocujeme."
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {offer.caseStudies.map((study) => (
          <article
            key={study.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="relative h-44 w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={study.imageAlt} className="h-full w-full object-cover" src={study.image || '/placeholder.svg'} />
              <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 backdrop-blur">
                {study.clientLabel}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-4 p-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{study.title}</h3>
                <p className="mt-1 flex items-start gap-1.5 text-sm leading-6 text-slate-600">
                  <Target aria-hidden className="mt-0.5 shrink-0 text-slate-400" size={15} />
                  {study.objective}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {study.mediaTypes.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                  >
                    {type}
                  </span>
                ))}
              </div>

              <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-4">
                <div>
                  <dt className="flex items-center gap-1 text-xs text-slate-400">
                    <MapPin aria-hidden size={12} />
                    Města
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">{study.cities.length}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-slate-400">
                    <PanelsTopLeft aria-hidden size={12} />
                    Plochy
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">{study.surfaces}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-xs text-slate-400">
                    <Eye aria-hidden size={12} />
                    Zásah
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">{formatNumber(study.estimatedReach)}+</dd>
                </div>
              </dl>

              <p className="mt-auto rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                {study.result}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
