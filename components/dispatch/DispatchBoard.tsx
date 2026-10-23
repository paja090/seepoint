'use client';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, CheckCheck, ChevronLeft, ChevronRight, ClipboardList, MapPin, Plus, RefreshCw, Search, SlidersHorizontal, Truck, Users } from 'lucide-react';
import { dispatchPlanningLinks, type DispatchItem, type DispatchPlan } from '@/lib/dispatch/queue';
import { dispatchCrews, dispatchMapResult, dispatchPlanHref, dispatchStatus, dispatchTimeline, type DispatchProgress } from '@/lib/dispatch/presentation';
import type { Coordinates } from '@/lib/field-planning/contracts';
import { plusDays } from '@/lib/planner/time';
import { RouteMap } from '@/components/field-planning/RouteMap';
import { WeekView } from '@/components/planner/WeekView';
import { Timeline } from '@/components/planner/Timeline';
import { DispatchIntake } from './DispatchIntake';
import { DispatchDrawer } from './DispatchDrawer';

const labels = { ready: 'Čeká na plán', issue: 'Potřebuje řešit', planned: 'Ve výjezdu' };
const sourceLabels = { work: 'Zakázka', navigation: 'Navigace', field: 'Terénní práce' };
const badge = { ready: 'bg-sky-50 text-sky-800', issue: 'bg-amber-50 text-amber-900', planned: 'bg-emerald-50 text-emerald-800' };
const emptyProgress: DispatchProgress = {};
const noEdit = () => {};
const control = 'min-w-0 w-full min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700';
type View = 'day' | 'week' | 'map';
type Props = { items: DispatchItem[]; plans: DispatchPlan[]; date: string; today?: string; canCreate: boolean; messages: string[]; timezone?: string; depot?: Coordinates; view?: View; progress?: DispatchProgress };

export function DispatchBoard({ items, plans, date, today = date, canCreate, messages, timezone = 'Europe/Prague', depot, view = 'day', progress = emptyProgress }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(''), [state, setState] = useState('all'), [source, setSource] = useState('all');
  const [selected, setSelected] = useState<string[]>([]), [activeCrew, setActiveCrew] = useState('');
  const [panel, setPanel] = useState<{ type: 'work'; id: string } | { type: 'create' } | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const closePanel = useCallback(() => { setPanel(null); setIntakeBusy(false); }, []);
  const openWork = useCallback((id: string) => setPanel({ type: 'work', id }), []);
  const visible = useMemo(() => items.filter(item => (state === 'all' || item.state === state) && (source === 'all' || item.source === source) && [item.title, item.client, item.address, item.reason].join(' ').toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs'))), [items, state, source, query]);
  const groups = dispatchPlanningLinks(items.filter(item => selected.includes(item.id)), date);
  const dayPlans = useMemo(() => plans.filter(plan => plan.date === date), [plans, date]);
  const crews = useMemo(() => dispatchCrews(dayPlans), [dayPlans]);
  const mapResult = useMemo(() => dispatchMapResult(dayPlans), [dayPlans]);
  const points = useMemo(() => visible.flatMap(item => item.state !== 'planned' && item.location ? [{ id: item.id, title: item.title, location: item.location }] : []), [visible]);
  const timeline = useMemo(() => dispatchTimeline(plans), [plans]);
  const dayTimeline = dispatchTimeline(dayPlans.filter(plan => plan.status !== 'DRAFT'));
  const workers = new Map<string, { name: string; routeKeys: Set<string> }>();
  for (const row of crews.filter(row => row.plan.status !== 'DRAFT')) row.crew.employeeIds.forEach((id, index) => {
    const worker = workers.get(id) ?? { name: row.crew.names[index] || 'Pracovník', routeKeys: new Set<string>() };
    worker.routeKeys.add(row.key); workers.set(id, worker);
  });
  const knownProgress = crews.filter(row => row.plan.status !== 'DRAFT').map(row => progress[row.key]);
  const done = knownProgress.every(Boolean) && view !== 'week' ? knownProgress.reduce((sum, p) => sum + p.done, 0) : null;
  const detail = panel?.type === 'work' ? items.find(item => item.id === panel.id) : undefined;
  const selectDay = (next: string, nextView = view) => router.push('/work/dispatch?' + new URLSearchParams({ date: next, ...(nextView !== 'day' ? { view: nextView } : {}) }));
  const time = (value: string) => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('cs-CZ', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
  const readyVisible = visible.filter(item => item.state === 'ready');
  const allVisibleSelected = readyVisible.length > 0 && readyVisible.every(item => selected.includes(item.id));
  const toggleVisible = () => setSelected(old => allVisibleSelected ? old.filter(id => !readyVisible.some(item => item.id === id)) : [...new Set([...old, ...readyVisible.map(item => item.id)])]);

  return <div className="space-y-4 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">Provoz / Dispečink</p><h1 className="text-2xl font-bold tracking-tight">Dispečink práce</h1></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button type="button" aria-label="Předchozí období" onClick={() => selectDay(plusDays(date, view === 'week' ? -7 : -1))} className="grid size-9 place-items-center rounded-lg hover:bg-white"><ChevronLeft size={17}/></button>
          <label className="flex min-w-0 items-center gap-2 text-sm"><CalendarDays size={16} className="hidden text-slate-500 sm:block"/><span className="sr-only">Den výjezdu</span><input aria-label="Den výjezdu" type="date" value={date} onChange={event => { if (event.target.value) selectDay(event.target.value); }} className="min-w-0 bg-transparent py-2 text-sm font-semibold outline-offset-2"/></label>
          <button type="button" aria-label="Další období" onClick={() => selectDay(plusDays(date, view === 'week' ? 7 : 1))} className="grid size-9 place-items-center rounded-lg hover:bg-white"><ChevronRight size={17}/></button>
        </div>
        <nav aria-label="Pohled dispečinku" className="flex rounded-xl bg-slate-100 p-1">{([['day', 'Dnes'], ['week', 'Týden'], ['map', 'Mapa']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => selectDay(id === 'day' ? today : date, id)} className={'min-h-9 rounded-lg px-3 text-sm font-semibold ' + (view === id ? 'bg-white text-sky-800 shadow-sm' : 'text-slate-500 hover:text-slate-900')}>{label}</button>)}</nav>
        {canCreate && <button type="button" onClick={() => setPanel({ type: 'create' })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-800 px-4 text-sm font-bold text-white hover:bg-sky-900"><Plus size={17}/>Přidat práci</button>}
      </div>
    </header>
    {messages.map(message => <p role="alert" key={message} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{message} <Link href="/work/route" className="underline">Otevřít rozšířené plánování</Link></p>)}
    <section aria-label="Souhrn vybraného dne" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(['ready', 'issue', 'planned'] as const).map(key => <button type="button" aria-pressed={state === key} disabled={view === 'week'} onClick={() => setState(state === key ? 'all' : key)} key={key} className={'flex min-w-0 items-center justify-between gap-2 rounded-2xl border bg-white p-4 text-left transition ' + (state === key ? 'border-sky-600 ring-1 ring-sky-600' : 'border-slate-200 hover:border-slate-400')}>
        <div><p className="text-xs font-medium text-slate-500">{labels[key]}</p><p className="mt-1 text-2xl font-bold tabular-nums">{items.filter(item => item.state === key).length}<span className="ml-2 text-xs font-normal text-slate-400">prací</span></p></div><span className={'hidden rounded-xl p-2 sm:block ' + badge[key]}>{key === 'planned' ? <Truck size={19}/> : <ClipboardList size={19}/>}</span>
      </button>)}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4"><div><p className="text-xs font-medium text-slate-500">Dokončeno</p><p className="mt-1 text-2xl font-bold tabular-nums">{done ?? '—'}<span className="ml-2 text-xs font-normal text-slate-400">zastávek</span></p><p className="text-[10px] text-slate-500">{done === null ? 'Průběh ověřte v denním detailu' : 'Ve výjezdech vybraného dne'}</p></div><CheckCheck className="hidden text-emerald-600 sm:block" size={20}/></div>
    </section>
    {view === 'week' ? <section aria-label="Týdenní výjezdy" className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Výjezdy na 7 dní od {date}</h2><span className="text-xs text-slate-500">Časy z uložených plánů · změny v detailu výjezdu</span></div><WeekView date={date} timezone={timezone} items={timeline} tasks={[]} onEdit={noEdit}/></section> : <div className={'grid items-start gap-4 ' + (view === 'map' ? 'xl:grid-cols-[minmax(0,1fr)_280px]' : 'xl:grid-cols-[minmax(240px,0.95fr)_minmax(260px,1.45fr)_minmax(220px,0.8fr)]')}>
      {view !== 'map' && <section aria-labelledby="dispatch-queue-heading" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-100 p-4"><div className="flex items-center justify-between"><h2 id="dispatch-queue-heading" className="font-bold">Fronta práce <span className="ml-1 text-sm font-normal text-slate-400">{visible.length}</span></h2><button type="button" aria-label="Zrušit filtry" onClick={() => { setState('all'); setSource('all'); setQuery(''); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><SlidersHorizontal size={17}/></button></div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:ring-2 focus-within:ring-sky-700"><Search size={16} className="shrink-0 text-slate-400"/><input aria-label="Hledat práci" placeholder="Klient, místo, práce…" value={query} onChange={event => setQuery(event.target.value)} className="min-h-10 min-w-0 w-full bg-transparent text-sm outline-none"/></label>
          <div className="grid grid-cols-2 gap-2"><select aria-label="Stav práce" value={state} onChange={event => setState(event.target.value)} className={control}><option value="all">Všechny stavy</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="Zdroj práce" value={source} onChange={event => setSource(event.target.value)} className={control}><option value="all">Všechny práce</option>{Object.entries(sourceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <label className="flex min-h-8 items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={allVisibleSelected} disabled={!readyVisible.length} onChange={toggleVisible} className="size-4 accent-sky-800"/>Vybrat dostupné ({readyVisible.length})</label>
        </div>
        {groups.length > 0 && <div className="space-y-2 border-b border-sky-100 bg-sky-50 p-3" aria-live="polite"><div className="flex items-center justify-between text-xs"><strong>Vybráno {groups.reduce((sum, group) => sum + group.count, 0)} prací</strong><button type="button" onClick={() => setSelected([])} className="min-h-8 underline">Zrušit výběr</button></div>{groups.map(group => <Link key={group.key} href={group.url} className="flex min-h-10 items-center justify-between gap-2 rounded-xl bg-sky-800 px-3 py-2 text-xs font-bold text-white hover:bg-sky-900">Naplánovat: {group.label} ({group.count})<ArrowRight size={15}/></Link>)}{groups.length > 1 && <p className="text-xs text-sky-900">Výběr je rozdělen do menších návrhů. Každý ověří dostupnost posádek a vozidel.</p>}</div>}
        <div className="max-h-[560px] divide-y divide-slate-100 overflow-y-auto">{!visible.length && <p className="px-4 py-12 text-center text-sm text-slate-500">Tomuto výběru neodpovídá žádná práce.</p>}{visible.map(item => <article key={item.id} className={'flex gap-3 px-4 py-3 transition hover:bg-slate-50 ' + (selected.includes(item.id) ? 'bg-sky-50/50' : '')}>
          <input type="checkbox" aria-label={'Vybrat ' + item.title} disabled={item.state !== 'ready'} checked={selected.includes(item.id)} onChange={event => setSelected(old => event.target.checked ? [...old, item.id] : old.filter(id => id !== item.id))} className="mt-2 size-4 shrink-0 accent-sky-800"/>
          <button type="button" onClick={() => openWork(item.id)} className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-700"><div className="flex flex-wrap items-center justify-between gap-1"><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{sourceLabels[item.source]}</span><span className={'rounded-md px-2 py-1 text-[10px] font-medium ' + badge[item.state]}>{labels[item.state]}</span></div><h3 className="mt-1 break-words text-sm font-semibold">{item.title}</h3><p className="mt-1 break-words text-xs leading-5 text-slate-500">{[item.client, item.address, item.quantity + ' ks'].filter(Boolean).join(' · ')}</p>{item.reason && <p className="mt-1 line-clamp-2 text-xs text-amber-800">{item.reason}</p>}</button>
        </article>)}</div>
        <p className="border-t border-slate-100 p-3 text-[11px] leading-4 text-slate-400">Pro {date}, starší práce a terénní zadání bez termínu.</p>
      </section>}
      <section aria-labelledby="dispatch-map-heading" className={(view === 'map' ? '' : 'hidden xl:block ') + 'min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1"><h2 id="dispatch-map-heading" className="font-bold">Mapa práce</h2><span className="text-[11px] text-slate-500">{points.length} míst z fronty · {crews.length} tras</span></div>
        {mapResult || points.length || depot ? <RouteMap result={mapResult} depot={depot} active={activeCrew} points={points} onPointSelect={openWork} selectedPointId={detail?.id}/> : <div className="grid min-h-80 place-items-center rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500"><div><MapPin className="mx-auto mb-3"/>Zatím nejsou dostupné polohy prací ani trasy.<br/><Link href="/work/route" className="mt-3 inline-block font-semibold text-sky-800 underline">Nastavit depo a plánování</Link></div></div>}
        <p className="mt-3 px-1 text-[11px] leading-5 text-slate-500"><span className="mr-1 inline-block size-2 rounded-full bg-slate-500"/>Místa z fronty · barevně uložené trasy. {activeCrew && <button type="button" onClick={() => setActiveCrew('')} className="font-semibold text-sky-800 underline">Zrušit zvýraznění</button>}</p>
      </section>
      <section aria-labelledby="dispatch-trips-heading" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between gap-2"><h2 id="dispatch-trips-heading" className="font-bold">Výjezdy <span className="text-sm font-normal text-slate-400">{dayPlans.length}</span></h2><button type="button" aria-label="Obnovit přehled" onClick={() => router.refresh()} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><RefreshCw size={16}/></button></div>
        <div className="max-h-[640px] space-y-3 overflow-y-auto">{!dayPlans.length && <div className="py-10 text-center text-sm text-slate-500"><Truck className="mx-auto mb-3 text-slate-300"/>Zatím žádné výjezdy.<p className="mt-2 text-xs">Vyberte dostupnou práci ve frontě.</p></div>}{crews.map(({ key, plan, crew, title }) => {
          const current = progress[key];
          return <article key={key} className={'rounded-xl border p-3 ' + (activeCrew === key ? 'border-sky-600 bg-sky-50/50 ring-1 ring-sky-600' : 'border-slate-200')}>
            <button type="button" aria-pressed={activeCrew === key} aria-label={'Zvýraznit trasu ' + title} onClick={() => setActiveCrew(activeCrew === key ? '' : key)} className="w-full text-left"><div className="flex flex-wrap items-center justify-between gap-1"><span className="text-[10px] font-semibold text-slate-500">{dispatchStatus[plan.status] ?? plan.status}</span><span className="text-[11px] tabular-nums text-slate-500">{time(crew.departureAt)}–{time(crew.endAt)}</span></div><h3 className="mt-2 break-words text-sm font-bold">{title}</h3><p className="mt-1 break-words text-xs text-slate-500">{crew.vehicleName || 'Bez vozidla'} · {current?.total ?? crew.stops.length} zastávek</p></button>
            {current ? <div className="mt-3"><div className="mb-1 flex justify-between text-[11px] text-slate-500"><span>{current.done} / {current.total} hotovo</span>{current.issues > 0 && <span className="text-amber-800">Problémy: {current.issues}</span>}</div><progress aria-label={'Dokončení ' + title} value={current.done} max={Math.max(current.total, 1)} className="h-1.5 w-full overflow-hidden rounded-full accent-emerald-600"/></div> : <p className="mt-3 text-[11px] text-slate-400">{plan.status === 'DRAFT' ? 'Návrh čeká na schválení' : 'Průběh není dostupný'}</p>}
            <Link href={dispatchPlanHref(plan)} className="mt-3 flex min-h-9 items-center justify-between border-t border-slate-100 pt-2 text-xs font-bold text-sky-800">Otevřít výjezd<ArrowRight size={14}/></Link>
          </article>;
        })}{dayPlans.filter(plan => !crews.some(row => row.plan.id === plan.id)).map(plan => <Link key={plan.id} href={dispatchPlanHref(plan)} className="block rounded-xl border border-slate-200 p-3 text-sm font-semibold">Výjezd {plan.version}<span className="mt-1 block text-xs font-normal text-slate-500">{dispatchStatus[plan.status]} · bez naplánované posádky</span></Link>)}</div>
        <p className="mt-4 text-[10px] text-slate-400">Údaje při načtení. Obnovte pro aktuální průběh.</p>
      </section>
    </div>}
    {view !== 'week' && <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-bold"><Users className="mr-2 inline" size={17}/>Časová osa pracovníků <span className="ml-2 text-xs font-normal text-slate-400">{workers.size} pracovníků · schválené výjezdy</span></summary><p className="my-3 text-xs text-slate-500">Plánované časy z výjezdů. Osobní kalendář a celkovou dostupnost najdete v Planneru.</p><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[...workers].map(([id, worker]) => <section key={id} aria-label={'Časová osa ' + worker.name}><h3 className="mb-2 text-sm font-bold">{worker.name}</h3><Timeline items={dayTimeline.filter(item => worker.routeKeys.has(item.id))} timezone={timezone} onEdit={noEdit}/></section>)}{!workers.size && <p className="text-sm text-slate-500">Pro tento den zatím nejsou schválené výjezdy s pracovníky.</p>}</div></details>}
    <footer className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-slate-500"><span>Datum přehledu: {date}</span><div className="flex flex-wrap gap-4"><Link href="/work" className="hover:underline">Zakázky a dílna</Link><Link href="/my-route" className="hover:underline">Moje trasa</Link><Link href={'/work/dispatch?' + new URLSearchParams({ date, planner: 'work' }) + '#planner'} className="font-semibold text-sky-800 hover:underline">Rozšířené plánování →</Link></div></footer>
    {panel && <DispatchDrawer title={panel.type === 'create' ? 'Přidat práci' : 'Detail práce'} onClose={closePanel} busy={intakeBusy}>
      {panel.type === 'create' ? <DispatchIntake embedded onClose={closePanel} onBusyChange={setIntakeBusy}/> : detail && <div className="space-y-6"><div><span className={'rounded-lg px-3 py-1 text-xs font-semibold ' + badge[detail.state]}>{labels[detail.state]}</span><h3 className="mt-4 break-words text-2xl font-bold">{detail.title}</h3><p className="mt-2 text-sm text-slate-500">{sourceLabels[detail.source]}</p></div><dl className="grid grid-cols-[90px_minmax(0,1fr)] gap-3 text-sm"><dt className="text-slate-500">Klient</dt><dd className="break-words">{detail.client || 'Neuveden'}</dd><dt className="text-slate-500">Místo</dt><dd className="break-words">{detail.address || 'Viz úplný detail práce'}</dd><dt className="text-slate-500">Množství</dt><dd>{detail.quantity} ks</dd></dl>{detail.reason && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{detail.reason}</p>}<Link href={detail.detailUrl} className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-semibold">Úplný detail a podklady<ArrowRight size={16}/></Link>{detail.state === 'ready' && <button type="button" onClick={() => { setSelected(old => [...new Set([...old, detail.id])]); closePanel(); }} className="min-h-11 w-full rounded-xl bg-sky-800 px-4 text-sm font-bold text-white">Přidat do výběru pro plánování</button>}{detail.planId && <p className="text-xs text-slate-500">Práce je přiřazená výjezdu. Změny provádějte v jeho detailu.</p>}</div>}
    </DispatchDrawer>}
  </div>;
}
