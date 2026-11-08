'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { OnboardingStep } from '@/lib/organization-onboarding';

type Progress = {
  completed: Record<OnboardingStep, boolean>;
  completedCount: number;
  percent: number;
  currentStep: string;
  isCompleted: boolean;
};

const steps: Array<{ key: OnboardingStep; title: string; description: string; href?: string; action: string }> = [
  { key: 'COMPANY', title: 'Firemní údaje', description: 'Organizace má vlastní název a bezpečný slug.', action: 'Hotovo při založení' },
  { key: 'OWNER', title: 'OWNER účet', description: 'Vlastník přijal pozvánku a má aktivní členství.', action: 'Čeká na aktivaci' },
  { key: 'SETTINGS', title: 'Nastavení firmy', description: 'Doplňte fakturační údaje, kontakt a základ brandingu.', href: '/settings/company', action: 'Otevřít nastavení' },
  { key: 'INVENTORY', title: 'Import ploch', description: 'Nahrajte první reklamní plochy, nebo tento krok prozatím přeskočte.', href: '/import', action: 'Otevřít import' },
  { key: 'TEAM', title: 'Pozvání kolegů', description: 'Přidejte členy týmu, nebo pokračujte zatím pouze s OWNEREM.', href: '/settings/members', action: 'Spravovat uživatele' },
];

export function OnboardingChecklist({ activeMemberCount, organizationName, progress: initialProgress, surfaceCount }: { activeMemberCount: number; organizationName: string; progress: Progress; surfaceCount: number }) {
  const [progress, setProgress] = useState(initialProgress);
  const [busyStep, setBusyStep] = useState<OnboardingStep | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function completeStep(step: OnboardingStep) {
    setBusyStep(step);
    setMessage(null);
    try {
      const response = await fetch('/api/onboarding', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ step }) });
      const result = await response.json() as { error?: string; progress?: Progress };
      if (!response.ok || !result.progress) throw new Error(result.error || 'Krok se nepodařilo uložit.');
      setProgress(result.progress);
      setMessage(result.progress.isCompleted ? 'Onboarding je dokončený.' : 'Průběh byl uložen.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Krok se nepodařilo uložit.');
    } finally {
      setBusyStep(null);
    }
  }

  return (
    <section aria-labelledby="onboarding-progress-title">
      <div className="card mb-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Aktivní organizace</p><h2 className="mt-1 text-2xl font-bold" id="onboarding-progress-title">{organizationName}</h2></div><p className="text-sm font-semibold text-slate-700">{progress.completedCount} z 5 kroků · {progress.percent} %</p></div>
        <div aria-label={`Onboarding dokončen z ${progress.percent} procent`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress.percent} className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar"><div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress.percent}%` }} /></div>
        <p className="mt-3 text-sm text-slate-600">Aktivní členové: {activeMemberCount} · Reklamní plochy: {surfaceCount}</p>
      </div>
      <ol className="grid gap-4 lg:grid-cols-5">
        {steps.map((step, index) => {
          const done = progress.completed[step.key];
          const canMarkComplete = !done && (step.key === 'SETTINGS' || step.key === 'INVENTORY' || step.key === 'TEAM');
          return <li className={`card flex min-h-64 flex-col ${done ? 'border-emerald-200 bg-emerald-50/40' : ''}`} key={step.key}><div className="flex items-center justify-between gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">{index + 1}</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{done ? 'Dokončeno' : 'Čeká'}</span></div><h3 className="mt-4 text-lg font-bold">{step.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{step.description}</p>{step.href && !done ? <Link className="btn-secondary mt-4 text-center" href={step.href}>{step.action}</Link> : null}{canMarkComplete ? <button className="mt-2 text-sm font-semibold text-slate-600 underline underline-offset-4 disabled:opacity-50" disabled={busyStep !== null} onClick={() => completeStep(step.key)} type="button">{busyStep === step.key ? 'Ukládám…' : step.key === 'SETTINGS' ? 'Označit jako dokončené' : 'Přeskočit prozatím'}</button> : null}{!step.href && !done ? <p className="mt-4 text-sm font-semibold text-amber-700">{step.action}</p> : null}</li>;
        })}
      </ol>
      <div aria-live="polite" className="mt-4 min-h-6 text-sm font-semibold text-slate-700">{message}</div>
      <div className="mt-4 rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            B2B Síť ČR
          </span>
          <h3 className="text-base font-black text-slate-950">
            Chcete nabídnout své volné kapacity partnerským agenturám?
          </h3>
          <p className="text-xs text-slate-600">
            Vaše naimportované plochy ({surfaceCount}) jsou ve výchozím stavu soukromé (<strong>PRIVATE</strong>). V sekci B2B Síť je můžete jedním kliknutím zveřejnit do B2B Burzy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href="/network"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 transition"
          >
            Otevřít B2B Síť a publikovat plochy →
          </Link>
          <Link
            href="/join-network"
            className="rounded-xl border border-indigo-200 bg-white px-3.5 py-2.5 text-xs font-bold text-indigo-800 hover:bg-indigo-50 transition"
          >
            Pozvat partnera přes IČO
          </Link>
        </div>
      </div>
    </section>
  );
}
