'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Plus, Trash2, Edit2, Check, X, AlertCircle, CheckCircle2, Layers } from 'lucide-react';

export type CarrierTypeItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  active: boolean;
  sortOrder: number;
  carrierCount: number;
};

export function CarrierTypesSettings() {
  const [types, setTypes] = useState<CarrierTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // New form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newIcon, setNewIcon] = useState('📍');
  const [newColor, setNewColor] = useState('#2563EB');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editDesc, setEditDesc] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch('/api/settings/carrier-types');
      const data = (await res.json()) as { carrierTypes?: CarrierTypeItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Nepodařilo se načíst typy nosičů.');
      setTypes(data.carrierTypes ?? []);
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
      const res = await fetch('/api/settings/carrier-types', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          code: newCode.trim() || undefined,
          icon: newIcon.trim() || null,
          color: newColor.trim() || null,
          description: newDesc.trim() || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; carrierType?: CarrierTypeItem; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Vytvoření selhalo.');

      setNotice(`Typ nosiče "${newName}" byl úspěšně vytvořen.`);
      setNewName('');
      setNewCode('');
      setNewIcon('📍');
      setNewColor('#2563EB');
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

  function startEdit(item: CarrierTypeItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditCode(item.code);
    setEditIcon(item.icon ?? '📍');
    setEditColor(item.color ?? '#2563EB');
    setEditDesc(item.description ?? '');
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return;
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/settings/carrier-types/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          code: editCode.trim() || undefined,
          icon: editIcon.trim() || null,
          color: editColor.trim() || null,
          description: editDesc.trim() || null,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Úprava selhala.');

      setNotice(`Typ nosiče "${editName}" byl upraven.`);
      setEditingId(null);
      await loadData();
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.');
    }
  }

  async function handleToggleActive(item: CarrierTypeItem) {
    setError('');
    try {
      const res = await fetch(`/api/settings/carrier-types/${item.id}`, {
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

  async function handleDelete(item: CarrierTypeItem) {
    const confirmText = item.carrierCount > 0
      ? `Typ "${item.name}" je přiřazen k ${item.carrierCount} nosičům. Smazáním bude deaktivován, aby nedošlo k porušení dat. Chcete pokračovat?`
      : `Opravdu chcete smazat typ nosiče "${item.name}"?`;
    if (!window.confirm(confirmText)) return;

    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/settings/carrier-types/${item.id}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Smazání selhalo.');

      setNotice(data.message || `Typ nosiče "${item.name}" byl smazán.`);
      await loadData();
      setTimeout(() => setNotice(''), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při mazání.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="text-sky-600" size={26} />
            Typy reklamních nosičů
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Vlastní číselník typů nosičů vaší organizace. Každá organizace spravuje pouze své typy.
          </p>
        </div>
        {!showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="button button-primary flex items-center gap-2 self-start"
          >
            <Plus size={16} />
            Přidat nový typ nosiče
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
            <h2 className="font-bold text-lg text-slate-900">Nový typ nosiče</h2>
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
                Název typu nosiče *
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="např. Megaboard, CLV, LED stěna..."
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
                placeholder="např. MEGABOARD"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ikona</label>
                <input
                  type="text"
                  className="input w-full text-center text-lg"
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  maxLength={4}
                />
              </div>
              <div className="w-1/2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Barva</label>
                <input
                  type="color"
                  className="input w-full h-10 p-1 cursor-pointer"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Popis (volitelný)</label>
            <input
              type="text"
              className="input w-full"
              placeholder="Stručný popis formátu, rozměrů či umístění..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
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
              {submitting ? 'Ukládám…' : 'Vytvořit typ nosiče'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="card text-center py-10 text-slate-500">Načítám typy nosičů…</div>
      ) : types.length === 0 ? (
        <div className="card text-center py-12 text-slate-500 space-y-3">
          <p className="text-base font-semibold">Zatím nemáte vytvořené žádné typy reklamních nosičů.</p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Vytvořte své první typy nosičů (např. Billboard, Bigboard, Citylight), abyste mohli začít evidovat svůj inventář.
          </p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="button button-primary mt-2 inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Přidat první typ nosiče
          </button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="py-3 px-4">Ikona & Barva</th>
                  <th className="py-3 px-4">Název</th>
                  <th className="py-3 px-4">Kód</th>
                  <th className="py-3 px-4">Nosičů v inventáři</th>
                  <th className="py-3 px-4">Stav</th>
                  <th className="py-3 px-4 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {types.map((item) => (
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
                            <div className="flex gap-2">
                              <div className="w-1/2">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Ikona</label>
                                <input
                                  type="text"
                                  className="input w-full text-center"
                                  value={editIcon}
                                  onChange={(e) => setEditIcon(e.target.value)}
                                />
                              </div>
                              <div className="w-1/2">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Barva</label>
                                <input
                                  type="color"
                                  className="input w-full h-10 p-1 cursor-pointer"
                                  value={editColor}
                                  onChange={(e) => setEditColor(e.target.value)}
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
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{item.icon || '📍'}</span>
                            <span
                              className="h-4 w-4 rounded-full border border-slate-300 shadow-sm"
                              style={{ backgroundColor: item.color || '#94a3b8' }}
                            />
                          </div>
                        </td>
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {item.carrierCount} nosičů
                          </span>
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
                              title="Smazat / Deaktivovat"
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
