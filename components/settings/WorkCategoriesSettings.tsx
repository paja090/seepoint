'use client';

import { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import type { WorkCategory, WorkCategoryPreset } from '@/lib/work-categories';

function formatPriceBadge(cat: WorkCategory): string | null {
  if (!cat.defaultRate || cat.defaultRate <= 0) return null;
  const unit =
    cat.defaultPriceType === 'PIECE_RATE'
      ? 'ks'
      : cat.defaultPriceType === 'FIXED'
      ? 'zakázka'
      : 'hod';
  return `${cat.defaultRate.toLocaleString('cs-CZ')} Kč / ${unit}`;
}

export function WorkCategoriesSettings() {
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [presets, setPresets] = useState<WorkCategoryPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Form for adding new category
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('🔨');
  const [newScope, setNewScope] = useState<'WORKSHOP' | 'FIELD'>('FIELD');
  const [newWorkType] = useState<WorkCategory['defaultWorkType']>('INSTALLATION');
  const [newPriceType, setNewPriceType] = useState<'HOURLY' | 'PIECE_RATE' | 'FIXED'>('PIECE_RATE');
  const [newRate, setNewRate] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/settings/work-categories');
        const data = (await res.json()) as {
          categories?: WorkCategory[];
          presets?: WorkCategoryPreset[];
          error?: string;
        };
        if (data.categories) setCategories(data.categories);
        if (data.presets) setPresets(data.presets);
      } catch {
        setError('Nepodařilo se načíst firemní činnosti.');
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, []);

  async function handleSave() {
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/settings/work-categories', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ categories }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        categories?: WorkCategory[];
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Uložení selhalo.');
      if (data.categories) setCategories(data.categories);
      setNotice('Firemní činnosti a ceník sazeb za úkoly byly úspěšně uloženy.');
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyPreset(presetKey: string) {
    const preset = presets.find((p) => p.key === presetKey);
    const confirmed = window.confirm(
      `Opravdu chcete načíst šablonu "${preset?.title || presetKey}"? Stávající seznam činností bude nahrazen touto šablonou.`
    );
    if (!confirmed) return;

    setApplyingPreset(presetKey);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/settings/work-categories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preset: presetKey }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        categories?: WorkCategory[];
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || 'Načtení šablony selhalo.');
      if (data.categories) setCategories(data.categories);
      setNotice(`Šablona "${preset?.title || presetKey}" byla úspěšně načtena.`);
      setTimeout(() => setNotice(''), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při aplikaci šablony.');
    } finally {
      setApplyingPreset(null);
    }
  }

  function handleAddCategory() {
    if (!newLabel.trim()) return;
    const key = `CAT_${Date.now().toString(36).toUpperCase()}`;
    const parsedRate = Number(newRate.replace(',', '.'));
    const newCat: WorkCategory = {
      key,
      label: newLabel.trim(),
      scope: newScope,
      icon: newIcon.trim() || '⚡',
      defaultWorkType: newWorkType,
      defaultPriceType: newPriceType,
      defaultRate: Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : undefined,
    };
    setCategories((prev) => [...prev, newCat]);
    setNewLabel('');
    setNewRate('');
  }

  function handleRemoveCategory(index: number) {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  }

  function handleMove(index: number, direction: 'up' | 'down') {
    setCategories((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  }

  function handleUpdateField<K extends keyof WorkCategory>(
    index: number,
    field: K,
    val: WorkCategory[K]
  ) {
    setCategories((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 font-medium">
        Načítám firemní nastavení činností a ceníku úkolů…
      </div>
    );
  }

  const workshopCategories = categories.filter((c) => c.scope === 'WORKSHOP');
  const fieldCategories = categories.filter((c) => c.scope === 'FIELD');

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏭</span>
          <h2 className="text-xl font-bold text-slate-900">
            Činnosti výroby, montáží & Ceník sazeb za úkoly pro pracovníky
          </h2>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          Zde nastavíte seznam prací a jejich ceník pro pracovníky (např.{' '}
          <b>Lepení billboardu – Úkolová sazba Kč/ks</b>,{' '}
          <b>Instalace lavičky – Úkolová sazba Kč/ks</b> nebo{' '}
          <b>Montáž / Dílna – Hodinová sazba Kč/hod</b>). Po uložení se sazby ihned propíšou do
          výkazů práce a vyúčtování.
        </p>
      </div>

      {notice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Industry Presets */}
      <section className="card space-y-4">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles size={16} className="text-amber-500" />
            Rychlé oborové šablony (načíst na 1 klik)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Vyberte si profil vaší firmy pro okamžité předvyplnění typických činností.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              disabled={applyingPreset !== null}
              onClick={() => handleApplyPreset(preset.key)}
              className="flex flex-col text-left p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30 transition shadow-2xs group disabled:opacity-50"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">{preset.icon}</span>
                <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition">
                  {preset.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                {preset.subtitle}
              </p>
              <span className="text-[10px] font-bold text-indigo-600 mt-3 flex items-center gap-1">
                <RotateCcw size={10} />{' '}
                {applyingPreset === preset.key ? 'Aplikuji…' : 'Načíst tuto šablonu →'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 2. Active Categories & Task Rate Editor */}
      <section className="card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Ceník činností a úkolů firmy ({categories.length})
            </h3>
            <p className="text-xs text-slate-500">
              U každé činnosti můžete nastavit, zda je <b>Úkolová (Kč/ks)</b>,{' '}
              <b>Hodinová (Kč/hod)</b> nebo <b>Za zakázku (Kč)</b>, a zadat její výchozí sazbu v Kč.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-slate-950 text-white font-extrabold text-xs shadow-md hover:bg-slate-800 transition flex items-center gap-2 self-start sm:self-auto disabled:opacity-50"
          >
            {saving ? 'Ukládám…' : '💾 Uložit činnosti a ceník'}
          </button>
        </div>

        <div className="space-y-3">
          {categories.map((cat, idx) => {
            const unitLabel =
              cat.defaultPriceType === 'PIECE_RATE'
                ? 'Kč / ks'
                : cat.defaultPriceType === 'FIXED'
                ? 'Kč / zak.'
                : 'Kč / hod';
            return (
              <div
                key={cat.key || idx}
                className="flex flex-wrap lg:flex-nowrap items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition"
              >
                {/* Order Controls */}
                <div className="flex items-center gap-0.5 text-slate-400">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, 'up')}
                    className="p-1 hover:text-slate-900 disabled:opacity-30"
                    title="Posunout nahoru"
                  >
                    <MoveUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === categories.length - 1}
                    onClick={() => handleMove(idx, 'down')}
                    className="p-1 hover:text-slate-900 disabled:opacity-30"
                    title="Posunout dolů"
                  >
                    <MoveDown size={14} />
                  </button>
                </div>

                {/* Icon Input */}
                <input
                  type="text"
                  value={cat.icon}
                  maxLength={4}
                  onChange={(e) => handleUpdateField(idx, 'icon', e.target.value)}
                  className="w-11 text-center p-2 rounded-lg border border-slate-200 bg-white text-base font-medium focus:ring-2 focus:ring-slate-900"
                  title="Emoji ikona"
                />

                {/* Label Input */}
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={cat.label}
                    onChange={(e) => handleUpdateField(idx, 'label', e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-900"
                    placeholder="Název činnosti (např. Lepení billboardu)"
                  />
                </div>

                {/* Price Type Switcher (Úkolová / Hodinová / Pevná) */}
                <select
                  value={cat.defaultPriceType || 'HOURLY'}
                  onChange={(e) =>
                    handleUpdateField(
                      idx,
                      'defaultPriceType',
                      e.target.value as WorkCategory['defaultPriceType']
                    )
                  }
                  className="p-2 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs font-bold text-indigo-900"
                  title="Způsob odměňování"
                >
                  <option value="PIECE_RATE">📦 Úkolová (za ks)</option>
                  <option value="HOURLY">⏱️ Hodinová (za hod)</option>
                  <option value="FIXED">💰 Pevná (za zakázku)</option>
                </select>

                {/* Default Rate Input (Kč) */}
                <div className="flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 w-36">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cat.defaultRate ?? ''}
                    onChange={(e) => {
                      const rawVal = e.target.value;
                      const num = rawVal === '' ? undefined : Number(rawVal);
                      handleUpdateField(
                        idx,
                        'defaultRate',
                        num !== undefined && Number.isFinite(num) ? num : undefined
                      );
                    }}
                    placeholder="Sazba..."
                    className="w-full text-xs font-black text-slate-900 outline-none bg-transparent"
                  />
                  <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap ml-1">
                    {unitLabel}
                  </span>
                </div>

                {/* Scope Switcher */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => handleUpdateField(idx, 'scope', 'WORKSHOP')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                      cat.scope === 'WORKSHOP'
                        ? 'bg-sky-100 text-sky-900 shadow-2xs font-extrabold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    🏭 Dílna
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateField(idx, 'scope', 'FIELD')}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition ${
                      cat.scope === 'FIELD'
                        ? 'bg-emerald-100 text-emerald-900 shadow-2xs font-extrabold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    🚗 Výjezd
                  </button>
                </div>

                {/* Work Type Select */}
                <select
                  value={cat.defaultWorkType}
                  onChange={(e) =>
                    handleUpdateField(
                      idx,
                      'defaultWorkType',
                      e.target.value as WorkCategory['defaultWorkType']
                    )
                  }
                  className="p-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700"
                >
                  <option value="INSTALLATION">Montáž / Výroba</option>
                  <option value="TRANSPORT">Doprava / Balení</option>
                  <option value="REPAIR">Oprava / Servis</option>
                  <option value="CHECK">Kontrola / Zaměření</option>
                  <option value="OTHER">Ostatní činnost</option>
                </select>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(idx)}
                  className="p-2 text-slate-400 hover:text-rose-600 transition"
                  title="Odstranit činnost"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add New Category Row */}
        <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 space-y-3">
          <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
            <Plus size={15} /> Přidat nový úkol / činnost do ceníku:
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              maxLength={4}
              className="w-12 text-center p-2 rounded-lg border border-slate-200 bg-white text-base font-medium"
              placeholder="🔨"
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Např. Lepení billboardu, Instalace lavičky..."
              className="flex-1 min-w-[200px] p-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
            <select
              value={newPriceType}
              onChange={(e) =>
                setNewPriceType(e.target.value as 'HOURLY' | 'PIECE_RATE' | 'FIXED')
              }
              className="p-2 rounded-lg border border-indigo-200 bg-indigo-50/50 text-xs font-bold text-indigo-900"
            >
              <option value="PIECE_RATE">📦 Úkolová (Kč / ks)</option>
              <option value="HOURLY">⏱️ Hodinová (Kč / hod)</option>
              <option value="FIXED">💰 Pevná (Kč / zak.)</option>
            </select>
            <input
              type="number"
              min="0"
              step="1"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder="Sazba v Kč (např. 450)"
              className="w-40 p-2 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-900"
            />
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as 'WORKSHOP' | 'FIELD')}
              className="p-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
            >
              <option value="FIELD">🚗 Výjezd v terénu</option>
              <option value="WORKSHOP">🏭 Práce na dílně</option>
            </select>
            <button
              type="button"
              onClick={handleAddCategory}
              disabled={!newLabel.trim()}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition disabled:opacity-40"
            >
              + Přidat do seznamu
            </button>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-500">
            Po kliknutí na <b>Uložit činnosti a ceník</b> se sazby automaticky propíšou i do firemního ceníku pro výkazy práce.
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-slate-950 text-white font-black text-xs shadow-md hover:bg-slate-800 transition disabled:opacity-50"
          >
            {saving ? 'Ukládám…' : '💾 Uložit činnosti a ceník'}
          </button>
        </div>
      </section>

      {/* 3. Live Preview */}
      <section className="card bg-slate-900 text-white space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">👀</span>
            <h3 className="text-sm font-bold text-white">
              Živý náhled tlačítek a sazeb ve výkazu práce
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-400">
            Takto tlačítka a ceník uvidí pracovníci i dispečeři
          </span>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
              🏭 Práce na firmě / Dílna ({workshopCategories.length}):
            </span>
            <div className="flex flex-wrap gap-2">
              {workshopCategories.map((c) => {
                const badge = formatPriceBadge(c);
                return (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                    {badge && (
                      <span className="rounded bg-indigo-500/30 px-1.5 py-0.5 text-[10px] font-bold text-indigo-200">
                        {badge}
                      </span>
                    )}
                  </span>
                );
              })}
              {workshopCategories.length === 0 && (
                <span className="text-xs text-slate-500 italic">Žádné činnosti pro dílnu</span>
              )}
            </div>
          </div>

          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
              🚗 Výjezdy a montáže v terénu ({fieldCategories.length}):
            </span>
            <div className="flex flex-wrap gap-2">
              {fieldCategories.map((c) => {
                const badge = formatPriceBadge(c);
                return (
                  <span
                    key={c.key}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs font-semibold"
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                    {badge && (
                      <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100">
                        {badge}
                      </span>
                    )}
                  </span>
                );
              })}
              {fieldCategories.length === 0 && (
                <span className="text-xs text-slate-500 italic">Žádné činnosti pro výjezdy</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
