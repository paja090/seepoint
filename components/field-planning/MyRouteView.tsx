'use client';
import Link from 'next/link';
import { useState } from 'react';
import { fieldProblemTypes, type MyRouteDTO, type MyRouteCarrier } from '@/lib/field-planning/contracts';
import { CarrierPhotoUploadModal } from '@/components/carriers/CarrierPhotoUploadModal';
import {
  Navigation,
  MapPin,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Car,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const MyRouteMap = dynamic(() => import('@/components/field-planning/MyRouteMap').then(m => m.MyRouteMap), { ssr: false });

export function MyRouteView({ initial }: { initial: MyRouteDTO }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoCarrier, setPhotoCarrier] = useState<MyRouteCarrier>(null);
  const [activePhotoModalStopId, setActivePhotoModalStopId] = useState<string | null>(null);
  const [activeProblemModalStopId, setActiveProblemModalStopId] = useState<string | null>(null);

  async function run(planId: string, workOrderId: string, action: string, form?: FormData, jobId?: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/work/route/mine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          workOrderId,
          jobId,
          action,
          problemType: form?.get('type'),
          note: form?.get('note'),
          requestKey: form?.get('key'),
        }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setActiveProblemModalStopId(null);
      const refreshed = await fetch('/api/work/route/mine');
      if (refreshed.ok) setData(await refreshed.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operace selhala.');
    } finally {
      setBusy(false);
    }
  }

  async function upload(planId: string, workOrderId: string, jobId: string, form: FormData) {
    setBusy(true);
    setError('');
    form.set('planId', planId);
    form.set('workOrderId', workOrderId);
    form.set('jobId', jobId);
    try {
      const response = await fetch('/api/work/route/mine/photo', { method: 'POST', body: form });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setActivePhotoModalStopId(null);
      const refreshed = await fetch('/api/work/route/mine');
      if (refreshed.ok) setData(await refreshed.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nahrání fotografie selhalo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* Top Header */}
      <header className="space-y-2">
        <Link
          href="/my-tasks"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:underline"
        >
          <ArrowLeft size={14} />
          <span>Zpět na Moje úkoly</span>
        </Link>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 flex items-center gap-2.5">
          <Navigation className="text-sky-600" size={28} />
          <span>Moje dnešní trasa</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Váš dnešní plán montáží a výjezdů v terénu seřazený podle zastávek.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {/* No routes banner */}
      {!data.routes.length && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center space-y-2">
          <CheckCircle2 size={36} className="mx-auto text-slate-300" />
          <h2 className="font-bold text-sm text-slate-700">Na dnešek nemáte naplánovanou žádnou trasu</h2>
          <p className="text-xs text-slate-500">
            Jakmile dispečer schválí trasu pro vaši posádku, uvidíte zde zastávky s navigací.
          </p>
        </div>
      )}

      {/* Route Cards */}
      {data.routes.map((route) => {
        const doneCount = route.stops.filter((s) => s.status === 'DONE').length;
        const issueCount = route.stops.filter((s) => s.status === 'ISSUE').length;
        const totalCount = route.stops.length;

        return (
          <section key={route.planId} className="space-y-4">
            {/* Route summary bar */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <Car size={15} className="text-sky-600" />
                <span>{route.vehicleName ?? 'Výjezd bez vozidla'}</span>
              </div>
              <div className="flex items-center gap-2">
                {issueCount > 0 && (
                  <span className="rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-700 shadow-sm flex items-center gap-1">
                    <AlertTriangle size={12} className="text-rose-600" />
                    <span>{issueCount} {issueCount === 1 ? 'problém' : issueCount < 5 ? 'problémy' : 'problémů'}</span>
                  </span>
                )}
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] shadow-sm font-extrabold text-slate-800">
                  {doneCount} / {totalCount} hotovo
                </span>
              </div>
            </div>

            {/* LIVE MAP */}
            <MyRouteMap route={route} height="h-[280px]" />

            {/* Google Maps Full Route */}
            {(() => {
              const points = route.stops.map(s => s.location).filter((loc): loc is { latitude: number; longitude: number } => Boolean(loc));
              if (points.length < 2) return null;
              const origin = `${points[0].latitude},${points[0].longitude}`;
              const dest = `${points[points.length - 1].latitude},${points[points.length - 1].longitude}`;
              const waypoints = points.slice(1, -1).map(p => `${p.latitude},${p.longitude}`).join('|');
              const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? `&waypoints=${waypoints}` : ''}`;
              
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-100 mt-2 border border-indigo-200/50"
                >
                  <MapPin size={16} />
                  <span>Zobrazit celou trasu na mapě</span>
                </a>
              );
            })()}

            {/* Stops list */}
            {route.stops.map((s, i) => {
              const isDone = s.status === 'DONE';
              const isInProgress = s.status === 'IN_PROGRESS';
              const isIssue = s.status === 'ISSUE';
              const timeString = new Date(s.startAt).toLocaleTimeString('cs-CZ', {
                timeZone: data.timezone,
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <article
                  id={`stop-${s.jobId}`}
                  key={s.jobId}
                  className={`rounded-3xl border p-5 shadow-sm space-y-3 transition ${
                    isDone
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : isIssue
                      ? 'border-rose-300 bg-rose-50/30 ring-2 ring-rose-500/20'
                      : isInProgress
                      ? 'border-sky-300 bg-sky-50/30 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* Stop header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${
                          isDone
                            ? 'bg-emerald-600 text-white'
                            : isIssue
                            ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/50'
                            : isInProgress
                            ? 'bg-sky-600 text-white animate-pulse'
                            : 'bg-slate-900 text-white'
                        }`}
                      >
                        {isDone ? '✓' : isIssue ? '!' : i + 1}
                      </div>

                      <div>
                        <h2 className={`font-extrabold text-sm sm:text-base leading-tight ${isIssue ? 'text-rose-950' : 'text-slate-950'}`}>
                          {s.title}
                        </h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {s.clientName} · {s.carrier?.code ? `Nosič ${s.carrier.code}` : s.workType}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isIssue && (
                        <span className="text-[11px] font-black text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-xl flex items-center gap-1 shadow-xs">
                          <AlertTriangle size={12} />
                          <span>Hlášen problém</span>
                        </span>
                      )}
                      <span className="text-xs font-bold text-sky-800 bg-sky-100/80 px-2.5 py-1 rounded-xl">
                        {timeString}
                      </span>
                    </div>
                  </div>

                  {/* Address */}
                  <p className="text-xs text-slate-700 font-semibold flex items-center gap-1.5 pl-1">
                    <MapPin size={14} className="text-sky-600 shrink-0" />
                    <span>{s.address ?? s.carrier?.address ?? s.carrier?.city}</span>
                  </p>

                  {/* Instructions */}
                  {s.instructions && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
                      <span className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                        Instrukce k montáži:
                      </span>
                      <p className="whitespace-pre-wrap">{s.instructions}</p>
                    </div>
                  )}

                  {/* Issue details box */}
                  {(isIssue || s.issueType || s.issueNote) && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-800 uppercase tracking-wider text-[10px]">
                        <AlertTriangle size={13} className="text-rose-600" />
                        <span>{s.issueType || 'Hlášený problém na místě'}</span>
                      </div>
                      {s.issueNote && (
                        <p className="whitespace-pre-wrap text-rose-800 font-medium pl-4">{s.issueNote}</p>
                      )}
                    </div>
                  )}

                  {/* Primary Action Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* Navigate Button */}
                    {s.location && (
                      <a
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-sky-600 transition"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${s.location.latitude},${s.location.longitude}`}
                      >
                        <Navigation size={14} />
                        <span>Navigovat 🗺️</span>
                      </a>
                    )}

                    {/* Start / Finish Button */}
                    {!isDone && s.status !== 'CANCELLED' && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(route.planId, s.workOrderId, isInProgress ? 'complete' : 'start', undefined, s.jobId)
                        }
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-2xl px-4 py-3 text-xs font-bold transition shadow-sm ${
                          isInProgress
                            ? 'bg-emerald-700 text-white hover:bg-emerald-600'
                            : isIssue
                            ? 'border border-rose-300 bg-white text-rose-800 hover:bg-rose-50'
                            : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Clock size={14} />
                        <span>{isInProgress ? 'Označit za hotové ✓' : isIssue ? 'Zkusit znovu / Zahájit' : 'Zahájit práci'}</span>
                      </button>
                    )}

                    {/* Upload Photo Button */}
                    {(s.navigationPointId || s.workOrderItemId) && !isDone && (
                      <button
                        type="button"
                        onClick={() =>
                          setActivePhotoModalStopId(activePhotoModalStopId === s.jobId ? null : s.jobId)
                        }
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                      >
                        <Camera size={14} className="text-sky-600" />
                        <span>Doklad / Fotka 📸</span>
                      </button>
                    )}

                    {/* Report Problem Button */}
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveProblemModalStopId(activeProblemModalStopId === s.jobId ? null : s.jobId)
                        }
                        className={`flex items-center justify-center gap-1 rounded-2xl px-3 py-3 text-xs font-bold transition ml-auto ${
                          isIssue ? 'text-rose-700 bg-rose-100 hover:bg-rose-200 border border-rose-200' : 'text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        <AlertTriangle size={14} />
                        <span>{isIssue ? 'Upravit problém' : 'Problém?'}</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Photo Upload Drawer */}
                  {activePhotoModalStopId === s.jobId && (
                    <form
                      action={(form) => upload(route.planId, s.workOrderId, s.jobId, form)}
                      className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-3 mt-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-1.5">
                          <Camera size={14} />
                          <span>Vyfotit doklad a dokončit montáž</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setActivePhotoModalStopId(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Zavřít
                        </button>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block">Fotografie hotové práce (povinné)</label>
                        <input
                          type="file"
                          name="afterPhoto"
                          accept="image/*"
                          capture="environment"
                          required
                          className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-sky-700 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-sky-600"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block">Poznámka (volitelné)</label>
                        <input
                          type="text"
                          name="note"
                          placeholder="Např. vylepeno v pořádku, osvětlení funkční"
                          className="input mt-1 w-full text-xs font-medium"
                        />
                      </div>

                      <button
                        disabled={busy}
                        className="w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-600 transition"
                      >
                        {busy ? 'Ukládám…' : 'Odeslat fotku a dokončit zastávku ✓'}
                      </button>
                    </form>
                  )}

                  {/* Inline Problem Report Drawer */}
                  {activeProblemModalStopId === s.jobId && (
                    <form
                      action={(form) => run(route.planId, s.workOrderId, 'problem', form, s.jobId)}
                      className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3 mt-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                          <AlertTriangle size={14} />
                          <span>{isIssue ? 'Upravit zádrhel na místě' : 'Nahlásit zádrhel na místě'}</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setActiveProblemModalStopId(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          Zavřít
                        </button>
                      </div>

                      <input type="hidden" name="key" value={`${route.planId}-${s.jobId}-${s.status}`} />

                      <div>
                        <label className="text-xs font-bold text-slate-700 block">Důvod zádrhelu</label>
                        <select name="type" defaultValue={s.issueType ?? fieldProblemTypes[0]} className="input mt-1 w-full text-xs font-semibold">
                          {fieldProblemTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block">Co přesně se stalo?</label>
                        <textarea
                          name="note"
                          rows={2}
                          required
                          defaultValue={s.issueNote ?? ''}
                          placeholder="Popište situaci pro dispečera…"
                          className="input mt-1 w-full text-xs font-medium"
                        />
                      </div>

                      <button
                        disabled={busy}
                        className={`w-full rounded-xl py-2.5 text-xs font-bold text-white shadow-sm transition ${
                          isIssue ? 'bg-rose-700 hover:bg-rose-600' : 'bg-amber-700 hover:bg-amber-600'
                        }`}
                      >
                        {busy ? 'Odesílám…' : isIssue ? 'Aktualizovat upozornění dispečerovi ⚠️' : 'Odeslat upozornění dispečerovi ⚠️'}
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}

      {photoCarrier && (
        <CarrierPhotoUploadModal
          isOpen
          onClose={() => setPhotoCarrier(null)}
          preselectedCarrierId={photoCarrier.id}
          carriers={[{
            id: photoCarrier.id,
            name: photoCarrier.name,
            code: photoCarrier.code ?? '',
            city: photoCarrier.city ?? '',
          }]}
          onSuccess={() => setPhotoCarrier(null)}
        />
      )}
    </div>
  );
}
