'use client';

import { useId, useState, type FormEvent } from 'react';
import type { ElectionRemovalPoint, FieldWorkStep } from '@prisma/client';

export type ReleaseWorkPoint = Pick<ElectionRemovalPoint, 'id' | 'label' | 'status' | 'assignedFieldPlanId' | 'startedAt'> & { steps: Pick<FieldWorkStep, 'kind' | 'status' | 'loadDelta' | 'completedQuantity'>[] };

export function ReleaseWorkPanel({ campaignId, points }: { campaignId: string; points: ReleaseWorkPoint[] }) {
  const formId = useId();
  const candidates = points.filter(p => !['COMPLETED', 'CANCELLED'].includes(p.status) && (p.assignedFieldPlanId || p.startedAt || p.status === 'ISSUE'));
  const [pointId, setPointId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = candidates.find(p => p.id === pointId) ?? candidates[0];
  const loaded = selected?.steps.some(s => s.loadDelta > 0 && s.completedQuantity > 0) ?? false;

  async function release(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch(loaded ? '/api/election-removal/tasks/handoff' : '/api/election-removal/tasks/release', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointId: selected.id, note: form.get('note'), requestKey: crypto.randomUUID(), confirmed: form.get('confirmed') === 'on', ...(loaded ? { latitude: Number(form.get('latitude')), longitude: Number(form.get('longitude')), gpsConfirmed: form.get('confirmed') === 'on' } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Uvolnění bodu selhalo.');
      // Open a fresh proposal, dropping any stale draft or parent-plan state on this page.
      window.location.assign('/election-removal/' + encodeURIComponent(campaignId) + '/plan?points=' + encodeURIComponent(selected.id));
    } catch (error) { setError(error instanceof Error ? error.message : 'Uvolnění bodu selhalo.'); setBusy(false); }
  }

  return <section id="release-work" aria-labelledby={formId + '-title'} className="scroll-mt-6 rounded-2xl border-2 border-sky-500 bg-sky-50 p-4 sm:p-5 shadow-sm">
    <h2 id={formId + '-title'} className="text-lg font-bold text-sky-950">Uvolnit body pro novou trasu</h2>
    <p className="mt-1 text-sm text-slate-700">Zde vyberte bod z původní trasy. Hotové množství a historie zůstanou zachované.</p>
    {candidates.length ? <form className="mt-4 grid gap-3" onSubmit={release}>
      <label className="text-sm font-semibold text-slate-900">Bod k uvolnění ({candidates.length})
        <select className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3" value={selected?.id ?? ''} disabled={busy} onChange={event => { setPointId(event.target.value); setError(''); }}>
          {candidates.map(p => <option key={p.id} value={p.id}>{p.label}{p.status === 'ISSUE' ? ' — hlášený problém' : ''}</option>)}
        </select>
      </label>
      <div key={selected?.id} className="grid gap-3">
        {loaded && <div className="grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-slate-700 sm:col-span-2">Materiál už byl naložen. Doplňte skutečné místo, kde jej nová posádka převezme.</p>
          <label className="text-sm">Zeměpisná šířka materiálu<input className="mt-1 block w-full rounded-lg border p-3" type="number" step="any" min={-90} max={90} name="latitude" required /></label>
          <label className="text-sm">Zeměpisná délka materiálu<input className="mt-1 block w-full rounded-lg border p-3" type="number" step="any" min={-180} max={180} name="longitude" required /></label>
        </div>}
        <label className="text-sm font-semibold text-slate-900">{loaded ? 'Držitel materiálu a pokyny k převzetí' : 'Stav práce a pokyny pro pokračování'}
          <textarea className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 font-normal" name="note" required maxLength={4000} rows={2} placeholder="Např. práce přerušena kvůli počasí, pokračovat zítra." />
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-800"><input className="mt-1" type="checkbox" name="confirmed" required />{loaded ? 'Potvrzuji skutečnou polohu materiálu a připravenost k převzetí.' : 'Potvrzuji, že původní posádka už na bodu nepracuje a lze jej naplánovat znovu.'}</label>
      </div>
      <p className="text-xs text-slate-600">Po potvrzení se otevře nové plánování vybraného bodu. U hlášeného problému potvrzujete, že je práce připravená k dalšímu pokusu.</p>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-sky-700 px-5 py-3 text-base font-bold text-white hover:bg-sky-800 disabled:opacity-50 sm:w-fit">{busy ? 'Uvolňuji bod…' : loaded ? 'Potvrdit předání a naplánovat bod' : 'Uvolnit vybraný bod a naplánovat'}</button>
    </form> : <p className="mt-3 rounded-lg bg-white p-3 text-sm text-slate-700">V této akci nejsou žádné přiřazené ani rozpracované body k uvolnění. Volné body můžete rovnou naplánovat.</p>}
  </section>;
}
