import { dealsByStage, formatCzk, stageTotals } from '@/lib/mock-sales-data';
import { DealCard } from './DealCard';

const headerTones: Record<string, string> = {
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
  blue: 'bg-sky-500',
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  red: 'bg-red-500',
};

export function PipelineBoard() {
  const stages = stageTotals();

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1100px] grid-cols-6 gap-4">
        {stages.map((stage) => {
          const deals = dealsByStage(stage.key);
          return (
            <section className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/60" key={stage.key}>
              <header className="border-b border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${headerTones[stage.tone] ?? 'bg-slate-400'}`} />
                  <h3 className="text-sm font-semibold text-slate-950">{stage.label}</h3>
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {stage.count}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{stage.description}</p>
                <p className="mt-1.5 text-xs font-semibold text-slate-700">{formatCzk(stage.value)}</p>
              </header>
              <div className="flex flex-1 flex-col gap-2.5 p-3">
                {deals.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    Žádné položky
                  </p>
                ) : (
                  deals.map((deal) => <DealCard deal={deal} key={deal.id} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
