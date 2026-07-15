import { Check, Circle } from 'lucide-react';
import type { OfferView } from '@/lib/offers/view-model';

type OfferWorkflowStepperProps = Pick<OfferView, 'status' | 'events' | 'converted'>;

export function OfferWorkflowStepper({ status, events, converted }: OfferWorkflowStepperProps) {
  const wasSent = status !== 'DRAFT';
  const wasViewed = events?.some((event) => event.type === 'VIEWED') ?? false;
  const hasDecision = ['ACCEPTED', 'REJECTED', 'EXPIRED'].includes(status);
  const stages = [
    { label: 'Návrh', complete: true },
    { label: 'Odesláno', complete: wasSent },
    { label: 'Zobrazeno', complete: wasViewed },
    { label: 'Rozhodnutí', complete: hasDecision },
    { label: 'Obsazenost', complete: Boolean(converted) },
  ];
  const activeIndex = Math.min(stages.findIndex((stage) => !stage.complete), stages.length - 1);

  return (
    <nav aria-label="Průběh nabídky" className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <ol className="grid grid-cols-5 gap-2">
        {stages.map((stage, index) => {
          const active = index === activeIndex;
          return (
            <li className="relative flex min-w-0 flex-col items-center text-center" key={stage.label}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-4 h-px w-full ${stage.complete ? 'bg-slate-950' : 'bg-slate-200'}`}
                />
              )}
              <span
                className={`relative z-10 flex size-8 items-center justify-center rounded-full border bg-white ${
                  stage.complete
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : active
                      ? 'border-slate-950 text-slate-950 ring-4 ring-slate-100'
                      : 'border-slate-200 text-slate-300'
                }`}
              >
                {stage.complete ? <Check aria-hidden="true" size={15} /> : <Circle aria-hidden="true" size={10} fill="currentColor" />}
              </span>
              <span className={`mt-2 truncate text-[11px] font-semibold sm:text-xs ${active || stage.complete ? 'text-slate-950' : 'text-slate-400'}`}>
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
