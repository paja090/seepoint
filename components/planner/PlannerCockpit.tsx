'use client';
import { primaryButton, secondaryButton } from './styles';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Flame,
  Hand,
  ListTodo,
  RefreshCw,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { PlannerReadModel } from '@/lib/planner/read-model';
import type { PlannerItem } from '@/lib/planner/domain';
import { dateInZone, dayRange, plusDays } from '@/lib/planner/time';
import { overlaps } from '@/lib/planner/scheduling';
import { plannerRequest } from './api';
import { BlockEditor } from './BlockEditor';
import { Timeline } from './Timeline';
import { TeamAvailability } from './TeamAvailability';
import { WeekView } from './WeekView';
import { DayCheckoutCard } from './DayCheckoutCard';

function formatSyncTime(iso: string | null | undefined, timezone: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  });
}

function formatTaskDueBadge(dueAt: string | null, todayDate: string, tomorrowDate: string, timezone: string) {
  if (!dueAt) return { label: 'Bez termínu', badgeClass: 'bg-slate-100 text-slate-600' };
  const dueDate = dateInZone(new Date(dueAt), timezone);
  const formatted = new Date(dueAt).toLocaleDateString('cs-CZ', { timeZone: timezone });
  if (dueDate === todayDate) return { label: `Dnes · ${formatted}`, badgeClass: 'bg-emerald-100 text-emerald-800' };
  if (dueDate === tomorrowDate) return { label: `Zítra · ${formatted}`, badgeClass: 'bg-sky-100 text-sky-800' };
  if (dueDate < todayDate) return { label: `Po termínu · ${formatted}`, badgeClass: 'bg-rose-100 text-rose-800' };
  return { label: formatted, badgeClass: 'bg-slate-100 text-slate-700' };
}

export function PlannerCockpit() {
  const [chosenDate, setDate] = useState('');
  const [view, setView] = useState('today'), [data, setData] = useState<PlannerReadModel | null>(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [syncing, setSyncing] = useState(false), [syncNotice, setSyncNotice] = useState('');
  const [editor, setEditor] = useState<{ block?: PlannerItem; startAt?: string } | null>(null);
  const [showReportDrawer, setShowReportDrawer] = useState(false);
  const date = chosenDate || data?.date || '';
  const generation = useRef(0);
  const lastLoadAtRef = useRef(0);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const request = ++generation.current;
    if (!options?.silent) {
      setLoading(true);
      setError('');
    }
    try {
      const result = await plannerRequest<PlannerReadModel>(`?date=${chosenDate}&view=${view}`);
      if (request === generation.current) {
        setData(result);
        setError('');
        lastLoadAtRef.current = Date.now();
      }
    } catch (e) {
      if (request === generation.current && !options?.silent) {
        setError(e instanceof Error ? e.message : 'Plán se nepodařilo načíst.');
      }
    } finally {
      if (request === generation.current && !options?.silent) {
        setLoading(false);
      }
    }
  }, [chosenDate, view]);

  useEffect(() => { void load(); }, [load]);

  // Keep Planner synchronized when Google Sheet / Google Calendar cron runs or user returns to this tab
  useEffect(() => {
    const refreshIfStale = (minAgeMs: number) => {
      if (document.visibilityState !== 'visible' || editor || syncing) return;
      if (Date.now() - lastLoadAtRef.current < minAgeMs) return;
      void load({ silent: true });
    };
    const onFocusOrVisible = () => refreshIfStale(45_000);
    const interval = window.setInterval(() => refreshIfStale(120_000), 120_000);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    window.addEventListener('focus', onFocusOrVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      window.removeEventListener('focus', onFocusOrVisible);
    };
  }, [editor, load, syncing]);

  const handleSyncAndRefresh = async () => {
    setSyncing(true);
    setSyncNotice('');
    try {
      const connected = (data?.connections ?? []).filter(c => c.status === 'CONNECTED');
      let syncedCalCount = 0;
      if (data?.googleEnabled && connected.length) {
        for (const conn of connected) {
          const res = await plannerRequest<{ status: string }>(`/connections/${conn.id}/sync`, {}).catch(() => null);
          if (res?.status === 'OK') syncedCalCount++;
        }
      }
      await load({ silent: true });
      setSyncNotice(
        syncedCalCount > 0
          ? 'Kalendář i data plánu byly aktualizovány.'
          : 'Data plánu byla obnovena.'
      );
    } catch (e) {
      setSyncNotice(e instanceof Error ? e.message : 'Obnovení selhalo.');
    } finally {
      setSyncing(false);
    }
  };

  const forDay = (d: string) => { if (!data) return []; const range = dayRange(d, data.preferences.timezone); return data.items.filter(i => overlaps(i, { startAt: range.start.toISOString(), endAt: range.end.toISOString() })); };
  const tz = data?.preferences.timezone || 'Europe/Prague';
  const realToday = dateInZone(new Date(), tz);
  const todayIso = date || realToday;
  const tomorrowIso = date ? plusDays(date, 1) : todayIso;
  const dayItems = date ? forDay(date) : [];
  const next = data?.items.find(i => i.source !== 'ABSENCE' && Date.parse(i.endAt) > Date.now());
  const formattedSheetSync = formatSyncTime(data?.sheetSyncAt, tz);
  const formattedCalSync = formatSyncTime(data?.calendarLastSyncAt, tz);
  const formattedRefreshed = formatSyncTime(data?.refreshedAt, tz);
  const hasConnectedCalendars = Boolean(data?.connections.some(c => c.status === 'CONNECTED'));
  const hasStaleOrErroredConnection = Boolean(
    data?.connections.some(c => c.status !== 'CONNECTED' || c.syncStatus === 'ERROR' || !c.lastSyncAt || Date.now() - +new Date(c.lastSyncAt) > 1_800_000)
  );
  const hasEmptySelectedCalendar = Boolean(
    data && data.googleEnabled && hasConnectedCalendars && data.calendarEventsCount === 0
  );
  const freeHours = data ? Math.round((data.capacity.freeMinutes / 60) * 10) / 10 : 0;
  const busyHours = data ? Math.round((data.capacity.busyMinutes / 60) * 10) / 10 : 0;
  const utilPct = data ? Math.min(100, Math.max(0, data.capacity.utilization)) : 0;

  return (
    <div className="space-y-6">
      {/* HERO HEADER CARD */}
      <header className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/70 to-emerald-50/40 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100/80 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-800">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Čas pro to důležité</span>
            </span>
            <h1 className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-slate-950">Planner</h1>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
              Váš den, priority, Plán práce a prostor pro soustředěnou práci.
            </p>
            {data && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                {formattedSheetSync && (
                  <span suppressHydrationWarning className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-amber-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>Plán práce sync: <strong>{formattedSheetSync}</strong></span>
                  </span>
                )}
                {data.googleEnabled && (
                  <span suppressHydrationWarning className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-sky-50/90 px-2.5 py-1 text-sky-900">
                    <span className={`h-1.5 w-1.5 rounded-full ${hasConnectedCalendars ? 'bg-sky-500' : 'bg-slate-400'}`} />
                    <span>Google Kalendář: <strong>{formattedCalSync || (hasConnectedCalendars ? 'zatím nesynchronizováno' : 'nepřipojen')}</strong></span>
                  </span>
                )}
                {formattedRefreshed && (
                  <span suppressHydrationWarning className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                    <span>Načteno: <strong>{formattedRefreshed}</strong></span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full lg:shrink-0">
            <button
              type="button"
              onClick={() => setShowReportDrawer((v) => !v)}
              disabled={!data}
              className={secondaryButton}
            >
              <ClipboardCheck className={`h-4 w-4 ${data?.myDayCheckout?.submitted ? 'text-emerald-600' : 'text-indigo-600'}`} />
              <span>{data?.myDayCheckout?.submitted ? 'Report odevzdán' : 'Report dne'}</span>
            </button>
            <button type="button" onClick={handleSyncAndRefresh} disabled={!data || syncing} className={secondaryButton}>
              <RefreshCw className={`h-4 w-4 text-emerald-700 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Synchronizuji…' : 'Obnovit & sync'}</span>
            </button>
            <Link href="/settings/planner" className={secondaryButton}>
              <Settings className="h-4 w-4 text-slate-500" />
              <span>Nastavení</span>
            </Link>
            <button onClick={() => setEditor({})} disabled={!data} className={primaryButton}>+ Pracovní blok</button>
          </div>
        </div>
      </header>

      {syncNotice && (
        <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{syncNotice}</span>
        </p>
      )}

      {/* VIEW SWITCHER & DATE BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Pohled Planneru" className="inline-flex rounded-2xl border border-slate-200/80 bg-slate-200/60 p-1">
          {[['today', 'Dnes'], ['week', 'Týden'], ...(data?.canSeeTeam ? [['team', 'Tým']] : [])].map(([id, label]) => (
            <button
              key={id}
              aria-label={label}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold transition ${
                view === id
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{label}</span>
              {id === 'team' && (data?.pendingApprovalsCount ?? 0) > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                  {data?.pendingApprovalsCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-1.5">
          {date && date !== realToday && (
            <button
              type="button"
              onClick={() => setDate(realToday)}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
            >
              Skok na dnes
            </button>
          )}
          <button
            disabled={!date}
            aria-label="Předchozí den"
            onClick={() => setDate(plusDays(date, view === 'today' ? -1 : -7))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            aria-label="Datum plánu"
            type="date"
            value={date}
            onChange={e => { if (e.target.value) setDate(e.target.value); }}
            className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            disabled={!date}
            aria-label="Další den"
            onClick={() => setDate(plusDays(date, view === 'today' ? 1 : 7))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900 shadow-sm">
          <p>{error}</p>
          <button onClick={() => void load()} className="mt-2 font-black underline">Zkusit znovu</button>
        </div>
      )}

      {loading && (
        <div role="status" className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm animate-pulse">
          Načítám váš plán…
        </div>
      )}

      {data && !loading && !error && (
        <>
          {/* TOP REPORTS & EXECUTIVE STRIP (ALWAYS VISIBLE AT THE TOP) */}
          <section className="rounded-3xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-white to-emerald-50/70 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-indigo-900">
                    <ClipboardCheck className="h-3 w-3" />
                    <span>Report dne</span>
                  </span>
                  {data.myDayCheckout?.submitted ? (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
                      ✓ Odevzdáno
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
                      ○ Čeká na doplnění
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 break-words">
                  {data.myDayCheckout?.submitted?.manualSummary
                    ? `Váš report: „${data.myDayCheckout.submitted.manualSummary}“`
                    : data.myDayCheckout?.autoSummary || 'Doplňte krátký souhrn, co se vám dnes podařilo.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {data.canSeeTeam && data.teamCheckoutsSummary && (
                  <button
                    type="button"
                    onClick={() => setView('team')}
                    className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-700" />
                    <span>
                      Reporty týmu: <strong>{data.teamCheckoutsSummary.submitted}/{data.teamCheckoutsSummary.total}</strong>
                    </span>
                    {(data.pendingApprovalsCount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
                        <Hand className="h-3 w-3" />
                        <span>{data.pendingApprovalsCount} ke schválení</span>
                      </span>
                    )}
                    {data.meetingReports && data.meetingReports.length > 0 && (
                      <span className="hidden sm:inline text-slate-500">
                        · Poslední porada: <strong className="text-slate-700">{data.meetingReports[0].title}</strong>
                      </span>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowReportDrawer((v) => !v)}
                  className={primaryButton}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  <span>
                    {showReportDrawer
                      ? 'Skrýt formulář'
                      : data.myDayCheckout?.submitted
                      ? 'Upravit report dne'
                      : 'Odevzdat report dne'}
                  </span>
                </button>
              </div>
            </div>

            {showReportDrawer && (
              <div className="mt-4 border-t border-indigo-200/60 pt-4">
                <DayCheckoutCard
                  data={data}
                  onSaved={() => {
                    setShowReportDrawer(false);
                    void load({ silent: true });
                  }}
                />
              </div>
            )}
          </section>

          {/* KPI BENTO ROW */}
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Volná kapacita dnes</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  <Clock className="h-3 w-3" />
                  <span>{utilPct} % obsazeno</span>
                </span>
              </div>
              <p className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">
                {freeHours} <span className="text-base font-bold text-emerald-300">h</span>
              </p>
              <div className="mt-3 space-y-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all" style={{ width: `${utilPct}%` }} />
                </div>
                <p className="text-[11px] text-slate-400">Naplánováno {busyHours} h z pracovního dne</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Další událost v plánu</p>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Calendar className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-3 break-words text-base sm:text-lg font-extrabold leading-snug text-slate-900">
                {next?.title || 'Žádná další událost'}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {next
                  ? next.allDay
                    ? new Date(next.startAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: tz })
                    : `${new Date(next.startAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: tz })} · ${new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(next.startAt))}`
                  : 'Prostor bez nadcházejících schůzek'}
              </p>
            </div>

            <div className={`rounded-3xl border p-5 shadow-sm transition hover:shadow-md ${data.attention.length ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/70 to-white' : 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Vyžaduje pozornost</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${data.attention.length ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {data.attention.length ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </div>
              </div>
              <p className={`mt-3 text-3xl sm:text-4xl font-black tracking-tight ${data.attention.length ? 'text-amber-700' : 'text-emerald-700'}`}>
                {data.attention.length}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                {data.attention.length ? 'Položky ke kontrole nebo přiřazení' : 'Vše čisté, bez kolizí a prodlev'}
              </p>
            </div>
          </section>

          {/* ALERTS & CALENDAR HINTS */}
          {!data.connections.length && (
            <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs sm:text-sm font-medium text-sky-950">
              <Calendar className="h-4 w-4 shrink-0 text-sky-600" />
              <span>
                Google Calendar není připojený. <Link className="font-bold underline" href="/settings/planner">Připojit svůj kalendář</Link>. Plán práce i interní bloky se zobrazují už teď.
              </span>
            </p>
          )}
          {hasStaleOrErroredConnection && (
            <p role="status" className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs sm:text-sm font-medium text-amber-950">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Kalendář potřebuje synchronizaci nebo opětovné připojení. Dostupnost nemusí být úplná. <Link href="/settings/planner" className="font-bold underline">Zkontrolovat</Link>
              </span>
            </p>
          )}
          {hasEmptySelectedCalendar && !hasStaleOrErroredConnection && (
            <p className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs sm:text-sm font-medium text-slate-700 shadow-sm">
              <CalendarRange className="h-4 w-4 shrink-0 text-slate-400" />
              <span>
                Vybrané Google kalendáře zatím neobsahují žádné načtené události (rozsah -30 až +120 dnů). V <Link href="/settings/planner" className="font-bold text-emerald-800 underline">Nastavení kalendářů</Link> můžete vybrat jiný kalendář nebo spustit Plný re-sync.
              </span>
            </p>
          )}

          {/* MAIN WORKSPACE VIEWS */}
          {view === 'team' ? (
            <TeamAvailability data={data} onReload={() => void load({ silent: true })} />
          ) : view === 'week' ? (
            <WeekView date={date} timezone={data.preferences.timezone} items={data.items} tasks={data.tasks} onEdit={block => setEditor({ block })} />
          ) : (
            <div className="grid items-start gap-5 lg:grid-cols-3">
              {/* LEFT: TODAY TIMELINE */}
              <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <h2 className="text-base font-black text-slate-900">Dnešní plán</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                    {dayItems.length}
                  </span>
                </div>
                <Timeline items={dayItems} timezone={data.preferences.timezone} onEdit={block => setEditor({ block })} />
              </section>

              {/* MIDDLE: PRIORITY & FOCUS SLOTS */}
              <section className="space-y-5">
                <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <ListTodo className="h-4 w-4" />
                      </div>
                      <h2 className="text-base font-black text-slate-900">Priority</h2>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                      {data.tasks.length}
                    </span>
                  </div>

                  {!data.tasks.length && (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-xs font-semibold text-slate-500">
                      Žádné otevřené úkoly. Vyhraďte si prostor na další práci.
                    </p>
                  )}

                  <ol className="space-y-2.5">
                    {data.tasks.slice(0, 8).map((t, i) => {
                      const badge = formatTaskDueBadge(t.dueAt, todayIso, tomorrowIso, tz);
                      const isUrgent = t.priority === 'URGENT' || t.priority === 'HIGH';
                      const sourceName =
                        t.sourceKind === 'CRM_TASK'
                          ? 'CRM'
                          : t.sourceKind === 'FIELD_TASK'
                          ? 'Terénní práce'
                          : t.href.startsWith('/work/')
                          ? 'Plán práce'
                          : 'Úkoly';

                      return (
                        <li
                          key={`${t.sourceKind}:${t.id}`}
                          className="group rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-slate-500 shadow-sm ring-1 ring-slate-200">
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <Link className="block break-words text-sm font-bold leading-snug text-slate-900 group-hover:text-emerald-800 hover:underline" href={t.href}>
                                {t.title}
                              </Link>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                                <span className={`rounded-full px-2 py-0.5 ${badge.badgeClass}`}>
                                  {badge.label}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 ${t.sourceKind === 'FIELD_TASK' ? 'bg-purple-100 text-purple-800' : 'bg-white text-slate-600 ring-1 ring-slate-200/80'}`}>
                                  {sourceName}
                                </span>
                                {isUrgent && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">
                                    <Flame className="h-3 w-3" />
                                    <span>Prioritní</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3">
                    <Link href="/my-tasks" className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-800 hover:underline">
                      <span>Otevřít úkoly</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link href="/work" className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-800 hover:underline">
                      <span>Otevřít Plán práce</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
                      <Zap className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">Prostor na soustředění</h2>
                      <p className="text-[11px] font-medium text-slate-500">Kliknutím zarezervujete volný blok</p>
                    </div>
                  </div>

                  {data.slots.length ? (
                    <div className="space-y-2">
                      {data.slots.map(s => (
                        <button
                          key={s.startAt}
                          onClick={() => setEditor({ startAt: s.startAt })}
                          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50 to-teal-50/60 px-4 py-3 text-left text-sm font-bold text-emerald-950 transition hover:border-emerald-300 hover:shadow-sm"
                        >
                          <span>
                            {new Date(s.startAt).toLocaleTimeString('cs-CZ', { timeZone: data.preferences.timezone, hour: '2-digit', minute: '2-digit' })} · 60 minut fokus
                          </span>
                          <span className="text-xs font-extrabold text-emerald-700">Rezervovat →</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl bg-slate-50 p-3.5 text-xs font-semibold text-slate-500">
                      Ve zvoleném dni už není volný hodinový focus blok v preferovaném čase.
                    </p>
                  )}
                </div>
              </section>

              {/* RIGHT: ATTENTION, TELEMETRY & DAILY CHECK-OUT */}
              <aside className="space-y-5">
                <div className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${data.attention.length ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {data.attention.length ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      </div>
                      <h2 className="text-base font-black text-slate-900">Co potřebuje pozornost</h2>
                    </div>
                  </div>

                  {data.attention.length ? (
                    <div className="space-y-2.5">
                      {data.attention.map((a, i) => {
                        const isOverdueOrCollision = a.reason.includes('Po termínu') || a.reason.includes('překrývají');
                        return (
                          <Link
                            key={i}
                            href={a.href}
                            className={`block rounded-2xl border p-3.5 transition hover:shadow-sm ${
                              isOverdueOrCollision
                                ? 'border-rose-200/90 bg-rose-50/70 hover:bg-rose-100/70'
                                : 'border-amber-200/90 bg-amber-50/70 hover:bg-amber-100/70'
                            }`}
                          >
                            <p className={`text-[11px] font-black uppercase tracking-wider ${isOverdueOrCollision ? 'text-rose-700' : 'text-amber-800'}`}>
                              {a.reason}
                            </p>
                            <p className="mt-1 break-words text-sm font-bold text-slate-900">{a.title}</p>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-xs font-semibold text-slate-500">
                      V dostupných datech nejsou blížící se termíny ani časové kolize.
                    </p>
                  )}

                  <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/90 px-3.5 py-2.5 text-xs font-medium text-slate-600">
                    Přehled dne: <strong className="text-slate-900">{dayItems.length}</strong> v ose · <strong className="text-slate-900">{data.todayScheduledWorkCount ?? 0}</strong> úkolů v termínu · <strong className="text-emerald-800">{freeHours} h</strong> volných.
                  </div>
                </div>
              </aside>
            </div>
          )}
        </>
      )}

      {editor && data && (
        <BlockEditor
          date={date}
          timezone={data.preferences.timezone}
          workingStart={data.preferences.workingStart}
          tasks={data.tasks}
          block={editor.block}
          startAt={editor.startAt}
          onClose={() => setEditor(null)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
