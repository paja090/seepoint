'use client';
import { useState } from 'react';
import type { PlanningJob } from '@/lib/field-planning/contracts';
import { zonedTime } from '@/lib/field-planning/profile';
export function JobPlanningSettings({ job, onSaved, employees, jobs, timezone }: { job: PlanningJob; onSaved: () => void; employees: Array<{ id: string; name: string }>; jobs: Array<{ id: string; title: string }>; timezone: string }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save(form: FormData) {
    setBusy(true); setError('');
    try {
      const instant = (name: string) => { const value = String(form.get(name) ?? ''); return value ? new Date(zonedTime(value.slice(0, 10), value.slice(11, 16), timezone)).toISOString() : undefined; };
      const constraints = { windowStart: instant('from'), windowEnd: instant('to'), requiredEmployeeIds: form.getAll('employees'), predecessorIds: form.getAll('predecessors'), requiredPositions: String(form.get('positions') ?? '').split(',').map(s => s.trim()).filter(Boolean), vehicleRequired: form.get('vehicle') === 'default' ? undefined : form.get('vehicle') === 'yes' };
      const response = await fetch('/api/work/route/constraints', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workOrderId: job.parentWorkOrderId ?? job.id, navigationPointId: job.navigationPointId, workOrderItemId: job.workOrderItemId, constraints, serviceMinutes: form.get('minutes') ? Number(form.get('minutes')) : null }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Změna selhala.'); } finally { setBusy(false); }
  }
  const local = (v?: string) => v ? new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(v)).replace(' ', 'T') : '';
  async function resolve(form: FormData) {
    setBusy(true); setError('');
    try { const response = await fetch('/api/work/route/constraints', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workOrderId: job.id, resolution: form.get('resolution') }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Vyřešení se nepodařilo uložit.'); } finally { setBusy(false); }
  }
  return <details className="mt-1 text-xs"><summary className="cursor-pointer text-sky-700">Délka a omezení</summary><form action={save} className="mt-2 space-y-2">
    <label className="block">Délka práce (min; prázdné = profil)<input className="input" type="number" min={1} max={1440} name="minutes" defaultValue={job.serviceMinutes ?? ''} /></label>
    {!job.navigationPointId && !job.workOrderItemId && <><label className="block">Nejdřívější začátek ({timezone})<input name="from" type="datetime-local" className="input" defaultValue={local(job.constraints.windowStart)} /></label><label className="block">Nejpozdější dokončení<input name="to" type="datetime-local" className="input" defaultValue={local(job.constraints.windowEnd)} /></label>
    <label className="block">Povinní pracovníci<select multiple name="employees" className="input" defaultValue={job.constraints.requiredEmployeeIds ?? []}>{employees.map(e => <option value={e.id} key={e.id}>{e.name}</option>)}</select></label>
    <label className="block">Nejprve dokončit<select multiple name="predecessors" className="input" defaultValue={job.constraints.predecessorIds ?? []}>{jobs.filter(j => j.id !== job.id).map(j => <option value={j.id} key={j.id}>{j.title}</option>)}</select></label>
    <label className="block">Požadované pracovní pozice (oddělené čárkou)<input name="positions" className="input" defaultValue={job.constraints.requiredPositions?.join(', ')} /></label>
    <label className="block">Vozidlo<select name="vehicle" className="input" defaultValue={job.constraints.vehicleRequired === undefined ? 'default' : job.constraints.vehicleRequired ? 'yes' : 'no'}><option value="default">Podle organizace</option><option value="yes">Povinné</option><option value="no">Není potřeba</option></select></label></>}
    {error && <p role="alert" className="text-red-700">{error}</p>}<button disabled={busy} className="font-bold text-sky-700">Uložit omezení</button></form>{job.blockedReason && !job.navigationPointId && <form action={resolve} className="mt-3 space-y-2"><p className="text-amber-800">{job.blockedReason}</p><label>Vyřešení samostatného provozního problému<input name="resolution" className="input" minLength={3} maxLength={1000} required /></label><button disabled={busy} className="font-bold text-emerald-700">Potvrdit vyřešení</button></form>}</details>;
}
