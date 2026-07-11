import { ArrowUpRight, Quote } from 'lucide-react';
import { SectionHeading } from './SectionHeading';
import { references } from '@/lib/proposal-data';

export function ClientReferences() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6 lg:mt-28">
      <SectionHeading
        eyebrow="References"
        title="Trusted by leading brands"
        description="A selection of the companies that rely on SeePOINT for their outdoor advertising."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {references.map((r) => (
          <div
            key={r.name}
            className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold tracking-tight text-slate-900">{r.name}</span>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                {r.campaigns} campaigns
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-400">{r.years} of cooperation</p>
            <div className="mt-4 flex flex-1 gap-2">
              <Quote className="h-4 w-4 shrink-0 text-slate-300" />
              <p className="text-sm leading-relaxed text-slate-600">{r.testimonial}</p>
            </div>
            <button className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand transition group-hover:gap-1.5">
              View case study <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
