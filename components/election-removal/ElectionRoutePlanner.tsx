'use client';

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ReleaseWorkPanel, type ReleaseWorkPoint } from './ReleaseWorkPanel';
import {
  Calendar,
  Clock,
  Car,
  Users,
  Plus,
  Trash2,
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Route,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ElectionCampaign, ElectionRemovalPoint } from '@prisma/client';

import { ELECTION_REMOVAL_MEDIA_LABELS } from '@/lib/election-removal/constants';
import type { PlanningInput, PlanningResult } from '@/lib/field-planning/contracts';
import { LocationPickerMap } from './LocationPickerMap';
import { ElectionRemovalMap } from './ElectionRemovalMap';

interface ResourceEmployee {
  id: string;
  name: string;
  role: string;
  position: string | null;
  busyReason?: string | null;
}

interface ResourceVehicle {
  capacitySlots?: number | null;
  equipment?: string[];
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
    points: (ElectionRemovalPoint & ReleaseWorkPoint)[];
  };
  employees: ResourceEmployee[];
  vehicles: ResourceVehicle[];
  initialDepot?: { latitude: number; longitude: number };
  initialSelectedPointIds?: string[];
  parentPlanId?: string;
  canManage?: boolean;
  fieldPlans?: Array<{ id: string; date: string; status: string; version: number }>;
}

function getCampaignDefaultOperation(campaign: ElectionCampaign): string {
  if (campaign.mediaDefaults && typeof campaign.mediaDefaults === 'object') {
    const md = campaign.mediaDefaults as Record<string, unknown>;
    if (typeof md.defaultOperation === 'string' && md.defaultOperation) {
      return md.defaultOperation;
    }
    if (md.purpose === 'INSTALLATION') return 'INSTALL_AD';
    if (md.purpose === 'REMOVAL') return 'REMOVE_AD';
    if (md.purpose === 'RELOCATION') return 'RELOCATION';
    if (md.purpose === 'INSPECTION') return 'INSPECTION';
  }
  const name = (campaign.name || '').toLowerCase();
  if (
    name.includes('deinstal') ||
    name.includes('demont') ||
    name.includes('odstran') ||
    name.includes('volby') ||
    name.includes('removal')
  ) {
    return 'REMOVE_AD';
  }
  if (
    name.includes('instal') ||
    name.includes('montaz') ||
    name.includes('montáž') ||
    name.includes('vylep') ||
    name.includes('výlep')
  ) {
    return 'INSTALL_AD';
  }
  if (
    name.includes('presun') ||
    name.includes('přesun') ||
    name.includes('prevoz') ||
    name.includes('převoz')
  ) {
    return 'RELOCATION';
  }
  return 'REMOVE_AD';
}

export function ElectionRoutePlanner({
  campaign,
  employees,
  vehicles,
  initialDepot,
  initialSelectedPointIds,
  parentPlanId,
  fieldPlans,
  canManage = false,
}: ElectionRoutePlannerProps) {
  const router = useRouter();
  const [draftPlanId, setDraftPlanId] = useState<string>();
  const [routeMode, setRouteMode] = useState('SEPARATE_MEDIA');
  const [isPending, startTransition] = useTransition();

  // Planning date & time configuration
  const initialDate = campaign.targetDate
    ? new Date(campaign.targetDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState<string>(initialDate);
  const [startTime, setStartTime] = useState<string>('07:30');
  const [endTime, setEndTime] = useState<string>('18:00');
  const [flexibleHours, setFlexibleHours] = useState<boolean>(true);
  const [vehicleCapacitySlots, setVehicleCapacitySlots] = useState<number>(30);
  const [warehouseUnloadMinutes, setWarehouseUnloadMinutes] = useState<number>(15);

  // Warehouse (depot) location: where items are unloaded and crews return
  const [depotLat, setDepotLat] = useState<string>(
    initialDepot?.latitude ? String(initialDepot.latitude) : '50.08804'
  );
  const [depotLng, setDepotLng] = useState<string>(
    initialDepot?.longitude ? String(initialDepot.longitude) : '14.42076'
  );
  const [saveDepotAsDefault, setSaveDepotAsDefault] = useState<boolean>(false);
  const [showDepotMap, setShowDepotMap] = useState<boolean>(true);

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

  const detectedParentPlan = useMemo(() => {
    if (parentPlanId) {
      return fieldPlans?.find((p) => p.id === parentPlanId);
    }
    const assignedPlanIds = Array.from(
      new Set(pendingPoints.map((p) => p.assignedFieldPlanId).filter(Boolean))
    );
    if (assignedPlanIds.length === 1) {
      return fieldPlans?.find((p) => p.id === assignedPlanIds[0]);
    }
    return undefined;
  }, [parentPlanId, fieldPlans, pendingPoints]);

  const campaignDefaultOp = useMemo(() => getCampaignDefaultOperation(campaign), [campaign]);

  const getPointEffectiveOp = (p: ElectionRemovalPoint): string => {
    return p.operationType || campaignDefaultOp;
  };

  const unassignedPoints = useMemo(
    () => pendingPoints.filter((p) => !p.operationType),
    [pendingPoints]
  );
  const [isBatchSetting, setIsBatchSetting] = useState(false);
  const [batchSettingError, setBatchSettingError] = useState<string | null>(null);

  const handleBatchSetOperation = async (operationType: string) => {
    if (unassignedPoints.length === 0) return;
    setIsBatchSetting(true);
    setBatchSettingError(null);
    try {
      const res = await fetch('/api/election-removal/points/batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointIds: unassignedPoints.map((p) => p.id),
          changes: { operationType, materialDisposition: 'LEAVE' },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nastavení prací selhalo.');
      router.refresh();
    } catch (err: unknown) {
      setBatchSettingError(err instanceof Error ? err.message : 'Nastavení prací selhalo.');
    } finally {
      setIsBatchSetting(false);
    }
  };

  const [planOperationFilter, setPlanOperationFilter] = useState<'ALL' | 'INSTALL' | 'REMOVE' | 'RELOCATION'>('ALL');

  const filteredPendingPoints = useMemo(() => {
    return pendingPoints.filter((p) => {
      const op = getPointEffectiveOp(p);
      if (planOperationFilter === 'ALL') return true;
      if (planOperationFilter === 'INSTALL') {
        return (op && op.startsWith('INSTALL')) || op === 'REPLACE_AD';
      }
      if (planOperationFilter === 'REMOVE') {
        return op && op.startsWith('REMOVE');
      }
      if (planOperationFilter === 'RELOCATION') {
        return op === 'RELOCATION';
      }
      return true;
    });
  }, [pendingPoints, planOperationFilter, campaignDefaultOp]);

  // Point Selection Mode: 'ALL' (all pending points) vs 'CUSTOM' (hand-picked on map)
  const [pointSelectionMode, setPointSelectionMode] = useState<'ALL' | 'CUSTOM'>(
    initialSelectedPointIds && initialSelectedPointIds.length > 0 ? 'CUSTOM' : 'ALL'
  );
  const [selectedPointIds, setSelectedPointIds] = useState<Set<string>>(
    new Set(initialSelectedPointIds || [])
  );
  const [showPointSelectionMap, setShowPointSelectionMap] = useState<boolean>(true);

  const handleTogglePointSelection = (pointId: string) => {
    setSelectedPointIds((prev) => {
      const next = new Set(prev);
      if (next.has(pointId)) {
        next.delete(pointId);
      } else {
        next.add(pointId);
      }
      return next;
    });
  };

  const handleSelectAllPending = () => {
    setSelectedPointIds(new Set(pendingPoints.map((p) => p.id)));
  };

  const handleClearSelection = () => {
    setSelectedPointIds(new Set());
  };

  const selectedPointsList = useMemo(() => {
    return pendingPoints.filter((p) => selectedPointIds.has(p.id));
  }, [pendingPoints, selectedPointIds]);

  const selectedPointsServiceMinutes = useMemo(() => {
    return selectedPointsList.reduce(
      (sum, p) => sum + (p.serviceMinutes || 10),
      0
    );
  }, [selectedPointsList]);

  // Dedicated media type filter: each medium is transported separately
  const [selectedMediumFilter, setSelectedMediumFilter] = useState<string>('ALL');

  const mediaTypeStats = useMemo(() => {
    const stats: Record<string, number> = {};
    let bannerChangeCount = 0;
    let relocationCount = 0;
    let warehouseRemovalCount = 0;
    pendingPoints.forEach((p) => {
      const op = p.operationType;
      if (op === 'REPLACE_AD') {
        bannerChangeCount++;
      } else if (op === 'RELOCATION') {
        relocationCount++;
      } else {
        warehouseRemovalCount++;
      }
      const key = p.mediaType || 'OTHER';
      stats[key] = (stats[key] || 0) + 1;
    });
    return { stats, bannerChangeCount, relocationCount, warehouseRemovalCount };
  }, [pendingPoints]);

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
    if (pointSelectionMode === 'CUSTOM' && selectedPointIds.size === 0) {
      setCalculationError('Vyberte prosím na mapě alespoň jeden bod pro posádku.');
      return;
    }

    const targetPointIds =
      pointSelectionMode === 'CUSTOM'
        ? Array.from(selectedPointIds)
        : planOperationFilter !== 'ALL'
        ? filteredPendingPoints.map((p) => p.id)
        : undefined;

    if (targetPointIds !== undefined && targetPointIds.length === 0) {
      setCalculationError(
        'Pro vybraný typ výjezdu nebyly nalezeny žádné body k naplánování. Vyberte jiný typ výjezdu nebo označte body v mapě.'
      );
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
          parentPlanId: parentPlanId || detectedParentPlan?.id,
          routeMode,
          startTime,
          endTime,
          flexibleHours,
          vehicleCapacitySlots,
          warehouseUnloadMinutes,
          filterMediaType: selectedMediumFilter,
          selectedPointIds: targetPointIds,
          depot: {
            latitude: parseFloat(depotLat) || 50.08804,
            longitude: parseFloat(depotLng) || 14.42076,
          },
          saveDepotAsDefault,
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

      setDraftPlanId(data.draftPlanId);
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
            draftPlanId,
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
      {canManage && <ReleaseWorkPanel campaignId={campaign.id} points={campaign.points} />}
      {/* Configuration Card */}
      <div className="card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-600" />
              Nastavení výjezdu a posádek
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Vyberte datum, čas odjezdu a posádky pro {pendingPoints.length} prací.
              {campaign.points.length > pendingPoints.length && (
                <span className="text-emerald-600 font-semibold ml-1">
                  ({campaign.points.length - pendingPoints.length} ks již dříve dokončeno).
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-sky-50 text-sky-700 rounded-lg text-xs font-semibold">
              {pointSelectionMode === 'CUSTOM'
                ? `K naplánování: ${selectedPointIds.size} z ${pendingPoints.length} vybráno`
                : `K naplánování: ${pendingPoints.length} médií`}
            </span>
            {campaign.points.length > pendingPoints.length && (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold">
                ✓ {campaign.points.length - pendingPoints.length} hotovo
              </span>
            )}
          </div>
        </div>

        {/* 1-Click Batch Fix Banner for unassigned points */}
        {unassignedPoints.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs font-bold text-amber-900">
                  {unassignedPoints.length} {unassignedPoints.length === 1 ? 'bod nemá' : unassignedPoints.length < 5 ? 'body nemají' : 'bodů nemá'} v databázi explicitně zapsaný typ práce (převzato podle akce: {campaignDefaultOp === 'REMOVE_AD' ? 'Deinstalace' : campaignDefaultOp === 'INSTALL_AD' ? 'Instalace' : 'Přesun'})
                </span>
              </div>
              <p className="text-[11px] text-amber-700">
                Chcete-li body trvale uložit, můžete jim jedním kliknutím nastavit typ:
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                disabled={isBatchSetting}
                onClick={() => handleBatchSetOperation('REMOVE_AD')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isBatchSetting ? 'Ukládám…' : 'Zapsat všem Deinstalaci'}</span>
              </button>
              <button
                type="button"
                disabled={isBatchSetting}
                onClick={() => handleBatchSetOperation('INSTALL_AD')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{isBatchSetting ? 'Ukládám…' : 'Zapsat všem Instalaci'}</span>
              </button>
            </div>
          </div>
        )}
        {batchSettingError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 font-medium">
            {batchSettingError}
          </div>
        )}

        {/* Rescheduling Banner if replanning an unexecuted plan or superseding an existing plan */}
        {detectedParentPlan && (
          <div className="rounded-xl border border-sky-300 bg-sky-50/90 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600 flex-shrink-0" />
                <span className="text-xs font-bold text-sky-950">
                  Přeplánování výjezdu (původní termín: {new Date(detectedParentPlan.date).toLocaleDateString('cs-CZ')})
                </span>
              </div>
              <p className="text-[11px] text-sky-700">
                Body z předchozího neuskutečněného výjezdu budou uvolněny a přeřazeny do nového data. Po schválení tento plán nahradí původní verzi v{detectedParentPlan.version}.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-lg text-xs font-semibold whitespace-nowrap">
                Nahradí výjezd {detectedParentPlan.id.slice(-6)}
              </span>
            </div>
          </div>
        )}

        {/* Trip Purpose / Operation Selector */}
        <div className="space-y-2 rounded-xl bg-slate-50/70 p-3.5 border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Typ výjezdu – co se bude dělat? *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                setPlanOperationFilter('ALL');
                if (pointSelectionMode === 'CUSTOM') setSelectedPointIds(new Set(pendingPoints.map((p) => p.id)));
              }}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                planOperationFilter === 'ALL'
                  ? 'border-sky-600 bg-white text-sky-900 font-semibold ring-2 ring-sky-600/20 shadow-sm'
                  : 'border-slate-200 bg-white/60 hover:bg-white text-slate-700'
              }`}
            >
              <span className="text-xs font-bold">🌐 Všechny práce</span>
              <span className="text-[11px] text-slate-500 font-normal">
                {pendingPoints.length} prací celkem
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlanOperationFilter('INSTALL');
                const matchIds = pendingPoints
                  .filter((p) => {
                    const op = getPointEffectiveOp(p);
                    return op?.startsWith('INSTALL') || op === 'REPLACE_AD';
                  })
                  .map((p) => p.id);
                setSelectedPointIds(new Set(matchIds));
              }}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                planOperationFilter === 'INSTALL'
                  ? 'border-emerald-600 bg-white text-emerald-900 font-semibold ring-2 ring-emerald-600/20 shadow-sm'
                  : 'border-slate-200 bg-white/60 hover:bg-white text-slate-700'
              }`}
            >
              <span className="text-xs font-bold">🛠️ Instalace</span>
              <span className="text-[11px] text-slate-500 font-normal">
                {pendingPoints.filter((p) => {
                  const op = getPointEffectiveOp(p);
                  return op?.startsWith('INSTALL') || op === 'REPLACE_AD';
                }).length} k instalaci
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlanOperationFilter('REMOVE');
                const matchIds = pendingPoints
                  .filter((p) => getPointEffectiveOp(p)?.startsWith('REMOVE'))
                  .map((p) => p.id);
                setSelectedPointIds(new Set(matchIds));
              }}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                planOperationFilter === 'REMOVE'
                  ? 'border-amber-600 bg-white text-amber-900 font-semibold ring-2 ring-amber-600/20 shadow-sm'
                  : 'border-slate-200 bg-white/60 hover:bg-white text-slate-700'
              }`}
            >
              <span className="text-xs font-bold">🗑️ Deinstalace</span>
              <span className="text-[11px] text-slate-500 font-normal">
                {pendingPoints.filter((p) => getPointEffectiveOp(p)?.startsWith('REMOVE')).length} k demontáži
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPlanOperationFilter('RELOCATION');
                const matchIds = pendingPoints
                  .filter((p) => getPointEffectiveOp(p) === 'RELOCATION')
                  .map((p) => p.id);
                setSelectedPointIds(new Set(matchIds));
              }}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col gap-0.5 ${
                planOperationFilter === 'RELOCATION'
                  ? 'border-purple-600 bg-white text-purple-900 font-semibold ring-2 ring-purple-600/20 shadow-sm'
                  : 'border-slate-200 bg-white/60 hover:bg-white text-slate-700'
              }`}
            >
              <span className="text-xs font-bold">🚚 Převozy</span>
              <span className="text-[11px] text-slate-500 font-normal">
                {pendingPoints.filter((p) => getPointEffectiveOp(p) === 'RELOCATION').length} k přesunu
              </span>
            </button>
          </div>
        </div>

        {/* Date and Time Settings */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              Datum realizace prací *
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Členové posádky ({crew.employeeIds.length})
                    </label>
                  </div>

                  {/* Summary of assigned employee names */}
                  {crew.employeeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {crew.employeeIds.map((id) => {
                        const emp = employees.find((e) => e.id === id);
                        return emp ? (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200"
                          >
                            👤 {emp.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

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
                          <div className="ml-auto flex items-center gap-1.5">
                            {emp.busyReason && (
                              <span
                                className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded font-medium"
                                title={emp.busyReason}
                              >
                                ⚠️ {emp.busyReason}
                              </span>
                            )}
                            {emp.position && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                {emp.position}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Výběr prací a pravidla tras</summary><div className="mt-4 space-y-4">
      <label className="block rounded border p-3">Režim tras<select className="ml-3 rounded border p-2" value={routeMode} onChange={e => setRouteMode(e.target.value)}><option value="SEPARATE_MEDIA">Odděleně podle média</option><option value="MIXED">Společně podle oblasti</option></select></label>
      <details className="rounded border p-3"><summary>Ověřená kapacita a vybavení konkrétních vozidel</summary>
        {vehicles.map(v => <form key={v.id} className="my-3 flex flex-wrap items-end gap-2" onSubmit={async e => {
          e.preventDefault(); const f = new FormData(e.currentTarget);
          try { const r = await fetch('/api/election-removal/vehicles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vehicleId: v.id, capacitySlots: Number(f.get('capacity')), equipment: String(f.get('equipment') || '').split(',').map(x => x.trim()).filter(Boolean) }) });
            const d = await r.json(); if (!r.ok) throw new Error(d.error); setPlanningResult(null); setPlanningInput(null); router.refresh();
          } catch (e) { setCalculationError(e instanceof Error ? e.message : 'Uložení vozidla selhalo.'); }
        }}><strong>{v.name}</strong><label>Sloty<input className="block w-24 rounded border p-2" name="capacity" type="number" min="1" required defaultValue={v.capacitySlots ?? ''} /></label>
          <label>Vybavení (čárkou)<input className="block rounded border p-2" name="equipment" defaultValue={v.equipment?.join(', ') ?? ''} /></label><button className="rounded border p-2">Uložit ověřené údaje</button></form>)}
      </details>
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
            Povolí plánovat i po uvedeném konci směny, v rámci nastavení organizace.
          </label>
        </div>

        {/* Point Selection: ALL vs CUSTOM MAP SELECTION */}
        <div className="space-y-4 p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-sky-600" />
                <span>Výběr bodů pro trasu výjezdu</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Standardně se plánují zbývající práce. Zde můžete výběr omezit.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPointSelectionMode('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                  pointSelectionMode === 'ALL'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🌐 Všechny zbývající body ({pendingPoints.length} ks)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPointSelectionMode('CUSTOM');
                  setShowPointSelectionMap(true);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                  pointSelectionMode === 'CUSTOM'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🎯 Pouze vybrané body na mapě ({selectedPointIds.size} ks)</span>
              </button>
            </div>
          </div>

          {/* Map & point selector when in CUSTOM mode */}
          {pointSelectionMode === 'CUSTOM' && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-sky-50/70 border border-sky-100 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-bold text-xs shadow-2xs">
                    {selectedPointIds.size} / {pendingPoints.length} vybráno
                  </span>
                  {selectedPointsList.length > 0 && (
                    <span className="text-xs font-semibold text-slate-700">
                      ⏱️ Odhadovaný čas práce: ~{Math.floor(selectedPointsServiceMinutes / 60)} h {selectedPointsServiceMinutes % 60} min
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllPending}
                    className="px-2.5 py-1 bg-white border border-sky-200 text-sky-800 hover:bg-sky-50 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    Vybrat vše ({pendingPoints.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    Zrušit výběr
                  </button>
                </div>
              </div>

              {/* Informative helper banner */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm">👆</span>
                  <span>
                    <strong>Klikněte na špendlíky v mapě:</strong> Vybrané body se zbarví modře s fajfkou (✓) a AI z nich navrhne optimální trasu pro posádku.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPointSelectionMap((prev) => !prev)}
                  className="text-sky-600 hover:text-sky-800 font-bold underline text-[11px] shrink-0 cursor-pointer"
                >
                  {showPointSelectionMap ? 'Skrýt mapu' : 'Zobrazit mapu'}
                </button>
              </div>

              {showPointSelectionMap && (
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                  <ElectionRemovalMap
                    points={pendingPoints}
                    selectedPointIds={selectedPointIds}
                    onTogglePointSelection={handleTogglePointSelection}
                    selectionMode={true}
                    height="400px"
                  />
                </div>
              )}

              {/* Selected Points Chips Preview */}
              {selectedPointsList.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                    <span>Vybraná stanoviště pro tuto trasu ({selectedPointsList.length}):</span>
                    <span className="text-[11px] text-slate-400">
                      Kliknutím na křížek (×) bod odeberete z trasy
                    </span>
                  </div>

                  <div className="max-h-32 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-1.5">
                    {selectedPointsList.map((pt) => (
                      <span
                        key={pt.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-sky-200 text-slate-800 shadow-2xs"
                      >
                        <span className="font-bold text-sky-600">✓</span>
                        <span className="truncate max-w-[200px]" title={pt.label}>
                          {pt.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          ({pt.mediaType})
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTogglePointSelection(pt.id)}
                          className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer font-bold"
                          title="Odebrat z trasy"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dedicated Medium Filter (Single-Medium Transport Rule) */}
        <div className="space-y-3 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>🎯 Médium pro tento výjezd</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 normal-case border border-indigo-100">
                {routeMode === 'SEPARATE_MEDIA' ? 'Oddělené trasy podle média' : 'Společné trasy podle oblasti'}
              </span>
            </label>
            <span className="text-[11px] text-slate-500">
              Kapacita a manipulace se řídí zadáním práce
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedMediumFilter('ALL')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                selectedMediumFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>🌐 Všechna média</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  selectedMediumFilter === 'ALL'
                    ? 'bg-slate-800 text-slate-100'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {pendingPoints.length} ks
              </span>
            </button>

            {mediaTypeStats.stats.ACKO !== undefined && (
              <button
                type="button"
                onClick={() => setSelectedMediumFilter('ACKO')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                  selectedMediumFilter === 'ACKO'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🅰️ Pouze Áčka</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    selectedMediumFilter === 'ACKO'
                      ? 'bg-sky-700 text-white'
                      : 'bg-sky-50 text-sky-800'
                  }`}
                >
                  {mediaTypeStats.stats.ACKO} ks
                </span>
              </button>
            )}

            {mediaTypeStats.stats.MINI_TOWER !== undefined && (
              <button
                type="button"
                onClick={() => setSelectedMediumFilter('MINI_TOWER')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                  selectedMediumFilter === 'MINI_TOWER'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🗼 Pouze MiniTowery</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    selectedMediumFilter === 'MINI_TOWER'
                      ? 'bg-indigo-700 text-white'
                      : 'bg-indigo-50 text-indigo-800'
                  }`}
                >
                  {mediaTypeStats.stats.MINI_TOWER} ks
                </span>
              </button>
            )}

            {mediaTypeStats.stats.TOWER !== undefined && (
              <button
                type="button"
                onClick={() => setSelectedMediumFilter('TOWER')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                  selectedMediumFilter === 'TOWER'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🏛️ Pouze Velké věže</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    selectedMediumFilter === 'TOWER'
                      ? 'bg-purple-700 text-white'
                      : 'bg-purple-50 text-purple-800'
                  }`}
                >
                  {mediaTypeStats.stats.TOWER} ks
                </span>
              </button>
            )}

            {mediaTypeStats.bannerChangeCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedMediumFilter('BANNER_CHANGE')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                  selectedMediumFilter === 'BANNER_CHANGE'
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🎨 Pouze výměny / sundání plachet</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    selectedMediumFilter === 'BANNER_CHANGE'
                      ? 'bg-teal-700 text-white'
                      : 'bg-teal-50 text-teal-800'
                  }`}
                >
                  {mediaTypeStats.bannerChangeCount} ks
                </span>
              </button>
            )}

            {mediaTypeStats.relocationCount > 0 && (
              <button
                type="button"
                onClick={() => setSelectedMediumFilter('RELOCATION')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-2xs ${
                  selectedMediumFilter === 'RELOCATION'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>🚚 Pouze přímé převozy</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    selectedMediumFilter === 'RELOCATION'
                      ? 'bg-purple-700 text-white'
                      : 'bg-purple-50 text-purple-800'
                  }`}
                >
                  {mediaTypeStats.relocationCount} ks
                </span>
              </button>
            )}
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-600 flex items-center gap-2">
            <span className="text-base shrink-0">💡</span>
            <span>
              {selectedMediumFilter === 'ACKO' && (
                <>Výjezd je omezen <strong>pouze na A-stojany</strong>. Kapacita se ověří podle vybraného vozidla.</>
              )}
              {selectedMediumFilter === 'MINI_TOWER' && (
                <>Výjezd je sestaven <strong>pouze pro MiniTowery</strong>. Kapacita a místo vykládky se řídí zadáním a vozidlem.</>
              )}
              {selectedMediumFilter === 'TOWER' && (
                <>Výjezd je určen <strong>pouze pro Velké věže</strong>. Nakládání a cílové zastávky odpovídají zadání jednotlivých prací.</>
              )}
              {selectedMediumFilter === 'BANNER_CHANGE' && (
                <>Výjezd pro <strong>servis a výměnu plachet</strong>. Přepravovaný materiál a kapacita se řídí zadáním jednotlivých prací.</>
              )}
              {selectedMediumFilter === 'RELOCATION' && (
                <>Výjezd pro <strong>přímý převoz konstrukcí</strong> na nová stanoviště (neodváží se na sklad, ale přímo na jiné místo).</>
              )}
              {selectedMediumFilter === 'ALL' && (
                <>Plánování pro <strong>všechna média a operace</strong>. Zvolený režim určuje společné nebo oddělené trasy; vyzvednutí a doručení odpovídají jednotlivým zadáním.</>
              )}
            </span>
          </div>
        </div>

        </div></details>
        <details open={!initialDepot} className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Výchozí místo, návrat a vykládka</summary><div className="mt-4">
        {/* Logistics & Capacity Constraints */}
        <div className="grid gap-4 sm:grid-cols-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Ložná kapacita vozíku / auta</span>
              <span className="font-bold text-sky-600 font-mono text-sm">{vehicleCapacitySlots} slotů</span>
            </label>
            <input
              type="number"
              min={1}
              max={150}
              value={vehicleCapacitySlots}
              onChange={(e) => setVehicleCapacitySlots(Math.max(1, parseInt(e.target.value) || 30))}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Použije se ověřená kapacita vybraného vozidla. Tento údaj slouží jako výchozí hodnota pro původní zadání.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Čas vykládky na skladě</span>
              <span className="font-bold text-sky-600 font-mono text-sm">{warehouseUnloadMinutes} min</span>
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={warehouseUnloadMinutes}
              onChange={(e) => setWarehouseUnloadMinutes(Math.max(0, parseInt(e.target.value) || 15))}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Odhadovaná doba složení nákladu do centrálního skladu před pokračováním ve svozu dalších bodů na trase.
            </p>
          </div>

          {/* Warehouse (Depot) Location Configuration */}
          <div className="sm:col-span-2 pt-3 border-t border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏢 Poloha centrálního skladu (Depo / Základna)</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Cílová stanice pro vykládku svezených konstrukcí při naplnění kapacity vozidla a místo návratu posádky na konci dne.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDepotMap((prev) => !prev)}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 underline flex items-center gap-1 cursor-pointer"
                >
                  🗺️ {showDepotMap ? 'Skrýt mapu skladu' : 'Zobrazit mapu pro kliknutí'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if ('geolocation' in navigator) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setDepotLat(pos.coords.latitude.toFixed(5));
                          setDepotLng(pos.coords.longitude.toFixed(5));
                        },
                        () => alert('Nepodařilo se zjistit aktuální polohu prohlížeče.')
                      );
                    }
                  }}
                  className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline flex items-center gap-1 cursor-pointer"
                >
                  📍 Moje poloha
                </button>
              </div>
            </div>

            {/* Interactive Map Picker for Depot */}
            {showDepotMap && (
              <div className="space-y-1">
                <LocationPickerMap
                  latitude={parseFloat(depotLat) || null}
                  longitude={parseFloat(depotLng) || null}
                  onChange={(coords) => {
                    setDepotLat(coords.latitude.toFixed(5));
                    setDepotLng(coords.longitude.toFixed(5));
                  }}
                  height="220px"
                  pinLabel="Centrální sklad / Depo"
                />
                <p className="text-[10px] text-slate-500 italic">
                  Tip: Klikněte kamkoliv do mapy nebo vyberte město nahoře pro okamžité přemístění skladu.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Zeměpisná šířka (Latitude)
                </span>
                <input
                  type="text"
                  value={depotLat}
                  onChange={(e) => setDepotLat(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="např. 50.08804 nebo 49.19506"
                />
              </div>
              <div>
                <span className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                  Zeměpisná délka (Longitude)
                </span>
                <input
                  type="text"
                  value={depotLng}
                  onChange={(e) => setDepotLng(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="např. 14.42076 nebo 16.60683"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="saveDepotDefaultCheck"
                checked={saveDepotAsDefault}
                onChange={(e) => setSaveDepotAsDefault(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
              />
              <label htmlFor="saveDepotDefaultCheck" className="text-xs text-slate-600 cursor-pointer font-medium">
                Uložit tyto souřadnice skladu jako trvalé výchozí depo pro celou firmu
              </label>
            </div>
          </div>
        </div>

        </div></details>
        {/* Action Button: Calculate */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Nejdřív zkontrolujete navrženou trasu. Pracovníci ji dostanou až po schválení.
          </p>

          <button
            type="button"
            onClick={handleCalculateRoutes}
            disabled={
              isCalculating ||
              (pointSelectionMode === 'CUSTOM'
                ? selectedPointIds.size === 0
                : pendingPoints.length === 0)
            }
            className="btn btn-primary px-6 py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isCalculating ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                <span>Optimalizuji trasy a přejezdy...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Navrhnout trasu</span>
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
                  Kontrola výjezdu
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApprovePlan}
                  disabled={
                    planningResult.conflicts.length > 0 ||
                    isApproving ||
                    isPending ||
                    planningResult.crews.reduce((acc, c) => acc + c.stops.length, 0) === 0
                  }
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
                      <span>{planningResult.unassigned.length ? 'Schválit naplánovanou část' : 'Schválit výjezd'}</span>
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
                  Naplánovaných kroků
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

            {planningResult.unassigned.length > 0 && <p className="text-sm text-amber-200">Schválí se pouze naplánované body. Nezařazené body zůstanou k dalšímu řešení. <a className="underline font-semibold" href="#release-work">Uvolnit body pro novou trasu</a></p>}
            {planningResult.unassigned.length > 0 && (
              <div className="bg-amber-950/60 border border-amber-800 text-amber-200 text-xs p-3.5 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                  <span>
                    {planningResult.unassigned.length}{' '}
                    {planningResult.unassigned.length === 1
                      ? 'médium nebylo zařazeno do trasy:'
                      : planningResult.unassigned.length < 5
                      ? 'média nebyla zařazena do trasy:'
                      : 'médií nebylo zařazeno do trasy:'}
                  </span>
                </div>
                <div className="space-y-1 pl-6">
                  {Array.from(
                    new Set(
                      planningResult.unassigned.map((u) => {
                        return u.message;
                      })
                    )
                  ).map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-amber-200/90">
                      <span className="text-amber-400">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {planningResult.conflicts && planningResult.conflicts.length > 0 && (
              <div className="bg-rose-950/60 border border-rose-800 text-rose-200 text-xs p-3.5 rounded-xl space-y-2">
                <div className="flex items-center gap-2 font-semibold text-rose-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>Zjištěny konflikty v plánu ({planningResult.conflicts.length}):</span>
                </div>
                <div className="space-y-1 pl-6">
                  {Array.from(new Set(planningResult.conflicts.map((c) => c.message))).map((msg, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-rose-200/90">
                      <span className="text-rose-400">•</span>
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
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
                        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                          <span>{crew.id.replace('crew-', 'Posádka ')}:</span>
                          <span className="text-sky-700 font-semibold">
                            {crew.names.join(', ') || 'Bez pracovníků'}
                          </span>
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
                            const isWarehouse = Boolean(stop.isWarehousePitstop || stop.workType === 'WAREHOUSE_UNLOAD');

                            if (isWarehouse) {
                              return (
                                <tr key={stop.jobId || stop.routeOrder} className="bg-amber-50/90 border-y-2 border-amber-300">
                                  <td className="py-2.5 px-2.5 font-mono font-bold text-amber-900">
                                    {stop.routeOrder}.
                                  </td>
                                  <td className="py-2.5 px-2.5 font-bold text-amber-950 whitespace-nowrap">
                                    {arrival} – {departure}
                                  </td>
                                  <td className="py-2.5 px-2.5 text-amber-800 font-medium">
                                    +{travelKm} km ({travelMin} min na sklad)
                                  </td>
                                  <td className="py-2.5 px-2.5" colSpan={2}>
                                    <div className="flex items-center gap-2">
                                      <span className="text-base">🏭</span>
                                      <div>
                                        <p className="font-bold text-amber-950">Centrální sklad: Vykládka materiálu</p>
                                        <p className="text-[11px] text-amber-700">
                                          Vozík naplněn ({stop.unloadedSlots ?? 30} ks). Složení materiálu do skladu a uvolnění kapacity na 0 ks.
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-2.5 font-mono text-[11px]">
                                    <span className="text-amber-800 font-semibold">Centrální sklad</span>
                                  </td>
                                  <td className="py-2.5 px-2.5 text-right font-bold text-amber-950 whitespace-nowrap">
                                    {stop.serviceMinutes} min vykládka
                                  </td>
                                </tr>
                              );
                            }

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
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                                      {ELECTION_REMOVAL_MEDIA_LABELS[
                                        (stop.mediaType as keyof typeof ELECTION_REMOVAL_MEDIA_LABELS) ||
                                          'OTHER'
                                      ] || stop.mediaType}
                                    </span>
                                    {stop.operationType === 'REPLACE_AD' && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Výměna reklamního materiálu
                                      </span>
                                    )}
                                    {stop.cumulativeLoadSlots !== undefined && (
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        Náklad: {stop.cumulativeLoadSlots}/{vehicleCapacitySlots}
                                      </span>
                                    )}
                                  </div>
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
