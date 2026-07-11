import { Eye, TrendingUp, Clock, Globe2, BarChart3 } from 'lucide-react';
import { SectionHeading } from './SectionHeading';
import { whyCampaign } from '@/lib/proposal-data';

const icons = [Eye, TrendingUp, Clock, Globe2, BarChart3];

export function WhyCampaign() {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-6 lg:mt-28">
      <SectionHeading
        eyebrow="Why this campaign"
        title="Built to be seen, and to perform"
        description="Every decision in this plan is designed to turn visibility into measurable results."
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {whyCampaign.map((item, i) => {
          const Icon = icons[i % icons.length];
          return (
            <div
              key={item.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
