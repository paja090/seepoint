'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Edit3, X, Save, Loader2 } from 'lucide-react';
import { VehicleType, VehicleStatus } from '@prisma/client';

interface VehicleData {
  id: string;
  name: string;
  type: VehicleType;
  registrationNumber?: string | null;
  vin?: string | null;
  status: VehicleStatus;
  technicalInspectionUntil?: Date | string | null;
  insuranceUntil?: Date | string | null;
  highwayPassUntil?: Date | string | null;
  responsiblePerson?: string | null;
  tiresInfo?: string | null;
  owner?: string | null;
  vtpUrl?: string | null;
  repairNotes?: string | null;
  note?: string | null;
}

function formatDateForInput(dateVal?: Date | string | null): string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function VehicleEditModal({ vehicle }: { vehicle: VehicleData }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: vehicle.name || '',
    registrationNumber: vehicle.registrationNumber || '',
    vin: vehicle.vin || '',
    type: vehicle.type || 'CAR',
    status: vehicle.status || 'AVAILABLE',
    technicalInspectionUntil: formatDateForInput(vehicle.technicalInspectionUntil),
    insuranceUntil: formatDateForInput(vehicle.insuranceUntil),
    highwayPassUntil: formatDateForInput(vehicle.highwayPassUntil),
    responsiblePerson: vehicle.responsiblePerson || '',
    tiresInfo: vehicle.tiresInfo || '',
    owner: vehicle.owner || '',
    vtpUrl: vehicle.vtpUrl || '',
    repairNotes: vehicle.repairNotes || '',
    note: vehicle.note || '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Úprava selhala.');
      }

      setIsOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 transition shadow-sm"
      >
        <Edit3 size={14} />
        <span>✏️ Upravit údaje vozidla / závady</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl bg-white shadow-2xl rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">✏️ Úprava karty vozidla</h3>
                <p className="text-xs text-slate-500">{vehicle.name} ({vehicle.registrationNumber || 'Bez SPZ'})</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="font-bold text-slate-700">
                  Název vozidla / Označení *
                  <input
                    required
                    className="input mt-1 w-full text-xs font-normal"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  SPZ
                  <input
                    className="input mt-1 w-full text-xs font-normal font-mono uppercase"
                    value={formData.registrationNumber}
                    onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Typ vozidla
                  <select
                    className="input mt-1 w-full text-xs font-normal"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as VehicleType })}
                  >
                    <option value="CAR">🚘 Osobní auto</option>
                    <option value="VAN">🚚 Dodávka / Užitkové</option>
                    <option value="TRAILER">🪧 Billboardový vozík</option>
                    <option value="OTHER">🛵 Skútr / Ostatní</option>
                  </select>
                </label>

                <label className="font-bold text-slate-700">
                  Stav vozidla
                  <select
                    className="input mt-1 w-full text-xs font-normal"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as VehicleStatus })}
                  >
                    <option value="AVAILABLE">🟢 K dispozici</option>
                    <option value="RESERVED">🟡 Rezervováno</option>
                    <option value="IN_USE">🔵 V provozu</option>
                    <option value="SERVICE">🔧 V servisu</option>
                    <option value="OUT_OF_SERVICE">🔴 Vyřazeno</option>
                  </select>
                </label>

                <label className="font-bold text-slate-700">
                  Zodpovědná osoba / Řidič
                  <input
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="např. Karel, Vlaďka, Jiřík..."
                    value={formData.responsiblePerson}
                    onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Vlastník vozidla
                  <input
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="např. SP, QX, soukromé..."
                    value={formData.owner}
                    onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="font-bold text-slate-700">
                  STK do
                  <input
                    type="date"
                    className="input mt-1 w-full text-xs font-normal"
                    value={formData.technicalInspectionUntil}
                    onChange={(e) => setFormData({ ...formData, technicalInspectionUntil: e.target.value })}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Pojištění do
                  <input
                    type="date"
                    className="input mt-1 w-full text-xs font-normal"
                    value={formData.insuranceUntil}
                    onChange={(e) => setFormData({ ...formData, insuranceUntil: e.target.value })}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Dálniční známka do
                  <input
                    type="date"
                    className="input mt-1 w-full text-xs font-normal"
                    value={formData.highwayPassUntil}
                    onChange={(e) => setFormData({ ...formData, highwayPassUntil: e.target.value })}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="font-bold text-slate-700">
                  Pneumatiky a rozměr
                  <input
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="např. 195/65 R15 Celoroční"
                    value={formData.tiresInfo}
                    onChange={(e) => setFormData({ ...formData, tiresInfo: e.target.value })}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  VIN kód
                  <input
                    className="input mt-1 w-full text-xs font-normal font-mono uppercase"
                    value={formData.vin}
                    onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                  />
                </label>
              </div>

              <label className="block font-bold text-slate-700">
                Odkaz na Velký technický průkaz (VTP na Google Disku)
                <input
                  type="url"
                  className="input mt-1 w-full text-xs font-normal"
                  placeholder="https://drive.google.com/file/d/..."
                  value={formData.vtpUrl}
                  onChange={(e) => setFormData({ ...formData, vtpUrl: e.target.value })}
                />
              </label>

              <label className="block font-bold text-rose-900 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                ⚠️ Aktuální závady & Poznámky k opravám
                <textarea
                  rows={2}
                  className="input mt-1 w-full text-xs font-normal border-rose-300"
                  placeholder="např. nesvítí pravá brzda, doplnit klimu na jaro, nová výměna oleje vyžadována..."
                  value={formData.repairNotes}
                  onChange={(e) => setFormData({ ...formData, repairNotes: e.target.value })}
                />
              </label>

              <label className="block font-bold text-slate-700">
                Obecná poznámka
                <input
                  className="input mt-1 w-full text-xs font-normal"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </label>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={loading || isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-sky-700 px-5 py-2 text-xs font-black text-white hover:bg-sky-800 transition shadow-md disabled:opacity-50"
                >
                  {loading || isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Uložit změny vozidla</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
