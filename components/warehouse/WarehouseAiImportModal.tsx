'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Camera, X, Loader2, CheckCircle2, Save, Trash2, Plus } from 'lucide-react';

interface ProposedItem {
  name: string;
  category: 'CONSUMABLE' | 'RETURNABLE';
  unit: string;
  quantityInStock: number;
  minQuantity: number;
  location: string;
  note: string;
}

export function WarehouseAiImportModal({ triggerClassName }: { triggerClassName?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [proposedItems, setProposedItems] = useState<ProposedItem[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setError('Fotka musí být JPEG, PNG nebo WebP a může mít nejvýše 3 MB.');
      return;
    }

    setPhotoPreview(URL.createObjectURL(file));
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;

      try {
        const res = await fetch('/api/warehouse/ai-import-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, photoBase64: base64Data }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI analýza fotky selhala.');

        setProposedItems(data.proposedItems || []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Chyba při AI zpracování fotky.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function updateItem<K extends keyof ProposedItem>(index: number, field: K, value: ProposedItem[K]) {
    setProposedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeItem(index: number) {
    setProposedItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addNewRow() {
    setProposedItems((prev) => [
      ...prev,
      {
        name: 'Nová skladová položka',
        category: 'CONSUMABLE',
        unit: 'ks',
        quantityInStock: 1,
        minQuantity: 2,
        location: 'Dílna / Regál',
        note: 'Ručně přidáno do AI seznamu',
      },
    ]);
  }

  async function handleSaveAllToDatabase() {
    if (proposedItems.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/warehouse/ai-import-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemsToSave: proposedItems }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uložení položek selhalo.');

      setSuccessMessage(data.message);
      setProposedItems([]);
      setPhotoPreview(null);
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání do databáze.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ||
          'flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 px-5 py-2.5 text-xs font-black text-white shadow-md hover:from-purple-600 hover:to-indigo-600 transition'
        }
      >
        <Sparkles size={16} className="shrink-0" />
        <span className="truncate">AI Naskladnit</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-2xl bg-white shadow-2xl rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  <span>✨ AI Vytvoření nových položek z fotky regálu</span>
                </h3>
                <p className="text-xs text-slate-500">
                  AI sama rozpozná věci na regálu, určí zda jde o spotřební materiál nebo vratné nářadí a zapíše do databáze.
                </p>
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

            {/* Photo Upload Dropzone */}
            <div className="mb-4 text-center">
              {photoPreview ? (
                <div className="relative mx-auto mb-3 h-44 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img src={photoPreview} alt="Shelf preview" className="h-full w-full object-cover" />
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-purple-300 rounded-2xl cursor-pointer bg-purple-50/50 hover:bg-purple-100/50 transition">
                  <Camera size={32} className="text-purple-600 mb-1" />
                  <span className="text-xs font-bold text-purple-950">Vyfotit regál v dílně nebo nahrát fotku</span>
                  <span className="text-[10px] text-purple-700">AI sama rozpozná názvy, počty i typy materiálu</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs font-extrabold text-purple-900">
                  <Loader2 size={18} className="animate-spin text-purple-600" />
                  <span>AI vyhodnocuje obraz regálu a sestavuje databázové položky...</span>
                </div>
              )}
            </div>

            {/* Proposed Items Table */}
            {proposedItems.length > 0 && (
              <div className="space-y-3 border-t border-slate-100 pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-800 text-sm">
                    📦 Nalezené nové položky (zkontrolujte před uložením do databáze):
                  </h4>
                  <button
                    type="button"
                    onClick={addNewRow}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 hover:underline"
                  >
                    <Plus size={12} />
                    <span>Přidat další řádek</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {proposedItems.map((item, idx) => (
                    <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          className="input font-bold text-slate-900 text-xs w-full"
                          value={item.name}
                          onChange={(e) => updateItem(idx, 'name', e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
                          title="Odstranit z vygenerovaného seznamu"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid gap-2 grid-cols-3">
                        <label className="font-semibold text-slate-600 text-[11px]">
                          Typ materiálu
                          <select
                            className="input mt-0.5 w-full text-[11px] font-bold"
                            value={item.category}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === 'CONSUMABLE' || value === 'RETURNABLE') updateItem(idx, 'category', value);
                            }}
                          >
                            <option value="CONSUMABLE">📦 Spotřební materiál</option>
                            <option value="RETURNABLE">🔨 Vratné nářadí</option>
                          </select>
                        </label>

                        <label className="font-semibold text-slate-600 text-[11px]">
                          Počet ks/balení
                          <input
                            type="number"
                            step="0.1"
                            className="input mt-0.5 w-full text-[11px] font-bold"
                            value={item.quantityInStock}
                            onChange={(e) => updateItem(idx, 'quantityInStock', Number(e.target.value))}
                          />
                        </label>

                        <label className="font-semibold text-slate-600 text-[11px]">
                          Jednotka
                          <input
                            className="input mt-0.5 w-full text-[11px]"
                            value={item.unit}
                            onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
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

              {proposedItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleSaveAllToDatabase}
                  disabled={saving || isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-700 px-5 py-2 text-xs font-black text-white hover:bg-purple-800 transition shadow-md disabled:opacity-50"
                >
                  {saving || isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>💾 Uložit {proposedItems.length} nových položek do databáze</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
