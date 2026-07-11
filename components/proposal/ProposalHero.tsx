import { Target, Users, CalendarRange, Radio, Layers, MapPin, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { campaign } from '@/lib/proposal-data';

const summary = [
  { icon: Target, label: 'Objective', value: campaign.objective },
  { icon: Users, label: 'Target audience', value: campaign.audience },
  { icon: CalendarRange, label: 'Duration', value: campaign.duration },
  { icon: Radio, label: 'Estimated reach', value: `${campaign.reach} people` },
  { icon: Layers, label: 'Media mix', value: campaign.mediaMix },
  { icon: MapPin, label: 'Locations', value: campaign.locations },
];

export function ProposalHero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 lg:pt-16">
      <div className="grid animate-fade-up gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
        <div className="flex flex-col justify-center">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" /> {campaign.status}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Prepared for {campaign.client}</span>
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">{campaign.client}</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl lg:text-6xl">
            {campaign.title}
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate-600">
            A tailored out-of-home advertising plan combining premium formats and high-traffic locations to
            maximise reach across the Czech Republic this summer.
          </p>

          <div className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {summary.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-0.5 text-sm leading-snug text-slate-700">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-lift transition hover:bg-brand-700">
              <CheckCircle2 className="h-4 w-4" /> Approve proposal
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Request changes <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-soft">
          <img
            src="/proposal/hero-carrier.png"
            alt="Featured advertising tower for the Summer Campaign 2026"
            className="h-full min-h-[360px] w-full object-cover"
          />
          <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-2xl border border-white/40 bg-white/80 px-4 py-3 backdrop-blur-md">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Featured carrier</p>
              <p className="text-sm font-semibold text-slate-900">TW-0203 · Náměstí Svobody, Brno</p>
            </div>
            <span className="rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">TOWER</span>
          </div>
        </div>
      </div>
    </section>
  );
}
