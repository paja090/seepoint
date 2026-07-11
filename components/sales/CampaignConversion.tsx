'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, PlayCircle, Rocket } from 'lucide-react';
import { conversionReservations, conversionSteps, formatCzk, successSummary } from '@/lib/mock-sales-data';
import { WorkflowStepper } from './WorkflowStepper';
import { Chip, MiniStat, ToneDot } from './ui';

export function CampaignConversion() {
  const [running, setRunning] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [done, setDone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  function runConversion() {
    setRunning(true);
    setDone(false);
    setActiveStep(0);
    conversionSteps.forEach((_, index) => {
      const timer = setTimeout(() => {
        setActiveStep(index + 1);
        if (index === conversionSteps.length - 1) {
          setDone(true);
          setRunning(false);
        }
      }, (index + 1) * 900);
      timers.current.push(timer);
    });
  }

  return (
    <div className="space-y-6">
      <WorkflowStepper current="conversion" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat label="Kampaň" value={successSummary.campaign} />
        <MiniStat label="Plochy" value={successSummary.surfaces} hint="k rezervaci" />
        <MiniStat label="Hodnota" value={formatCzk(successSummary.value)} hint="s DPH" />
        <MiniStat label="Termín" value="Srpen 2026" hint={successSummary.period} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Steps */}
        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Rocket aria-hidden className="text-slate-500" size={18} />
              <h2 className="text-base font-semibold text-slate-950">Převod nabídky na kampaň</h2>
            </div>
            {!running && !done && (
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={runConversion}
                type="button"
              >
                <PlayCircle aria-hidden size={16} /> Spustit převod
              </button>
            )}
            {done && <Chip tone="green"><CheckCircle2 aria-hidden size={13} /> Dokončeno</Chip>}
          </div>

          <ol className="space-y-2.5">
            {conversionSteps.map((step, index) => {
              const isDone = activeStep > index;
              const isActive = running && activeStep === index;
              return (
                <li
                  className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${isDone ? 'border-emerald-200 bg-emerald-50/60' : isActive ? 'border-sky-200 bg-sky-50/60' : 'border-slate-200'}`}
                  key={step.id}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${isDone ? 'bg-emerald-600 text-white' : isActive ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {isDone ? <CheckCircle2 aria-hidden size={17} /> : isActive ? <Loader2 aria-hidden className="animate-spin" size={17} /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{step.label}</p>
                    <p className="text-sm text-slate-500">{step.detail}</p>
                  </div>
                  {isDone && <span className="text-xs font-semibold text-emerald-600">Hotovo</span>}
                  {isActive && <span className="text-xs font-semibold text-sky-600">Probíhá…</span>}
                </li>
              );
            })}
          </ol>

          {done && (
            <a
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              href="/sales/success"
            >
              Zobrazit shrnutí kampaně <ArrowRight aria-hidden size={16} />
            </a>
          )}
        </section>

        {/* Reservations */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="card">
            <h2 className="text-base font-semibold text-slate-950">Rezervace ploch</h2>
            <p className="mt-1 text-sm text-slate-500">Ukázka {conversionReservations.length} z {successSummary.surfaces} vytvářených rezervací.</p>
            <div className="mt-3 space-y-2">
              {conversionReservations.map((row) => {
                const created = done || row.status === 'created';
                return (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5" key={row.id}>
                    <ToneDot tone={row.tone} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{row.surface} · {row.city}</p>
                      <p className="text-xs text-slate-400">{row.period}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${created ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {created ? <><CheckCircle2 aria-hidden size={13} /> Rezervováno</> : 'Čeká'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
