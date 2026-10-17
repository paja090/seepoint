'use client';

import React, { useState } from 'react';
import { OTHER_COST_PRESETS } from '@/lib/work-entry-stats';

type QuickOtherCostFormProps = {
  settlementId?: string;
  employeeId?: string;
  employees?: Array<{ id: string; firstName: string; lastName: string }>;
  onSuccess: (message: string) => void;
  onCancel?: () => void;
};

export function QuickOtherCostForm({
  settlementId = 'current',
  employeeId: initialEmployeeId = '',
  employees,
  onSuccess,
  onCancel,
}: QuickOtherCostFormProps) {
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('COMPANY_CAR');
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [direction, setDirection] = useState<'DEDUCTION' | 'REIMBURSEMENT' | 'ADVANCE' | 'BONUS'>('DEDUCTION');
  const [category, setCategory] = useState<string>('FUEL');
  const [description, setDescription] = useState<string>('Využití služebního auta');
  const [amount, setAmount] = useState<string>('');
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSelectPreset = (preset: (typeof OTHER_COST_PRESETS)[number]) => {
    setSelectedPresetKey(preset.key);
    setCategory(preset.category);
    setDescription(preset.label);
    setDirection(preset.defaultDirection);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanAmount = amount.trim().replace(',', '.');
    const numericAmount = Number(cleanAmount);
    if (!cleanAmount || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Zadejte platnou kladnou částku v Kč.');
      return;
    }

    if (employees && employees.length > 0 && !employeeId && settlementId === 'current') {
      setError('Vyberte pracovníka.');
      return;
    }

    const signedAmount =
      direction === 'DEDUCTION' || direction === 'ADVANCE'
        ? -Math.abs(numericAmount)
        : Math.abs(numericAmount);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/settlements/${settlementId}/adjustments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          employeeId: employeeId || undefined,
          workDate,
          amount: signedAmount.toFixed(2),
          category,
          adjustmentType: direction,
          description: description.trim() || 'Ostatní náklad',
          reason: `Zápis nákladu: ${description.trim() || 'Ostatní náklad'}`,
          isRecurring,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Uložení nákladu se nezdařilo.');
      }
      setAmount('');
      onSuccess(
        `Položka "${description}" (${
          direction === 'DEDUCTION' || direction === 'ADVANCE' ? '-' : '+'
        }${Math.abs(numericAmount).toLocaleString('cs-CZ')} Kč) byla uložena do vyúčtování.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nastala chyba při ukládání.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            🚗 Ostatní náklady, auto, nájem, telefon a zálohy
          </h3>
          <p className="text-xs text-slate-500">
            Rychlý zápis srážek (služební auto, nájem, telefon, záloha) nebo náhrad výdajů (palivo, materiál, prémie) přímo do vyúčtování.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Zavřít ✕
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* 1-Click Cost Presets */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          1. Vyberte druh nákladu (1 kliknutí)
        </div>
        <div className="flex flex-wrap gap-2">
          {OTHER_COST_PRESETS.map((preset) => {
            const active = selectedPresetKey === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Direction toggle: Deduction vs Reimbursement */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          2. Jak položku započítat do vyúčtování?
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setDirection('DEDUCTION')}
            className={`rounded-xl border p-2.5 text-left text-xs transition ${
              direction === 'DEDUCTION'
                ? 'border-red-600 bg-red-50 text-red-950 ring-1 ring-red-600 font-bold'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="font-bold">➖ Srážka / Náklad (- Kč)</div>
            <div className="text-[11px] opacity-80">Odečte se z výplaty (auto, nájem, tarif)</div>
          </button>

          <button
            type="button"
            onClick={() => setDirection('REIMBURSEMENT')}
            className={`rounded-xl border p-2.5 text-left text-xs transition ${
              direction === 'REIMBURSEMENT' || direction === 'BONUS'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600 font-bold'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="font-bold">➕ Náhrada / Proplacení (+ Kč)</div>
            <div className="text-[11px] opacity-80">Přičte se k výplatě (palivo, materiál, bonus)</div>
          </button>

          <button
            type="button"
            onClick={() => setDirection('ADVANCE')}
            className={`rounded-xl border p-2.5 text-left text-xs transition ${
              direction === 'ADVANCE'
                ? 'border-amber-600 bg-amber-50 text-amber-950 ring-1 ring-amber-600 font-bold'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="font-bold">💵 Vyplacená záloha (- Kč)</div>
            <div className="text-[11px] opacity-80">Odečte již vyplacenou zálohu</div>
          </button>
        </div>
      </div>

      {/* Main fields */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {employees && employees.length > 0 && settlementId === 'current' && (
          <label className="text-xs font-bold text-slate-700">
            Pracovník *
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="input mt-1 w-full text-sm font-normal"
            >
              <option value="">Vyberte pracovníka...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="text-xs font-bold text-slate-700 sm:col-span-2">
          Název / Popis položky *
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="např. Využití služebního auta, Nájem dílny, Telefon..."
            className="input mt-1 w-full text-sm font-normal"
          />
        </label>

        <label className="text-xs font-bold text-slate-700">
          Částka (Kč) *
          <input
            type="number"
            step="0.01"
            min="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="např. 1500"
            className="input mt-1 w-full text-sm font-bold"
          />
        </label>

        {settlementId === 'current' && (
          <label className="text-xs font-bold text-slate-700">
            Datum / Období
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="input mt-1 w-full text-sm font-normal"
            />
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="rounded text-slate-900"
          />
          <span>Opakovat automaticky každý měsíc (měsíční paušál za auto / nájem / telefon)</span>
        </label>

        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Zrušit
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-slate-950 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? 'Ukládám...' : 'Uložit náklad do vyúčtování'}
          </button>
        </div>
      </div>
    </form>
  );
}
