import { stats } from '@/lib/proposal-data';

const toneMap: Record<string, string> = {
  brand: 'text-brand',
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  indigo: 'text-indigo-600',
  slate: 'text-slate-700',
};

export function StatsRow() {
  return (
    <section className="mx-auto mt-12 max-w-6xl px-6 lg:mt-20">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            <p className={`text-3xl font-semibold tracking-tight ${toneMap[s.tone]}`}>{s.value}</p>
            <p className="mt-2 text-xs font-medium leading-tight text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
