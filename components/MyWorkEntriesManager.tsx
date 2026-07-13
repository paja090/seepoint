'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dateOnly } from '@/lib/internal-format';

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

type EntryPayload = {
  id: string;
  workDate: string;
  workTaskId: string;
  workOrderId: string | null;
  workType: string;
  remunerationMethod: string;
  quantity: string;
  unit: string;
  appliedUnitRate: string | null;
  calculatedAmount: string;
  rateSource: string | null;
  note: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  creationSource: 'AUTOMATIC' | 'MANUAL';
  workTask: { title: string } | null;
  workOrder: { title: string } | null;
};

type MyWorkEntriesManagerProps = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
  initialEntries: EntryPayload[];
  prefilledTask: TaskPayload | null;
};

const workTypeLabels: Record<string, string> = {
  INSTALLATION: 'Instalace',
  REINSTALLATION: 'Reinstalace',
  DEINSTALLATION: 'Deinstalace',
  REPAIR: 'Oprava',
  CHECK: 'Kontrola',
  TRANSPORT: 'Převoz',
  OTHER: 'Jiná práce',
};

const rateTypeLabels: Record<string, string> = {
  HOURLY: 'Hodinová',
  TASK: 'Úkolová',
  FIXED: 'Pevná částka',
};

const rateSourceLabels: Record<string, string> = {
  EMPLOYEE_RATE: 'Individuální sazba',
  COMPANY_RATE: 'Firemní sazba',
  MANUAL: 'Manuální zadání',
};

export function MyWorkEntriesManager({ employee, initialEntries, prefilledTask }: MyWorkEntriesManagerProps) {
  const router = useRouter();
  const [entries, setEntries] = useState<EntryPayload[]>(initialEntries);
  const [editingEntry, setEditingEntry] = useState<EntryPayload | null>(null);

  // Form states
  const [showForm, setShowForm] = useState(prefilledTask !== null);
  const [workTaskId, setWorkTaskId] = useState(prefilledTask?.id || '');
  const [workDate, setWorkDate] = useState(
    prefilledTask?.scheduledDate
      ? new Date(prefilledTask.scheduledDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );
  const [workType, setWorkType] = useState(prefilledTask?.workOrder?.workType || 'INSTALLATION');
  const [remunerationMethod, setRemunerationMethod] = useState('HOURLY');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('hod');
  const [note, setNote] = useState('');

  // Resolved rate state
  const [resolvedRate, setResolvedRate] = useState<string | null>(null);
  const [resolvedUnit, setResolvedUnit] = useState('ks');
  const [resolvedSource, setResolvedSource] = useState<string | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Dynamic rate resolution
  useEffect(() => {
    if (!showForm || !workType || !remunerationMethod || !workDate) return;

    const fetchRate = async () => {
      setLoadingRate(true);
      try {
        const res = await fetch(
          `/api/work-entries/resolve-rate?employeeId=${employee.id}&workType=${workType}&workDate=${workDate}&remunerationMethod=${remunerationMethod}`
        );
        const data = await res.json();
        if (res.ok && data.rate) {
          setResolvedRate(data.rate);
          setResolvedUnit(data.unit || 'ks');
          setUnit(data.unit || (remunerationMethod === 'HOURLY' ? 'hod' : 'ks'));
          setResolvedSource(data.source);
        } else {
          setResolvedRate(null);
          setResolvedSource(null);
        }
      } catch {
        setResolvedRate(null);
        setResolvedSource(null);
      } finally {
        setLoadingRate(false);
      }
    };

    const timer = setTimeout(fetchRate, 300);
    return () => clearTimeout(timer);
  }, [showForm, workType, remunerationMethod, workDate, employee.id]);

  // Adjust unit default based on method
  useEffect(() => {
    if (remunerationMethod === 'HOURLY') {
      setUnit('hod');
    } else {
      setUnit(resolvedUnit || 'ks');
    }
  }, [remunerationMethod, resolvedUnit]);

  // Handle Create or Update submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const bodyData = {
      employeeId: employee.id,
      workTaskId,
      workDate,
      workType,
      remunerationMethod,
      quantity,
      unit,
      note,
      creationSource: prefilledTask ? 'AUTOMATIC' : 'MANUAL',
    };

    try {
      let res;
      if (editingEntry) {
        res = await fetch(`/api/work-entries/${editingEntry.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workDate,
            workType,
            remunerationMethod,
            quantity,
            unit,
            note,
          }),
        });
      } else {
        res = await fetch('/api/work-entries', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(bodyData),
        });
      }

      const out = await res.json();
      if (!res.ok) {
        throw new Error(out.error || 'Operace se nezdařila.');
      }

      setSuccessMsg(editingEntry ? 'Záznam byl úspěšně upraven.' : 'Záznam práce byl úspěšně uložen jako koncept.');
      setShowForm(false);
      setEditingEntry(null);
      resetForm();

      // Refresh list
      const fetchEntries = await fetch(`/api/work-entries?employeeId=${employee.id}`);
      const freshData = await fetchEntries.json();
      if (fetchEntries.ok) {
        setEntries(freshData);
      }
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operace se nezdařila.';
      setErrorMsg(message);
    }
  };

  const resetForm = () => {
    setWorkTaskId(prefilledTask?.id || '');
    setWorkDate(new Date().toISOString().slice(0, 10));
    setWorkType('INSTALLATION');
    setRemunerationMethod('HOURLY');
    setQuantity('');
    setUnit('hod');
    setNote('');
    setResolvedRate(null);
    setResolvedSource(null);
    setEditingEntry(null);
  };

  const handleEdit = (entry: EntryPayload) => {
    setEditingEntry(entry);
    setWorkTaskId(entry.workTaskId);
    setWorkDate(entry.workDate.slice(0, 10));
    setWorkType(entry.workType);
    setRemunerationMethod(entry.remunerationMethod);
    setQuantity(entry.quantity);
    setUnit(entry.unit);
    setNote(entry.note || '');
    setResolvedRate(entry.appliedUnitRate);
    setResolvedSource(entry.rateSource);
    setShowForm(true);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const filteredEntries = entries.filter((entry) => {
    if (statusFilter && entry.status !== statusFilter) return false;
    if (dateFilter && !entry.workDate.startsWith(dateFilter)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Moje odvedená práce</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pracovník: {employee.firstName} {employee.lastName}
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
          >
            Zapsat novou práci
          </button>
        )}
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {errorMsg}
        </div>
      )}

      {showForm && (
        <section className="card">
          <div className="mb-4 flex items-center justify-between border-b pb-3">
            <h2 className="text-xl font-bold">
              {editingEntry ? 'Upravit záznam' : 'Nový záznam odvedené práce'}
            </h2>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingEntry(null);
                resetForm();
              }}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Zrušit
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {prefilledTask && !editingEntry ? (
              <div className="md:col-span-2 lg:col-span-3 rounded-lg bg-sky-50 border border-sky-100 p-3 text-sm text-sky-950">
                <strong>Zapisujete práci k úkolu:</strong> {prefilledTask.title}
                {prefilledTask.description && <p className="mt-1 text-xs text-sky-800">{prefilledTask.description}</p>}
              </div>
            ) : (
              <label className="text-sm font-semibold">
                ID Úkolu (WorkTask CUID) <span className="text-red-500">*</span>
                <input
                  className="input mt-1 w-full"
                  required
                  value={workTaskId}
                  onChange={(e) => setWorkTaskId(e.target.value)}
                  placeholder="Zadejte ID úkolu..."
                  disabled={!!prefilledTask}
                />
              </label>
            )}

            <label className="text-sm font-semibold">
              Datum práce <span className="text-red-500">*</span>
              <input
                type="date"
                className="input mt-1 w-full"
                required
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </label>

            <label className="text-sm font-semibold">
              Druh práce <span className="text-red-500">*</span>
              <select
                className="input mt-1 w-full"
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
              >
                {Object.entries(workTypeLabels).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Forma odměny <span className="text-red-500">*</span>
              <select
                className="input mt-1 w-full"
                value={remunerationMethod}
                onChange={(e) => setRemunerationMethod(e.target.value)}
              >
                {Object.entries(rateTypeLabels).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Množství <span className="text-red-500">*</span>
              <input
                className="input mt-1 w-full"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={remunerationMethod === 'HOURLY' ? 'např. 2:30 nebo 2.5' : 'např. 5'}
              />
            </label>

            <label className="text-sm font-semibold">
              Jednotka <span className="text-red-500">*</span>
              <input
                className="input mt-1 w-full"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="hod, ks, atd."
                disabled={remunerationMethod === 'HOURLY'}
              />
            </label>

            <div className="md:col-span-2 lg:col-span-3 rounded-lg bg-slate-50 border p-3 flex flex-wrap gap-4 items-center justify-between text-sm">
              <div>
                <span className="text-slate-500">Předpokládaná sazba:</span>{' '}
                {loadingRate ? (
                  <span className="text-slate-400">Načítání...</span>
                ) : resolvedRate ? (
                  <strong className="text-slate-900">
                    {Number(resolvedRate).toLocaleString('cs-CZ')} CZK / {unit}
                  </strong>
                ) : (
                  <span className="font-semibold text-amber-600">Sazba nenalezena (bude uložen DRAFT bez sazby)</span>
                )}
                {resolvedSource && (
                  <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">
                    {rateSourceLabels[resolvedSource] || resolvedSource}
                  </span>
                )}
              </div>
            </div>

            <label className="md:col-span-2 lg:col-span-3 text-sm font-semibold">
              Poznámka
              <textarea
                className="input mt-1 w-full h-20"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Zadejte poznámku k provedené práci..."
              />
            </label>

            <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingEntry(null);
                  resetForm();
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Zrušit
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
              >
                {editingEntry ? 'Uložit změny' : 'Uložit jako koncept'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filtering */}
      <div className="card grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">
          Stav
          <select
            className="input mt-1 w-full font-normal"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Všechny stavy</option>
            <option value="DRAFT">Koncept (DRAFT)</option>
            <option value="CONFIRMED">Potvrzeno (CONFIRMED)</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Datum
          <input
            type="date"
            className="input mt-1 w-full font-normal"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={() => {
              setStatusFilter('');
              setDateFilter('');
            }}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition w-full"
          >
            Zrušit filtry
          </button>
        </div>
      </div>

      {/* List */}
      <section className="card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Přehled odvedené práce</h2>
          <span className="text-sm text-slate-500">Nalezeno {filteredEntries.length} záznamů</span>
        </div>

        {filteredEntries.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Nebyly nalezeny žádné záznamy práce.</p>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
              <tr>
                <th className="py-2 pr-3">Datum</th>
                <th className="py-2 pr-3">Úkol / Zakázka</th>
                <th className="py-2 pr-3">Druh práce</th>
                <th className="py-2 pr-3">Množství</th>
                <th className="py-2 pr-3">Sazba</th>
                <th className="py-2 pr-3">Částka</th>
                <th className="py-2 pr-3">Stav</th>
                <th className="py-2 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr className="border-b last:border-0 hover:bg-slate-50/50" key={entry.id}>
                  <td className="py-3 pr-3 font-medium">{dateOnly(new Date(entry.workDate))}</td>
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-slate-900">{entry.workTask?.title || 'Interní úkol'}</div>
                    <div className="text-xs text-slate-500">
                      Zakázka: {entry.workOrder?.title || 'Bez zakázky'}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-slate-700">{workTypeLabels[entry.workType] || entry.workType}</td>
                  <td className="py-3 pr-3">
                    {Number(entry.quantity).toLocaleString('cs-CZ')} {entry.unit}
                  </td>
                  <td className="py-3 pr-3 text-slate-700">
                    {entry.appliedUnitRate ? (
                      <>
                        {Number(entry.appliedUnitRate).toLocaleString('cs-CZ')} CZK
                        {entry.rateSource && (
                          <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-600">
                            {rateSourceLabels[entry.rateSource] || entry.rateSource}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        Chybí sazba
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-3 font-semibold text-slate-900">
                    {Number(entry.calculatedAmount).toLocaleString('cs-CZ')} CZK
                  </td>
                  <td className="py-3 pr-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        entry.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {entry.status === 'CONFIRMED' ? 'Potvrzeno' : 'Koncept'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    {entry.status === 'DRAFT' && (
                      <button
                        onClick={() => handleEdit(entry)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                      >
                        Upravit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
