import Link from 'next/link';
import { Check } from 'lucide-react';
import { workflowStages } from '@/lib/mock-sales-data';

export function WorkflowStepper({ current }: { current: string }) {
  const currentStage = workflowStages.find((stage) => stage.key === current);
  const currentStep = currentStage?.step ?? 0;

  return (
    <nav aria-label="Průběh obchodního workflow" className="card mb-6 overflow-x-auto !p-4">
      <ol className="flex min-w-max items-center gap-1">
        {workflowStages.map((stage, index) => {
          const done = stage.step < currentStep;
          const active = stage.step === currentStep;
          return (
            <li className="flex items-center gap-1" key={stage.key}>
              <Link
                className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-slate-950 text-white'
                    : done
                      ? 'text-emerald-700 hover:bg-emerald-50'
                      : 'text-slate-500 hover:bg-slate-100'
                }`}
                href={stage.href}
              >
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    active
                      ? 'bg-white text-slate-950'
                      : done
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {done ? <Check aria-hidden size={14} /> : stage.step}
                </span>
                <span className="whitespace-nowrap">{stage.label}</span>
              </Link>
              {index < workflowStages.length - 1 && (
                <span aria-hidden className={`h-px w-5 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
