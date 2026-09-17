'use client';
import { primaryButton, secondaryButton } from './styles';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlannerReadModel } from '@/lib/planner/read-model';
import type { PlannerItem } from '@/lib/planner/domain';
import { dayRange, plusDays } from '@/lib/planner/time';
import { overlaps } from '@/lib/planner/scheduling';
import { plannerRequest } from './api';
import { BlockEditor } from './BlockEditor';
import { Timeline } from './Timeline';
import { TeamAvailability } from './TeamAvailability';
import { WeekView } from './WeekView';
export function PlannerCockpit() {
  const [chosenDate, setDate] = useState('');
  const [view, setView] = useState('today'), [data, setData] = useState<PlannerReadModel | null>(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [editor, setEditor] = useState<{ block?: PlannerItem; startAt?: string } | null>(null);
  const date = chosenDate || data?.date || '';
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError('');
    try { const result = await plannerRequest<PlannerReadModel>(`?date=${chosenDate}&view=${view}`); if (request === generation.current) setData(result); }
    catch (e) { if (request === generation.current) setError(e instanceof Error ? e.message : 'Plán se nepodařilo načíst.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [chosenDate, view]);
  useEffect(() => { void load(); }, [load]);
  const forDay = (d: string) => { if (!data) return []; const range = dayRange(d, data.preferences.timezone); return data.items.filter(i => overlaps(i, { startAt: range.start.toISOString(), endAt: range.end.toISOString() })); };
  const next = data?.items.find(i => i.source !== 'ABSENCE' && Date.parse(i.endAt) > Date.now());
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Čas pro to důležité</p><h1 className="mt-1 text-3xl font-black text-slate-950">Planner</h1><p className="mt-1 text-sm text-slate-500">Váš den, priority a prostor pro soustředěnou práci.</p></div><div className="flex gap-2"><Link href="/settings/planner" className={secondaryButton}>Nastavení</Link><button onClick={() => setEditor({})} disabled={!data} className={primaryButton}>+ Pracovní blok</button></div></header>
    <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Pohled Planneru" className="flex gap-1 rounded-xl bg-slate-100 p-1">{[['today', 'Dnes'], ['week', 'Týden'], ...(data?.canSeeTeam ? [['team', 'Tým']] : [])].map(([id, label]) => <button key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)} className={`rounded-lg px-5 py-2 text-sm font-bold ${view === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}</nav><div className="flex items-center gap-2"><button disabled={!date} aria-label="Předchozí den" onClick={() => setDate(plusDays(date, view === 'today' ? -1 : -7))} className={secondaryButton}>←</button><input aria-label="Datum plánu" type="date" value={date} onChange={e => { if (e.target.value) setDate(e.target.value); }} className="min-w-0 rounded-xl border p-2 text-sm" /><button disabled={!date} aria-label="Další den" onClick={() => setDate(plusDays(date, view === 'today' ? 1 : 7))} className={secondaryButton}>→</button></div></div>
    {error && <div role="alert" className="card border-amber-200 bg-amber-50"><p>{error}</p><button onClick={load} className="mt-2 font-bold">Zkusit znovu</button></div>}
    {loading && <div role="status" className="card animate-pulse text-slate-500">Načítám váš plán…</div>}
    {data && !loading && !error && <>
      <section className="grid gap-3 sm:grid-cols-3"><div className="card-dark"><p className="text-xs text-slate-300">Volná evidovaná kapacita dnes</p><p className="mt-2 text-3xl font-bold">{Math.round(data.capacity.freeMinutes / 60 * 10) / 10} <span className="text-base">h</span></p></div><div className="card"><p className="text-xs text-slate-500">Další událost v zobrazeném plánu</p><p className="mt-2 break-words font-bold">{next?.title || 'Žádná další událost'}</p></div><div className="card"><p className="text-xs text-slate-500">Vyžaduje pozornost</p><p className="mt-2 text-3xl font-bold">{data.attention.length}</p></div></section>
      {!data.connections.length && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">Google Calendar není připojený. <Link className="font-bold underline" href="/settings/planner">Připojit svůj kalendář</Link>. Interní plán můžete používat už teď.</p>}
      {data.connections.some(c => c.status !== 'CONNECTED' || c.syncStatus === 'ERROR' || !c.lastSyncAt || Date.now() - +new Date(c.lastSyncAt) > 86400000) && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Kalendář potřebuje synchronizaci nebo opětovné připojení. Dostupnost nemusí být úplná. <Link href="/settings/planner" className="underline">Zkontrolovat</Link></p>}
      {view === 'team' ? <TeamAvailability data={data} /> : view === 'week' ? <WeekView date={date} timezone={data.preferences.timezone} items={data.items} tasks={data.tasks} onEdit={block => setEditor({ block })} /> : <div className="grid items-start gap-5 lg:grid-cols-3">
        <section className="card"><h2 className="mb-4 text-lg font-bold">Dnešní plán</h2><Timeline items={forDay(date)} timezone={data.preferences.timezone} onEdit={block => setEditor({ block })} /></section>
        <section className="space-y-5"><div className="card"><h2 className="mb-4 text-lg font-bold">Priority</h2>{!data.tasks.length && <p className="text-sm text-slate-500">Žádné otevřené úkoly. Vyhraďte si prostor na další práci.</p>}<ol className="space-y-3">{data.tasks.slice(0, 5).map((t, i) => <li key={`${t.sourceKind}:${t.id}`} className="flex gap-3 border-b border-slate-100 pb-3"><span className="font-bold text-slate-400">{i + 1}.</span><div><Link className="font-semibold hover:underline" href={t.href}>{t.title}</Link><p className="mt-1 text-xs text-slate-500">{t.dueAt ? new Date(t.dueAt).toLocaleDateString('cs-CZ', { timeZone: data.preferences.timezone }) : 'Bez termínu'} · {t.sourceKind === 'CRM_TASK' ? 'CRM' : 'Úkoly'}</p></div></li>)}</ol><Link href="/my-tasks" className="mt-3 inline-block text-sm font-bold text-emerald-800">Otevřít úkoly →</Link></div><div className="card"><h2 className="font-bold">Prostor na soustředění</h2>{data.slots.length ? data.slots.map(s => <button key={s.startAt} onClick={() => setEditor({ startAt: s.startAt })} className="mt-3 block w-full rounded-xl bg-emerald-50 p-3 text-left text-sm font-semibold text-emerald-900">{new Date(s.startAt).toLocaleTimeString('cs-CZ', { timeZone: data.preferences.timezone, hour: '2-digit', minute: '2-digit' })} · 60 minut →</button>) : <p className="mt-2 text-sm text-slate-500">Ve zvoleném dni už není volný hodinový focus blok v preferovaném čase.</p>}</div></section>
        <aside className="card"><h2 className="mb-4 text-lg font-bold">Co potřebuje pozornost</h2>{data.attention.length ? data.attention.map((a, i) => <Link key={i} href={a.href} className="mb-3 block rounded-xl bg-amber-50 p-3"><p className="text-xs font-bold text-amber-800">{a.reason}</p><p className="mt-1 text-sm font-semibold">{a.title}</p></Link>) : <p className="text-sm text-slate-500">V dostupných datech nejsou blížící se termíny ani časové kolize.</p>}<p className="mt-5 border-t pt-4 text-xs text-slate-500">AI doporučení připravujeme. Tento přehled vychází z termínů a evidovaného plánu.</p></aside>
      </div>}
    </>}
    {editor && data && <BlockEditor date={date} timezone={data.preferences.timezone} workingStart={data.preferences.workingStart} tasks={data.tasks} block={editor.block} startAt={editor.startAt} onClose={() => setEditor(null)} onSaved={load} />}
  </div>;
}
