'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Upload, X, Loader2, CheckCircle2, Sparkles, Minus, Plus } from 'lucide-react';

interface DetectedItem {
  itemId: string;
  name: string;
  unit: string;
  detectedQty: number;
}

export function WarehousePhotoScannerModal({
  workOrders = [],
  employees = [],
}: {
  workOrders?: { id: string; title: string; clientName: string }[];
  employees?: { id: string; firstName: string; lastName: string }[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [workOrderId, setWorkOrderId] = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoPreview(URL.createObjectURL(file));
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch('/api/warehouse/photo-recognition', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rozpoznání fotky selhalo.');

      setDetectedItems(data.detectedItems || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při rozpoznávání fotky.');
    } finally {
      setLoading(false);
    }
  }

  function updateQty(itemId: string, delta: number) {
    setDetectedItems((prev) =>
      prev.map((item) => {
        if (item.itemId === itemId) {
          const newQty = Math.max(0.1, Number((item.detectedQty + delta).toFixed(2)));
          return { ...item, detectedQty: newQty };
        }
        return item;
      })
    );
  }

  async function handleConfirmIssue() {
    if (detectedItems.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      for (const item of detectedItems) {
        await fetch('/api/warehouse/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itemId: item.itemId,
            type: 'ISSUE',
            quantity: item.detectedQty,
            workOrderId: workOrderId || undefined,
            assignedEmployeeId: assignedEmployeeId || undefined,
            note: 'Výdej z AI Fotky materiálu',
          }),
        });
      }

      setSuccessMessage('Všechny rozpoznané položky byly úspěšně vydány ze skladu!');
      setDetectedItems([]);
      setPhotoPreview(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při potvrzení výdeje.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:from-emerald-500 hover:to-teal-500 transition"
      >
        <Camera size={16} />
        <span>📷 AI Fotka regálu / materiálu</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-md bg-white shadow-2xl rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Camera className="h-5 w-5 text-emerald-600" />
                  <span>📷 AI Rozpoznání fotky materiálu</span>
                </h3>
                <p className="text-xs text-slate-500">Vyfoťte položky nebo materiál v kufrů auta</p>
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

            {successMessage && (
              <div className="mb-4 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Photo Uploader Input */}
            <div className="mb-4 text-center">
              {photoPreview ? (
                <div className="relative mx-auto mb-3 h-40 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition">
                  <Camera size={32} className="text-slate-400 mb-1" />
                  <span className="text-xs font-bold text-slate-700">Vyfotit nebo nahrát fotku materiálu</span>
                  <span className="text-[10px] text-slate-400">Pásky, lepidla, žebřík, krabice...</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 py-3 text-xs font-extrabold text-emerald-800">
                  <Loader2 size={16} className="animate-spin text-emerald-600" />
                  <span>AI zkoumá fotku a vyhledává položky...</span>
                </div>
              )}
            </div>

            {/* Detected Items List */}
            {detectedItems.length > 0 && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                  <Sparkles size={14} className="text-emerald-600" />
                  Rozpoznané položky na fotce (Můžete upravit kusi):
                </h4>

                <div className="space-y-2">
                  {detectedItems.map((item) => (
                    <div
                      key={item.itemId}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-900 block">{item.name}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">Jednotka: {item.unit}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQty(item.itemId, -0.5)}
                          className="h-7 w-7 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold hover:bg-slate-100"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="font-black text-slate-900 text-sm min-w-[36px] text-center">
                          {item.detectedQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(item.itemId, 0.5)}
                          className="h-7 w-7 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-bold hover:bg-slate-100"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Optional Assignment */}
                {employees.length > 0 && (
                  <label className="block font-bold text-slate-700 text-xs mt-3">
                    Komu se materiál vydává
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
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 mt-4 text-xs">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Zavřít
              </button>

              {detectedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmIssue}
                  disabled={loading || isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-black text-white hover:bg-emerald-800 transition shadow-md disabled:opacity-50"
                >
                  {loading || isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  <span>Potvrdit výdej {detectedItems.length} položek</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
