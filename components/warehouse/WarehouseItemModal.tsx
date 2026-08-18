'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Plus, X, Loader2, Edit3, Building2, MapPin } from 'lucide-react';

interface WarehouseItemData {
  id?: string;
  name: string;
  code?: string | null;
  category: 'CONSUMABLE' | 'RETURNABLE';
  unit: string;
  quantityInStock: number | string;
  minQuantity?: number | string | null;
  unitPrice?: number | string | null;
  location?: string | null;
  supplierName?: string | null;
  supplierContact?: string | null;
  note?: string | null;
}

export function WarehouseItemModal({ item }: { item?: WarehouseItemData }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(item?.name || '');
  const [code, setCode] = useState(item?.code || '');
  const [category, setCategory] = useState<'CONSUMABLE' | 'RETURNABLE'>(item?.category || 'CONSUMABLE');
  const [unit, setUnit] = useState(item?.unit || 'ks');
  const [quantityInStock, setQuantityInStock] = useState(item?.quantityInStock?.toString() || '0');
  const [minQuantity, setMinQuantity] = useState(item?.minQuantity?.toString() || '');
  const [unitPrice, setUnitPrice] = useState(item?.unitPrice?.toString() || '');
  const [location, setLocation] = useState(item?.location || '');
  const [supplierName, setSupplierName] = useState(item?.supplierName || '');
  const [supplierContact, setSupplierContact] = useState(item?.supplierContact || '');
  const [note, setNote] = useState(item?.note || '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    const isEdit = Boolean(item?.id);
    const url = isEdit ? `/api/warehouse/items/${item?.id}` : '/api/warehouse/items';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          category,
          unit,
          quantityInStock: Number(quantityInStock) || 0,
          minQuantity: minQuantity ? Number(minQuantity) : null,
          unitPrice: unitPrice ? Number(unitPrice) : null,
          location: location.trim() || undefined,
          supplierName: supplierName.trim() || undefined,
          supplierContact: supplierContact.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Uložení selhalo.');
      }

      setIsOpen(false);
      if (!isEdit) {
        setName('');
        setCode('');
        setQuantityInStock('0');
        setMinQuantity('');
        setUnitPrice('');
        setLocation('');
        setSupplierName('');
        setSupplierContact('');
        setNote('');
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při uložení.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {item ? (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
          title="Upravit položku"
        >
          <Edit3 size={15} />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-slate-800 transition"
        >
          <Plus size={16} />
          <span>+ Nová skladová položka</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-lg bg-white shadow-2xl rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <Package className="h-5 w-5 text-sky-600" />
                  <span>{item ? '✏️ Úprava skladové položky' : '📦 Nová skladová položka'}</span>
                </h3>
                <p className="text-xs text-slate-500">Zadejte specifikaci materiálu, nářadí nebo vybavení</p>
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
              <label className="block font-bold text-slate-700">
                Název položky *
                <input
                  required
                  className="input mt-1 w-full text-xs font-normal"
                  placeholder="např. Stahovací pásky 500mm černé (balení 100ks)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <div className="grid gap-3 grid-cols-2">
                <label className="font-bold text-slate-700">
                  Typ materiálu *
                  <select
                    className="input mt-1 w-full text-xs font-normal"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                  >
                    <option value="CONSUMABLE">📦 Spotřební materiál (Odečítá se)</option>
                    <option value="RETURNABLE">🔨 Vratné nářadí / Vybavení (Vrací se)</option>
                  </select>
                </label>

                <label className="font-bold text-slate-700">
                  Jednotka *
                  <select
                    className="input mt-1 w-full text-xs font-normal"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="ks">ks (kusy)</option>
                    <option value="balení">balení</option>
                    <option value="role">role</option>
                    <option value="sada">sada</option>
                    <option value="m">m (metry)</option>
                    <option value="l">l (litry)</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 grid-cols-3">
                <label className="font-bold text-slate-700">
                  Stav na skladě *
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input mt-1 w-full text-xs font-normal"
                    value={quantityInStock}
                    onChange={(e) => setQuantityInStock(e.target.value)}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Min. zásoba
                  <input
                    type="number"
                    step="0.01"
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="např. 10"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Cena Kč (bez DPH)
                  <input
                    type="number"
                    step="0.01"
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="Kč"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-3 grid-cols-2">
                <label className="font-bold text-slate-700">
                  Kód / SKU položky
                  <input
                    className="input mt-1 w-full text-xs font-normal font-mono"
                    placeholder="např. PAS-500-BLK"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Umístění na skladě (Sektor/Regál)
                  <input
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="např. Regál A1 - Plasty"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-3 grid-cols-2">
                <label className="font-bold text-slate-700">
                  Dodavatel / Prodejce
                  <input
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="např. Hornbach / Hilti / Den Braven"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Kontakt na dodavatele
                  <input
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="Telefon / email / link..."
                    value={supplierContact}
                    onChange={(e) => setSupplierContact(e.target.value)}
                  />
                </label>
              </div>

              <label className="block font-bold text-slate-700">
                Poznámka / Popis
                <textarea
                  rows={2}
                  className="input mt-1 w-full text-xs font-normal"
                  placeholder="Doplňující specifikace nebo návod k použití..."
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
                  {loading || isPending ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                  <span>{item ? 'Uložit změny' : 'Vytvořit položku'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
