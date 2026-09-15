'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrewInput, PlanningInput, PlanningProfile, PlanView } from '@/lib/field-planning/contracts';
import { RouteMap } from './field-planning/RouteMap';
import { PlanningProfileForm } from './field-planning/PlanningProfileForm';
import {
  Calendar,
  Clock,
  Car,
  Users,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Settings2,
  Plus,
  Trash2,
  ChevronRight,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Navigation,
} from 'lucide-react';

type Loaded = { profile: PlanningProfile | null; data: PlanningInput | null; plans: PlanView[] };

function mapsLinks(plan: PlanView, crewId: string) {
  const crew = plan.result.crews.find((c) => c.id === crewId);
  if (!crew) return [];
  const coords = (p: { latitude: number; longitude: number }) => `${p.latitude},${p.longitude}`;
  const points = [crew.startLocation ?? plan.profile.depot, ...crew.stops.map((s) => s.location), plan.profile.endLocation];
  const links: string[] = [];
  for (let i = 0; i < points.length - 1; i += 4) {
    const slice = points.slice(i, i + 5);
    links.push(
      `https://www.google.com/maps/dir/?${new URLSearchParams({
        api: '1',
        origin: coords(slice[0]),
        destination: coords(slice.at(-1)!),
        waypoints: slice.slice(1, -1).map(coords).join('|'),
        travelmode: 'driving',
      })}`
    );
  }
  return links;
}

export function WorkRoutePlanner({
  defaultDate,
  country,
  navigation = false,
}: {
  navigation?: boolean;
  defaultDate: string;
  country: string | null;
}) {
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('08:00');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [crews, setCrews] = useState<CrewInput[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [activeCrewId, setActiveCrewId] = useState('');
  const [activeTab, setActiveTab] = useState<'crews' | 'jobs'>('crews');

  const [sourceFilter, setSourceFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [readyOnly, setReadyOnly] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inputsChanged, setInputsChanged] = useState(false);
  const [acceptEstimated, setAcceptEstimated] = useState(false);

  const requestKey = useRef<string | null>(null);
  const loadCounter = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++loadCounter.current;
    setError('');
    try {
      const response = await fetch(`/api/work/route?date=${date}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (ticket !== loadCounter.current) return;

      setInputsChanged(false);
      setLoaded(data);
      setPlan(data.plans[0] ?? null);

      // Initialize crews if empty
      if (data.data?.crews && data.data.crews.length > 0) {
        setCrews(data.data.crews);
      } else {
        // Sensible default: 1 initial crew with first available employee
        const firstEmployee = data.data?.employees?.find((e: { available: boolean; isActive: boolean }) => e.isActive && e.available);
        const firstVehicle = data.data?.vehicles?.find((v: { status: string; reserved: boolean }) => v.status === 'AVAILABLE' && !v.reserved);
        setCrews([
          {
            id: crypto.randomUUID(),
            employeeIds: firstEmployee ? [firstEmployee.id] : [],
            vehicleId: firstVehicle ? firstVehicle.id : null,
          },
        ]);
      }

      // Default selected jobs
      const jobsToSelect =
        data.data?.jobs
          ?.filter((j: { status: string }) => !['DONE', 'CANCELLED'].includes(j.status))
          ?.map((j: { id: string }) => j.id) ?? [];
      setSelectedJobs(jobsToSelect);

      if (data.plans[0]?.result.crews[0]) {
        setActiveCrewId(data.plans[0].result.crews[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načtení plánovacích dat selhalo.');
    }
  }, [date]);

  useEffect(() => {
    setPlan(null);
    setLoaded(null);
    requestKey.current = null;
    void load();
  }, [load]);

  async function handleAction(kind: 'generate' | 'replan' | 'approve' | 'cancel') {
    setBusy(true);
    setError('');
    try {
      const generating = kind === 'generate' || kind === 'replan';
      requestKey.current ??= crypto.randomUUID();

      const response = await fetch('/api/work/route', {
        method: generating ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          generating
            ? {
                date,
                startTime: startTime || undefined,
                requestKey: requestKey.current,
                crews: crews.filter((c) => c.employeeIds.length > 0),
                jobIds: selectedJobs,
                ...(kind === 'replan' ? { parentPlanId: plan?.id } : {}),
              }
            : { action: kind, id: plan?.id, acceptEstimated }
        ),
      });

      const value = await response.json();
      if (!response.ok) throw new Error(value.error);

      setInputsChanged(false);
      setPlan(value);
      setActiveCrewId(value.result?.crews[0]?.id ?? '');
      requestKey.current = null;
      setAcceptEstimated(false);
      setLoaded((old) => (old ? { ...old, plans: [value, ...old.plans.filter((p) => p.id !== value.id)] } : old));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operace plánování selhala.');
    } finally {
      setBusy(false);
    }
  }

  function updateCrews(newCrews: CrewInput[]) {
    setCrews(newCrews);
    setInputsChanged(true);
    requestKey.current = null;
  }

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('cs-CZ', {
      timeZone: plan?.profile.timezone ?? loaded?.profile?.timezone ?? 'Europe/Prague',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const visibleJobs =
    loaded?.data?.jobs.filter((j) => {
      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'navigation' && Boolean(j.navigationPointId)) ||
        (sourceFilter === 'work' && !j.navigationPointId);
      const matchesReady = !readyOnly || !j.blockedReason;
      const matchesQuery =
        !query.trim() ||
        [j.title, j.clientName, j.orderNumber, j.address]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase());
      return matchesSource && matchesReady && matchesQuery;
    }) ?? [];

  const activeCrew = plan?.result.crews.find((c) => c.id === activeCrewId) ?? plan?.result.crews[0];

  const setDateOffset = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDate(`${yyyy}-${mm}-${dd}`);
  };

  return (
    <div className="mx-auto max-w-[1680px] space-y-6">
      {/* Top Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700">
            <Navigation size={14} />
            <span>Dispečink a montáže</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-slate-950">
            Plánování výjezdů a tras
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Přiřaďte zakázky posádkám, nechte systém spočítat trasu a odešlete ji do mobilů technikům.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/my-route"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <span>📱 Moje trasa v mobilu</span>
          </Link>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Settings2 size={16} className="text-slate-500" />
            <span>Nastavení depa</span>
          </button>
        </div>
      </header>

      {/* Profile Settings Modal */}
      {settingsOpen && (
        <PlanningProfileForm
          navigation={navigation}
          country={country}
          initial={loaded?.profile ?? null}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false);
            void load();
          }}
        />
      )}

      {/* Error alert */}
      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800 border border-red-200">
          <AlertCircle size={20} className="text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Dispatch Control Toolbar */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* Date and departure time */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setDateOffset(0)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                date === new Date().toISOString().slice(0, 10)
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dnes
            </button>
            <button
              onClick={() => setDateOffset(1)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
            >
              Zítra
            </button>
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <Calendar size={16} className="text-slate-400" />
            <input
              type="date"
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={date}
              disabled={busy}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <Clock size={16} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-500 hidden sm:inline">Odjezd:</span>
            <input
              type="time"
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={startTime}
              disabled={busy}
              onChange={(e) => {
                setStartTime(e.target.value);
                setInputsChanged(true);
                requestKey.current = null;
              }}
            />
          </div>
        </div>

        {/* Primary action buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => void handleAction('generate')}
            disabled={busy || !loaded?.data || !selectedJobs.length || !crews.some((c) => c.employeeIds.length > 0)}
            className="flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-sky-600 disabled:opacity-40 transition"
          >
            <Sparkles size={16} />
            <span>{busy ? 'Počítám trasu…' : 'Naplánovat trasy 🪄'}</span>
          </button>

          {plan && ['DRAFT', 'APPROVED', 'ACTIVE'].includes(plan.status) && (
            <button
              onClick={() => void handleAction('replan')}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <RefreshCw size={14} />
              <span>Přepočítat</span>
            </button>
          )}

          {plan?.status === 'DRAFT' && (
            <button
              onClick={() => void handleAction('approve')}
              disabled={busy || inputsChanged || Boolean(plan.result.conflicts.length || plan.result.unassigned.length)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-600 disabled:opacity-40 transition"
            >
              <CheckCircle2 size={16} />
              <span>Schválit a odeslat posádkám</span>
            </button>
          )}

          {plan?.status === 'DRAFT' && (
            <button
              onClick={() => void handleAction('cancel')}
              disabled={busy}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:text-red-600 transition"
            >
              Zrušit návrh
            </button>
          )}

          {/* Versions dropdown */}
          {Boolean(loaded?.plans?.length) && (
            <select
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
              value={plan?.id ?? ''}
              onChange={(e) => {
                const chosen = loaded?.plans.find((p) => p.id === e.target.value);
                if (chosen) {
                  setPlan(chosen);
                  setActiveCrewId(chosen.result.crews[0]?.id ?? '');
                }
              }}
            >
              {loaded?.plans.map((p) => (
                <option key={p.id} value={p.id}>
                  Verze {p.version} · {p.status === 'APPROVED' ? 'Schváleno' : p.status === 'DRAFT' ? 'Návrh' : p.status}
                </option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* Warning banner when inputs changed */}
      {inputsChanged && (
        <div className="flex items-center justify-between rounded-2xl bg-amber-50 p-4 border border-amber-200 text-xs font-semibold text-amber-900">
          <span>⚠️ Změnil se výběr zakázek nebo složení posádek. Pro aktualizaci klikněte na „Naplánovat trasy“.</span>
          <button
            onClick={() => void handleAction('generate')}
            className="rounded-xl bg-amber-700 px-3.5 py-1.5 text-white font-bold hover:bg-amber-600 transition"
          >
            Aktualizovat
          </button>
        </div>
      )}

      {/* Plan Summary Banner */}
      {plan && (
        <section className="rounded-3xl bg-slate-900 p-5 sm:p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span
                className={`rounded-xl px-3 py-1 text-xs font-black uppercase tracking-wider ${
                  plan.status === 'APPROVED' || plan.status === 'ACTIVE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {plan.status === 'APPROVED' ? 'Schválený plán' : plan.status === 'ACTIVE' ? 'Probíhá v terénu' : 'Návrh trasy (Draft)'}
              </span>
              <span className="text-xs text-slate-400 font-medium">Verze {plan.version}</span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs sm:text-sm">
              <div>
                <span className="text-slate-400 text-xs block">Zastávek</span>
                <strong className="text-base font-bold">
                  {plan.result.crews.reduce((acc, c) => acc + c.stops.length, 0)}
                </strong>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-400 text-xs block">Posádek</span>
                <strong className="text-base font-bold">{plan.result.crews.length}</strong>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-400 text-xs block">Vzdálenost</span>
                <strong className="text-base font-bold">{(plan.result.distanceMeters / 1000).toFixed(1)} km</strong>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-400 text-xs block">Čas přejezdů</span>
                <strong className="text-base font-bold">{Math.round(plan.result.travelSeconds / 60)} min</strong>
              </div>
              <div className="border-l border-slate-800 pl-4">
                <span className="text-slate-400 text-xs block">Čas práce</span>
                <strong className="text-base font-bold">{plan.result.serviceMinutes} min</strong>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            💡 {plan.result.explanation}
          </p>

          {plan.result.estimated && plan.status === 'DRAFT' && (
            <label className="mt-3 flex items-center gap-2 text-xs text-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptEstimated}
                onChange={(e) => setAcceptEstimated(e.target.checked)}
                className="rounded text-amber-500"
              />
              <span>Souhlasím s použitím odhadovaných dojezdových časů (silniční API vrátilo odhad).</span>
            </label>
          )}
        </section>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Crews & Jobs Tabs (5 cols) */}
        <aside className="lg:col-span-5 space-y-4">
          <div className="flex rounded-2xl bg-slate-200/70 p-1">
            <button
              onClick={() => setActiveTab('crews')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 ${
                activeTab === 'crews'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={16} />
              <span>Posádky a auta ({crews.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 ${
                activeTab === 'jobs'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin size={16} />
              <span>Vybrané zakázky ({selectedJobs.length})</span>
            </button>
          </div>

          {/* TAB 1: CREWS & VEHICLES */}
          {activeTab === 'crews' && (
            <div className="space-y-4">
              {crews.map((c, index) => {
                const assignedEmployees = loaded?.data?.employees.filter((e) => c.employeeIds.includes(e.id)) ?? [];
                const availableToAdd =
                  loaded?.data?.employees.filter((e) => e.isActive && !c.employeeIds.includes(e.id)) ?? [];
                const currentVehicle = loaded?.data?.vehicles.find((v) => v.id === c.vehicleId);

                return (
                  <div
                    key={c.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-800 text-xs font-black">
                          #{index + 1}
                        </div>
                        <h3 className="font-extrabold text-sm text-slate-900">
                          Posádka {index + 1}
                        </h3>
                      </div>

                      {crews.length > 1 && (
                        <button
                          onClick={() => updateCrews(crews.filter((x) => x.id !== c.id))}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="Odebrat posádku"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Workers Chips */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                        Pracovníci v autě
                      </label>
                      <div className="flex flex-wrap gap-1.5 min-h-8 items-center">
                        {assignedEmployees.map((emp) => (
                          <span
                            key={emp.id}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800"
                          >
                            <span>{emp.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateCrews(
                                  crews.map((x) =>
                                    x.id === c.id
                                      ? { ...x, employeeIds: x.employeeIds.filter((id) => id !== emp.id) }
                                      : x
                                  )
                                )
                              }
                              className="text-slate-400 hover:text-red-600 transition ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ))}

                        {/* Add worker dropdown */}
                        {availableToAdd.length > 0 && (
                          <select
                            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                updateCrews(
                                  crews.map((x) =>
                                    x.id === c.id ? { ...x, employeeIds: [...x.employeeIds, e.target.value] } : x
                                  )
                                );
                              }
                            }}
                          >
                            <option value="">+ Přidat montážníka…</option>
                            {availableToAdd.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} {emp.available ? '🟢' : '🔴 (absence)'}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Vehicle selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                        Vozidlo
                      </label>
                      <div className="flex items-center gap-2">
                        <Car size={16} className="text-slate-400 shrink-0" />
                        <select
                          className="input w-full text-xs font-semibold"
                          value={c.vehicleId ?? ''}
                          onChange={(e) =>
                            updateCrews(
                              crews.map((x) => (x.id === c.id ? { ...x, vehicleId: e.target.value || null } : x))
                            )
                          }
                        >
                          <option value="">Bez vybraného vozidla</option>
                          {loaded?.data?.vehicles?.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} · {v.status === 'AVAILABLE' ? 'Volné' : v.status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() =>
                  updateCrews([...crews, { id: crypto.randomUUID(), employeeIds: [], vehicleId: null }])
                }
                className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-3.5 text-xs font-bold text-sky-700 hover:bg-sky-50/50 hover:border-sky-300 transition flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                <span>Přidat další posádku / auto</span>
              </button>
            </div>
          )}

          {/* TAB 2: JOBS TO PLAN */}
          {activeTab === 'jobs' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-sm text-slate-900">
                  Zakázky ({selectedJobs.length} z {visibleJobs.length})
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => {
                      setSelectedJobs(visibleJobs.map((j) => j.id));
                      setInputsChanged(true);
                      requestKey.current = null;
                    }}
                    className="font-bold text-sky-700 hover:underline"
                  >
                    Vybrat vše
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    onClick={() => {
                      setSelectedJobs([]);
                      setInputsChanged(true);
                      requestKey.current = null;
                    }}
                    className="text-slate-500 hover:underline"
                  >
                    Zrušit
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Hledat klienta, město, zakázku…"
                    className="input w-full pl-9 text-xs"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <select
                    className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold"
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                  >
                    <option value="all">Všechny typy</option>
                    <option value="work">Běžné montáže</option>
                    {navigation && <option value="navigation">Navigation body</option>}
                  </select>

                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={readyOnly}
                      onChange={(e) => setReadyOnly(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Jen bez problému</span>
                  </label>
                </div>
              </div>

              {/* Jobs List */}
              <div className="max-h-[500px] overflow-y-auto space-y-2.5 pr-1">
                {visibleJobs.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-500 font-medium">
                    Žádné odpovídající zakázky k naplánování.
                  </p>
                ) : (
                  visibleJobs.map((j) => {
                    const isSelected = selectedJobs.includes(j.id);
                    return (
                      <div
                        key={j.id}
                        onClick={() => {
                          setSelectedJobs((old) =>
                            isSelected ? old.filter((id) => id !== j.id) : [...old, j.id]
                          );
                          setInputsChanged(true);
                          requestKey.current = null;
                        }}
                        className={`rounded-2xl border p-3.5 transition cursor-pointer ${
                          isSelected
                            ? 'border-sky-500 bg-sky-50/50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by parent div
                            className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-bold text-xs text-slate-900 truncate">{j.title}</h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                                {j.serviceMinutes ?? 45} min
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {j.clientName} · {j.address || 'Adresa nezadána'}
                            </p>

                            {j.blockedReason && (
                              <p className="mt-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-lg p-1.5">
                                ⚠️ {j.blockedReason}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Right Side: Map & Crew Stop Schedule (7 cols) */}
        <main className="lg:col-span-7 space-y-4">
          {/* Crew Switcher Tabs (when plan exists) */}
          {plan?.result?.crews && plan.result.crews.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {plan.result.crews.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCrewId(c.id)}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
                    activeCrew?.id === c.id
                      ? 'bg-sky-700 text-white shadow-md'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Posádka {i + 1}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      activeCrew?.id === c.id ? 'bg-sky-800 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {c.stops.length} zastávek
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Interactive Map */}
          <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm overflow-hidden">
            <RouteMap
              result={plan?.result}
              depot={loaded?.profile?.depot}
              active={activeCrew?.id ?? ''}
            />
          </div>

          {/* Stop Timeline / Schedule for Active Crew */}
          {activeCrew ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Trasa: {activeCrew.names.join(' + ')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeCrew.vehicleName ?? 'Bez vozidla'} · Odjezd {formatTime(activeCrew.departureAt)} · Návrat {formatTime(activeCrew.endAt)}
                  </p>
                </div>

                {mapsLinks(plan!, activeCrew.id).map((href, i, links) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-sky-50 border border-sky-200 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100 transition"
                  >
                    <span>Otevřít v Google Maps ↗</span>
                  </a>
                ))}
              </div>

              {/* Ordered Stops List */}
              <div className="space-y-3">
                {activeCrew.stops.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">Tato posádka nemá v návrhu žádné zastávky.</p>
                ) : (
                  activeCrew.stops.map((s) => (
                    <div
                      key={s.jobId ?? s.workOrderId}
                      className="flex items-start gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-sky-700 text-xs font-black text-white">
                        {s.routeOrder}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            href={s.navigationOrderId ? `/navigation/orders/${s.navigationOrderId}` : `/work/${s.workOrderId}`}
                            className="font-bold text-xs sm:text-sm text-slate-900 hover:text-sky-700 hover:underline truncate"
                          >
                            {s.title}
                          </Link>

                          <span className="text-xs font-bold text-sky-800 bg-sky-100/80 px-2.5 py-0.5 rounded-lg shrink-0">
                            Příjezd {formatTime(s.arrivalAt)} (práce {formatTime(s.startAt)}–{formatTime(s.endAt)})
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1">
                          📍 {s.address}
                        </p>

                        {s.reason && (
                          <p className="text-xs text-slate-500 mt-1.5 bg-white p-2 rounded-xl border border-slate-100">
                            {s.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center space-y-2">
              <Navigation size={32} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-sm text-slate-700">Žádný aktivní plán trasy</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Vyberte zakázky a posádky v levém panelu a klikněte na tlačítko <strong>„Naplánovat trasy 🪄“</strong>.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
