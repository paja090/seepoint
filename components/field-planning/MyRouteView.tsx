'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { MyRouteDTO } from '@/lib/field-planning/execution';
import { CarrierPhotoUploadModal } from '@/components/carriers/CarrierPhotoUploadModal';
export function MyRouteView({ initial }: { initial: MyRouteDTO }) {
  const [data, setData] = useState(initial); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<MyRouteDTO['routes'][number]['stops'][number]['carrier']>(null);
  async function run(planId: string, workOrderId: string, action: string, form?: FormData, jobId?: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/work/route/mine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId, workOrderId, jobId, action, problemType: form?.get('type'), note: form?.get('note'), requestKey: form?.get('key') }) });
      const value = await response.json(); if (!response.ok) throw new Error(value.error);
      const refreshed = await fetch('/api/work/route/mine'); if (refreshed.ok) setData(await refreshed.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Operace selhala.'); } finally { setBusy(false); }
  }
  async function upload(planId: string, workOrderId: string, jobId: string, form: FormData) {
    setBusy(true); setError('');
    form.set('planId', planId); form.set('workOrderId', workOrderId); form.set('jobId', jobId);
    try {
      const response = await fetch('/api/work/route/mine/photo', { method: 'POST', body: form });
      const value = await response.json(); if (!response.ok) throw new Error(value.error);
      const refreshed = await fetch('/api/work/route/mine'); if (refreshed.ok) setData(await refreshed.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Nahrání selhalo.'); } finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-2xl space-y-5"><header><Link href="/my-tasks" className="text-sm text-sky-700">← Moje úkoly</Link><h1 className="mt-3 text-3xl font-bold">Moje trasa dnes</h1><p className="mt-2 text-slate-500">Schválené zastávky v pořadí. Časy v zóně {data.timezone}.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {!data.routes.length && <section className="card">Na dnešek nemáte schválenou trasu.</section>}
    {data.routes.map(route => <section key={route.planId} className="space-y-3"><p className="font-semibold">{route.vehicleName ?? 'Bez vozidla'} · {route.stops.filter(s => s.status === 'DONE').length}/{route.stops.length} hotovo</p>{route.stops.map((s, i) => <article id={`stop-${s.jobId}`} key={s.jobId} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex justify-between gap-3"><h2 className="text-lg font-bold">{i + 1}. {s.title}</h2><span className="font-semibold text-sky-700">{new Date(s.startAt).toLocaleTimeString('cs-CZ', { timeZone: data.timezone, hour: '2-digit', minute: '2-digit' })}</span></div><p className="mt-1 text-sm text-slate-500">{s.clientName} · {s.navigationPointId ? 'Instalace navigace' : s.workType} · {({ DONE: 'Hotovo', IN_PROGRESS: 'Probíhá', PLANNED: 'Naplánováno', CANCELLED: 'Zrušeno' } as Record<string, string>)[s.status] ?? s.status}</p><p className="mt-2 text-sm">{s.carrier?.code} · {s.address ?? s.carrier?.address ?? s.carrier?.city}</p><details className="mt-3 text-sm"><summary className="font-semibold">{s.navigationPointId ? 'Otevřít bod' : 'Zadání a náhled'}</summary><p className="mt-2 whitespace-pre-wrap">{s.instructions}</p>{s.carrier?.photoUrl && <a href={s.carrier.photoUrl} target="_blank" rel="noreferrer" className="mt-2 block text-sky-700">Zobrazit fotografii nosiče ↗</a>}</details>
      <div className="mt-4 flex flex-wrap gap-2"><a className="rounded-xl bg-sky-700 px-4 py-3 font-bold text-white" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${s.location.latitude},${s.location.longitude}`}>Navigovat ↗</a>
        {s.status !== 'DONE' && s.status !== 'CANCELLED' && <button disabled={busy} className="rounded-xl border px-4 py-3 font-semibold disabled:opacity-40" onClick={() => void run(route.planId, s.workOrderId, s.status === 'IN_PROGRESS' ? 'complete' : 'start', undefined, s.jobId)}>{s.status === 'IN_PROGRESS' ? 'Dokončit' : 'Zahájit'}</button>}
        {s.carrier && !s.navigationPointId && !s.workOrderItemId && <button onClick={() => setPhoto(s.carrier)} className="rounded-xl border px-4 py-3">Nahrát fotku</button>}
        {s.navigationOrderId && !s.navigationPointId && <Link href={`/navigation/orders/${s.navigationOrderId}`} className="rounded-xl border px-4 py-3">Otevřít bod v Navigation</Link>}
        {s.taskId && <Link href={`/my-work-entries?taskId=${s.taskId}`} className="rounded-xl border px-4 py-3">Vykázat práci</Link>}
      </div>{(s.navigationPointId || s.workOrderItemId) && s.status !== 'DONE' && s.status !== 'CANCELLED' && <details className="mt-4 text-sm"><summary className="font-semibold text-sky-700">Fotografie a dokončení práce</summary><form className="mt-3 space-y-3" action={form => upload(route.planId, s.workOrderId, s.jobId, form)}><label className="block">Před montáží (volitelné)<input className="block w-full" type="file" name="beforePhoto" accept="image/*" capture="environment" /></label><label className="block">Dokončená práce (povinné)<input className="block w-full" type="file" name="afterPhoto" accept="image/*" capture="environment" required /></label><label className="block">Poznámka<input name="note" className="input" maxLength={1000} /></label><p>Uložením fotografie potvrzujete dokončení práce na této zastávce.</p><button disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white">Uložit fotografii a dokončit bod</button></form></details>}{s.pointPhotoUrl && <a className="mt-3 block text-sm text-sky-700" href={s.pointPhotoUrl}>Fotografie bodu ↗</a>}<p className="mt-2 text-xs text-slate-500">Dokončení nenahrazuje fotodokumentaci ani vykázání práce. Fotku zařaďte jako doložení instalace, kontrolu nebo poškození.</p>
      <details className="mt-4 text-sm"><summary className="font-semibold text-amber-800">Nahlásit problém</summary><form className="mt-3 space-y-2" action={form => run(route.planId, s.workOrderId, 'problem', form, s.jobId)}><input type="hidden" name="key" value={`${route.planId}-${s.jobId}-${s.status}`} /><label className="block">Typ<select name="type" className="input">{['Technický problém', 'Nedostupný nosič', 'Nemožnost instalace', 'Poškození', 'Chybějící materiál', 'Jiné'].map(t => <option key={t}>{t}</option>)}</select></label><label className="block">Popis<textarea name="note" className="input" required maxLength={1000} /></label><button disabled={busy} className="rounded-xl bg-amber-700 px-4 py-2 text-white">Odeslat problém manažerovi</button></form></details>
      {route.stops[i + 1] && <a href={`#stop-${route.stops[i + 1].jobId}`} className="mt-4 block text-sm font-semibold text-sky-700">Další bod ↓</a>}
    </article>)}</section>)}
    {photo && <CarrierPhotoUploadModal isOpen onClose={() => setPhoto(null)} preselectedCarrierId={photo.id} carriers={[photo]} onSuccess={() => setPhoto(null)} />}
  </div>;
}
