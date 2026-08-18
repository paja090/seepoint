'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, X, Loader2, CheckCircle2, User, Car, Truck, Clock } from 'lucide-react';

interface VehicleOption {
  id: string;
  name: string;
  type: string;
  registrationNumber?: string | null;
  status: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface VehicleReservationModalProps {
  vehicles: VehicleOption[];
  employees: EmployeeOption[];
  defaultVehicleId?: string;
}

export function VehicleReservationModal({ vehicles, employees, defaultVehicleId }: VehicleReservationModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [vehicleId, setVehicleId] = useState(defaultVehicleId || vehicles[0]?.id || '');
  const [employeeId, setEmployeeId] = useState(employees[0]?.id || '');
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(tomorrow);
  const [purpose, setPurpose] = useState('');
  const [note, setNote] = useState('');

  const quickPurposes = [
    '🚚 Montáž billboardů Ostrava',
    '🪧 Odvoz a instalace minitoweru',
    '🤝 Klientská schůzka & Zaměření',
    '🔧 Odvoz auta do servisu / STK',
    '📦 Převoz materiálu a tisku',
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vehicleId || !purpose.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/vehicle-reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          employeeId: employeeId || undefined,
          dateFrom,
          dateTo,
          purpose,
          note,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Vytvoření rezervace selhalo.');
      }

      setIsOpen(false);
      setPurpose('');
      setNote('');
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při uložení rezervace.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:from-sky-500 hover:to-emerald-500 transition"
      >
        <Plus size={16} />
        <span>+ Nová rezervace vozidla / vozíku</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-lg bg-white shadow-2xl rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-sky-600" />
                  <span>📅 Vytvořit novou rezervaci</span>
                </h3>
                <p className="text-xs text-slate-500">Zarezervovat auto, dodávku nebo vozík na výjezd</p>
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

            {/* Quick Purpose Presets */}
            <div className="mb-4">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1.5">Rychlý účel výjezdu:</span>
              <div className="flex flex-wrap gap-1.5">
                {quickPurposes.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPurpose(p)}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-sky-100 hover:text-sky-900 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <label className="block font-bold text-slate-700">
                Vyberte vozidlo nebo vozík *
                <select
                  required
                  className="input mt-1 w-full text-xs font-normal"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.type === 'VAN' ? '🚚' : v.type === 'TRAILER' ? '🪧' : '🚘'} {v.name} ({v.registrationNumber || 'Bez SPZ'})
                    </option>
                  ))}
                </select>
              </label>

              {employees.length > 0 && (
                <label className="block font-bold text-slate-700">
                  Pracovník / Řidič
                  <select
                    className="input mt-1 w-full text-xs font-normal"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        👤 {emp.firstName} {emp.lastName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid gap-3 grid-cols-2">
                <label className="font-bold text-slate-700">
                  Datum a čas OD *
                  <input
                    type="date"
                    required
                    className="input mt-1 w-full text-xs font-normal"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Datum a čas DO *
                  <input
                    type="date"
                    required
                    className="input mt-1 w-full text-xs font-normal"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
              </div>

              <label className="block font-bold text-slate-700">
                Účel rezervace / Cíl výjezdu *
                <input
                  required
                  className="input mt-1 w-full text-xs font-normal"
                  placeholder="např. Montáž polepů Ostrava, výjezd montážníků..."
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                />
              </label>

              <label className="block font-bold text-slate-700">
                Doplňující poznámka
                <input
                  className="input mt-1 w-full text-xs font-normal"
                  placeholder="např. Bude připojen i VOZIK 2..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 mt-4">
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
                  {loading || isPending ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                  <span>Uložit a zarezervovat vozidlo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
