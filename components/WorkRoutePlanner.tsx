'use client';
import { hasApprovableWork } from '@/lib/field-planning/approval-rules';
import { planningDayOffset, planningStopHref } from '@/lib/field-planning/presentation';
import { PostponeRouteButton } from '@/components/election-removal/PostponeRouteButton';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CrewInput, PlanningInput, PlanningProfile, PlanView } from '@/lib/field-planning/contracts';
import { RouteMap } from './field-planning/RouteMap';
import { PlanningProfileForm } from './field-planning/PlanningProfileForm';
import { FieldTelemetryCard } from './field-planning/FieldTelemetryCard';
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
  Search,
  RefreshCw,
  Navigation,
  Pencil,
  UserCheck,
  X,
} from 'lucide-react';

type Loaded = { profile: PlanningProfile | null; data: PlanningInput | null; plans: PlanView[] };

function getPlanSummaryDetails(p: PlanView) {
  const allStops = p.result.crews.flatMap((c) => c.stops);
  const totalStops = allStops.length;

  const clientMap = new Map<string, number>();
  const citySet = new Set<string>();

  for (const s of allStops) {
    const client = s.clientName?.trim();
    if (client) {
      clientMap.set(client, (clientMap.get(client) ?? 0) + 1);
    }
    if (s.address) {
      const parts = s.address.split(',').map((part) => part.trim());
      const candidate = parts[parts.length - 1] || parts[0];
      if (candidate) {
        const cleaned = candidate.replace(/^\d{3}\s?\d{2}\s*/, '').trim();
        if (cleaned) citySet.add(cleaned);
      }
    }
  }

  const clients = Array.from(clientMap.entries()).map(([name, count]) => ({ name, count }));
  const cities = Array.from(citySet);
  const isValid = p.status === 'APPROVED' || p.status === 'ACTIVE';

  let statusBadge = {
    label: 'Návrh (Draft)',
    bg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: '📝',
    text: 'Zatím neodsouhlasený návrh — montéři v terénu trasu nevidí.',
  };

  if (p.status === 'APPROVED') {
    statusBadge = {
      label: 'Platná trasa (Schváleno)',
      bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: '✓',
      text: 'Platná schválená trasa — pracovníci ji mají aktivní v sekci Moje trasa.',
    };
  } else if (p.status === 'ACTIVE') {
    statusBadge = {
      label: 'Probíhá v terénu',
      bg: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      icon: '⚡',
      text: 'Výjezd na této trase právě probíhá v terénu.',
    };
  } else if (p.status === 'COMPLETED') {
    statusBadge = {
      label: 'Dokončeno',
      bg: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
      icon: '🏁',
      text: 'Trasa a výjezd byly dokončeny.',
    };
  }

  return {
    totalStops,
    clients,
    cities,
    isValid,
    statusBadge,
  };
}

export function WorkRoutePlanner({
  defaultDate,
  country,
  navigation = false,
  initialJobIds,
  initialPlanId,
  standardOnly = false,
  unified = false,
}: {
  navigation?: boolean;
  defaultDate: string;
  country: string | null;
  initialJobIds?: string[];
  initialPlanId?: string;
  standardOnly?: boolean;
  unified?: boolean;
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
  const [telemetryOpen, setTelemetryOpen] = useState(false);
  const [inputsChanged, setInputsChanged] = useState(false);
  const [acceptEstimated, setAcceptEstimated] = useState(false);

  const [renameModal, setRenameModal] = useState<{ open: boolean; crewId: string; currentName: string } | null>(null);
  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    crewId: string;
    crewName: string;
    currentWorkerNames: string[];
    currentEmployeeIds: string[];
  } | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferMode, setTransferMode] = useState<'replace_first' | 'replace_all'>('replace_first');
  const [toast, setToast] = useState<string | null>(null);

  const requestKey = useRef<string | null>(null);
  const loadCounter = useRef(0);

  async function handleRenameSubmit(crewId: string, newName: string) {
    const trimmed = newName.trim();
    setRenameModal(null);
    setCrews((prev) => prev.map((c) => (c.id === crewId ? { ...c, name: trimmed } : c)));
    if (!plan?.id) {
      setToast('Název trasy v návrhu byl aktualizován.');
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/work/route', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'renameCrew', id: plan.id, crewId, name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlan(data);
      setLoaded((old) => (old ? { ...old, plans: [data, ...old.plans.filter((p) => p.id !== data.id)] } : old));
      setToast(`Trasa byla úspěšně přejmenována na „${trimmed || 'výchozí'}“.`);
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Přejmenování trasy selhalo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleTransferSubmit() {
    if (!transferModal || !transferTargetId) return;
    const { crewId, crewName } = transferModal;
    const targetEmp = loaded?.data?.employees.find((e) => e.id === transferTargetId);
    const targetName = targetEmp?.name || 'vybraného montážníka';

    setTransferModal(null);

    if (!plan?.id) {
      setCrews((prev) =>
        prev.map((c) => {
          if (c.id !== crewId) return c;
          if (transferMode === 'replace_all' || c.employeeIds.length <= 1) {
            return { ...c, employeeIds: [transferTargetId] };
          }
          return {
            ...c,
            employeeIds: [transferTargetId, ...c.employeeIds.slice(1).filter((id) => id !== transferTargetId)],
          };
        })
      );
      setInputsChanged(true);
      setToast(`Trasa ${crewName} byla v návrhu předána na: ${targetName}.`);
      setTimeout(() => setToast(null), 4000);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/work/route', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transferCrew',
          id: plan.id,
          crewId,
          targetEmployeeId: transferTargetId,
          mode: transferMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlan(data);
      setLoaded((old) => (old ? { ...old, plans: [data, ...old.plans.filter((p) => p.id !== data.id)] } : old));
      setCrews((prev) =>
        prev.map((c) => {
          if (c.id !== crewId) return c;
          const updated = data.result.crews.find((rc: { id: string }) => rc.id === crewId);
          return updated ? { ...c, employeeIds: updated.employeeIds, name: updated.name } : c;
        })
      );
      setToast(`Trasa ${crewName} byla úspěšně předána na pracovníka: ${targetName}.`);
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Předání trasy selhalo.');
    } finally {
      setBusy(false);
    }
  }

  const load = useCallback(async () => {
    const ticket = ++loadCounter.current;
    setError('');
    try {
      const response = await fetch(`/api/work/route?date=${date}${unified ? '&source=dispatch'+(initialJobIds?.length?'&jobs='+encodeURIComponent(initialJobIds.join(',')):'') : standardOnly ? '&source=work' : ''}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (ticket !== loadCounter.current) return;

      setInputsChanged(false);


      if(initialPlanId && !(data.plans as PlanView[]).some(p=>p.id===initialPlanId)){
        const selected=await fetch('/api/work/route?id='+encodeURIComponent(initialPlanId));
        const value=await selected.json();if(!selected.ok)throw new Error(value.error || 'Výjezd není dostupný.');
        if(ticket!==loadCounter.current)return;
        data.plans=[value,...data.plans];
      }
      setLoaded(data);
      const activePlan = initialPlanId
        ? (data.plans as PlanView[]).find((p: PlanView) => p.id === initialPlanId) ?? null
        : data.plans[0] ?? null;
      setPlan(activePlan);

      // Initialize crews with saved plan crews or default
      if (activePlan?.result?.crews && activePlan.result.crews.length > 0) {
        setCrews(
          activePlan.result.crews.map((c: { id: string; name?: string | null; employeeIds: string[]; vehicleId: string | null; startLocation?: { latitude: number; longitude: number } }) => ({
            id: c.id,
            name: c.name || null,
            employeeIds: c.employeeIds,
            vehicleId: c.vehicleId,
            startLocation: c.startLocation,
          }))
        );
      } else if (data.data?.crews && data.data.crews.length > 0) {
        setCrews(data.data.crews);
      } else {
        // Sensible default: 1 initial crew with first available employee
        const firstEmployee = data.data?.employees?.find((e: { available: boolean; isActive: boolean }) => e.isActive && e.available);
        const firstVehicle = data.data?.vehicles?.find((v: { status: string; reserved: boolean }) => v.status === 'AVAILABLE' && !v.reserved);
        setCrews([
          {
            id: crypto.randomUUID(),
            name: 'Trasa 1',
            employeeIds: firstEmployee ? [firstEmployee.id] : [],
            vehicleId: firstVehicle ? firstVehicle.id : null,
          },
        ]);
      }

      // Default selected jobs (preselect initialJobIds if provided from work plan)
      let jobsToSelect: string[] = [];
      const activePlanJobIds = (activePlan?.result?.crews?.flatMap((c: { stops?: { jobId?: string; workOrderId?: string }[] }) =>
        (c.stops ?? []).map((s) => s.jobId ?? s.workOrderId).filter(Boolean)
      ) ?? []) as string[];

      if (initialJobIds && initialJobIds.length > 0) {
        const availableJobIds = new Set((data.data?.jobs as { id: string }[] | undefined)?.map((j) => j.id) ?? []);
        const validInitial = initialJobIds.filter((id) => availableJobIds.has(id));
        jobsToSelect = [...new Set([...activePlanJobIds, ...validInitial])];
        if (validInitial.length > 0) {
          setInputsChanged(true);
          setActiveTab('jobs');
          setToast(`Z plánu práce bylo vybráno ${validInitial.length} zakázek k naplánování.`);
          setTimeout(() => setToast(null), 4000);
        }
      } else if (activePlanJobIds.length > 0) {
        jobsToSelect = [...new Set(activePlanJobIds)];
      } else {
        jobsToSelect =
          data.data?.jobs
            ?.filter((j: { status: string }) => !['DONE', 'CANCELLED'].includes(j.status))
            ?.map((j: { id: string }) => j.id) ?? [];
      }
      setSelectedJobs(jobsToSelect);

      if (activePlan?.result?.crews?.[0]) {
        setActiveCrewId(activePlan.result.crews[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Načtení plánovacích dat selhalo.');
    }
  }, [date, initialJobIds, initialPlanId, standardOnly, unified]);

  useEffect(() => {
    setPlan(null);
    setLoaded(null);
    requestKey.current = null;
    void load();
  }, [load]);

  // Periodic poll for live crew GPS locations when an approved/active plan is displayed
  useEffect(() => {
    if (!plan?.id || !['APPROVED', 'ACTIVE'].includes(plan.status)) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/work/route/locations?planId=${plan.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.locations) {
          setPlan((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              result: {
                ...prev.result,
                crews: prev.result.crews.map((c) => ({
                  ...c,
                  liveLocation: data.locations[c.id] ?? c.liveLocation ?? null,
                })),
              },
            };
          });
        }
      } catch {
        // Silently ignore background polling errors
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [plan?.id, plan?.status]);

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

  const currentPlanJobIds = new Set(
    plan?.result.crews.flatMap((c) => c.stops.map((s) => s.jobId ?? s.workOrderId).filter(Boolean)) ?? []
  );

  const visibleJobs =
    loaded?.data?.jobs.filter((j) => {
      const matchesSource =
        sourceFilter === 'all' ||
        (sourceFilter === 'navigation' && Boolean(j.navigationPointId)) ||
        (sourceFilter === 'work' && !j.navigationPointId);
      const isCurrentPlanJob = currentPlanJobIds.has(j.id);
      const isBlockedByOther = Boolean(j.blockedReason && (!isCurrentPlanJob || j.blockedReason !== 'Zastávka již patří jinému schválenému plánu.'));
      const matchesReady = !readyOnly || !isBlockedByOther;
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
    setDate(planningDayOffset(new Date(), loaded?.profile?.timezone ?? 'Europe/Prague', offsetDays));
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
          <button
            onClick={() => setTelemetryOpen(!telemetryOpen)}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition shadow-sm ${
              telemetryOpen
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            <Sparkles size={16} />
            <span>AI Telemetrie norem</span>
          </button>
        </div>
      </header>

      {plan && ['APPROVED', 'ACTIVE'].includes(plan.status) && (unified || plan.result.crews.some(c=>c.stops.some(s=>s.fieldWorkStepId))) && <div className="rounded-xl border border-sky-300 bg-sky-50 p-4"><PostponeRouteButton planId={plan.id} unified={unified} /></div>}

      {/* AI Telemetry & Calibration Section */}
      {telemetryOpen && (
        <div className="relative">
          <FieldTelemetryCard
            onProfileUpdated={() => {
              void load();
            }}
          />
        </div>
      )}

      {/* Profile Settings Modal */}
      {loaded && !loaded.profile && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nejdříve otevřete Nastavení depa a zadejte výchozí místo a místo návratu své firmy.
        </p>
      )}
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
                date === planningDayOffset(new Date(), loaded?.profile?.timezone ?? 'Europe/Prague', 0)
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
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              window.dispatchEvent(new CustomEvent('open-dispatch-intake'));
            }}
            className="flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-2.5 text-xs font-bold text-sky-800 hover:bg-sky-100 transition shadow-xs"
            title="Otevřít centrální formulář zadání práce v hlavním dispečinku"
          >
            <Plus size={15} />
            <span>+ Zadat práci</span>
          </button>

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
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition shadow-sm ${
                inputsChanged && ['APPROVED', 'ACTIVE'].includes(plan.status)
                  ? 'bg-sky-600 text-white hover:bg-sky-500'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40'
              }`}
              title={inputsChanged ? 'Přepočítat trasu se změnami ve vybraných zakázkách' : 'Přepočítat časy a pořadí stávající trasy'}
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
              <span>{inputsChanged && ['APPROVED', 'ACTIVE'].includes(plan.status) ? 'Přepočítat trasu se změnami' : 'Přepočítat'}</span>
            </button>
          )}

          {plan?.status === 'DRAFT' && (
            <button
              onClick={() => void handleAction('approve')}
              disabled={busy || inputsChanged || !hasApprovableWork(plan.result)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-600 disabled:opacity-40 transition"
            >
              <CheckCircle2 size={16} />
              <span>{plan.result.unassigned.length ? 'Schválit naplánovanou část' : 'Schválit a odeslat posádkám'}</span>
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

          {plan?.status === 'DRAFT' && plan.result.unassigned.length > 0 && (
            <div role="status" className="w-full rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Schválí se pouze naplánovaná práce. Nezařazené úkoly ({plan.result.unassigned.length}) zůstanou k dalšímu naplánování.
              <ul className="mt-2 list-disc pl-5">{plan.result.unassigned.map((alert, index) => <li key={index}>{alert.message}</li>)}</ul>
            </div>
          )}
          {/* Versions dropdown */}
          {Boolean(loaded?.plans?.length) && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="plan-version-select" className="text-xs font-bold text-slate-500 hidden sm:inline">
                Verze trasy:
              </label>
              <select
                id="plan-version-select"
                className="max-w-[260px] sm:max-w-md rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:border-sky-500 focus:outline-none cursor-pointer"
                value={plan?.id ?? ''}
                onChange={(e) => {
                  const chosen = loaded?.plans.find((p) => p.id === e.target.value);
                  if (chosen) {
                    setPlan(chosen);
                    setActiveCrewId(chosen.result.crews[0]?.id ?? '');
                  }
                }}
              >
                {loaded?.plans.map((p) => {
                  const d = getPlanSummaryDetails(p);
                  const clientStr = d.clients.length > 0
                    ? d.clients.slice(0, 2).map((c) => `${c.name} (${c.count})`).join(', ') + (d.clients.length > 2 ? '…' : '')
                    : null;
                  const cityStr = d.cities.length > 0
                    ? d.cities.slice(0, 2).join(', ') + (d.cities.length > 2 ? '…' : '')
                    : null;
                  const targetInfo = [clientStr, cityStr].filter(Boolean).join(' · ');

                  return (
                    <option key={p.id} value={p.id}>
                      {d.isValid ? '⭐ [PLATNÁ] ' : '[NÁVRH] '}
                      {p.name ? `${p.name} (v${p.version})` : `Verze ${p.version}`}
                      {` · ${d.statusBadge.label}`}
                      {targetInfo ? ` — ${targetInfo}` : ` (${d.totalStops} zastávek)`}
                    </option>
                  );
                })}
              </select>
            </div>
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
      {plan && (() => {
        const details = getPlanSummaryDetails(plan);
        return (
          <section className="rounded-3xl bg-slate-900 p-5 sm:p-6 text-white shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider border shadow-2xs ${details.statusBadge.bg}`}
                >
                  <span>{details.statusBadge.icon}</span>
                  <span>{details.statusBadge.label}</span>
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {plan.name ? `${plan.name} (Verze ${plan.version})` : `Verze ${plan.version}`}
                </span>
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

            {/* Target orders / clients & destination cities strip */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {details.isValid ? 'Platná trasa pokrývá:' : 'Tento návrh plánuje:'}
              </span>
              {details.clients.length > 0 ? (
                details.clients.map((c) => (
                  <span
                    key={c.name}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-950/80 border border-sky-700/60 px-2.5 py-1 text-xs font-bold text-sky-200"
                  >
                    <span>🎯 {c.name}</span>
                    <span className="text-[10px] text-sky-400">({c.count})</span>
                  </span>
                ))
              ) : (
                <span className="text-slate-400 italic">Běžné výjezdy / bez zadaného klienta</span>
              )}

              {details.cities.length > 0 && (
                <span className="inline-flex items-center gap-1 text-slate-300 ml-2">
                  <span className="text-slate-500 font-medium">📍 Směr:</span>
                  <span className="font-semibold text-slate-200">{details.cities.slice(0, 4).join(', ')}{details.cities.length > 4 ? '…' : ''}</span>
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                💡 {plan.result.explanation}
              </p>
              <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                {details.statusBadge.text}
              </span>
            </div>

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
        );
      })()}

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


                return (
                  <div
                    key={c.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-800 text-xs font-black">
                          #{index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            placeholder={`Název trasy ${index + 1} (např. Sever, Centrum...)`}
                            value={c.name ?? ''}
                            onChange={(e) =>
                              updateCrews(
                                crews.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x))
                              )
                            }
                            className="input w-full text-xs font-bold text-slate-900 py-1 px-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50 focus:bg-white transition"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setTransferTargetId('');
                            setTransferModal({
                              open: true,
                              crewId: c.id,
                              crewName: c.name || `Posádka ${index + 1}`,
                              currentWorkerNames: assignedEmployees.map((e) => e.name),
                              currentEmployeeIds: c.employeeIds,
                            });
                          }}
                          className="flex items-center gap-1 rounded-xl bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                          title="Předat trasu jinému pracovníkovi"
                        >
                          <UserCheck size={14} />
                          <span className="hidden sm:inline">Předat</span>
                        </button>

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
                  updateCrews([...crews, { id: crypto.randomUUID(), name: `Trasa ${crews.length + 1}`, employeeIds: [], vehicleId: null }])
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
                    type="button"
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      window.dispatchEvent(new CustomEvent('open-dispatch-intake'));
                    }}
                    className="flex items-center gap-1 font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-200 transition mr-1"
                    title="Otevřít centrální formulář zadání práce v dispečinku"
                  >
                    <Plus size={13} />
                    <span>Přidat práci</span>
                  </button>
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

                            {j.blockedReason && (!currentPlanJobIds.has(j.id) || j.blockedReason !== 'Zastávka již patří jinému schválenému plánu.') ? (
                              <p className="mt-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-lg p-1.5">
                                ⚠️ {j.blockedReason}
                              </p>
                            ) : currentPlanJobIds.has(j.id) ? (
                              <p className="mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg p-1.5 flex items-center gap-1">
                                <span>✓ Součást této trasy</span>
                              </p>
                            ) : null}
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
                  <div className="flex items-center gap-1.5">
                    <span>{c.name || `Posádka ${i + 1}`}</span>
                    {c.names && c.names.length > 0 && (
                      <span className="text-[10px] font-normal opacity-75 hidden sm:inline">
                        ({c.names.join(' + ')})
                      </span>
                    )}
                    {c.liveLocation && (
                      <span
                        className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse"
                        title="Živá GPS poloha na mapě"
                      />
                    )}
                  </div>
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
          <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm overflow-hidden space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-sky-600" />
                <h3 className="text-xs font-extrabold text-slate-800">
                  Dispečerská mapa tras a živých poloh posádek
                </h3>
              </div>
              {plan?.result?.crews?.some((c) => c.liveLocation) && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Živé GPS posádek aktivní</span>
                </span>
              )}
            </div>
            <RouteMap
              result={plan?.result}
              depot={loaded?.profile?.depot}
              warehouses={loaded?.profile?.warehouses}
              active={activeCrew?.id ?? ''}
            />
          </div>

          {/* Stop Timeline / Schedule for Active Crew */}
          {activeCrew ? (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-slate-900">
                      Trasa: {activeCrew.name || `Posádka ${plan ? plan.result.crews.indexOf(activeCrew) + 1 : 1}`}
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setRenameModal({
                          open: true,
                          crewId: activeCrew.id,
                          currentName: activeCrew.name || `Posádka ${plan ? plan.result.crews.indexOf(activeCrew) + 1 : 1}`,
                        })
                      }
                      className="p-1 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-slate-100 transition"
                      title="Pojmenovat / přejmenovat trasu"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Montážníci:{' '}
                    <strong className="text-slate-800 font-semibold">
                      {activeCrew.names.join(' + ') || 'Nepřiřazeno'}
                    </strong>
                    {' · '}
                    {activeCrew.vehicleName ?? 'Bez vozidla'} · Odjezd {formatTime(activeCrew.departureAt)} · Návrat {formatTime(activeCrew.endAt)}
                  </p>
                  {activeCrew.liveLocation && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-bold text-emerald-900 shadow-2xs">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span>
                        Živá GPS poloha:{' '}
                        {activeCrew.liveLocation.speed != null && activeCrew.liveLocation.speed > 2
                          ? `${Math.round(activeCrew.liveLocation.speed * 3.6)} km/h`
                          : 'Stojí na místě'}
                        {' · '}
                        signál{' '}
                        {Math.round(
                          (Date.now() - new Date(activeCrew.liveLocation.updatedAt).getTime()) / 1000
                        ) < 60
                          ? 'před chvílí'
                          : `před ${Math.round(
                              (Date.now() - new Date(activeCrew.liveLocation.updatedAt).getTime()) /
                                60000
                            )} min`}
                      </span>
                    </div>
                  )}

                  {/* Summary of clients and towns for this specific crew */}
                  {(() => {
                    const crewClients = Array.from(
                      new Set(activeCrew.stops.map((s) => s.clientName?.trim()).filter(Boolean) as string[])
                    );
                    const crewCities = Array.from(
                      new Set(
                        activeCrew.stops
                          .map((s) => {
                            if (!s.address) return null;
                            const parts = s.address.split(',').map((p) => p.trim());
                            const cand = parts[parts.length - 1] || parts[0];
                            return cand ? cand.replace(/^\d{3}\s?\d{2}\s*/, '').trim() : null;
                          })
                          .filter(Boolean) as string[]
                      )
                    );
                    if (crewClients.length === 0 && crewCities.length === 0) return null;

                    return (
                      <div className="flex flex-wrap items-center gap-2 mt-2 pt-1">
                        {crewClients.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Zakázky:</span>
                            {crewClients.map((client) => (
                              <span
                                key={client}
                                className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200"
                              >
                                🎯 {client}
                              </span>
                            ))}
                          </div>
                        )}
                        {crewCities.length > 0 && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Směr:</span>
                            <span>📍 {crewCities.slice(0, 3).join(', ')}{crewCities.length > 3 ? '…' : ''}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTransferTargetId('');
                      setTransferModal({
                        open: true,
                        crewId: activeCrew.id,
                        crewName: activeCrew.name || `Posádka ${plan ? plan.result.crews.indexOf(activeCrew) + 1 : 1}`,
                        currentWorkerNames: activeCrew.names,
                        currentEmployeeIds: activeCrew.employeeIds,
                      });
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-2xs"
                    title="Předat celou trasu jinému pracovníkovi z týmu"
                  >
                    <UserCheck size={14} />
                    <span>Předat trasu</span>
                  </button>
                </div>
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
                          {planningStopHref(s) ? <Link
                            href={planningStopHref(s)!}
                            className="font-bold text-xs sm:text-sm text-slate-900 hover:text-sky-700 hover:underline truncate"
                          >
                            {s.title}
                          </Link> : <span className="font-bold text-xs sm:text-sm text-slate-900">{s.title}</span>}

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

      {/* Rename Route Modal */}
      {renameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pencil size={18} className="text-sky-600" />
                Pojmenovat / přejmenovat trasu
              </h3>
              <button
                type="button"
                onClick={() => setRenameModal(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const val = fd.get('name')?.toString() || '';
                void handleRenameSubmit(renameModal.crewId, val);
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Název trasy / posádky
                </label>
                <input
                  name="name"
                  defaultValue={renameModal.currentName}
                  placeholder="např. Severní okruh, Billboardy centrum..."
                  autoFocus
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 transition"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Tento název uvidí dispečer v plánu i na mapě a montážník ve své mobilní aplikaci.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModal(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-500 disabled:opacity-50 transition"
                >
                  {busy ? 'Ukládám…' : 'Uložit název'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Route Modal */}
      {transferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck size={18} className="text-indigo-600" />
                Předat trasu na jiného pracovníka
              </h3>
              <button
                type="button"
                onClick={() => setTransferModal(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-3.5 text-xs text-indigo-950 space-y-1">
                <div className="font-bold flex items-center justify-between">
                  <span>Trasa:</span>
                  <span className="font-extrabold text-indigo-700">{transferModal.crewName}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Aktuálně přiřazeno:</span>
                  <span className="font-semibold">{transferModal.currentWorkerNames.join(' + ') || 'Nikdo'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Předat na člena týmu:
                </label>
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
                >
                  <option value="">-- Vyberte pracovníka z týmu --</option>
                  {loaded?.data?.employees
                    ?.filter((e) => !transferModal.currentEmployeeIds.includes(e.id))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.roles?.join(', ') || 'Pracovník'}) {!e.available ? '⚠️ má absenci' : ''}
                      </option>
                    ))}
                </select>
              </div>

              {transferModal.currentEmployeeIds.length > 1 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Režim předání posádky:
                  </label>
                  <div className="space-y-1.5 text-xs">
                    <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="radio"
                        name="transferMode"
                        checked={transferMode === 'replace_first'}
                        onChange={() => setTransferMode('replace_first')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Nahradit vedoucího posádky (1. montážníka)</div>
                        <div className="text-[11px] text-slate-500">Ostatní členové posádky zůstanou v autě.</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="radio"
                        name="transferMode"
                        checked={transferMode === 'replace_all'}
                        onChange={() => setTransferMode('replace_all')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">Nahradit celou posádku</div>
                        <div className="text-[11px] text-slate-500">Trasa bude předána výhradně novému pracovníkovi.</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTransferModal(null)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Zrušit
                </button>
                <button
                  type="button"
                  disabled={!transferTargetId || busy}
                  onClick={() => void handleTransferSubmit()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  {busy ? 'Předávám...' : 'Předat trasu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl bg-slate-900 text-white px-4 py-3 shadow-xl border border-slate-800 text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
