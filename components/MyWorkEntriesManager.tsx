'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { dateOnly } from '@/lib/internal-format';
import type { WorkCategory } from '@/lib/work-categories';
import { DEFAULT_WORK_CATEGORIES } from '@/lib/work-categories';
import { WorkStatisticsPanel } from '@/components/WorkStatisticsPanel';
import { QuickOtherCostForm } from '@/components/QuickOtherCostForm';
import { resolveActivityName } from '@/lib/work-entry-stats';

type TaskPayload = {
  id: string;
  title: string;
  description: string | null;
  scheduledDate: Date | null;
  workOrder: {
    id: string;
    title: string;
    workType: string;
    clientId: string | null;
    clientName: string;
  } | null;
};

type WorkOrderOption = {
  id: string;
  title: string;
  workType: string;
  clientName: string;
  price: number | null;
};

type EntryPayload = {
  id: string;
  workDate: string;
  workTaskId: string;
  workOrderId: string | null;
  workType: string;
  carrierTypeLabel?: string | null;
  remunerationMethod: string;
  quantity: string;
  unit: string;
  appliedUnitRate: string | null;
  calculatedAmount: string;
  rateSource: string | null;
  note: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  creationSource: 'AUTOMATIC' | 'MANUAL';
  workTask: { title: string } | null;
  workOrder: { title: string } | null;
  rejectionReason?: string | null;
};

type MyWorkEntriesManagerProps = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
  initialEntries: EntryPayload[];
  prefilledTask: TaskPayload | null;
  workCategories?: WorkCategory[];
  workOrders?: WorkOrderOption[];
};

const workTypeLabels: Record<string, string> = {
  INSTALLATION: 'Instalace',
  REINSTALLATION: 'Reinstalace',
  DEINSTALLATION: 'Deinstalace',
  REPAIR: 'Oprava / Servis',
  CHECK: 'Kontrola / Zaměření',
  TRANSPORT: 'Doprava / Převoz',
  OTHER: 'Jiná práce',
};

const rateTypeLabels: Record<string, string> = {
  HOURLY: '⏱️ Hodinová práce',
  TASK: '📦 Úkolová práce (ks)',
  FIXED: '💰 Cena za zakázku',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Koncept',
  SUBMITTED: 'Odesláno',
  APPROVED: 'Započteno ve vyúčtování',
  RETURNED: 'Vráceno k opravě',
};

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-800 border border-slate-200',
  SUBMITTED: 'bg-blue-100 text-blue-800 border border-blue-200',
  APPROVED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  RETURNED: 'bg-red-100 text-red-800 border border-red-200 font-bold',
};

export function MyWorkEntriesManager({
  employee,
  initialEntries,
  prefilledTask,
  workCategories,
  workOrders = [],
}: MyWorkEntriesManagerProps) {
  const router = useRouter();
  const categories = workCategories && workCategories.length > 0 ? workCategories : DEFAULT_WORK_CATEGORIES;

  const [entries, setEntries] = useState<EntryPayload[]>(initialEntries);
  const [editingEntry, setEditingEntry] = useState<EntryPayload | null>(null);

  // Panels: 'work' (default open for super fast entry!), 'cost' (other costs), or null
  const [activeFormPanel, setActiveFormPanel] = useState<'work' | 'cost' | null>('work');

  // Simplified Work Form state
  const [activityTitle, setActivityTitle] = useState(
    prefilledTask?.title || categories[0]?.label || 'Instalace lavičky / městského mobiliáře'
  );
  const [selectedOrderId, setSelectedOrderId] = useState(prefilledTask?.workOrder?.id || '');
  const [workDate, setWorkDate] = useState(
    prefilledTask?.scheduledDate
      ? new Date(prefilledTask.scheduledDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [workType, setWorkType] = useState<string>(
    prefilledTask?.workOrder?.workType || categories[0]?.defaultWorkType || 'INSTALLATION'
  );
  const [remunerationMethod, setRemunerationMethod] = useState<'HOURLY' | 'TASK' | 'FIXED'>('HOURLY');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('hod');
  const [unitRate, setUnitRate] = useState('');
  const [note, setNote] = useState('');

  const [resolvedSource, setResolvedSource] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [activityFilter, setActivityFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // Auto-resolve rate from backend when workType / remunerationMethod / workDate / selectedOrderId changes
  useEffect(() => {
    if (editingEntry) return;
    let cancelled = false;
    const fetchRate = async () => {
      try {
        const orderParam = selectedOrderId ? `&workOrderId=${selectedOrderId}` : '';
        const res = await fetch(
          `/api/work-entries/resolve-rate?employeeId=${employee.id}&workType=${workType}&workDate=${workDate}&remunerationMethod=${remunerationMethod}${orderParam}`
        );
        const data = await res.json();
        if (!cancelled && res.ok && data.rate) {
          setUnitRate(String(Number(data.rate)));
          setResolvedSource(data.source);
          if (remunerationMethod === 'TASK' && data.unit) {
            setUnit(data.unit);
          }
        }
      } catch {
        // Ignore rate lookup failure; user can always type rate directly
      }
    };
    fetchRate();
    return () => {
      cancelled = true;
    };
  }, [workType, remunerationMethod, workDate, selectedOrderId, employee.id, editingEntry]);

  const handleSelectCategory = (cat: WorkCategory) => {
    setActivityTitle(cat.label);
    setWorkType(cat.defaultWorkType);
    if (cat.defaultPriceType === 'PIECE_RATE') {
      setRemunerationMethod('TASK');
      setUnit('ks');
    } else if (cat.defaultPriceType === 'FIXED') {
      setRemunerationMethod('FIXED');
      setQuantity('1');
      setUnit('zakázka');
    } else if (cat.defaultPriceType === 'HOURLY') {
      setRemunerationMethod('HOURLY');
      setUnit('hod');
    }
    if (cat.defaultRate !== undefined && cat.defaultRate > 0) {
      setUnitRate(String(cat.defaultRate));
    }
  };

  const handleSelectMethod = (method: 'HOURLY' | 'TASK' | 'FIXED') => {
    setRemunerationMethod(method);
    if (method === 'HOURLY') {
      setUnit('hod');
      if (quantity === '1' && remunerationMethod === 'FIXED') setQuantity('');
    } else if (method === 'TASK') {
      setUnit('ks');
    } else {
      setQuantity('1');
      setUnit('zakázka');
      const ord = workOrders.find((o) => o.id === selectedOrderId);
      if (ord?.price && !unitRate) {
        setUnitRate(String(ord.price));
      }
    }
  };

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    const ord = workOrders.find((o) => o.id === orderId);
    if (ord) {
      setWorkType(ord.workType || 'INSTALLATION');
      if (!activityTitle || activityTitle === 'Odvedená práce') {
        setActivityTitle(ord.title);
      }
      if (ord.price && remunerationMethod === 'FIXED') {
        setUnitRate(String(ord.price));
      }
    }
  };

  const previewAmount = (() => {
    const r = parseFloat(unitRate.replace(',', '.')) || 0;
    if (remunerationMethod === 'FIXED') return r;
    let q = 0;
    if (quantity.includes(':')) {
      const [h, m] = quantity.split(':').map((v) => parseInt(v, 10) || 0);
      q = h + m / 60;
    } else {
      q = parseFloat(quantity.replace(',', '.')) || 0;
    }
    return Math.round(q * r * 100) / 100;
  })();

  const refreshList = async () => {
    try {
      const fetchEntries = await fetch(`/api/work-entries?employeeId=${employee.id}`);
      const freshData = await fetchEntries.json();
      if (fetchEntries.ok) {
        setEntries(freshData);
      }
    } catch {}
  };

  const resetForm = () => {
    setEditingEntry(null);
    setQuantity('');
    setNote('');
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const effectiveQty = remunerationMethod === 'FIXED' ? '1' : quantity;
    if (!effectiveQty || !String(effectiveQty).trim()) {
      setErrorMsg(remunerationMethod === 'HOURLY' ? 'Zadejte počet odpracovaných hodin.' : 'Zadejte počet kusů / úkolů.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: employee.id,
        workTaskId: editingEntry ? editingEntry.workTaskId : prefilledTask?.id || undefined,
        workOrderId: selectedOrderId || undefined,
        activityTitle: activityTitle.trim() || 'Odvedená práce',
        workDate,
        workType,
        remunerationMethod,
        quantity: effectiveQty,
        unit: remunerationMethod === 'HOURLY' ? 'hod' : unit || 'ks',
        unitRate: unitRate !== '' ? unitRate : undefined,
        note: note.trim() || undefined,
        autoApprove: true,
      };

      const res = editingEntry
        ? await fetch(`/api/work-entries/${editingEntry.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/work-entries', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const out = await res.json();
      if (!res.ok) {
        throw new Error(out.error || 'Uložení práce se nezdařilo.');
      }

      setSuccessMsg(
        editingEntry
          ? 'Záznam práce byl upraven a přepočítán ve vyúčtování.'
          : 'Práce byla uložena a automaticky započítána do vašeho vyúčtování.'
      );
      resetForm();
      await refreshList();
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Operace se nezdařila.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: EntryPayload) => {
    setEditingEntry(entry);
    setActivityTitle(resolveActivityName(entry));
    setSelectedOrderId(entry.workOrderId || '');
    setWorkDate(entry.workDate.slice(0, 10));
    setWorkType(entry.workType);
    setRemunerationMethod((entry.remunerationMethod as 'HOURLY' | 'TASK' | 'FIXED') || 'HOURLY');
    setQuantity(entry.quantity);
    setUnit(entry.unit);
    setUnitRate(entry.appliedUnitRate ? String(Number(entry.appliedUnitRate)) : '');
    setNote(entry.note || '');
    setActiveFormPanel('work');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleDelete = async (entryId: string) => {
    if (!window.confirm('Opravdu chcete smazat tento záznam práce?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/work-entries/${entryId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Smazání se nezdařilo.');
      setSuccessMsg('Záznam práce byl smazán.');
      await refreshList();
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při mazání.');
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (monthFilter && !entry.workDate.startsWith(monthFilter)) return false;
    if (activityFilter && resolveActivityName(entry) !== activityFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Moje odvedená práce & Výdaje</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pracovník: <strong>{employee.firstName} {employee.lastName}</strong> • Jednoduchý zápis hodinové práce, úkolové práce, zakázek a ostatních nákladů.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setActiveFormPanel(activeFormPanel === 'work' ? null : 'work');
            }}
            className={`rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm ${
              activeFormPanel === 'work'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'
            }`}
          >
            ➕ Zapsat práci (Hodiny / Úkol / Zakázka)
          </button>

          <button
            type="button"
            onClick={() => setActiveFormPanel(activeFormPanel === 'cost' ? null : 'cost')}
            className={`rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm ${
              activeFormPanel === 'cost'
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 border border-indigo-200 text-indigo-900 hover:bg-indigo-100'
            }`}
          >
            🚗 + Ostatní náklady (Auto, Nájem, Telefon, Palivo)
          </button>

          <Link
            href="/my-settlements"
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition shadow-sm"
          >
            📊 Moje vyúčtování →
          </Link>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900" role="status">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900" role="alert">
          {errorMsg}
        </div>
      )}

      {/* PANEL 1: Super-simple Work Entry Form */}
      {activeFormPanel === 'work' && (
        <section className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingEntry ? '✏️ Upravit záznam práce' : '⚡ Rychlý zápis odvedené práce'}
              </h2>
              <p className="text-xs text-slate-500">
                Vyberte činnost (nebo napište vlastní), zvolte Hodinovou / Úkolovou / Cenu za zakázku a uložte.
              </p>
            </div>
            {editingEntry && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Zrušit úpravu ✕
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitWork} className="space-y-4">
            {/* Step 1: Activity quick chips */}
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Co jste dělali? (Klikněte na činnost nebo napište vlastní)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => {
                  const isSelected = activityTitle === cat.label;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => handleSelectCategory(cat)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs font-bold text-slate-700">
                  Název úkolu / činnosti *
                  <input
                    required
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    placeholder="např. Instalace lavičky, Lepení billboardu..."
                    className="input mt-1 w-full text-sm font-semibold"
                  />
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Zakázka (volitelné)
                  <select
                    value={selectedOrderId}
                    onChange={(e) => handleSelectOrder(e.target.value)}
                    className="input mt-1 w-full text-sm font-normal"
                  >
                    <option value="">— Obecná práce / Bez konkrétní zakázky —</option>
                    {workOrders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.title} {ord.clientName ? `(${ord.clientName})` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs font-bold text-slate-700">
                  Datum práce *
                  <input
                    type="date"
                    required
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    className="input mt-1 w-full text-sm font-normal"
                  />
                </label>
              </div>
            </div>

            {/* Step 2: Remuneration Mode (Hourly / Task / Fixed Job Price) */}
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Typ odměny (Hodinová / Úkolová / Cena za zakázku)
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['HOURLY', 'TASK', 'FIXED'] as const).map((method) => {
                  const active = remunerationMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => handleSelectMethod(method)}
                      className={`rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-sm font-bold">{rateTypeLabels[method]}</div>
                      <div className={`text-[11px] mt-0.5 ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                        {method === 'HOURLY' && 'Zadejte počet odpracovaných hodin × hodinová sazba'}
                        {method === 'TASK' && 'Zadejte počet kusů / výlepů / laviček × sazba za kus'}
                        {method === 'FIXED' && 'Zadejte pevnou domluvenou cenu za celou zakázku'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Quantity + Rate + Total */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              {remunerationMethod !== 'FIXED' && (
                <label className="text-xs font-bold text-slate-700">
                  {remunerationMethod === 'HOURLY' ? 'Počet hodin *' : 'Počet kusů / úkolů *'}
                  <input
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={remunerationMethod === 'HOURLY' ? 'např. 4.5 nebo 4:30' : 'např. 6'}
                    className="input mt-1 w-full text-base font-bold"
                  />
                </label>
              )}

              {remunerationMethod === 'TASK' && (
                <label className="text-xs font-bold text-slate-700">
                  Jednotka
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="ks, m2, výlep..."
                    className="input mt-1 w-full text-sm font-normal"
                  />
                </label>
              )}

              <label className="text-xs font-bold text-slate-700">
                {remunerationMethod === 'HOURLY'
                  ? 'Hodinová sazba (Kč / hod)'
                  : remunerationMethod === 'TASK'
                  ? `Sazba za ${unit || 'ks'} (Kč)`
                  : 'Cena za zakázku (Kč) *'}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required={remunerationMethod === 'FIXED'}
                  value={unitRate}
                  onChange={(e) => setUnitRate(e.target.value)}
                  placeholder={remunerationMethod === 'HOURLY' ? 'např. 350' : remunerationMethod === 'TASK' ? 'např. 250' : 'např. 4500'}
                  className="input mt-1 w-full text-base font-bold"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Poznámka (volitelné)
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Upřesnění místa nebo práce..."
                  className="input mt-1 w-full text-sm font-normal"
                />
              </label>
            </div>

            {/* Live Calculation Footer */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">Výsledná částka za tuto práci:</span>
                <span className="text-xl font-black text-slate-900">
                  {previewAmount.toLocaleString('cs-CZ')} Kč
                </span>
                {resolvedSource && (
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    Sazba z ceníku
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {editingEntry && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Zrušit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-slate-950 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  {submitting
                    ? 'Ukládám...'
                    : editingEntry
                    ? '💾 Uložit změny'
                    : '✅ Uložit práci do vyúčtování'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* PANEL 2: Quick Other Costs Form (Auto, Nájem, Telefon, Palivo, Materiál, Záloha) */}
      {activeFormPanel === 'cost' && (
        <QuickOtherCostForm
          settlementId="current"
          employeeId={employee.id}
          onSuccess={(msg) => {
            setSuccessMsg(msg);
            setActiveFormPanel(null);
            router.refresh();
          }}
          onCancel={() => setActiveFormPanel(null)}
        />
      )}

      {/* Statistics & Breakdown by Activity/Task */}
      <WorkStatisticsPanel
        items={filteredEntries}
        title="Rozdělení mé práce podle úkolů a činností"
        selectedActivity={activityFilter}
        onSelectActivity={setActivityFilter}
      />

      {/* Entries Table with Simple Filter */}
      <section className="card overflow-x-auto">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Historie zapsané práce</h2>
            <p className="text-xs text-slate-500">Nalezeno {filteredEntries.length} záznamů</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="input text-xs py-1.5 px-3"
              title="Filtrovat podle měsíce"
            />
            {(monthFilter || activityFilter) && (
              <button
                type="button"
                onClick={() => {
                  setMonthFilter('');
                  setActivityFilter('');
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Zrušit filtr
              </button>
            )}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            Zatím zde nejsou žádné záznamy práce. Použijte formulář výše pro rychlý zápis.
          </p>
        ) : (
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
              <tr>
                <th className="py-2.5 pr-3">Datum</th>
                <th className="py-2.5 pr-3">Úkol / Činnost / Zakázka</th>
                <th className="py-2.5 pr-3">Typ</th>
                <th className="py-2.5 pr-3">Množství</th>
                <th className="py-2.5 pr-3">Sazba</th>
                <th className="py-2.5 pr-3">Celkem</th>
                <th className="py-2.5 pr-3">Stav</th>
                <th className="py-2.5 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const activityName = resolveActivityName(entry);
                return (
                  <tr className="border-b last:border-0 hover:bg-slate-50/50" key={entry.id}>
                    <td className="py-3 pr-3 font-medium whitespace-nowrap">
                      {dateOnly(new Date(entry.workDate))}
                    </td>
                    <td className="py-3 pr-3">
                      <div className="font-bold text-slate-900">{activityName}</div>
                      {entry.workOrder?.title && (
                        <div className="text-xs text-slate-500">Zakázka: {entry.workOrder.title}</div>
                      )}
                      {entry.note && <div className="text-xs text-slate-500 italic">{entry.note}</div>}
                      {entry.status === 'RETURNED' && entry.rejectionReason && (
                        <div className="mt-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded px-2 py-0.5 inline-block">
                          Důvod vrácení: {entry.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-xs font-semibold text-slate-600">
                      {entry.remunerationMethod === 'HOURLY'
                        ? '⏱️ Hodinová'
                        : entry.remunerationMethod === 'FIXED'
                        ? '💰 Zakázka'
                        : '📦 Úkolová'}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-slate-800 whitespace-nowrap">
                      {entry.remunerationMethod === 'FIXED'
                        ? '1 zakázka'
                        : `${Number(entry.quantity).toLocaleString('cs-CZ')} ${entry.unit}`}
                    </td>
                    <td className="py-3 pr-3 text-slate-700 whitespace-nowrap">
                      {entry.appliedUnitRate
                        ? `${Number(entry.appliedUnitRate).toLocaleString('cs-CZ')} Kč`
                        : '—'}
                    </td>
                    <td className="py-3 pr-3 font-extrabold text-slate-900 whitespace-nowrap font-mono">
                      {Number(entry.calculatedAmount).toLocaleString('cs-CZ')} Kč
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          statusClasses[entry.status] || statusClasses.DRAFT
                        }`}
                      >
                        {statusLabels[entry.status] || entry.status}
                      </span>
                    </td>
                    <td className="py-3 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleEdit(entry)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Upravit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
