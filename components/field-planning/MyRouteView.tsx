'use client';
import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import { fieldProblemTypes, type MyRouteDTO, type MyRouteCarrier } from '@/lib/field-planning/contracts';
import { computeRouteLiveETA, formatLiveClock } from '@/lib/field-planning/live-eta';
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
  Timer,
  Layers,
  Briefcase,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const MyRouteMap = dynamic(() => import('@/components/field-planning/MyRouteMap').then(m => m.MyRouteMap), { ssr: false });

function formatHoursMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function MyRouteView({ initial }: { initial: MyRouteDTO }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoCarrier, setPhotoCarrier] = useState<MyRouteCarrier>(null);
  const [activePhotoModalStopId, setActivePhotoModalStopId] = useState<string | null>(null);
  const [activeProblemModalStopId, setActiveProblemModalStopId] = useState<string | null>(null);
  const [hideDoneStops, setHideDoneStops] = useState(true);
  const [groupByOrder, setGroupByOrder] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const [currentDate, setCurrentDate] = useState<string>(initial.date || todayStr);

  const routesWithLiveETA = useMemo(() => {
    return data.routes.map((route) => {
      const live = computeRouteLiveETA(
        {
          departureAt: route.departureAt,
          endAt: route.endAt,
          tripStartedAt: route.tripStartedAt,
          tripCompletedAt: route.tripCompletedAt,
          stops: route.stops,
        },
        { targetDate: currentDate }
      );
      return {
        ...route,
        liveEstimatedEndAt: live.liveEstimatedEndAt,
        totalDelayMinutes: live.totalDelayMinutes,
        stops: live.stops,
      };
    });
  }, [data, currentDate]);

  // Live GPS tracking when trip is active (from start_trip until complete_trip)
  useEffect(() => {
    const activeRoute = data.routes.find((r) => r.tripStartedAt && !r.tripCompletedAt);
    if (!activeRoute) return;
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    let isMounted = true;
    let lastSent = 0;

    const sendPosition = async (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now - lastSent < 25000) return; // Throttle to max 1 ping per 25s
      lastSent = now;
      try {
        await fetch('/api/work/route/mine/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: activeRoute.planId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          }),
        });
      } catch {
        // Silently ignore transient network errors
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => { if (isMounted) void sendPosition(pos); },
      undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => { if (isMounted) void sendPosition(pos); },
      undefined,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );

    const timer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => { if (isMounted) void sendPosition(pos); },
        undefined,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    }, 45000);

    return () => {
      isMounted = false;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
    };
  }, [data.routes]);

  // Auto-refresh routes & crew live locations periodically when a trip is active
  useEffect(() => {
    const hasActiveTrip = data.routes.some((r) => r.tripStartedAt && !r.tripCompletedAt);
    if (!hasActiveTrip) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/work/route/mine?date=${currentDate}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // Silently ignore background poll errors
      }
    }, 25000);

    return () => clearInterval(timer);
  }, [data.routes, currentDate]);

  async function loadDateRoute(date: string) {
    setBusy(true);
    setError('');
    setCurrentDate(date);
    try {
      const refreshed = await fetch(`/api/work/route/mine?date=${date}`);
      if (refreshed.ok) {
        setData(await refreshed.json());
      }
    } catch {
      setError('Nepodařilo se načíst trasu.');
    } finally {
      setBusy(false);
    }
  }

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
      const refreshed = await fetch(`/api/work/route/mine?date=${currentDate}`);
      if (refreshed.ok) setData(await refreshed.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operace selhala.');
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
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
      const refreshed = await fetch(`/api/work/route/mine?date=${currentDate}`);
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
      <header className="space-y-3">
        <Link
          href="/my-tasks"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:underline"
        >
          <ArrowLeft size={14} />
          <span>Zpět na Moje úkoly</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 flex items-center gap-2.5">
              <Navigation className="text-sky-600" size={28} />
              <span>Moje trasa v terénu</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Plán montáží a výjezdů vaší posádky seřazený podle optimálních zastávek.
            </p>
          </div>
          <Link
            href="/work/route"
            className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-sky-700"
            title="Přepnout na plánování tras a dispečerskou mapu"
          >
            <MapPin size={14} className="text-sky-600" />
            <span>Dispečink výjezdů</span>
          </Link>
        </div>

        {/* Date Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => loadDateRoute(todayStr)}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentDate === todayStr
                  ? 'bg-white shadow-xs text-sky-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dnes
            </button>
            <button
              type="button"
              onClick={() => loadDateRoute(tomorrowStr)}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                currentDate === tomorrowStr
                  ? 'bg-white shadow-xs text-sky-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Zítra
            </button>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => e.target.value && loadDateRoute(e.target.value)}
              className="bg-transparent text-[11px] text-slate-600 border-none outline-none cursor-pointer pl-1 font-medium"
            />
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {new Date(currentDate).toLocaleDateString('cs-CZ', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </span>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-2xl bg-red-50 p-4 text-xs font-semibold text-red-800 border border-red-200 flex items-start justify-between gap-2 shadow-xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-red-500 hover:text-red-700 font-bold ml-2 cursor-pointer"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </div>
      )}

      {/* No routes banner */}
      {!data.routes.length && (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center space-y-3">
          <CheckCircle2 size={36} className="mx-auto text-slate-300" />
          <h2 className="font-bold text-sm text-slate-700">
            Na den {new Date(currentDate).toLocaleDateString('cs-CZ')} nemáte naplánovanou žádnou trasu
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Jakmile dispečer schválí trasu pro vaši posádku, uvidíte zde zastávky s přímou navigací.
          </p>
          {currentDate === todayStr && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => loadDateRoute(tomorrowStr)}
                className="text-xs font-bold text-sky-600 hover:text-sky-800 underline cursor-pointer"
              >
                Zkontrolovat trasu na zítřek →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Advance work notice for future dates */}
      {currentDate > todayStr && routesWithLiveETA.length > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs text-indigo-950 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <span>
              <strong>Plán na {currentDate === tomorrowStr ? 'zítřek' : 'další dny'}:</strong> Pokud máte dnešní trasu hotovou a stíháte, můžete kterýkoliv úkol zahájit a splnit v předstihu již dnes.
            </span>
          </div>
        </div>
      )}

      {/* Route Cards */}
      {routesWithLiveETA.map((route) => {
        const doneCount = route.stops.filter((s) => s.status === 'DONE').length;
        const issueCount = route.stops.filter((s) => s.status === 'ISSUE').length;
        const totalCount = route.stops.length;

        // Measured duration from completed stops (excluding instant completions < 1 min)
        const measuredStops = route.stops.filter(
          (s) => s.status === 'DONE' && s.actualDurationMinutes != null && !s.isInstantCompletion
        );
        const totalMeasuredMinutes = measuredStops.reduce(
          (acc, s) => acc + (s.actualDurationMinutes || 0),
          0
        );
        const avgMeasuredMinutes =
          measuredStops.length > 0
            ? (totalMeasuredMinutes / measuredStops.length).toFixed(1)
            : null;

        // Order & Campaign grouping
        const orderGroupsMap = new Map<
          string,
          {
            key: string;
            title: string;
            clientName: string | null;
            stops: typeof route.stops;
          }
        >();
        route.stops.forEach((s) => {
          const key = s.workOrderId || s.campaignName || s.clientName || 'default';
          const title =
            s.orderTitle ||
            s.campaignName ||
            (s.clientName ? `Zakázka: ${s.clientName}` : 'Běžný výjezd');
          if (!orderGroupsMap.has(key)) {
            orderGroupsMap.set(key, {
              key,
              title,
              clientName: s.clientName,
              stops: [],
            });
          }
          orderGroupsMap.get(key)!.stops.push(s);
        });
        const orderGroups = Array.from(orderGroupsMap.values());

        // Map jobId to absolute 1-based route sequence number (matching map markers 1:1)
        const stopIndexMap = new Map<string, number>();
        route.stops.forEach((s, idx) => {
          stopIndexMap.set(s.jobId, idx + 1);
        });

        const renderSingleStop = (s: (typeof route.stops)[number], displayOrder: number) => {
          const isDone = s.status === 'DONE';
          const isInProgress = s.status === 'IN_PROGRESS';
          const isIssue = s.status === 'ISSUE';
          const plannedTimeString = new Date(s.startAt).toLocaleTimeString('cs-CZ', {
            timeZone: data.timezone,
            hour: '2-digit',
            minute: '2-digit',
          });
          const liveTimeString = formatLiveClock(s.liveEstimatedStartAt ?? s.startAt, data.timezone);
          const hasSignificantDelay = s.delayMinutes !== undefined && Math.abs(s.delayMinutes) >= 5;

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
              {/* Order / Campaign Pill */}
              {(s.orderTitle || s.campaignName) && (
                <div className="flex items-center gap-1.5 pb-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    <Briefcase size={10} className="text-sky-600" />
                    <span>{s.orderTitle || s.campaignName}</span>
                  </span>
                </div>
              )}

              {/* Stop header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isIssue
                        ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400/50'
                        : isInProgress
                        ? 'bg-sky-600 text-white animate-pulse'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    {displayOrder}
                    {isDone && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-black text-white border border-white shadow-xs">
                        ✓
                      </span>
                    )}
                    {isIssue && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-700 text-[10px] font-black text-white border border-white shadow-xs">
                        !
                      </span>
                    )}
                  </div>

                  <div>
                    <h2
                      className={`font-extrabold text-sm sm:text-base leading-tight ${
                        isIssue ? 'text-rose-950' : 'text-slate-950'
                      }`}
                    >
                      {s.title}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {s.clientName} · {s.carrier?.code ? `Nosič ${s.carrier.code}` : s.workType}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {isIssue && (
                    <span className="text-[11px] font-black text-rose-700 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-xl flex items-center gap-1 shadow-xs">
                      <AlertTriangle size={12} />
                      <span>Hlášen problém</span>
                    </span>
                  )}
                  {isDone ? (
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-2xs">
                        <CheckCircle2 size={12} className="text-emerald-700" />
                        <span>Hotovo {s.completedAt ? formatLiveClock(s.completedAt, data.timezone) : ''}</span>
                      </span>
                      {currentDate > todayStr ? (
                        <span className="text-[10px] font-bold text-emerald-700 mt-0.5">
                          ✓ Splněno v předstihu
                        </span>
                      ) : (
                        hasSignificantDelay && (
                          <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                            plán {plannedTimeString}
                          </span>
                        )
                      )}
                    </div>
                  ) : isInProgress ? (
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-extrabold text-sky-950 bg-sky-100 border border-sky-300 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-xs animate-pulse">
                        <Clock size={12} className="text-sky-700" />
                        <span>Běží (~do {formatLiveClock(s.liveEstimatedEndAt, data.timezone)})</span>
                      </span>
                      <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                        začátek {s.startedAt ? formatLiveClock(s.startedAt, data.timezone) : plannedTimeString}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-extrabold text-sky-900 bg-sky-100/90 border border-sky-300 px-2.5 py-1 rounded-xl shadow-2xs">
                        ~{liveTimeString}
                      </span>
                      {hasSignificantDelay && (
                        <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                          plán {plannedTimeString} ({s.delayMinutes! > 0 ? `+${s.delayMinutes}m` : `${s.delayMinutes}m`})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Timing row (Planned work & travel time, Measured duration) */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5">
                {s.serviceMinutes !== undefined && (
                  <span className="inline-flex items-center gap-1 text-slate-600 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md font-medium">
                    <Clock size={11} className="text-slate-400" />
                    <span>Plán práce: {s.serviceMinutes} min</span>
                  </span>
                )}
                {s.travelMinutes !== undefined && s.travelMinutes > 0 && (
                  <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-md font-medium">
                    <Car size={11} className="text-slate-400" />
                    <span>Přejezd: ~{s.travelMinutes} min</span>
                  </span>
                )}
                {s.actualDurationMinutes !== undefined && s.actualDurationMinutes !== null && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${
                      s.serviceMinutes && s.actualDurationMinutes <= s.serviceMinutes
                        ? 'text-emerald-800 bg-emerald-100/80 border border-emerald-300'
                        : 'text-amber-800 bg-amber-100/80 border border-amber-300'
                    }`}
                  >
                    <CheckCircle2 size={11} />
                    <span>
                      Naměřeno: {s.actualDurationMinutes} min
                      {s.serviceMinutes
                        ? ` (${
                            s.actualDurationMinutes <= s.serviceMinutes
                              ? `-${s.serviceMinutes - s.actualDurationMinutes}`
                              : `+${s.actualDurationMinutes - s.serviceMinutes}`
                          } min)`
                        : ''}
                    </span>
                  </span>
                )}
                {s.isInstantCompletion && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-slate-500 bg-slate-100 border border-slate-200"
                    title="Práce trvala méně než 1 minutu (zapomenuté zahájení). Nezapočítává se do průměru norem."
                  >
                    <span>⚡ Hotovo (&lt; 1 min, mimo průměr)</span>
                  </span>
                )}
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
                    <p className="whitespace-pre-wrap text-rose-800 font-medium pl-4">
                      {s.issueNote}
                    </p>
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
                      void run(
                        route.planId,
                        s.workOrderId,
                        isInProgress ? 'complete' : 'start',
                        undefined,
                        s.jobId
                      )
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
                    <span>
                      {isInProgress
                        ? 'Označit za hotové ✓'
                        : isIssue
                        ? 'Zkusit znovu / Zahájit'
                        : currentDate > todayStr
                        ? 'Zahájit v předstihu ⚡'
                        : 'Zahájit práci'}
                    </span>
                  </button>
                )}

                {/* Upload Photo Button */}
                {(s.navigationPointId || s.workOrderItemId) && !isDone && (
                  <button
                    type="button"
                    onClick={() =>
                      setActivePhotoModalStopId(
                        activePhotoModalStopId === s.jobId ? null : s.jobId
                      )
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
                      setActiveProblemModalStopId(
                        activeProblemModalStopId === s.jobId ? null : s.jobId
                      )
                    }
                    className={`flex items-center justify-center gap-1 rounded-2xl px-3 py-3 text-xs font-bold transition ml-auto ${
                      isIssue
                        ? 'text-rose-700 bg-rose-100 hover:bg-rose-200 border border-rose-200'
                        : 'text-amber-700 hover:bg-amber-50'
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
                    <label className="text-xs font-bold text-slate-700 block">
                      Fotografie hotové práce (povinné)
                    </label>
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
                    <label className="text-xs font-semibold text-slate-700 block">
                      Poznámka (volitelné)
                    </label>
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
                  action={(form) =>
                    run(route.planId, s.workOrderId, 'problem', form, s.jobId)
                  }
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

                  <input
                    type="hidden"
                    name="key"
                    value={`${route.planId}-${s.jobId}-${s.status}`}
                  />

                  <div>
                    <label className="text-xs font-bold text-slate-700 block">Důvod zádrhelu</label>
                    <select
                      name="type"
                      defaultValue={s.issueType ?? fieldProblemTypes[0]}
                      className="input mt-1 w-full text-xs font-semibold"
                    >
                      {fieldProblemTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
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
                    {busy
                      ? 'Odesílám…'
                      : isIssue
                      ? 'Aktualizovat upozornění dispečerovi ⚠️'
                      : 'Odeslat upozornění dispečerovi ⚠️'}
                  </button>
                </form>
              )}
            </article>
          );
        };

        return (
          <section key={route.planId} className="space-y-4">
            {/* Route summary bar */}
            <div className="flex flex-wrap items-center justify-between rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Car size={15} className="text-sky-600" />
                <span>{route.vehicleName ?? 'Výjezd bez vozidla'}</span>
                {route.crewName && (
                  <span className="text-slate-600 font-semibold bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                    Posádka: {route.crewName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {issueCount > 0 && (
                  <span className="rounded-full bg-rose-100 border border-rose-300 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-700 shadow-sm flex items-center gap-1">
                    <AlertTriangle size={12} className="text-rose-600" />
                    <span>
                      {issueCount}{' '}
                      {issueCount === 1
                        ? 'problém'
                        : issueCount < 5
                        ? 'problémy'
                        : 'problémů'}
                    </span>
                  </span>
                )}
                <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] shadow-sm font-extrabold text-slate-800">
                  {doneCount} / {totalCount} hotovo
                </span>
              </div>
            </div>

            {/* Timing Breakdown Card (Travel, Planned Service, Shift Total, Measured Actual) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Timer size={14} className="text-sky-600" />
                  <span>Časová náročnost výjezdu</span>
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Kalkulace a měření časů
                </span>
              </div>

              {/* Trip Controls (Start Departure from Warehouse / Complete Return to Warehouse) */}
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border transition ${
                  route.tripCompletedAt
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : route.tripStartedAt
                    ? 'bg-sky-50 border-sky-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      route.tripCompletedAt
                        ? 'bg-emerald-600 text-white'
                        : route.tripStartedAt
                        ? 'bg-sky-600 text-white animate-pulse'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Navigation size={14} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-900 block leading-tight">
                      {route.tripCompletedAt
                        ? `Výjezd dokončen: návrat na sklad v ${new Date(
                            route.tripCompletedAt
                          ).toLocaleTimeString('cs-CZ', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : route.tripStartedAt
                        ? `Výjezd na trase: odjezd ze skladu v ${new Date(
                            route.tripStartedAt
                          ).toLocaleTimeString('cs-CZ', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`
                        : 'Celodenní výjezd (ze skladu a zpět)'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {route.tripCompletedAt
                        ? `Skutečná délka směny: ${formatHoursMinutes(
                            route.actualTripMinutes ?? 0
                          )}`
                        : route.tripStartedAt
                        ? 'Stopky směny běží včetně cest a případných kolon'
                        : currentDate > todayStr
                        ? 'Zahajte výjezd i v předstihu pro změření celé trasy'
                        : 'Zahajte při ranním odjezdu z firmy pro změření celé směny'}
                    </span>
                    {route.tripStartedAt && !route.tripCompletedAt && (
                      <span className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-700 font-bold">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>Živé GPS spojení s dispečinkem aktivní</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!route.tripStartedAt && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(route.planId, '', 'start_trip')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                    >
                      <span>
                        {currentDate > todayStr
                          ? '🚀 Zahájit výjezd v předstihu ⚡'
                          : '🚀 Zahájit výjezd (odjezd ze skladu)'}
                      </span>
                    </button>
                  )}
                  {route.tripStartedAt && !route.tripCompletedAt && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(route.planId, '', 'complete_trip')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                    >
                      <span>
                        {currentDate > todayStr
                          ? '🏁 Ukončit výjezd v předstihu ⚡'
                          : '🏁 Ukončit výjezd (návrat na sklad)'}
                      </span>
                    </button>
                  )}
                  {route.tripCompletedAt && (
                    <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                      ✓ Návrat zapsán
                    </span>
                  )}
                </div>
              </div>

              {/* Live Shift ETA Banner */}
              <div className="rounded-xl border border-sky-200 bg-linear-to-r from-sky-50/90 via-indigo-50/30 to-white p-3 space-y-1.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-sky-700 text-white shadow-xs">
                      <Clock size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-900 block leading-tight">
                        Předpokládaný konec směny (Live ETA)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg sm:text-xl font-black text-slate-950">
                          ~{formatLiveClock(route.liveEstimatedEndAt, data.timezone)}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          (původní plán dispečera {formatLiveClock(route.endAt, data.timezone)})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {route.totalDelayMinutes !== undefined && route.totalDelayMinutes > 5 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-extrabold text-[11px] border border-amber-300 shadow-2xs">
                        <span>⚠️ Posun +{formatHoursMinutes(route.totalDelayMinutes)}</span>
                      </span>
                    ) : route.totalDelayMinutes !== undefined && route.totalDelayMinutes < -5 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 font-extrabold text-[11px] border border-emerald-300 shadow-2xs">
                        <span>⚡ Náskok {formatHoursMinutes(Math.abs(route.totalDelayMinutes))}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-100 text-sky-900 font-extrabold text-[11px] border border-sky-200 shadow-2xs">
                        <span>✓ Podle plánu</span>
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Časy se dynamicky přepočítávají podle vašeho skutečného zahájení a tempa práce na jednotlivých zastávkách.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Čas na cestě
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    ~{formatHoursMinutes(route.travelMinutes ?? 0)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {route.distanceKm ? `${route.distanceKm} km přejezdů` : 'Přejezdy'}
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Čas realizace (plán)
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    ~{formatHoursMinutes(route.serviceMinutes ?? 0)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Práce na stanovištích
                  </span>
                </div>

                <div className="p-2 bg-slate-50 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Celkem výjezd
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    ~{formatHoursMinutes(
                      (route.travelMinutes ?? 0) + (route.serviceMinutes ?? 0)
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Cesta + realizace
                  </span>
                </div>

                <div className="p-2 bg-sky-50/70 border border-sky-100 rounded-xl">
                  <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
                    Reálně naměřeno
                  </span>
                  <span className="font-extrabold text-sky-950 text-sm">
                    {route.actualTripMinutes != null
                      ? formatHoursMinutes(route.actualTripMinutes)
                      : measuredStops.length > 0
                      ? formatHoursMinutes(totalMeasuredMinutes)
                      : '—'}
                  </span>
                  <span
                    className="text-[10px] text-sky-700 block truncate"
                    title={
                      route.actualTripMinutes != null
                        ? `Celý výjezd: ${formatHoursMinutes(
                            route.actualTripMinutes
                          )}, z toho práce: ${formatHoursMinutes(totalMeasuredMinutes)}`
                        : measuredStops.length > 0
                        ? `Průměr ${avgMeasuredMinutes} min / bod`
                        : ''
                    }
                  >
                    {route.actualTripMinutes != null
                      ? `Práce: ${formatHoursMinutes(
                          totalMeasuredMinutes
                        )} | Cesta: ${formatHoursMinutes(
                          Math.max(0, route.actualTripMinutes - totalMeasuredMinutes)
                        )}`
                      : measuredStops.length > 0
                      ? `Práce: ${formatHoursMinutes(
                          totalMeasuredMinutes
                        )} (${measuredStops.length}x)`
                      : 'Měří se po dokončení'}
                  </span>
                </div>
              </div>
            </div>

            {/* LIVE MAP */}
            <MyRouteMap route={route} height="h-[280px]" />

            {/* Google Maps Full Route (active uncompleted stops only) */}
            {(() => {
              const activeStops = route.stops.filter((s) => s.status !== 'DONE');
              const targetStops = activeStops.length > 0 ? activeStops : route.stops;
              const points = targetStops
                .map((s) => s.location)
                .filter((loc): loc is { latitude: number; longitude: number } =>
                  Boolean(loc)
                );
              if (points.length < 2) return null;
              const origin = `${points[0].latitude},${points[0].longitude}`;
              const dest = `${points[points.length - 1].latitude},${points[points.length - 1].longitude}`;
              const waypoints = points
                .slice(1, -1)
                .map((p) => `${p.latitude},${p.longitude}`)
                .join('|');
              const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${
                waypoints ? `&waypoints=${waypoints}` : ''
              }`;

              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-100 mt-2 border border-indigo-200/50"
                >
                  <MapPin size={16} />
                  <span>Zobrazit trasu na mapě (zbývající zastávky)</span>
                </a>
              );
            })()}

            {/* Done stops toggle banner */}
            {doneCount > 0 && (
              <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>
                    {hideDoneStops
                      ? `${doneCount} hotových zastávek je v trase skryto`
                      : `${doneCount} dokončených zastávek`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setHideDoneStops(!hideDoneStops)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                >
                  {hideDoneStops ? 'Zobrazit hotové' : 'Skrýt hotové'}
                </button>
              </div>
            )}

            {/* Order separation view switcher (if multiple orders exist) */}
            {orderGroups.length > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers size={14} className="text-sky-600" />
                  <span>Rozdělení zakázek ({orderGroups.length}):</span>
                </span>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setGroupByOrder(false)}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs ${
                      !groupByOrder
                        ? 'bg-white shadow-xs text-sky-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Pořadí trasy (1, 2, 3...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupByOrder(true)}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs ${
                      groupByOrder
                        ? 'bg-white shadow-xs text-sky-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Dle zakázek ({orderGroups.length})
                  </button>
                </div>
              </div>
            )}

            {/* Stops list rendering (Grouped by Order OR Sequential Route) */}
            {groupByOrder && orderGroups.length > 1 ? (
              <div className="space-y-4 pt-1">
                {orderGroups.map((group) => {
                  const visibleGroupStops = group.stops.filter(
                    (s) => !hideDoneStops || s.status !== 'DONE'
                  );
                  const groupDone = group.stops.filter(
                    (s) => s.status === 'DONE'
                  ).length;
                  const groupServiceMin = group.stops.reduce(
                    (acc, s) => acc + (s.serviceMinutes || 0),
                    0
                  );

                  return (
                    <div
                      key={group.key}
                      className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-100 px-2 py-0.5 rounded-md inline-block">
                            Zakázka / Kampaň
                          </span>
                          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                            <Briefcase size={14} className="text-sky-600 shrink-0" />
                            <span>{group.title}</span>
                          </h3>
                          {group.clientName && group.clientName !== group.title && (
                            <p className="text-xs text-slate-500 font-medium">
                              Klient: {group.clientName}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-500">
                            ~{formatHoursMinutes(groupServiceMin)}
                          </span>
                          <span className="font-bold bg-white px-2.5 py-1 rounded-xl shadow-2xs text-slate-800 border border-slate-200">
                            {groupDone} / {group.stops.length} hotovo
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 pt-1">
                        {visibleGroupStops.length > 0 ? (
                          visibleGroupStops.map((s) =>
                            renderSingleStop(s, stopIndexMap.get(s.jobId) ?? 1)
                          )
                        ) : (
                          <p className="text-xs text-slate-400 italic p-2 text-center">
                            Všechny zastávky této zakázky jsou hotové.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {route.stops
                  .filter((s) => !hideDoneStops || s.status !== 'DONE')
                  .map((s, i, filteredStops) => {
                    const prevStop = i > 0 ? filteredStops[i - 1] : null;
                    const isNewOrder =
                      orderGroups.length > 1 &&
                      (!prevStop ||
                        (prevStop.orderTitle ||
                          prevStop.campaignName ||
                          prevStop.workOrderId) !==
                          (s.orderTitle ||
                            s.campaignName ||
                            s.workOrderId));

                    return (
                      <div key={s.jobId} className="space-y-2">
                        {isNewOrder && (
                          <div className="flex items-center gap-2 pt-2 pb-0.5">
                            <div className="h-px bg-slate-200 flex-1" />
                            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200/80 flex items-center gap-1.5">
                              <Briefcase size={11} className="text-sky-600" />
                              <span>
                                {s.orderTitle ||
                                  s.campaignName ||
                                  s.clientName ||
                                  'Další zakázka'}
                              </span>
                            </span>
                            <div className="h-px bg-slate-200 flex-1" />
                          </div>
                        )}
                        {renderSingleStop(s, stopIndexMap.get(s.jobId) ?? (i + 1))}
                      </div>
                    );
                  })}
              </div>
            )}
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
