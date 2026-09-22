'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Plus, Trash2, Edit2, Check, X, AlertCircle, CheckCircle2, Package } from 'lucide-react';
import type { CarrierTypeItem } from './CarrierTypesSettings';

export type ProductItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  carrierTypeId: string | null;
  carrierType?: {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  unit: string | null;
  active: boolean;
  sortOrder: number;
};

export function ProductCatalogSettings() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [carrierTypes, setCarrierTypes] = useState<CarrierTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCarrierTypeId, setNewCarrierTypeId] = useState('');
  const [newUnit, setNewUnit] = useState('ks');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editCarrierTypeId, setEditCarrierTypeId] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editDesc, setEditDesc] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const [prodRes, ctRes] = await Promise.all([
        fetch('/api/settings/products'),
        fetch('/api/settings/carrier-types'),
      ]);
      const prodData = (await prodRes.json()) as { products?: ProductItem[]; error?: string };
      const ctData = (await ctRes.json()) as { carrierTypes?: CarrierTypeItem[]; error?: string };

      if (!prodRes.ok) throw new Error(prodData.error || 'Nepodařilo se načíst produkty.');
      setProducts(prodData.products ?? []);
      setCarrierTypes(ctData.carrierTypes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/settings/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim() || undefined,
          carrierTypeId: newCarrierTypeId.trim() || null,
          unit: newUnit.trim() || 'ks',
          description: newDesc.trim() || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; product?: ProductItem; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Vytvoření produktu selhalo.');

      setNotice(`Produkt "${newName}" byl úspěšně vytvořen.`);
      setNewName('');
      setNewCode('');
      setNewCarrierTypeId('');
      setNewUnit('ks');
      setNewDesc('');
      setShowAddForm(false);
      await loadData();
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(item: ProductItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCode(item.code);
    setEditCarrierTypeId(item.carrierTypeId ?? '');
    setEditUnit(item.unit ?? 'ks');
    setEditDesc(item.description ?? '');
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/settings/products/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || undefined,
          carrierTypeId: editCarrierTypeId.trim() || null,
          unit: editUnit.trim() || 'ks',
          description: editDesc.trim() || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Úprava selhala.');

      setNotice(`Produkt "${editName}" byl upraven.`);
      setEditingId(null);
      await loadData();
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.');
    }
  }

  async function handleToggleActive(item: ProductItem) {
    setError('');
    try {
      const res = await fetch(`/api/settings/products/${item.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ active: !item.active }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Změna stavu selhala.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při změně stavu.');
    }
  }

  async function handleDelete(item: ProductItem) {
    if (!window.confirm(`Opravdu chcete smazat produkt "${item.name}"?`)) return;

    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/settings/products/${item.id}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Smazání selhalo.');

      setNotice(`Produkt "${item.name}" byl smazán.`);
      await loadData();
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při mazání.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="text-sky-600" size={26} />
            Produktový katalog organizace
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Vlastní obchodní produkty a reklamní formáty vaší společnosti pro nabídky a ceníky.
          </p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="button button-primary flex items-center gap-2 self-start"
          >
            <Plus size={16} />
            Přidat produkt
          </button>
        )}
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center gap-2">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleCreate} className="card border-2 border-sky-200 bg-sky-50/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-slate-900">Nový produkt</h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Název produktu *
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="např. Pronájem billboardu A/B, Digitální spot..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kód (volitelný)
              </label>
              <input
                type="text"
                className="input w-full font-mono uppercase"
                placeholder="např. PROD_BB_MONTH"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Typ nosiče
              </label>
              <select
                className="input w-full"
                value={newCarrierTypeId}
                onChange={(e) => setNewCarrierTypeId(e.target.value)}
              >
                <option value="">— Bez vazby na nosič —</option>
                {carrierTypes.map((ct) => (
                  <option key={ct.id} value={ct.id}>
                    {ct.icon ? `${ct.icon} ` : ''}{ct.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jednotka</label>
              <input
                type="text"
                className="input w-full"
                placeholder="ks, plocha, měsíc..."
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Popis (volitelný)</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Stručný popis produktu pro nabídku..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="button bg-white border border-slate-200 text-slate-700"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="button button-primary"
            >
              {submitting ? 'Ukládám…' : 'Vytvořit produkt'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="card text-center py-10 text-slate-500">Načítám produkty…</div>
      ) : products.length === 0 ? (
        <div className="card text-center py-12 text-slate-500 space-y-3">
          <p className="text-base font-semibold">Zatím nemáte v katalogu žádné produkty.</p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Vytvořte své obchodní nabídkové produkty navázané na vaše typy nosičů.
          </p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="button button-primary mt-2 inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Přidat první produkt
          </button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4">Produkt</th>
                  <th className="py-3 px-4">Kód</th>
                  <th className="py-3 px-4">Typ nosiče</th>
                  <th className="py-3 px-4">Jednotka</th>
                  <th className="py-3 px-4">Stav</th>
                  <th className="py-3 px-4 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50/50 ${!item.active ? 'opacity-50' : ''}`}>
                    {editingId === item.id ? (
                      <td colSpan={6} className="p-4 bg-amber-50/40">
                        <div className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Název</label>
                              <input
                                type="text"
                                className="input w-full"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Kód</label>
                              <input
                                type="text"
                                className="input w-full font-mono uppercase"
                                value={editCode}
                                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Typ nosiče</label>
                              <select
                                className="input w-full"
                                value={editCarrierTypeId}
                                onChange={(e) => setEditCarrierTypeId(e.target.value)}
                              >
                                <option value="">— Bez nosiče —</option>
                                {carrierTypes.map((ct) => (
                                  <option key={ct.id} value={ct.id}>
                                    {ct.icon ? `${ct.icon} ` : ''}{ct.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-600 mb-1">Jednotka</label>
                              <input
                                type="text"
                                className="input w-full"
                                value={editUnit}
                                onChange={(e) => setEditUnit(e.target.value)}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1">Popis</label>
                            <input
                              type="text"
                              className="input w-full"
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="button bg-white border border-slate-200 text-xs"
                            >
                              Zrušit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item.id)}
                              className="button button-primary text-xs flex items-center gap-1"
                            >
                              <Check size={14} />
                              Uložit změny
                            </button>
                          </div>
                        </div>
                      </td>
                    ) : (
                      <>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {item.name}
                          {item.description && (
                            <p className="text-xs font-normal text-slate-500 mt-0.5">{item.description}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                          {item.code}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.carrierType ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-100">
                              <span>{item.carrierType.icon || '📍'}</span>
                              <span>{item.carrierType.name}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {item.unit || 'ks'}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(item)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                              item.active
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {item.active ? 'Aktivní' : 'Neaktivní'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              title="Upravit"
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              title="Smazat"
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
