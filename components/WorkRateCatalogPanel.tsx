'use client';

import React, { useState } from 'react';
import type { WorkCategory } from '@/lib/work-categories';

export type RateCatalogItem = {
  id: string;
  source: 'COMPANY' | 'EMPLOYEE';
  employeeId?: string | null;
  employeeName?: string | null;
  type: 'HOURLY' | 'TASK' | 'FIXED' | string;
  name: string;
  workType: string | null;
  carrierTypeLabel?: string | null;
  amount: string;
  unit: string | null;
};

type WorkRateCatalogPanelProps = {
  companyRates: RateCatalogItem[];
  employeeRates?: RateCatalogItem[];
  selectedEmployeeId?: string;
  workCategories?: WorkCategory[];
  canManage?: boolean;
  onSelectRate?: (rate: {
    name: string;
    type: 'HOURLY' | 'TASK' | 'FIXED';
    amount: string;
    unit: string;
    workType: string;
  }) => void;
  onRatesChanged?: () => void;
};

const WORK_TYPE_LABELS: Record<string, string> = {
  INSTALLATION: 'Instalace',
  REINSTALLATION: 'Reinstalace',
  DEINSTALLATION: 'Deinstalace',
  REPAIR: 'Oprava / Servis',
  CHECK: 'Kontrola / Zaměření',
  TRANSPORT: 'Doprava / Převoz',
  OTHER: 'Ostatní práce',
};

const RATE_TYPE_BADGES: Record<string, { label: string; icon: string; cls: string }> = {
  TASK: {
    label: 'Úkolová sazba',
    icon: '📦',
    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  HOURLY: {
    label: 'Hodinová sazba',
    icon: '⏱️',
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  FIXED: {
    label: 'Cena za zakázku',
    icon: '💰',
    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

export function WorkRateCatalogPanel({
  companyRates: initialCompanyRates,
  employeeRates = [],
  selectedEmployeeId,
  workCategories = [],
  canManage = false,
  onSelectRate,
  onRatesChanged,
}: WorkRateCatalogPanelProps) {
  const [companyRates, setCompanyRates] = useState<RateCatalogItem[]>(initialCompanyRates);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Quick add/update rate form state
  const [rateType, setRateType] = useState<'TASK' | 'HOURLY' | 'FIXED'>('TASK');
  const [rateName, setRateName] = useState('');
  const [rateWorkType, setRateWorkType] = useState('INSTALLATION');
  const [rateAmount, setRateAmount] = useState('');
  const [rateUnit, setRateUnit] = useState('ks');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const visibleEmployeeRates = selectedEmployeeId
    ? employeeRates.filter((r) => !r.employeeId || r.employeeId === selectedEmployeeId)
    : employeeRates;

  // Also include any workCategories that have defaultRate > 0 and aren't already in companyRates
  const categoryDerivedRates: RateCatalogItem[] = workCategories
    .filter(
      (cat) =>
        cat.defaultRate !== undefined &&
        cat.defaultRate > 0 &&
        !companyRates.some(
          (cr) => cr.name.trim().toLowerCase() === cat.label.trim().toLowerCase()
        )
    )
    .map((cat) => {
      const mappedType =
        cat.defaultPriceType === 'PIECE_RATE'
          ? 'TASK'
          : cat.defaultPriceType === 'FIXED'
          ? 'FIXED'
          : 'HOURLY';
      return {
        id: `cat-${cat.key}`,
        source: 'COMPANY' as const,
        type: mappedType,
        name: cat.label,
        workType: cat.defaultWorkType || 'INSTALLATION',
        carrierTypeLabel: cat.label,
        amount: String(cat.defaultRate),
        unit: mappedType === 'HOURLY' ? 'hod' : mappedType === 'FIXED' ? 'zakázka' : 'ks',
      };
    });

  const allRates: RateCatalogItem[] = [
    ...visibleEmployeeRates,
    ...companyRates,
    ...categoryDerivedRates,
  ];
  const taskRatesCount = allRates.filter((r) => r.type === 'TASK').length;
  const hourlyRatesCount = allRates.filter((r) => r.type === 'HOURLY').length;

  const handleCategoryPick = (cat: WorkCategory) => {
    setRateName(cat.label);
    setRateWorkType(cat.defaultWorkType || 'INSTALLATION');
    if (cat.defaultPriceType === 'HOURLY') {
      setRateType('HOURLY');
      setRateUnit('hod');
    } else if (cat.defaultPriceType === 'FIXED') {
      setRateType('FIXED');
      setRateUnit('zakázka');
    } else {
      setRateType('TASK');
      setRateUnit('ks');
    }
    // Pre-fill existing amount if already defined
    const existing = companyRates.find(
      (r) => r.name.trim().toLowerCase() === cat.label.trim().toLowerCase()
    );
    if (existing) {
      setRateAmount(existing.amount);
      setRateType((existing.type as 'TASK' | 'HOURLY' | 'FIXED') || 'TASK');
      setRateUnit(existing.unit || (existing.type === 'HOURLY' ? 'hod' : 'ks'));
    } else if (cat.defaultRate && cat.defaultRate > 0) {
      setRateAmount(String(cat.defaultRate));
    }
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!rateName.trim()) {
      setFeedback({ type: 'err', text: 'Vyberte nebo zadejte název úkolu / sazby.' });
      return;
    }
    const normalizedAmount = rateAmount.trim().replace(',', '.');
    if (!normalizedAmount || Number(normalizedAmount) <= 0) {
      setFeedback({ type: 'err', text: 'Zadejte platnou částku v Kč.' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/company-rates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: rateType,
          name: rateName.trim(),
          workType: rateWorkType || 'INSTALLATION',
          carrierTypeLabel: rateName.trim(),
          amount: normalizedAmount,
          unit: rateType === 'HOURLY' ? 'hod' : rateUnit.trim() || 'ks',
          validFrom: new Date().toISOString().slice(0, 10),
          upsert: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Uložení sazby selhalo.');
      }

      const newItem: RateCatalogItem = {
        id: data.id,
        source: 'COMPANY',
        type: data.type,
        name: data.name,
        workType: data.workType,
        carrierTypeLabel: data.carrierTypeLabel,
        amount: data.amount,
        unit: data.unit,
      };

      setCompanyRates((prev) => {
        const idx = prev.findIndex((r) => r.id === newItem.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = newItem;
          return copy;
        }
        return [newItem, ...prev];
      });

      setFeedback({
        type: 'ok',
        text: `Sazba „${newItem.name}“ (${Number(newItem.amount).toLocaleString('cs-CZ')} Kč / ${newItem.unit || 'ks'}) byla uložena do ceníku.`,
      });
      setRateAmount('');
      setShowAddForm(false);
      onRatesChanged?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Sazbu se nepodařilo uložit.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRate = async (id: string, name: string) => {
    if (!window.confirm(`Opravdu chcete odstranit sazbu „${name}“ z ceníku?`)) return;
    setFeedback(null);
    try {
      const res = await fetch(`/api/company-rates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Smazání sazby selhalo.');
      }
      setCompanyRates((prev) => prev.filter((r) => r.id !== id));
      setFeedback({ type: 'ok', text: `Sazba „${name}“ byla odstraněna.` });
      onRatesChanged?.();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Smazání selhalo.',
      });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-2 text-left"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-base">
              📋
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Náhled ceníku sazeb (za úkol / hodinu)
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                  {allRates.length} sazeb
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {taskRatesCount} úkolových · {hourlyRatesCount} hodinových
                {onSelectRate ? ' · Kliknutím na sazbu ji rovnou předvyplníte do formuláře' : ''}
              </p>
            </div>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm((v) => !v);
                  setIsExpanded(true);
                }}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
              >
                {showAddForm ? 'Zavřít rychlou úpravu' : '+ Rychle nastavit sazbu'}
              </button>
              <a
                href="/settings/work"
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                ⚙️ Správa ceníku úkolů v Nastavení →
              </a>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {isExpanded ? 'Skrýt ceník ▲' : 'Zobrazit ceník ▼'}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {showAddForm && canManage && (
        <form
          onSubmit={handleSaveRate}
          className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
              Nastavit firemní sazbu za úkol nebo hodinu
            </h4>
            <span className="text-[11px] text-slate-500">
              Pokud sazba se stejným názvem již existuje, automaticky se přepíše na novou částku.
            </span>
          </div>

          {workCategories.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold text-slate-600">
                1. Vyberte úkol ze šablony (nebo napište vlastní níže):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {workCategories.map((cat) => {
                  const isSelected = rateName.trim().toLowerCase() === cat.label.trim().toLowerCase();
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => handleCategoryPick(cat)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-semibold text-slate-700 lg:col-span-2">
              Název úkolu / činnosti v ceníku
              <input
                type="text"
                required
                value={rateName}
                onChange={(e) => setRateName(e.target.value)}
                placeholder="např. Instalace lavičky / Lepení billboardu..."
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              />
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Typ sazby
              <select
                value={rateType}
                onChange={(e) => {
                  const val = e.target.value as 'TASK' | 'HOURLY' | 'FIXED';
                  setRateType(val);
                  if (val === 'HOURLY') setRateUnit('hod');
                  else if (val === 'FIXED') setRateUnit('zakázka');
                  else setRateUnit('ks');
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
              >
                <option value="TASK">📦 Úkolová (za ks / úkol)</option>
                <option value="HOURLY">⏱️ Hodinová (za hod)</option>
                <option value="FIXED">💰 Pevná (za zakázku)</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-slate-700">
              Sazba (Kč)
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={rateAmount}
                onChange={(e) => setRateAmount(e.target.value)}
                placeholder="např. 450"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900"
              />
            </label>

            <div className="flex items-end gap-2">
              <label className="flex-1 text-xs font-semibold text-slate-700">
                Jednotka
                <input
                  type="text"
                  value={rateType === 'HOURLY' ? 'hod' : rateUnit}
                  disabled={rateType === 'HOURLY'}
                  onChange={(e) => setRateUnit(e.target.value)}
                  placeholder="ks, m2..."
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-normal disabled:bg-slate-100"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50 h-[38px]"
              >
                {saving ? 'Ukládám...' : 'Uložit sazbu'}
              </button>
            </div>
          </div>
        </form>
      )}

      {isExpanded && (
        <div className="mt-3">
          {allRates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-xs text-slate-500">
              V ceníku zatím nejsou definované žádné sazby za úkol ani hodinu.
              {canManage ? (
                <span>
                  {' '}
                  Klikněte na <b>„+ Nastavit sazbu za úkol / hodinu“</b> výše a přidejte např. sazbu za{' '}
                  <i>Instalaci lavičky</i> nebo <i>Lepení billboardu</i>.
                </span>
              ) : (
                <span> Sazbu můžete při zápisu práce zadat i ručně.</span>
              )}
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {allRates.map((rate) => {
                const badge = RATE_TYPE_BADGES[rate.type] || RATE_TYPE_BADGES.TASK;
                const unitText = rate.unit || (rate.type === 'HOURLY' ? 'hod' : 'ks');
                return (
                  <div
                    key={`${rate.source}-${rate.id}`}
                    onClick={() =>
                      onSelectRate?.({
                        name: rate.name,
                        type: (rate.type as 'HOURLY' | 'TASK' | 'FIXED') || 'TASK',
                        amount: rate.amount,
                        unit: unitText,
                        workType: rate.workType || 'INSTALLATION',
                      })
                    }
                    className={`group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 transition ${
                      onSelectRate
                        ? 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-sm'
                        : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge.cls}`}
                        >
                          {badge.icon} {badge.label}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {rate.source === 'EMPLOYEE'
                            ? `👤 ${rate.employeeName || 'Osobní sazba'}`
                            : '🏢 Firemní ceník'}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-slate-900 leading-snug">
                        {rate.name}
                      </div>

                      {rate.workType && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          Druh práce: {WORK_TYPE_LABELS[rate.workType] || rate.workType}
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-baseline justify-between border-t border-slate-200/80 pt-2">
                      <div className="text-base font-black text-slate-900">
                        {Number(rate.amount).toLocaleString('cs-CZ')} Kč{' '}
                        <span className="text-xs font-semibold text-slate-500">/ {unitText}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onSelectRate && (
                          <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 opacity-85 group-hover:opacity-100">
                            Použít →
                          </span>
                        )}
                        {canManage && rate.source === 'COMPANY' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteRate(rate.id, rate.name);
                            }}
                            title="Smazat sazbu z ceníku"
                            className="rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
