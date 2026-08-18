'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, RotateCcw, Loader2, X } from 'lucide-react';

interface WarehouseMovementModalProps {
  itemId: string;
  itemName: string;
  unit: string;
  currentStock: number;
  category: 'CONSUMABLE' | 'RETURNABLE';
  workOrders?: { id: string; title: string; clientName: string }[];
  employees?: { id: string; firstName: string; lastName: string }[];
  defaultType?: 'RECEIPT' | 'ISSUE' | 'RETURN';
}

export function WarehouseMovementModal({
  itemId,
  itemName,
  unit,
  currentStock,
  category,
  workOrders = [],
  employees = [],
  defaultType = 'ISSUE',
}: WarehouseMovementModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<'RECEIPT' | 'ISSUE' | 'RETURN'>(defaultType);
  const [quantity, setQuantity] = useState('1');
  const [workOrderId, setWorkOrderId] = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [note, setNote] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || Number(quantity) <= 0) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/warehouse/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          type,
          quantity: Number(quantity),
          workOrderId: workOrderId || undefined,
          assignedEmployeeId: assignedEmployeeId || undefined,
          note: note ? note.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Pohyb selhal.');
      }

      setIsOpen(false);
      setQuantity('1');
      setWorkOrderId('');
      setAssignedEmployeeId('');
      setNote('');
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při naskladnění / výdeji.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            setType('ISSUE');
            setIsOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-amber-100 px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200 transition"
          title="Vydat materiál / nářadí montážníkovi"
        >
          <ArrowUpRight size={14} className="text-amber-700" />
          <span>Vydat</span>
        </button>

        {category === 'RETURNABLE' && (
          <button
            onClick={() => {
              setType('RETURN');
              setIsOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-100 px-2.5 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-200 transition"
            title="Vrátit vratné vybavení / nářadí zpět na sklad"
          >
            <RotateCcw size={14} className="text-emerald-700" />
            <span>Vrátit</span>
          </button>
        )}

        <button
          onClick={() => {
            setType('RECEIPT');
            setIsOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-sky-100 px-2.5 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-200 transition"
          title="Naskladnit nový materiál"
        >
          <ArrowDownLeft size={14} className="text-sky-700" />
          <span>Naskladnit</span>
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-md bg-white shadow-2xl rounded-3xl p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {type === 'RECEIPT' ? '📥 Naskladnění materiálu' : type === 'RETURN' ? '🔄 Vrácení na sklad' : '📤 Výdej na zakázku'}
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">{itemName}</p>
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

            <div className="mb-4 rounded-xl bg-slate-50 p-3 text-xs flex justify-between items-center border border-slate-200">
              <span className="text-slate-500 font-bold">Aktuální stav na skladě:</span>
              <span className="font-extrabold text-slate-900 text-sm">
                {currentStock} {unit}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <label className="block font-bold text-slate-700">
                Typ pohybu *
                <select
                  className="input mt-1 w-full text-xs font-normal"
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                >
                  <option value="ISSUE">📤 Výdej montážníkovi / Na zakázku</option>

                  {category === 'RETURNABLE' && (
                    <option value="RETURN">🔄 Vrácení vypůjčeného nářadí/vybavení</option>
                  )}

                  <option value="RECEIPT">📥 Příjem / Naskladnění nového materiálu</option>
                </select>
              </label>

              <label className="block font-bold text-slate-700">
                Množství ({unit}) *
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className="input mt-1 w-full text-xs font-normal font-bold"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>

              {type === 'ISSUE' && (
                <>
                  {workOrders.length > 0 && (
                    <label className="block font-bold text-slate-700">
                      Propojit se zakázkou (volitelné)
                      <select
                        className="input mt-1 w-full text-xs font-normal"
                        value={workOrderId}
                        onChange={(e) => setWorkOrderId(e.target.value)}
                      >
                        <option value="">-- Bez propojení se zakázkou --</option>
                        {workOrders.map((wo) => (
                          <option key={wo.id} value={wo.id}>
                            📋 {wo.title} ({wo.clientName})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {employees.length > 0 && (
                    <label className="block font-bold text-slate-700">
                      Komu se materiál/nářadí vydává
                      <select
                        className="input mt-1 w-full text-xs font-normal"
                        value={assignedEmployeeId}
                        onChange={(e) => setAssignedEmployeeId(e.target.value)}
                      >
                        <option value="">-- Vyberte montážníka --</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            👤 {emp.firstName} {emp.lastName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}

              <label className="block font-bold text-slate-700">
                Poznámka k pohybu
                <input
                  className="input mt-1 w-full text-xs font-normal"
                  placeholder="např. Výjezd na Billboard Ostrava, Vráceno z montáže..."
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
                  className="flex items-center gap-1.5 rounded-xl bg-slate-950 px-5 py-2 text-xs font-black text-white hover:bg-slate-800 transition shadow-md disabled:opacity-50"
                >
                  {loading || isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>Potvrdit pohyb</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
