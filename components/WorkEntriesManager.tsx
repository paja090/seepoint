'use client';

import React, { useState } from 'react';
import { dateOnly } from '@/lib/internal-format';

type EmployeePayload = {
  id: string;
  firstName: string;
  lastName: string;
};

type EntryPayload = {
  id: string;
  employeeId: string;
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
  status: 'DRAFT' | 'CONFIRMED';
  creationSource: 'AUTOMATIC' | 'MANUAL';
  employee: { firstName: string; lastName: string };
  workTask: { title: string } | null;
  workOrder: { title: string } | null;
};

type WorkEntriesManagerProps = {
  employees: EmployeePayload[];
  initialEntries: EntryPayload[];
  currentUserRole?: string;
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

export function WorkEntriesManager({ employees, initialEntries }: WorkEntriesManagerProps) {
  const [entries, setEntries] = useState<EntryPayload[]>(initialEntries);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [orderQuery, setOrderQuery] = useState('');

  // Form states (Creating manual or additional work entry)
  const [showForm, setShowForm] = useState(false);
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [workTaskId, setWorkTaskId] = useState('');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [workType, setWorkType] = useState('INSTALLATION');
  const [remunerationMethod, setRemunerationMethod] = useState('HOURLY');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('hod');
  const [note, setNote] = useState('');
  const [manualRate, setManualRate] = useState('');

  // Additional entry bypass
  const [isAdditional, setIsAdditional] = useState(false);
  const [additionalReason, setAdditionalReason] = useState('');

  // Detail Modal state
  const [activeDetail, setActiveDetail] = useState<EntryPayload | null>(null);
  const [missingRateValue, setMissingRateValue] = useState('');

  // Error/Success messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Duplicate Warning Modal (for additional entries)
  const [showDuplicateBypassForm, setShowDuplicateBypassForm] = useState(false);

  // Handle new entry submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const bodyData = {
      employeeId: targetEmployeeId,
      workTaskId,
      workDate,
      workType,
      remunerationMethod,
      quantity,
      unit,
      note,
      creationSource: 'MANUAL',
      allowAdditionalEntry: isAdditional,
      additionalEntryReason: additionalReason,
      manualRate: manualRate ? parseFloat(manualRate) : undefined,
    };

    try {
      const res = await fetch('/api/work-entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const out = await res.json();
      if (!res.ok) {
        if (out.error === 'ZÁPIS_DUPLICITNÍ') {
          setShowDuplicateBypassForm(true);
          return;
        }
        throw new Error(out.error || 'Uložení selhalo.');
      }

      setSuccessMsg('Záznam byl úspěšně vytvořen jako koncept.');
      setShowForm(false);
      setShowDuplicateBypassForm(false);
      resetForm();
      await refreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operace se nezdařila.';
      setErrorMsg(message);
    }
  };

  // Submit bypass warning
  const handleBypassSubmit = async () => {
    if (!additionalReason.trim()) {
      setErrorMsg('Pro dodatečný zápis duplicitní práce musíte vyplnit odůvodnění.');
      return;
    }
    setIsAdditional(true);
    // Trigger submit again with allowAdditionalEntry = true
    setErrorMsg('');
    const bodyData = {
      employeeId: targetEmployeeId,
      workTaskId,
      workDate,
      workType,
      remunerationMethod,
      quantity,
      unit,
      note,
      creationSource: 'MANUAL',
      allowAdditionalEntry: true,
      additionalEntryReason: additionalReason,
      manualRate: manualRate ? parseFloat(manualRate) : undefined,
    };

    try {
      const res = await fetch('/api/work-entries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bodyData),
      });

      const out = await res.json();
      if (!res.ok) {
        throw new Error(out.error || 'Uložení selhalo.');
      }

      setSuccessMsg('Záznam práce byl schválen a uložen jako duplicitní koncept.');
      setShowForm(false);
      setShowDuplicateBypassForm(false);
      resetForm();
      await refreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operace se nezdařila.';
      setErrorMsg(message);
    }
  };

  const resetForm = () => {
    setTargetEmployeeId('');
    setWorkTaskId('');
    setWorkDate(new Date().toISOString().slice(0, 10));
    setWorkType('INSTALLATION');
    setRemunerationMethod('HOURLY');
    setQuantity('');
    setUnit('hod');
    setNote('');
    setManualRate('');
    setIsAdditional(false);
    setAdditionalReason('');
  };

  // Save manual rate for DRAFT
  const handleSaveManualRate = async () => {
    if (!activeDetail) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/work-entries/${activeDetail.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          manualRate: parseFloat(missingRateValue),
        }),
      });

      const out = await res.json();
      if (!res.ok) {
        throw new Error(out.error || 'Uložení sazby selhalo.');
      }

      setSuccessMsg('Ruční sazba byla úspěšně uložena.');
      setActiveDetail(null);
      setMissingRateValue('');
      await refreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operace se nezdařila.';
      setErrorMsg(message);
    }
  };

  // Confirm WorkEntry
  const handleConfirm = async (entryId: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/work-entries/${entryId}/confirm`, {
        method: 'POST',
      });

      const out = await res.json();
      if (!res.ok) {
        throw new Error(out.error || 'Potvrzení selhalo.');
      }

      setSuccessMsg('Záznam práce byl úspěšně potvrzen a uzamčen.');
      setActiveDetail(null);
      await refreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operace se nezdařila.';
      setErrorMsg(message);
    }
  };

  const refreshList = async () => {
    try {
      const res = await fetch('/api/work-entries');
      const data = await res.json();
      if (res.ok) {
        setEntries(data);
      }
    } catch {}
  };

  // Filter entries in memory
  const filteredEntries = entries.filter((entry) => {
    if (employeeFilter && entry.employeeId !== employeeFilter) return false;
    if (statusFilter && entry.status !== statusFilter) return false;
    if (typeFilter && entry.workType !== typeFilter) return false;
    if (dateFromFilter && entry.workDate < dateFromFilter) return false;
    if (dateToFilter && entry.workDate.slice(0, 10) > dateToFilter) return false;
    if (orderQuery) {
      const q = orderQuery.toLowerCase();
      const orderTitle = entry.workOrder?.title.toLowerCase() || '';
      const orderId = entry.workOrderId?.toLowerCase() || '';
      if (!orderTitle.includes(q) && !orderId.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Odvedená práce</h1>
          <p className="mt-1 text-sm text-slate-500">
            Správa a potvrzování záznamů odvedené práce zaměstnanců SeePoint.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
        >
          Zapsat dodatečnou práci
        </button>
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
            <h2 className="text-xl font-bold">Zápis dodatečné/ruční práce</h2>
            <button
              onClick={() => {
                setShowForm(false);
                setShowDuplicateBypassForm(false);
                resetForm();
              }}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Zrušit
            </button>
          </div>

          {!showDuplicateBypassForm ? (
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-semibold">
                Pracovník <span className="text-red-500">*</span>
                <select
                  className="input mt-1 w-full"
                  required
                  value={targetEmployeeId}
                  onChange={(e) => setTargetEmployeeId(e.target.value)}
                >
                  <option value="">Vyberte pracovníka...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold">
                ID Úkolu (WorkTask CUID) <span className="text-red-500">*</span>
                <input
                  className="input mt-1 w-full"
                  required
                  value={workTaskId}
                  onChange={(e) => setWorkTaskId(e.target.value)}
                  placeholder="Zadejte ID úkolu..."
                />
              </label>

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
                  placeholder="hod, ks..."
                  disabled={remunerationMethod === 'HOURLY'}
                />
              </label>

              <label className="text-sm font-semibold bg-amber-50 border border-amber-100 p-2 rounded-lg">
                Sazba (ruční zadání - volitelné)
                <input
                  className="input mt-1 w-full bg-white"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                  placeholder="Zadejte částku..."
                />
              </label>

              <label className="md:col-span-2 lg:col-span-3 text-sm font-semibold">
                Poznámka
                <textarea
                  className="input mt-1 w-full h-20"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Zadejte poznámku..."
                />
              </label>

              <div className="md:col-span-2 lg:col-span-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
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
                  Uložit koncept
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <h3 className="text-lg font-bold">Upozornění na duplicitní zápis</h3>
              <p>Pro tohoto pracovníka a úkol již existuje evidovaný zápis práce ve stejný den.</p>
              <label className="block text-sm font-semibold text-amber-950 mt-2">
                Zdůvodnění zápisu duplicity (povinné) <span className="text-red-500">*</span>
                <input
                  className="input mt-1 w-full bg-white text-slate-900"
                  required
                  value={additionalReason}
                  onChange={(e) => setAdditionalReason(e.target.value)}
                  placeholder="Zadejte věcné odůvodnění např. vícepracování, opakovaná montáž..."
                />
              </label>
              <div className="flex gap-3 justify-end mt-4">
                <button
                  onClick={() => setShowDuplicateBypassForm(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Zpět na formulář
                </button>
                <button
                  onClick={handleBypassSubmit}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition"
                >
                  Potvrdit a uložit duplicitu
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Filters Form */}
      <div className="card grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <label className="text-sm font-semibold">
          Pracovník
          <select
            className="input mt-1 w-full font-normal"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          >
            <option value="">Všichni pracovníci</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
        </label>

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
          Druh práce
          <select
            className="input mt-1 w-full font-normal"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Všechny druhy</option>
            {Object.entries(workTypeLabels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold">
          Od data
          <input
            type="date"
            className="input mt-1 w-full font-normal"
            value={dateFromFilter}
            onChange={(e) => setDateFromFilter(e.target.value)}
          />
        </label>

        <label className="text-sm font-semibold">
          Do data
          <input
            type="date"
            className="input mt-1 w-full font-normal"
            value={dateToFilter}
            onChange={(e) => setDateToFilter(e.target.value)}
          />
        </label>

        <label className="text-sm font-semibold">
          Hledat zakázku
          <input
            className="input mt-1 w-full font-normal"
            value={orderQuery}
            onChange={(e) => setOrderQuery(e.target.value)}
            placeholder="Název nebo ID..."
          />
        </label>
      </div>

      {/* Main List */}
      <section className="card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Přehled odvedené práce zaměstnanců</h2>
          <span className="text-sm text-slate-500">Nalezeno {filteredEntries.length} záznamů</span>
        </div>

        {filteredEntries.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Nebyly nalezeny žádné záznamy práce.</p>
        ) : (
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
              <tr>
                <th className="py-2 pr-3">Pracovník</th>
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
                  <td className="py-3 pr-3 font-semibold text-slate-900">
                    {entry.employee.firstName} {entry.employee.lastName}
                  </td>
                  <td className="py-3 pr-3">{dateOnly(new Date(entry.workDate))}</td>
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
                    <button
                      onClick={() => {
                        setActiveDetail(entry);
                        setMissingRateValue(entry.appliedUnitRate || '');
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Detail & Action Modal */}
      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-xl font-bold">Detail záznamu odvedené práce</h3>
              <button
                onClick={() => {
                  setActiveDetail(null);
                  setMissingRateValue('');
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="text-sm space-y-2.5">
              <div className="grid grid-cols-2">
                <span className="text-slate-500">Pracovník:</span>
                <strong>
                  {activeDetail.employee.firstName} {activeDetail.employee.lastName}
                </strong>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-500">Datum práce:</span>
                <strong>{dateOnly(new Date(activeDetail.workDate))}</strong>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-500">Druh práce:</span>
                <strong>{workTypeLabels[activeDetail.workType]}</strong>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-500">Forma odměny:</span>
                <strong>{rateTypeLabels[activeDetail.remunerationMethod]}</strong>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-500">Množství:</span>
                <strong>
                  {Number(activeDetail.quantity).toLocaleString('cs-CZ')} {activeDetail.unit}
                </strong>
              </div>
              <div className="grid grid-cols-2 border-t pt-2 mt-2">
                <span className="text-slate-500">Přiřazený úkol:</span>
                <strong>{activeDetail.workTask?.title || 'Interní úkol'}</strong>
              </div>
              <div className="grid grid-cols-2">
                <span className="text-slate-500">Zakázka (Plán):</span>
                <strong>{activeDetail.workOrder?.title || 'Bez zakázky'}</strong>
              </div>
              <div className="grid grid-cols-2 border-t pt-2 mt-2">
                <span className="text-slate-500">Aplikovaná sazba:</span>
                <strong>
                  {activeDetail.appliedUnitRate ? (
                    `${Number(activeDetail.appliedUnitRate).toLocaleString('cs-CZ')} CZK`
                  ) : (
                    <span className="text-red-600">Chybí sazba</span>
                  )}
                </strong>
              </div>
              {activeDetail.rateSource && (
                <div className="grid grid-cols-2">
                  <span className="text-slate-500">Zdroj sazby:</span>
                  <span>{rateSourceLabels[activeDetail.rateSource] || activeDetail.rateSource}</span>
                </div>
              )}
              <div className="grid grid-cols-2">
                <span className="text-slate-500">Vypočtená částka:</span>
                <strong className="text-slate-900">
                  {Number(activeDetail.calculatedAmount).toLocaleString('cs-CZ')} CZK
                </strong>
              </div>
              {activeDetail.note && (
                <div className="border-t pt-2 mt-2">
                  <span className="text-slate-500 block mb-1">Poznámka:</span>
                  <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700 whitespace-pre-wrap">
                    {activeDetail.note}
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons based on status */}
            <div className="flex flex-wrap gap-2 justify-end pt-3 border-t">
              {activeDetail.status === 'DRAFT' ? (
                <>
                  {!activeDetail.appliedUnitRate && (
                    <div className="w-full flex gap-2 items-center bg-amber-50 border border-amber-200 p-2 rounded-lg mb-3">
                      <label className="text-xs font-semibold text-amber-950 flex-1">
                        Doplnit ruční sazbu (CZK)
                        <input
                          className="input mt-1 w-full bg-white font-normal"
                          value={missingRateValue}
                          onChange={(e) => setMissingRateValue(e.target.value)}
                          placeholder="Zadejte sazbu..."
                        />
                      </label>
                      <button
                        onClick={handleSaveManualRate}
                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 self-end"
                      >
                        Uložit sazbu
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setActiveDetail(null);
                      setMissingRateValue('');
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Zavřít
                  </button>

                  <button
                    onClick={() => handleConfirm(activeDetail.id)}
                    disabled={!activeDetail.appliedUnitRate}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition ${
                      activeDetail.appliedUnitRate
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    Potvrdit práci
                  </button>
                </>
              ) : (
                <div className="w-full flex justify-between items-center text-xs text-slate-500">
                  <span>🔒 Potvrzený záznam je uzamčen pro úpravy.</span>
                  <button
                    onClick={() => {
                      setActiveDetail(null);
                      setMissingRateValue('');
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Zavřít
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
