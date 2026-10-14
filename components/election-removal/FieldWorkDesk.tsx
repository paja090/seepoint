'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ElectionRemovalPoint, FieldWorkStep } from '@prisma/client';
import { operations, dispositions } from '@/lib/election-removal/task-spec';
import { ELECTION_REMOVAL_MEDIA_LABELS } from '@/lib/election-removal/constants';
import { LocationPickerMap } from './LocationPickerMap';

type Point = ElectionRemovalPoint & { steps: FieldWorkStep[]; photos?: { id: string }[] };
type Carrier = { id: string; name: string; latitude: number | null; longitude: number | null; surfaces: { id: string; name: string }[] };
export function FieldWorkDesk({ campaignId, points }: { campaignId: string; points: Point[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Point | null>(null);
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destination, setDestination] = useState<{ latitude: number; longitude: number } | null>(null);
  const [carrier, setCarrier] = useState<Carrier | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [transport, setTransport] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [formKey, setFormKey] = useState(0);
  const category = (p: Point) => p.status === 'COMPLETED' ? 'DONE' : p.reviewRequired ? 'REVIEW' : p.status === 'ISSUE' ? 'ISSUE' : p.steps.some(s => s.completedQuantity > 0) ? 'PARTIAL' : p.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : p.assignedFieldPlanId ? 'ASSIGNED' : 'PENDING';
  const groups = { ALL: 'Vše', REVIEW: 'Vyžaduje kontrolu', PENDING: 'Nenaplánované', ASSIGNED: 'Naplánované', IN_PROGRESS: 'Rozpracované', PARTIAL: 'Částečně hotové', DONE: 'Hotové', ISSUE: 'Problémy / opakování' };
  function editPoint(point: Point | null) {
    setEdit(point); setGps(point ? { latitude: point.latitude, longitude: point.longitude } : null);
    setDestination(point?.destinationLatitude != null && point.destinationLongitude != null ? { latitude: point.destinationLatitude, longitude: point.destinationLongitude } : null);
    setTransport(Boolean(point?.destinationLatitude != null)); setCarrier(null); setFormKey(k => k + 1);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const payload = { ...Object.fromEntries(form), campaignId, id: edit?.id, ...gps,
      carrierId: carrier?.id ?? edit?.carrierId ?? null, surfaceId: form.has('surfaceId') ? form.get('surfaceId') || null : edit?.surfaceId ?? null,
      gpsConfirmed: form.get('gpsConfirmed') === 'on', destinationGpsConfirmed: form.get('destinationGpsConfirmed') === 'on',
      destinationLatitude: destination?.latitude, destinationLongitude: destination?.longitude,
      windowStart: form.get('windowStart') ? new Date(String(form.get('windowStart'))).toISOString() : null,
      windowEnd: form.get('windowEnd') ? new Date(String(form.get('windowEnd'))).toISOString() : null,
      quantity: Number(form.get('quantity')), serviceMinutes: form.get('serviceMinutes') ? Number(form.get('serviceMinutes')) : undefined, deliveryMinutes: Number(form.get('deliveryMinutes') || 10),
      loadSlots: Number(form.get('loadSlots')), requiredWorkers: Number(form.get('requiredWorkers')),
      requiredEquipment: String(form.get('requiredEquipment') || '').split(',').map(s => s.trim()).filter(Boolean),
      requiredPositions: String(form.get('requiredPositions') || '').split(',').map(s => s.trim()).filter(Boolean) };
    try {
      const response = await fetch('/api/election-removal/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      editPoint(null); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Uložení selhalo. Zadání zůstává zachováno.'); }
    finally { setBusy(false); }
  }
  const input = 'block w-full rounded-lg border border-slate-300 p-2 text-sm';
  return <section className="space-y-5">
    <div className="flex flex-wrap gap-2">{Object.entries(groups).map(([key, label]) => <button key={key} className={`rounded-lg border px-3 py-2 text-sm ${filter === key ? 'bg-sky-100' : 'bg-white'}`} onClick={() => setFilter(key)}>{label} ({key === 'ALL' ? points.length : points.filter(p => category(p) === key).length})</button>)}</div>
    <Link className="inline-block rounded-lg bg-sky-700 p-3 text-white" href={`/election-removal/${campaignId}/plan${selected.length ? '?points=' + selected.join(',') : ''}`}>4–5. Posádky, výjezdy a schválení</Link>
    {selected.length > 0 && <form className="flex flex-wrap gap-3 rounded border p-3" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError(''); const f = new FormData(e.currentTarget);
      const changes = Object.fromEntries([...f.entries()].filter(([,v]) => v !== ''));
      try { const r = await fetch('/api/election-removal/points/batch', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pointIds: selected, changes }) });
        const d = await r.json(); if (!r.ok) throw new Error(d.error); router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : 'Změna selhala.'); } finally { setBusy(false); }
    }}><strong>Hromadná změna ({selected.length})</strong>
      <label>Operace<select name="operationType" className={input}><option value="">Beze změny</option>{Object.entries(operations).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Typ objektu<select name="mediaType" className={input}><option value="">Beze změny</option>{Object.entries(ELECTION_REMOVAL_MEDIA_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label>Termín<input type="date" name="deadlineAt" className={input} /></label>
      <label>Společné instrukce<input name="description" className={input} /></label><button disabled={busy} className="rounded border p-2">Použít na vybrané</button>
    </form>}
    <div className="space-y-2">{points.filter(p => filter === 'ALL' || category(p) === filter).map(p => <article key={p.id} className="rounded-xl border bg-white p-4">
      <div className="flex gap-3 items-center"><input aria-label={`Vybrat ${p.label}`} type="checkbox" checked={selected.includes(p.id)} onChange={e => setSelected(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} />
        <strong>{p.label} · {p.quantity} ks · {p.operationType && operations[p.operationType as keyof typeof operations] || 'Vyžaduje kontrolu'}</strong>
        <button className="ml-auto underline" onClick={() => editPoint(p)}>Upravit zadání</button></div>
      <p className="mt-2 text-sm">{p.description} {p.materialInstructions}</p>
      {p.photos?.map(photo => <a key={photo.id} className="mr-3 text-sm underline text-sky-700" href={`/api/photos/${photo.id}/file`} target="_blank" rel="noreferrer">Fotodokumentace</a>)}
      {p.steps.map(s => <p className="text-sm text-slate-600" key={s.id}>{s.sequence}. {s.label}: {s.completedQuantity}/{s.quantity} · {s.status}{s.custodyNote ? ` · ${s.custodyNote}` : ''}{s.issueNote ? ` · ${s.issueNote}` : ''}</p>)}
      {p.steps.some(s => s.status === 'COMPLETED' && s.loadDelta > 0) && p.steps.some(s => s.kind === 'DELIVERY' && !s.startedAt && s.status !== 'COMPLETED') && <details className="mt-3 rounded border p-3"><summary>Předat naložený materiál jiné posádce</summary>
        <form className="mt-3 space-y-2" onSubmit={async e => {
          e.preventDefault(); setBusy(true); setError(''); const f = new FormData(e.currentTarget);
          try { const r = await fetch('/api/election-removal/tasks/handoff', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({pointId:p.id,latitude:Number(f.get('latitude')),longitude:Number(f.get('longitude')),gpsConfirmed:f.get('confirmed')==='on',note:f.get('note'),requestKey:`handoff-${p.id}-${p.steps.length}`}) });
            const d=await r.json();if(!r.ok) throw new Error(d.error);router.refresh();
          } catch(e) {setError(e instanceof Error?e.message:'Předání selhalo.');}finally{setBusy(false);}
        }}><p className="text-sm">Doplňte skutečnou polohu materiálu. Vznikne krok převzetí pro nový výjezd; původní nakládka zůstane v historii.</p>
          <label>Aktuální zeměpisná šířka<input className={input} type="number" step="any" name="latitude" required /></label>
          <label>Aktuální zeměpisná délka<input className={input} type="number" step="any" name="longitude" required /></label>
          <label>Držitel materiálu a podmínky předání<textarea className={input} name="note" required /></label>
          <label className="flex gap-2"><input type="checkbox" name="confirmed" required />Potvrzuji skutečnou GPS a připravenost předání</label>
          <button disabled={busy} className="rounded border p-2">Uvolnit doručení a naplánovat převzetí</button>
        </form></details>}
    </article>)}</div>
    <form key={formKey} onSubmit={save} className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">2–3. {edit ? 'Upravit objekt a práci' : 'Přidat objekt a práci'}</h2>
      <p className="text-sm text-slate-600">Samostatný objekt nevyžaduje nosič. Pro instalaci ze skladu vyberte jako zdroj sklad a jako cíl místo instalace.</p>
      <label className="block">Vyhledat existující nosič<input className={input} placeholder="Název nebo kód" onChange={async e => { try { const r = await fetch('/api/election-removal/tasks?q=' + encodeURIComponent(e.target.value)); if (r.ok) setCarriers((await r.json()).carriers); } catch { setError('Vyhledání nosičů selhalo.'); } }} /></label>
      <div className="flex flex-wrap gap-2">{carriers.map(c => <button type="button" key={c.id} className="rounded border p-2 text-sm" onClick={() => { setCarrier(c); setCarriers([]); if (c.latitude != null && c.longitude != null) setGps({ latitude: c.latitude, longitude: c.longitude }); }}>{c.name}</button>)}</div>
      {carrier && <label>Plocha<select className={input} name="surfaceId"><option value="">Celý objekt</option>{carrier.surfaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Název objektu<input className={input} required name="label" defaultValue={edit?.label ?? ''} /></label>
        <label>Typ objektu<select name="mediaType" className={input} defaultValue={edit?.mediaType ?? 'OTHER'}>{Object.entries(ELECTION_REMOVAL_MEDIA_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Vlastní typ / upřesnění<input className={input} name="objectType" defaultValue={edit?.objectType ?? 'Samostatný objekt'} /></label>
        <label>Operace<select className={input} name="operationType" defaultValue={edit?.operationType ?? 'INSPECTION'}>{Object.entries(operations).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Množství<input className={input} name="quantity" type="number" min="1" required defaultValue={edit?.quantity ?? 1} /></label>
        <label>Termín práce<input className={input} name="deadlineAt" type="date" defaultValue={edit?.deadlineAt ? new Date(edit.deadlineAt).toISOString().slice(0,10) : ''} /></label>
        <label>Práce na zdroji celkem (min)<input className={input} name="serviceMinutes" type="number" min="1" placeholder="Automaticky podle operace, objektu a množství" defaultValue={edit?.serviceMinutes ?? ''} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{(['windowStart', 'windowEnd'] as const).map(key => <label key={key}>{key === 'windowStart' ? 'Přístup od (místní čas)' : 'Dokončit do (místní čas)'}<input className={input} type="datetime-local" name={key} defaultValue={edit?.[key] ? new Date(new Date(edit[key]!).getTime() - new Date(edit[key]!).getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''} /></label>)}</div>
      <label className="block">Přesný pokyn<textarea className={input} name="description" required defaultValue={edit?.description ?? ''} /></label>
      <LocationPickerMap latitude={gps?.latitude} longitude={gps?.longitude} onChange={setGps} />
      <p>{gps ? `${gps.latitude}, ${gps.longitude}` : 'Klikněte do mapy nebo vyhledejte adresu.'}</p>
      <label className="flex gap-2"><input name="gpsConfirmed" type="checkbox" required />Potvrzuji GPS místa práce / vyzvednutí</label>
      <label className="block">Nakládání s materiálem<select className={input} name="materialDisposition" defaultValue={edit?.materialDisposition ?? 'LEAVE'} onChange={e => setTransport(['WAREHOUSE','TRANSFER','CLIENT'].includes(e.target.value))}>{Object.entries(dispositions).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="block">Co vzít s sebou / co odvézt / co ponechat<textarea className={input} name="materialInstructions" defaultValue={edit?.materialInstructions ?? ''} /></label>
      {transport && <div className="space-y-3 rounded border p-3">
        <label>Cíl / sklad<input className={input} name="destinationName" required defaultValue={edit?.destinationName ?? ''} /></label>
        <LocationPickerMap latitude={destination?.latitude} longitude={destination?.longitude} onChange={setDestination} pinLabel="Cíl převozu" />
        <label className="flex gap-2"><input type="checkbox" name="destinationGpsConfirmed" required />Potvrzuji cílovou GPS</label>
        <label>Vykládka a práce v cíli celkem (min)<input className={input} name="deliveryMinutes" type="number" min="1" defaultValue={edit?.steps[1]?.serviceMinutes ?? 10} /></label>
      </div>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Náklad při převozu (sloty; bez přepravy 0)<input className={input} name="loadSlots" type="number" min="0" required defaultValue={edit?.loadSlots ?? 0} /></label>
        <label>Počet pracovníků<input className={input} name="requiredWorkers" type="number" min="1" defaultValue={edit?.requiredWorkers ?? 1} /></label>
        <label>Vybavení vozidla (oddělit čárkou)<input className={input} name="requiredEquipment" defaultValue={edit?.requiredEquipment.join(', ') ?? ''} /></label>
        <label>Dovednosti / pozice (oddělit čárkou)<input className={input} name="requiredPositions" defaultValue={edit?.requiredPositions.join(', ') ?? ''} /></label>
        <label>Kontakt<input className={input} name="contact" defaultValue={edit?.contact ?? ''} /></label>
        <label>Přístupové informace<input className={input} name="accessInstructions" defaultValue={edit?.accessInstructions ?? ''} /></label>
        <label>Fotografie / montážní podklad (URL)<input className={input} type="url" name="referenceUrl" defaultValue={edit?.referenceUrl ?? ''} /></label>
      </div>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button disabled={busy} className="rounded-lg bg-sky-700 px-4 py-3 text-white">{busy ? 'Ukládám…' : 'Uložit jednoznačné zadání'}</button>
      {edit && <button type="button" className="ml-3 underline" onClick={() => editPoint(null)}>Nové zadání</button>}
    </form>
  </section>;
}
