import { Target, TrendingUp, Radio } from 'lucide-react';
import { SectionHeading } from './SectionHeading';
import { caseStudies } from '@/lib/proposal-data';

export function CaseStudies() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6 lg:mt-28">
      <SectionHeading
        eyebrow="Case studies"
        title="Results that speak for themselves"
        description="Recent campaigns delivered with the same formats proposed for your summer plan."
      />
      <div className="flex flex-col gap-6">
        {caseStudies.map((cs, i) => (
          <article
            key={cs.title}
            className={`grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft lg:grid-cols-2 ${
              i % 2 === 1 ? 'lg:[&>div:first-child]:order-2' : ''
            }`}
          >
            <div className="relative min-h-[260px] overflow-hidden bg-slate-100">
              <img src={cs.image || '/placeholder.svg'} alt={cs.title} className="h-full w-full object-cover" />
              <span className="absolute left-4 top-4 rounded-lg bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate-700 backdrop-blur-md">
                {cs.client}
              </span>
            </div>
            <div className="flex flex-col justify-center p-6 lg:p-8">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">{cs.title}</h3>
              <div className="mt-5 space-y-4">
                <div className="flex gap-3">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Objective</p>
                    <p className="text-sm text-slate-700">{cs.objective}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Result</p>
                    <p className="text-sm font-semibold text-slate-900">{cs.result}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Radio className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reach</p>
                    <p className="text-sm text-slate-700">{cs.impressions}</p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
