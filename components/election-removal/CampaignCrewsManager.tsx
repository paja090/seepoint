'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Route, Users, Car, CheckCircle2, Edit3, ArrowRight } from 'lucide-react';
import {
  EditCrewModal,
  type ResourceEmployee,
  type ResourceVehicle,
} from './EditCrewModal';

export interface CampaignCrewDisplay {
  id: string;
  name: string;
  employeeIds: string[];
  names: string[];
  vehicleId: string | null;
  vehicleName: string | null;
  totalPoints: number;
  completedPoints: number;
}

interface CampaignCrewsManagerProps {
  campaignId: string;
  initialCrews: CampaignCrewDisplay[];
  employees: ResourceEmployee[];
  vehicles: ResourceVehicle[];
  canManage: boolean;
}

export function CampaignCrewsManager({
  campaignId,
  initialCrews,
  employees,
  vehicles,
  canManage,
}: CampaignCrewsManagerProps) {
  const router = useRouter();
  const [crews, setCrews] = useState<CampaignCrewDisplay[]>(initialCrews);
  const [editingCrew, setEditingCrew] = useState<CampaignCrewDisplay | null>(null);

  const handleCrewUpdated = (updated: {
    id: string;
    employeeIds: string[];
    names: string[];
    vehicleId: string | null;
    vehicleName: string | null;
  }) => {
    setCrews((prev) =>
      prev.map((c) =>
        c.id === updated.id
          ? {
              ...c,
              employeeIds: updated.employeeIds,
              names: updated.names,
              vehicleId: updated.vehicleId,
              vehicleName: updated.vehicleName,
            }
          : c
      )
    );
    router.refresh();
  };

  if (crews.length === 0) return null;

  return (
    <div className="card p-5 space-y-4 bg-gradient-to-r from-sky-50/70 to-indigo-50/50 border border-sky-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-sky-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Route className="w-5 h-5 text-sky-600" />
            Výjezdy a posádky v terénu ({crews.length})
          </h3>
          <p className="text-xs text-slate-500">
            Přiřazení pracovníci, vozidla a přímé mobilní trasy jednotlivých posádek
          </p>
        </div>

        <Link
          href={`/election-removal/${campaignId}/route`}
          className="text-xs font-semibold text-sky-700 hover:text-sky-900 underline flex items-center gap-1"
        >
          <span>Otevřít celkový přehled tras</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {crews.map((crew) => {
          const crewPercent =
            crew.totalPoints > 0
              ? Math.round((crew.completedPoints / crew.totalPoints) * 100)
              : 0;

          return (
            <div
              key={crew.id}
              className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3 flex flex-col justify-between hover:border-sky-300 transition"
            >
              <div className="space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    🚗 {crew.name}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                    {crew.totalPoints} ks
                  </span>
                </div>

                {/* Assigned Workers Names */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Členové posádky:</span>
                  </div>
                  {crew.names.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {crew.names.map((name, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200"
                        >
                          👤 {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 font-medium italic">
                      ⚠️ Žádný pracovník není přiřazen
                    </p>
                  )}
                </div>

                {/* Assigned Vehicle */}
                {crew.vehicleName && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">{crew.vehicleName}</span>
                  </div>
                )}

                {/* Progress */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>
                      Hotovo: {crew.completedPoints} / {crew.totalPoints} ks
                    </span>
                    <span className="font-bold text-slate-700">{crewPercent} %</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${crewPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <Link
                  href={`/election-removal/${campaignId}/route?crew=${crew.id}`}
                  className="flex-1 py-1.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-bold text-center transition"
                >
                  📱 Trasa
                </Link>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => setEditingCrew(crew)}
                    className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition"
                    title="Změnit složení posádky a vozidlo"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Změnit posádku</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editingCrew && (
        <EditCrewModal
          campaignId={campaignId}
          crew={editingCrew}
          employees={employees}
          vehicles={vehicles}
          isOpen={true}
          onClose={() => setEditingCrew(null)}
          onSuccess={handleCrewUpdated}
        />
      )}
    </div>
  );
}
