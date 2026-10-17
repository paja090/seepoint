'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles, Wrench, Trash2, Truck, CheckSquare, Square, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { ElectionRemovalPoint, FieldWorkStep } from '@prisma/client';
import { operations, dispositions } from '@/lib/election-removal/task-spec';
import { ELECTION_REMOVAL_MEDIA_LABELS } from '@/lib/election-removal/constants';
import { cleanLayerName, isGenericLayerName } from '@/lib/election-removal/point-metadata';
import { LocationPickerMap } from './LocationPickerMap';

type Point = ElectionRemovalPoint & { steps: FieldWorkStep[]; photos?: { id: string; type?: string; fileName?: string | null; createdAt?: string | Date; capturedLatitude?: number | null; capturedLongitude?: number | null; capturedByWorkerName?: string | null }[] };
type Carrier = { id: string; name: string; latitude: number | null; longitude: number | null; surfaces: { id: string; name: string }[] };
export function FieldWorkDesk({ campaignId, points }: { campaignId: string; points: Point[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [formOpen, setFormOpen] = useState(points.length === 0);
  const [source, setSource] = useState<'MAP' | 'CARRIER'>('MAP');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(25);
  const [edit, setEdit] = useState<Point | null>(null);
  const [gps, setGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destination, setDestination] = useState<{ latitude: number; longitude: number } | null>(null);
  const [carrier, setCarrier] = useState<Carrier | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [transport, setTransport] = useState(false);
  const [disposition, setDisposition] = useState('LEAVE');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [formKey, setFormKey] = useState(0);

  async function markPointStatus(pointIds: string[], status: 'COMPLETED' | 'PENDING') {
    if (!pointIds.length) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/election-removal/points/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointIds, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Změna stavu selhala.');
      setSelected([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Změna stavu selhala.');
    } finally {
      setBusy(false);
    }
  }
  const category = (p: Point) => p.status === 'COMPLETED' ? 'DONE' : p.reviewRequired ? 'REVIEW' : p.status === 'ISSUE' ? 'ISSUE' : p.steps.some(s => s.completedQuantity > 0) ? 'PARTIAL' : p.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : p.assignedFieldPlanId ? 'ASSIGNED' : 'PENDING';
  const groups = { ALL: 'Vše', REVIEW: 'Vyžaduje kontrolu', PENDING: 'Nenaplánované', ASSIGNED: 'Naplánované', IN_PROGRESS: 'Rozpracované', PARTIAL: 'Částečně hotové', DONE: 'Hotové', ISSUE: 'Problémy / opakování' };
  function editPoint(point: Point | null) {
    setFormOpen(true); setSource(point?.carrierId ? 'CARRIER' : 'MAP'); setError('');
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    setEdit(point); setGps(point ? { latitude: point.latitude, longitude: point.longitude } : null);
    setDestination(point?.destinationLatitude != null && point.destinationLongitude != null ? { latitude: point.destinationLatitude, longitude: point.destinationLongitude } : null);
    setDisposition(point?.materialDisposition ?? 'LEAVE'); setTransport(['WAREHOUSE','TRANSFER','CLIENT'].includes(point?.materialDisposition ?? 'LEAVE')); setCarrier(null); setFormKey(k => k + 1);
  }
  function duplicatePoint(point: Point) {
    setFormOpen(true); setSource(point.carrierId ? 'CARRIER' : 'MAP'); setError('');
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    setEdit({ ...point, id: '', label: `${point.label} (kopie)` } as unknown as Point);
    setGps({ latitude: point.latitude, longitude: point.longitude });
    setDestination(point.destinationLatitude != null && point.destinationLongitude != null ? { latitude: point.destinationLatitude, longitude: point.destinationLongitude } : null);
    setDisposition(point.materialDisposition ?? 'LEAVE'); setTransport(['WAREHOUSE','TRANSFER','CLIENT'].includes(point.materialDisposition ?? 'LEAVE')); setCarrier(null); setFormKey(k => k + 1);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    const payload = { ...Object.fromEntries(form), objectType: form.get('objectType') || ELECTION_REMOVAL_MEDIA_LABELS[form.get('mediaType') as keyof typeof ELECTION_REMOVAL_MEDIA_LABELS], campaignId, id: edit?.id ? edit.id : undefined, ...gps,
      carrierId: source === 'CARRIER' ? carrier?.id ?? edit?.carrierId ?? null : null, surfaceId: source === 'CARRIER' ? (form.has('surfaceId') ? form.get('surfaceId') || null : edit?.surfaceId ?? null) : null,
      gpsConfirmed: form.get('gpsConfirmed') === 'on', destinationGpsConfirmed: form.get('destinationGpsConfirmed') === 'on',
      destinationLatitude: destination?.latitude, destinationLongitude: destination?.longitude,
      windowStart: form.get('windowStart') ? new Date(String(form.get('windowStart'))).toISOString() : null,
      windowEnd: form.get('windowEnd') ? new Date(String(form.get('windowEnd'))).toISOString() : null,
      quantity: Number(form.get('quantity')), serviceMinutes: form.get('serviceMinutes') ? Number(form.get('serviceMinutes')) : undefined, deliveryMinutes: Number(form.get('deliveryMinutes') || 10),
      loadSlots: transport ? Number(form.get('loadSlots')) : 0, requiredWorkers: Number(form.get('requiredWorkers')),
      requiredEquipment: String(form.get('requiredEquipment') || '').split(',').map(s => s.trim()).filter(Boolean),
      requiredPositions: String(form.get('requiredPositions') || '').split(',').map(s => s.trim()).filter(Boolean) };
    try {
      const response = await fetch('/api/election-removal/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setEdit(null); setFormOpen(false); setCarriers([]); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Uložení selhalo. Zadání zůstává zachováno.'); }
    finally { setBusy(false); }
  }

  async function applyBatchChanges(changes: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/election-removal/points/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pointIds: selected, changes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Změna selhala.');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Změna selhala.');
    } finally {
      setBusy(false);
    }
  }

  const filteredPoints = points.filter(p => (filter === 'ALL' || category(p) === filter) && `${p.label} ${p.description}`.toLocaleLowerCase('cs').includes(search.toLocaleLowerCase('cs')));
  const input = 'block w-full rounded-lg border border-slate-300 p-2 text-sm';
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Práce v akci</h2>
        <p className="text-sm text-slate-500">Zadejte nebo hromadně upravte body, a naplánujte trasu výjezdu s AI.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-xl border border-sky-600 bg-white px-4 py-2 text-sm font-bold text-sky-700 hover:bg-sky-50 transition shadow-2xs"
          onClick={() => editPoint(null)}
        >
          + Přidat práci
        </button>
        {points.some((p) => !p.reviewRequired && p.status !== 'COMPLETED') && (
          <Link
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition"
            href={`/election-removal/${campaignId}/plan${selected.length ? '?points=' + selected.join(',') : ''}`}
            title="Spustit AI optimalizaci trasy"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>⚡ Naplánovat trasu (AI){selected.length ? ` (${selected.length})` : ''}</span>
          </Link>
        )}
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 font-medium text-xs">{error}</p>}
    {points.length > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200/80 p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <input
            aria-label="Hledat práci"
            className={input + ' sm:max-w-xs bg-white shadow-2xs'}
            placeholder="Hledat místo nebo práci…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(25);
            }}
          />
          <select
            aria-label="Stav práce"
            className={input + ' sm:max-w-xs bg-white shadow-2xs'}
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setVisibleCount(25);
            }}
          >
            {Object.entries(groups).map(([key, label]) => (
              <option key={key} value={key}>
                {label} ({key === 'ALL' ? points.length : points.filter((p) => category(p) === key).length})
              </option>
            ))}
          </select>
        </div>

        {/* Global Select All / Clear Selection */}
        <div className="flex items-center gap-2">
          {selected.length === filteredPoints.length && filteredPoints.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 bg-white shadow-2xs transition"
            >
              <Square className="w-3.5 h-3.5 text-slate-400" />
              <span>Zrušit výběr ({selected.length})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSelected(filteredPoints.map((p) => p.id))}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900 px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 shadow-2xs transition"
            >
              <CheckSquare className="w-3.5 h-3.5 text-sky-600" />
              <span>Označit všechny body ({filteredPoints.length})</span>
            </button>
          )}
        </div>
      </div>
    )}
    {selected.length > 0 && (
      <div className="rounded-2xl border border-sky-300 bg-sky-50/70 p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-black text-sm text-slate-900">
              Vybráno {selected.length} {selected.length === 1 ? 'bod' : selected.length < 5 ? 'body' : 'bodů'}:
            </span>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Zrušit výběr
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick 1-click batch actions */}
            <button
              type="button"
              disabled={busy}
              onClick={() => applyBatchChanges({ operationType: 'INSTALL_AD' })}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
              title="Nastavit všem vybraným bodům montáž/instalaci"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>🛠️ Nastavit Instalaci</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => applyBatchChanges({ operationType: 'REMOVE_AD' })}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
              title="Nastavit všem vybraným bodům demontáž/odstranění"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>🗑️ Nastavit Deinstalaci</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => applyBatchChanges({ operationType: 'RELOCATION' })}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
              title="Nastavit všem vybraným bodům přesun"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>🚚 Nastavit Přesun</span>
            </button>

            {/* Manual completion / reset buttons */}
            <button
              type="button"
              disabled={busy}
              onClick={() => markPointStatus(selected, 'COMPLETED')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition"
              title="Označit vybrané body jako hotové přímo z PC"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>✅ Označit hotovo ({selected.length})</span>
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => markPointStatus(selected, 'PENDING')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
              title="Vrátit vybrané body zpět k rozpracování"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>↩ Vrátit k rozpracování</span>
            </button>

            <Link
              href={`/election-removal/${campaignId}/plan?points=${selected.join(',')}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-sm transition"
              title="Otevřít AI plánovač tras přímo pro tyto vybrané body"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>⚡ Naplánovat trasu (AI)</span>
            </Link>
          </div>
        </div>

        {/* Collapsible custom bulk changes */}
        <details className="text-xs pt-2 border-t border-sky-200">
          <summary className="cursor-pointer font-bold text-sky-800 hover:text-sky-950">
            Další hromadné změny (typ nosiče, termín, instrukce pro montéry...)
          </summary>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const changes = Object.fromEntries(
                [...f.entries()].filter(([, v]) => v !== '')
              );
              await applyBatchChanges(changes);
            }}
          >
            <label className="text-[11px] font-bold text-slate-700">
              Přesný typ operace
              <select name="operationType" className={input + ' mt-1 bg-white'}>
                <option value="">Beze změny</option>
                {Object.entries(operations).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-700">
              Typ objektu
              <select name="mediaType" className={input + ' mt-1 bg-white'}>
                <option value="">Beze změny</option>
                {Object.entries(ELECTION_REMOVAL_MEDIA_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold text-slate-700">
              Termín
              <input type="date" name="deadlineAt" className={input + ' mt-1 bg-white'} />
            </label>
            <label className="flex-1 min-w-[200px] text-[11px] font-bold text-slate-700">
              Společné instrukce pro montéry
              <input name="description" placeholder="Např. Výlep plakátů A1, nutné žebříky" className={input + ' mt-1 bg-white'} />
            </label>
            <button disabled={busy} className="rounded-xl bg-slate-900 text-white font-bold px-4 py-2 text-xs hover:bg-slate-800 transition">
              {busy ? 'Ukládám…' : 'Použít změny'}
            </button>
          </form>
        </details>
      </div>
    )}
    {formOpen && <form ref={formRef} key={formKey} onSubmit={save} className="space-y-4 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{edit ? 'Upravit práci' : 'Nová práce'}</h2>
      <div className="flex gap-2" role="group" aria-label="Odkud vybrat objekt">{([['MAP','Místo v mapě'],['CARRIER','Nosič z databáze']] as const).map(([key,label]) => <button key={key} type="button" aria-pressed={source === key} className={`rounded-lg border px-3 py-2 text-sm ${source === key ? 'border-sky-700 bg-sky-50 text-sky-800' : ''}`} onClick={() => setSource(key)}>{label}</button>)}</div>
      <div hidden={source !== 'CARRIER'}>
      <label className="block">Vyhledat existující nosič<input className={input} placeholder="Název nebo kód" onChange={async e => { try { const r = await fetch('/api/election-removal/tasks?q=' + encodeURIComponent(e.target.value)); if (r.ok) setCarriers((await r.json()).carriers); } catch { setError('Vyhledání nosičů selhalo.'); } }} /></label>
      <div className="flex flex-wrap gap-2">{carriers.map(c => <button type="button" key={c.id} className="rounded border p-2 text-sm" onClick={() => { setCarrier(c); setCarriers([]); const label = formRef.current?.elements.namedItem('label') as HTMLInputElement | null; if (label && !label.value) label.value = c.name; if (c.latitude != null && c.longitude != null) setGps({ latitude: c.latitude, longitude: c.longitude }); }}>{c.name}</button>)}</div>
      {carrier && <label>Plocha<select className={input} name="surfaceId"><option value="">Celý objekt</option>{carrier.surfaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      </div>
      <input type="hidden" name="layerName" defaultValue={edit?.layerName ?? ''} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Název místa / objektu<input className={input} required name="label" defaultValue={edit?.label ?? ''} /></label>
        <label>Typ objektu<select name="mediaType" className={input} defaultValue={edit?.mediaType ?? 'OTHER'}>{Object.entries(ELECTION_REMOVAL_MEDIA_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Co se má udělat
          <select
            className={input}
            name="operationType"
            defaultValue={edit?.operationType ?? 'INSPECTION'}
            onChange={e => {
              if (e.target.value === 'RELOCATION') { setDisposition('TRANSFER'); setTransport(true); }
              else if (e.target.value.startsWith('INSTALL')) { setDisposition('LEAVE'); setTransport(false); }
              else if (e.target.value.startsWith('REMOVE')) { setDisposition('WAREHOUSE'); setTransport(false); }
            }}
          >
            <optgroup label="🛠️ Instalace a montáže">
              <option value="INSTALL_AD">Instalace reklamního materiálu</option>
              <option value="INSTALL_OBJECT">Instalace konstrukce / objektu</option>
              <option value="REPLACE_AD">Výměna reklamního materiálu</option>
            </optgroup>
            <optgroup label="🗑️ Deinstalace a demontáže">
              <option value="REMOVE_AD">Odstranění reklamního materiálu</option>
              <option value="REMOVE_OBJECT">Demontáž konstrukce / objektu</option>
            </optgroup>
            <optgroup label="🚚 Převozy a přesuny">
              <option value="RELOCATION">Přesun na jiné místo / sklad</option>
            </optgroup>
            <optgroup label="🔍 Ostatní operace">
              <option value="REPAIR">Oprava</option>
              <option value="INSPECTION">Kontrola</option>
              <option value="OTHER">Jiná práce</option>
            </optgroup>
          </select>
        </label>
        <label>Množství<input className={input} name="quantity" type="number" min="1" required defaultValue={edit?.quantity ?? 1} /></label>
      </div>
      <label className="block">Přesný pokyn<textarea className={input} name="description" required defaultValue={edit?.description ?? ''} /></label>
      <LocationPickerMap latitude={gps?.latitude} longitude={gps?.longitude} onChange={setGps} />
      <p>{gps ? `${gps.latitude}, ${gps.longitude}` : 'Klikněte do mapy nebo vyhledejte adresu.'}</p>
      <label className="flex gap-2"><input name="gpsConfirmed" type="checkbox" required defaultChecked={Boolean(edit || gps)} />Potvrzuji GPS místa práce / vyzvednutí</label>
      <label className="block">Nakládání s materiálem<select className={input} name="materialDisposition" value={disposition} onChange={e => { setDisposition(e.target.value); setTransport(['WAREHOUSE','TRANSFER','CLIENT'].includes(e.target.value)); }}>{Object.entries(dispositions).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="block">Co vzít s sebou / co odvézt / co ponechat<textarea className={input} name="materialInstructions" defaultValue={edit?.materialInstructions ?? ''} /></label>
      {transport && <div className="space-y-3 rounded border p-3">
        <label>Cíl / sklad<input className={input} name="destinationName" required defaultValue={edit?.destinationName ?? ''} /></label>
        <LocationPickerMap latitude={destination?.latitude} longitude={destination?.longitude} onChange={setDestination} pinLabel="Cíl převozu" />
        <label className="flex gap-2"><input type="checkbox" name="destinationGpsConfirmed" required />Potvrzuji cílovou GPS</label>
        <label>Vykládka a práce v cíli celkem (min)<input className={input} name="deliveryMinutes" type="number" min="1" defaultValue={edit?.steps[1]?.serviceMinutes ?? 10} /></label>
      </div>}
      <div hidden={!transport} className="rounded-lg bg-slate-50 p-3"><label>Velikost nákladu (kapacitní jednotky)<input className={input} name="loadSlots" type="number" min="0" required defaultValue={edit?.loadSlots ?? 0} /></label><p className="mt-1 text-xs text-slate-500">Kapacita pro celý náklad: áčko 1, mini tower 6, tower 30 jednotek. U jiného objektu zadejte nárok podle vozidla.</p></div>
      <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">Další údaje: čas, kontakt, podklady a vybavení</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>Upřesnění objektu (nepovinné)<input className={input} name="objectType" defaultValue={edit?.objectType ?? ''} /></label>
        <label>Termín práce<input className={input} name="deadlineAt" type="date" defaultValue={edit?.deadlineAt ? new Date(edit.deadlineAt).toISOString().slice(0,10) : ''} /></label>
        <label>Odhad práce (min)<input className={input} name="serviceMinutes" type="number" min="1" placeholder="Automaticky podle operace, objektu a množství" defaultValue={edit?.serviceMinutes ?? ''} /></label>
{(['windowStart', 'windowEnd'] as const).map(key => <label key={key}>{key === 'windowStart' ? 'Přístup od (místní čas)' : 'Dokončit do (místní čas)'}<input className={input} type="datetime-local" name={key} defaultValue={edit?.[key] ? new Date(new Date(edit[key]!).getTime() - new Date(edit[key]!).getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''} /></label>)}

        <label>Počet pracovníků<input className={input} name="requiredWorkers" type="number" min="1" defaultValue={edit?.requiredWorkers ?? 1} /></label>
        <label>Vybavení vozidla (oddělit čárkou)<input className={input} name="requiredEquipment" defaultValue={edit?.requiredEquipment.join(', ') ?? ''} /></label>
        <label>Dovednosti / pozice (oddělit čárkou)<input className={input} name="requiredPositions" defaultValue={edit?.requiredPositions.join(', ') ?? ''} /></label>
        <label>Kontakt<input className={input} name="contact" defaultValue={edit?.contact ?? ''} /></label>
        <label>Přístupové informace<input className={input} name="accessInstructions" defaultValue={edit?.accessInstructions ?? ''} /></label>
        <label>Fotografie / montážní podklad (URL)<input className={input} type="url" name="referenceUrl" defaultValue={edit?.referenceUrl ?? ''} /></label>
      </div>
      </details>
      <button disabled={busy} className="rounded-lg bg-sky-700 px-4 py-3 text-white">{busy ? 'Ukládám…' : 'Uložit práci'}</button>
      <button type="button" disabled={busy} className="ml-4 text-sm underline" onClick={() => setFormOpen(false)}>Zrušit</button>
    </form>}
    <div className="space-y-2">{filteredPoints.slice(0,visibleCount).map(p => <article key={p.id} className="rounded-xl border bg-white p-4">
      <div className="flex gap-3 items-center flex-wrap"><input aria-label={`Vybrat ${p.label}`} type="checkbox" checked={selected.includes(p.id)} onChange={e => setSelected(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} />
        <div className="flex flex-wrap items-center gap-2">
          <strong>{p.label} · {p.quantity} ks · {p.operationType && operations[p.operationType as keyof typeof operations] || 'Vyžaduje kontrolu'}</strong>
          {p.layerName && !isGenericLayerName(p.layerName) && (
            <span className="rounded-md bg-sky-50 text-sky-800 px-2 py-0.5 text-xs font-bold border border-sky-200 shadow-2xs">
              🎯 {cleanLayerName(p.layerName)}
            </span>
          )}
        </div>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-1 text-xs">{groups[category(p)]}</span>
        {!p.startedAt && !p.steps.some(s => s.startedAt || s.completedQuantity > 0) && p.status !== 'COMPLETED' && (
          <button type="button" className="text-sm underline text-sky-700 font-medium" onClick={() => editPoint(p)}>Upravit</button>
        )}
        <button type="button" className="text-sm underline text-slate-500 hover:text-sky-700" onClick={() => duplicatePoint(p)}>Duplikovat</button>
        {p.status === 'COMPLETED' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => markPointStatus([p.id], 'PENDING')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline inline-flex items-center gap-1"
            title="Vrátit bod k rozpracování"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Vrátit</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => markPointStatus([p.id], 'COMPLETED')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg px-2 py-0.5 inline-flex items-center gap-1 shadow-2xs transition"
            title="Označit bod jako hotový přímo z PC"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Hotovo</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-sm">{p.description} {p.materialInstructions}</p>
      {p.photos && p.photos.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          {p.photos.slice(0, 5).map(photo => (
            <a
              key={photo.id}
              href={`/api/photos/${encodeURIComponent(photo.id)}/file`}
              target="_blank"
              rel="noreferrer"
              className="block w-12 h-12 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition relative shadow-xs"
              title="Zobrazit fotografii v plném rozlišení"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${encodeURIComponent(photo.id)}/file`} alt="Foto" loading="lazy" className="w-full h-full object-cover" />
            </a>
          ))}
          {p.photos.length > 5 && (
            <span className="text-xs text-slate-500 font-medium">+{p.photos.length - 5} dalších</span>
          )}
        </div>
      )}
      {p.steps.map(s => <p className="text-sm text-slate-600" key={s.id}>{s.sequence}. {s.label}: {s.completedQuantity}/{s.quantity} · {({ PENDING: 'Čeká', ASSIGNED: 'Naplánováno', IN_PROGRESS: 'Probíhá', ISSUE: 'Problém', COMPLETED: 'Hotovo', CANCELLED: 'Zrušeno' } as Record<string,string>)[s.status] ?? s.status}{s.custodyNote ? ` · ${s.custodyNote}` : ''}{s.issueNote ? ` · ${s.issueNote}` : ''}</p>)}
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
    {points.length > 0 && filteredPoints.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-slate-500">Žádná práce neodpovídá hledání.</p>}
    {filteredPoints.length > visibleCount && <button className="rounded-lg border px-4 py-2 text-sm" onClick={() => setVisibleCount(n => n + 25)}>Zobrazit dalších {Math.min(25,filteredPoints.length-visibleCount)} prací ({filteredPoints.length-visibleCount} zbývá)</button>}

  </section>;
}
