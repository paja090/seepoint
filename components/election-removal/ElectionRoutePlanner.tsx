'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Clock,
  Car,
  Users,
  Plus,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Route,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ElectionCampaign, ElectionRemovalPoint } from '@prisma/client';
import { ELECTION_REMOVAL_MEDIA_LABELS } from '@/lib/election-removal/constants';
import type { PlanningInput, PlanningResult, PlannedCrew } from '@/lib/field-planning/contracts';

interface ResourceEmployee {
  id: string;
  name: string;
  role: string;
  position: string | null;
}

interface ResourceVehicle {
  id: string;
  name: string;
  registrationNumber: string | null;
}

interface CrewConfig {
  id: string;
  name: string;
  employeeIds: string[];
  vehicleId: string | null;
}

interface ElectionRoutePlannerProps {
  campaign: ElectionCampaign & {
    points: ElectionRemovalPoint[];
  };
  employees: ResourceEmployee[];
  vehicles: ResourceVehicle[];
}

export function ElectionRoutePlanner({
  campaign,
  employees,
  vehicles,
}: ElectionRoutePlannerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Planning date & time configuration
  const initialDate = campaign.targetDate
    ? new Date(campaign.targetDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState<string>(initialDate);
  const [startTime, setStartTime] = useState<string>('07:30');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [flexibleHours, setFlexibleHours] = useState<boolean>(true);

  // Crews configuration: default to 1 crew with first available employee & vehicle if present
  const [crews, setCrews] = useState<CrewConfig[]>([
    {
      id: 'crew-1',
      name: 'Posádka 1',
      employeeIds: employees.length > 0 ? [employees[0].id] : [],
      vehicleId: vehicles.length > 0 ? vehicles[0].id : null,
    },
  ]);

  // Points selection: pending points only
  const pendingPoints = campaign.points.filter((p) =>
    ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ISSUE'].includes(p.status)
  );

  // Optimization state
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  const [planningInput, setPlanningInput] = useState<PlanningInput | null>(null);
  const [planningResult, setPlanningResult] = useState<PlanningResult | null>(null);

  // Crew accordion expand state in preview
  const [expandedCrewIds, setExpandedCrewIds] = useState<Record<string, boolean>>({
    'crew-1': true,
  });

  // Saving state
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  // Add a new crew
  const handleAddCrew = () => {
    const nextIndex = crews.length + 1;
    const newCrewId = `crew-${nextIndex}`;
    // Find unassigned employee
    const assignedEmpIds = new Set(crews.flatMap((c) => c.employeeIds));
    const freeEmp = employees.find((e) => !assignedEmpIds.has(e.id));
    // Find unassigned vehicle
    const assignedVehIds = new Set(crews.map((c) => c.vehicleId).filter(Boolean));
    const freeVeh = vehicles.find((v) => !assignedVehIds.has(v.id));

    setCrews((prev) => [
      ...prev,
      {
        id: newCrewId,
        name: `Posádka ${nextIndex}`,
        employeeIds: freeEmp ? [freeEmp.id] : [],
        vehicleId: freeVeh ? freeVeh.id : null,
      },
    ]);

    setExpandedCrewIds((prev) => ({ ...prev, [newCrewId]: true }));
  };

  // Remove crew
  const handleRemoveCrew = (crewId: string) => {
    if (crews.length <= 1) return;
    setCrews((prev) => prev.filter((c) => c.id !== crewId));
  };

  // Toggle employee in crew
  const handleToggleEmployee = (crewId: string, empId: string) => {
    setCrews((prev) =>
      prev.map((c) => {
        if (c.id !== crewId) return c;
        const exists = c.employeeIds.includes(empId);
        return {
          ...c,
          employeeIds: exists
            ? c.employeeIds.filter((id) => id !== empId)
            : [...c.employeeIds, empId],
        };
      })
    );
  };

  // Change vehicle in crew
  const handleVehicleChange = (crewId: string, vehicleId: string) => {
    setCrews((prev) =>
      prev.map((c) => (c.id === crewId ? { ...c, vehicleId: vehicleId || null } : c))
    );
  };

  // Run Route Optimization
  const handleCalculateRoutes = async () => {
    // Validate
    if (!date) {
      setCalculationError('Vyberte prosím datum plánovaného výjezdu.');
      return;
    }
    const emptyCrews = crews.filter((c) => c.employeeIds.length === 0);
    if (emptyCrews.length > 0) {
      setCalculationError('Každá posádka musí mít přiřazeného alespoň jednoho pracovníka.');
      return;
    }

    setIsCalculating(true);
    setCalculationError(null);
    setPlanningResult(null);

    try {
      const res = await fetch(`/api/election-removal/campaigns/${campaign.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          startTime,
          endTime,
          flexibleHours,
          crews: crews.map((c) => ({
            id: c.id,
            employeeIds: c.employeeIds,
            vehicleId: c.vehicleId,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se optimalizovat trasy.');
      }

      setPlanningInput(data.planningInput);
      setPlanningResult(data.planningResult);
    } catch (err: unknown) {
      setCalculationError(
        err instanceof Error ? err.message : 'Chyba při výpočtu plánu.'
      );
    } finally {
      setIsCalculating(false);
    }
  };

  // Approve and Save Plan
  const handleApprovePlan = async () => {
    if (!planningInput || !planningResult) return;

    setIsApproving(true);
    setApprovalError(null);

    try {
      const res = await fetch(
        `/api/election-removal/campaigns/${campaign.id}/plan/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planningInput,
            planningResult,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se schválit a uložit plán.');
      }

      startTransition(() => {
        router.push(`/election-removal/${campaign.id}`);
      });
    } catch (err: unknown) {
      setApprovalError(
        err instanceof Error ? err.message : 'Chyba při ukládání plánu.'
      );
      setIsApproving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Configuration Card */}
      <div className="card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-600" />
              Nastavení výjezdu a posádek
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Vyberte datum, čas odjezdu a posádky pro demontáž {pendingPoints.length} médií.
              {campaign.points.length > pendingPoints.length && (
                <span className="text-emerald-600 font-semibold ml-1">
                  ({campaign.points.length - pendingPoints.length} ks již dříve dokončeno).
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-sky-50 text-sky-700 rounded-lg text-xs font-semibold">
              K naplánování: {pendingPoints.length} médií
            </span>
            {campaign.points.length > pendingPoints.length && (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold">
                ✓ {campaign.points.length - pendingPoints.length} hotovo
              </span>
            )}
          </div>
        </div>

        {/* Date and Time Settings */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              Datum realizace demontáže *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              Čas odjezdu z depa
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              Plánovaný konec směny
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Flexible Working Hours Toggle */}
        <div className="p-3.5 bg-sky-50/70 border border-sky-100 rounded-xl flex items-start gap-3">
          <input
            id="flexibleHours"
            type="checkbox"
            checked={flexibleHours}
            onChange={(e) => setFlexibleHours(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
          />
          <label htmlFor="flexibleHours" className="text-xs text-slate-700 cursor-pointer select-none">
            <span className="font-semibold text-slate-900 block">
              Pružná pracovní doba (posádky mohou zůstat déle v terénu)
            </span>
            Povolí přesčasy a umožní posádkám obsloužit všechny zadané body bez jejich odmítnutí z důvodu konce pevné směny.
          </label>
        </div>

        {/* Crews Setup */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              Pracovní posádky a vozidla ({crews.length})
            </h3>

            <button
              type="button"
              onClick={handleAddCrew}
              className="btn bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 text-xs font-semibold inline-flex items-center gap-1.5 py-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Přidat posádku</span>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {crews.map((crew, idx) => (
              <div
                key={crew.id}
                className="p-4 border border-slate-200 rounded-xl space-y-4 bg-slate-50/40 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-xs flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    {crew.name}
                  </span>

                  {crews.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCrew(crew.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition"
                      title="Odebrat posádku"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Vehicle Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-slate-400" />
                    Vozidlo posádky
                  </label>
                  <select
                    value={crew.vehicleId || ''}
                    onChange={(e) => handleVehicleChange(crew.id, e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                  >
                    <option value="">– Bez vybraného vozidla –</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} {v.registrationNumber ? `(${v.registrationNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employees Selection */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    Členové posádky ({crew.employeeIds.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1 bg-white border border-slate-200 rounded-lg p-2 text-xs">
                    {employees.map((emp) => {
                      const isSelected = crew.employeeIds.includes(emp.id);
                      return (
                        <label
                          key={emp.id}
                          className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition ${
                            isSelected ? 'bg-sky-50 text-sky-900 font-semibold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleEmployee(crew.id, emp.id)}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span>{emp.name}</span>
                          {emp.position && (
                            <span className="text-[10px] text-slate-400 font-normal ml-auto">
                              {emp.position}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button: Calculate */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Routing engine optimalizuje přejezdy podle reálných silničních vzdáleností a servisních časů médií.
          </p>

          <button
            type="button"
            onClick={handleCalculateRoutes}
            disabled={isCalculating || pendingPoints.length === 0}
            className="btn btn-primary px-6 py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-md disabled:opacity-50"
          >
            {isCalculating ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Optimalizuji trasy a přejezdy...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Vypočítat a optimalizovat trasy</span>
              </>
            )}
          </button>
        </div>

        {calculationError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{calculationError}</span>
          </div>
        )}
      </div>

      {/* Optimization Results Card */}
      {planningResult && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="card p-6 space-y-4 bg-slate-900 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  Výsledek optimalizace
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">
                  Navržené demontážní trasy
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApprovePlan}
                  disabled={isApproving || isPending}
                  className="btn btn-primary px-6 py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isApproving ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Schvaluji a ukládám plán...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Schválit a uložit plán do realizace</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  Aktivních tras
                </p>
                <p className="text-2xl font-bold text-white">
                  {planningResult.crews.length}
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  Naplánovaných nosičů
                </p>
                <p className="text-2xl font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-5 h-5" />
                  {planningResult.crews.reduce((acc, c) => acc + c.stops.length, 0)} ks
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  Celkem kilometry
                </p>
                <p className="text-2xl font-bold text-sky-400 flex items-center gap-1">
                  <Route className="w-5 h-5" />
                  {(planningResult.distanceMeters / 1000).toFixed(1)} km
                </p>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400">
                  Čistá práce + přejezdy
                </p>
                <p className="text-2xl font-bold text-indigo-400 flex items-center gap-1">
                  <Clock className="w-5 h-5" />
                  {Math.floor(
                    (planningResult.serviceMinutes * 60 + planningResult.travelSeconds) / 3600
                  )}{' '}
                  h{' '}
                  {Math.round(
                    ((planningResult.serviceMinutes * 60 + planningResult.travelSeconds) % 3600) /
                      60
                  )}{' '}
                  min
                </p>
              </div>
            </div>

            {planningResult.unassigned.length > 0 && (
              <div className="bg-amber-950/50 border border-amber-800 text-amber-200 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>
                  {planningResult.unassigned.length} médií se nevešlo do pracovní doby zvolených posádek. Pro jejich zařazení přidejte další posádku nebo prodlužte čas.
                </span>
              </div>
            )}

            {approvalError && (
              <div className="bg-rose-950/50 border border-rose-800 text-rose-200 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{approvalError}</span>
              </div>
            )}
          </div>

          {/* Crews breakdown */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Harmonogram jednotlivých tras a zastávek
            </h3>

            {planningResult.crews.map((crew, cIdx) => {
              const isExpanded = expandedCrewIds[crew.id] ?? true;
              const totalHours = Math.floor(
                (crew.serviceMinutes * 60 + crew.travelSeconds) / 3600
              );
              const totalMins = Math.round(
                ((crew.serviceMinutes * 60 + crew.travelSeconds) % 3600) / 60
              );

              return (
                <div key={crew.id} className="card overflow-hidden border border-slate-200">
                  {/* Crew Header */}
                  <div
                    onClick={() =>
                      setExpandedCrewIds((prev) => ({
                        ...prev,
                        [crew.id]: !isExpanded,
                      }))
                    }
                    className="p-4 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer hover:bg-slate-100/70 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-600 text-white font-bold flex items-center justify-center text-sm">
                        {cIdx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Trasa posádky: {crew.names.join(', ') || crew.id}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          {crew.vehicleName && (
                            <span className="flex items-center gap-1">
                              <Car className="w-3.5 h-3.5 text-slate-400" />
                              {crew.vehicleName}
                            </span>
                          )}
                          <span>Odjezd: {new Date(crew.departureAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>Návrat: {new Date(crew.endAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {crew.stops.length} médií
                        </span>
                        <p className="text-slate-500">
                          {(crew.distanceMeters / 1000).toFixed(1)} km · {totalHours} h {totalMins} min
                        </p>
                      </div>

                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Stops Timeline */}
                  {isExpanded && (
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                            <th className="py-2 px-2.5">Poř.</th>
                            <th className="py-2 px-2.5">Čas</th>
                            <th className="py-2 px-2.5">Přejezd</th>
                            <th className="py-2 px-2.5">Médium / Zastávka</th>
                            <th className="py-2 px-2.5">Typ média</th>
                            <th className="py-2 px-2.5">GPS</th>
                            <th className="py-2 px-2.5 text-right">Délka práce</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {crew.stops.map((stop) => {
                            const arrival = new Date(stop.arrivalAt).toLocaleTimeString('cs-CZ', {
                              hour: '2-digit',
                              minute: '2-digit',
                            });
                            const departure = new Date(stop.endAt).toLocaleTimeString('cs-CZ', {
                              hour: '2-digit',
                              minute: '2-digit',
                            });
                            const travelKm = (stop.travel.distanceMeters / 1000).toFixed(1);
                            const travelMin = Math.round(stop.travel.durationSeconds / 60);

                            return (
                              <tr key={stop.jobId || stop.routeOrder} className="hover:bg-slate-50/60 transition">
                                <td className="py-2 px-2.5 font-mono font-bold text-slate-500">
                                  {stop.routeOrder}.
                                </td>
                                <td className="py-2 px-2.5 font-semibold text-slate-900 whitespace-nowrap">
                                  {arrival} – {departure}
                                </td>
                                <td className="py-2 px-2.5 text-slate-500">
                                  {stop.travel.distanceMeters === 0 ? (
                                    <span className="text-emerald-600 font-semibold">
                                      0 km (stejné GPS)
                                    </span>
                                  ) : (
                                    <span>
                                      +{travelKm} km ({travelMin} min)
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2.5">
                                  <p className="font-semibold text-slate-900">{stop.title}</p>
                                  {stop.address && (
                                    <p className="text-[11px] text-slate-500">{stop.address}</p>
                                  )}
                                </td>
                                <td className="py-2 px-2.5">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                                    {ELECTION_REMOVAL_MEDIA_LABELS[
                                      (stop.mediaType as keyof typeof ELECTION_REMOVAL_MEDIA_LABELS) ||
                                        'OTHER'
                                    ] || stop.mediaType}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 font-mono text-[11px]">
                                  <a
                                    href={`https://www.google.com/maps?q=${stop.location.latitude},${stop.location.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sky-600 hover:underline inline-flex items-center gap-1"
                                  >
                                    <span>
                                      {stop.location.latitude.toFixed(5)}, {stop.location.longitude.toFixed(5)}
                                    </span>
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                  </a>
                                </td>
                                <td className="py-2 px-2.5 text-right font-semibold text-slate-700">
                                  {stop.serviceMinutes} min
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
