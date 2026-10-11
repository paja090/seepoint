'use client';

import { useState } from 'react';
import { Users, Car, X, Check, Clock, AlertTriangle } from 'lucide-react';

export interface ResourceEmployee {
  id: string;
  name: string;
  role: string;
  position: string | null;
}

export interface ResourceVehicle {
  id: string;
  name: string;
  registrationNumber: string | null;
}

export interface EditCrewModalProps {
  campaignId: string;
  crew: {
    id: string;
    name: string;
    employeeIds: string[];
    vehicleId: string | null;
  };
  employees: ResourceEmployee[];
  vehicles: ResourceVehicle[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedCrew: {
    id: string;
    employeeIds: string[];
    names: string[];
    vehicleId: string | null;
    vehicleName: string | null;
  }) => void;
}

export function EditCrewModal({
  campaignId,
  crew,
  employees,
  vehicles,
  isOpen,
  onClose,
  onSuccess,
}: EditCrewModalProps) {
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>(crew.employeeIds);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(crew.vehicleId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleEmployee = (empId: string) => {
    setSelectedEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleSave = async () => {
    if (selectedEmpIds.length === 0) {
      setError('Vyberte prosím alespoň jednoho pracovníka pro posádku.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/election-removal/campaigns/${campaignId}/crews`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewId: crew.id,
          employeeIds: selectedEmpIds,
          vehicleId: selectedVehicleId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se uložit změny posádky.');
      }

      onSuccess(data.crew);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání posádky.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-600" />
              Změna posádky: {crew.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upravte pracovníky a vozidlo přiřazené k této schválené trase.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Vehicle Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Car className="w-4 h-4 text-slate-400" />
              Vozidlo posádky
            </label>
            <select
              value={selectedVehicleId || ''}
              onChange={(e) => setSelectedVehicleId(e.target.value || null)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">– Bez vybraného vozidla –</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.registrationNumber ? `(${v.registrationNumber})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Employees Multi-select */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" />
                Pracovníci v posádce ({selectedEmpIds.length})
              </label>
              <span className="text-[11px] text-slate-500">
                Vybráno {selectedEmpIds.length} z {employees.length}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 bg-slate-50/60 border border-slate-200 rounded-xl p-2.5 text-xs">
              {employees.length === 0 ? (
                <p className="text-slate-400 py-3 text-center">Žádní dostupní pracovníci.</p>
              ) : (
                employees.map((emp) => {
                  const isChecked = selectedEmpIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition border ${
                        isChecked
                          ? 'bg-sky-50/80 border-sky-200 text-sky-950 font-semibold shadow-2xs'
                          : 'bg-white border-transparent hover:bg-slate-100/70 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEmployee(emp.id)}
                        className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 h-4 w-4"
                      />
                      <span className="flex-1 text-sm">{emp.name}</span>
                      {emp.position && (
                        <span className="text-[11px] text-slate-400 font-normal px-2 py-0.5 rounded-full bg-slate-100">
                          {emp.position}
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
          >
            Zrušit
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || selectedEmpIds.length === 0}
            className="btn btn-primary px-5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-sm inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Ukládám změny...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Uložit posádku</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
