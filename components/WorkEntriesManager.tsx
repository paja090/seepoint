'use client';

import React, { useState } from 'react';
import { dateOnly } from '@/lib/internal-format';

type EmployeePayload = {
  id: string;
  firstName: string;
  lastName: string;
};

type ExpensePayload = {
  id: string;
  type: string;
  description: string;
  amount: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  receiptUrl?: string | null;
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
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  creationSource: 'AUTOMATIC' | 'MANUAL';
  employee: { firstName: string; lastName: string };
  workTask: { title: string } | null;
  workOrder: { title: string } | null;
  expenses: ExpensePayload[];
  rejectionReason?: string | null;
};

type WorkEntriesManagerProps = {
  employees: EmployeePayload[];
  initialEntries: EntryPayload[];
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

const statusLabels: Record<string, string> = {
  DRAFT: 'Koncept',
  SUBMITTED: 'Odesláno',
  APPROVED: 'Schváleno',
  RETURNED: 'Vráceno',
};

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-800 border border-slate-200',
  SUBMITTED: 'bg-blue-100 text-blue-800 border border-blue-200',
  APPROVED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  RETURNED: 'bg-red-100 text-red-800 border border-red-200 font-semibold',
};

const expenseStatusLabels: Record<string, string> = {
  PENDING: 'Čeká',
  APPROVED: 'Schváleno',
  REJECTED: 'Zamítnuto',
};

const expenseStatusClasses: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
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

  // Form states (Creating manual/additional work entry)
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

  // Actions Prompts Modals state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const [showApproveReasonModal, setShowApproveReasonModal] = useState(false);
  const [approveReason, setApproveReason] = useState('');

  // Correction Mode state (in detail modal)
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionQty, setCorrectionQty] = useState('');
  const [correctionRate, setCorrectionRate] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  // Rejection modal for WorkExpense
  const [rejectingExpenseId, setRejectingExpenseId] = useState<string | null>(null);
  const [expenseRejectReason, setExpenseRejectReason] = useState('');

  // Error/Success messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Duplicate Warning Modal (for additional entries)
  const [showDuplicateBypassForm, setShowDuplicateBypassForm] = useState(false);

  const refreshList = async () => {
    try {
      const res = await fetch('/api/work-entries');
      const data = await res.json();
      if (res.ok) {
        setEntries(data);
        if (activeDetail) {
          const freshDetail = data.find((e: EntryPayload) => e.id === activeDetail.id);
          if (freshDetail) {
            setActiveDetail(freshDetail);
          }
        }
      }
    } catch {}
  };

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

      setSuccessMsg('Záznam byl úspěšně vytvořen.');
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

      setSuccessMsg('Záznam práce byl úspěšně uložen s duplicitním odůvodněním.');
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

  // Approve action
  const handleApprove = async (entryId: string, reason?: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/work-entries/${entryId}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });

      const out = await res.json();
      if (!res.ok) {
        if (out.error && out.error.includes('je nutné uvést důvod')) {
          // Late approval triggers reason modal
          setShowApproveReasonModal(true);
          return;
        }
        throw new Error(out.error || 'Schválení selhalo.');
      }

      setSuccessMsg('Záznam práce byl schválen.');
      setShowApproveReasonModal(false);
      setApproveReason('');
      setActiveDetail(null);
      await refreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operace se nezdařila.';
      setErrorMsg(message);
    }
  };

  // Return action
  const handleReturn = async (entryId: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!returnReason.trim()) {
      setErrorMsg('Důvod pro vrácení je povinný.');
      return;
    }

    try {
      const res = await fetch(`/api/work-entries/${entryId}/return`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: returnReason }),
      });

      const out = await res.json();
      if (!res.ok) {
        throw new Error(out.error || 'Vrácení selhalo.');
      }

      setSuccessMsg('Záznam byl vrácen pracovníkovi k opravě.');
      setShowReturnModal(false);
      setReturnReason('');
      setActiveDetail(null);
      await refreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operace se nezdařila.';
      setErrorMsg(message);
    }
  };

  // Correct Action (For APPROVED items)
  const handleCorrect = async (entryId: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!correctionReason.trim()) {
      setErrorMsg('Důvod pro provedení opravy je povinný.');
      return;
    }

    try {
      const res = await fetch(`/api/work-entries/${entryId}/correct`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          quantity: correctionQty ? parseFloat(correctionQty) : undefined,
          unitPrice: correctionRate ? parseFloat(correctionRate) : undefined,
          note: correctionNote || undefined,
          reason: correctionReason,
        }),
      });

      const out = await res.json();
      if (!res.ok) {
        throw new Error(out.error || 'Oprava selhala.');
      }

      setSuccessMsg('Oprava záznamu práce byla uložena.');
      setIsCorrecting(false);
      setCorrectionQty('');
      setCorrectionRate('');
      setCorrectionNote('');
      setCorrectionReason('');
      setActiveDetail(null);
      await refreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Oprava se nezdařila.';
      setErrorMsg(message);
    }
  };

  // Approve WorkExpense
  const handleApproveExpense = async (expenseId: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/work-expenses/${expenseId}/approve`, {
        method: 'POST',
      });
      const out = await res.json();
      if (!res.ok) {
        throw new Error(out.error || 'Schválení výdaje selhalo.');
      }

      setSuccessMsg('Výdaj byl schválen a zapsán do vyúčtování.');
      await refreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operace se nezdařila.';
      setErrorMsg(message);
    }
  };

  // Reject WorkExpense
  const handleRejectExpense = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!expenseRejectReason.trim()) {
      setErrorMsg('Důvod zamítnutí výdaje je povinný.');
      return;
    }

    try {
      const res = await fetch(`/api/work-expenses/${rejectingExpenseId}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: expenseRejectReason }),
      });
      const out = await res.json();
      if (!res.ok) {
        throw new Error(out.error || 'Zamítnutí výdaje selhalo.');
      }

      setSuccessMsg('Výdaj byl zamítnut.');
      setRejectingExpenseId(null);
      setExpenseRejectReason('');
      await refreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operace se nezdařila.';
      setErrorMsg(message);
    }
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
            Správa a schvalování záznamů odvedené práce zaměstnanců SeePoint.
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
            <option value="SUBMITTED">Odesláno (SUBMITTED)</option>
            <option value="APPROVED">Schváleno (APPROVED)</option>
            <option value="RETURNED">Vráceno (RETURNED)</option>
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
                    {entry.status === 'RETURNED' && entry.rejectionReason && (
                      <div className="mt-1 text-[11px] text-red-700 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 inline-block">
                        Důvod vrácení: {entry.rejectionReason}
                      </div>
                    )}
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
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClasses[entry.status]}`}>
                      {statusLabels[entry.status] || entry.status}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => {
                        setActiveDetail(entry);
                        setIsCorrecting(false);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
                    >
                      Detail / Akce
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-xl font-bold">Detail záznamu odvedené práce</h3>
              <button
                onClick={() => {
                  setActiveDetail(null);
                  setIsCorrecting(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="text-sm space-y-2.5">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2">Základní údaje</h4>
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
                <div className="grid grid-cols-2 border-t pt-2">
                  <span className="text-slate-500">Aplikovaná sazba:</span>
                  <strong>
                    {activeDetail.appliedUnitRate ? (
                      `${Number(activeDetail.appliedUnitRate).toLocaleString('cs-CZ')} CZK`
                    ) : (
                      <span className="text-red-600">Chybí sazba</span>
                    )}
                  </strong>
                </div>
                <div className="grid grid-cols-2">
                  <span className="text-slate-500">Vypočtená částka:</span>
                  <strong className="text-slate-900">
                    {Number(activeDetail.calculatedAmount).toLocaleString('cs-CZ')} CZK
                  </strong>
                </div>
                {activeDetail.note && (
                  <div className="border-t pt-2 mt-2">
                    <span className="text-slate-500 block mb-1">Poznámka pracovníka:</span>
                    <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700 whitespace-pre-wrap">
                      {activeDetail.note}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Výdaje k vyúčtování</h4>
                {activeDetail.expenses.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">K této práci nejsou připojeny žádné výdaje.</p>
                ) : (
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {activeDetail.expenses.map((expense) => (
                      <div className="rounded-xl border p-3 text-xs bg-slate-50 relative space-y-1.5" key={expense.id}>
                        <div className="flex justify-between items-center">
                          <span className="font-bold">{expense.type}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${expenseStatusClasses[expense.status]}`}>
                            {expenseStatusLabels[expense.status]}
                          </span>
                        </div>
                        <p className="text-slate-600">{expense.description}</p>
                        <div className="flex justify-between items-center font-bold">
                          <span>Částka:</span>
                          <span>{Number(expense.amount).toLocaleString('cs-CZ')} CZK</span>
                        </div>
                        {expense.receiptUrl && (
                          <div className="mt-1">
                            <a
                              href={expense.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline font-semibold block"
                            >
                              📎 Zobrazit účtenku (Receipt)
                            </a>
                          </div>
                        )}
                        {expense.status === 'REJECTED' && expense.rejectionReason && (
                          <p className="text-red-700 font-medium">Důvod zamítnutí: {expense.rejectionReason}</p>
                        )}
                        {expense.status === 'PENDING' && (
                          <div className="flex gap-2 justify-end pt-2 border-t mt-2">
                            <button
                              onClick={() => {
                                setRejectingExpenseId(expense.id);
                                setExpenseRejectReason('');
                              }}
                              className="rounded bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 font-semibold hover:bg-red-100 transition"
                            >
                              Zamítnout
                            </button>
                            <button
                              onClick={() => handleApproveExpense(expense.id)}
                              className="rounded bg-emerald-600 text-white px-2.5 py-1 font-semibold hover:bg-emerald-700 transition"
                            >
                              Schválit
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rejection of WorkExpense Form */}
            {rejectingExpenseId && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <h5 className="font-bold text-red-900 text-sm">Zdůvodnění zamítnutí výdaje</h5>
                <textarea
                  className="input bg-white w-full h-16 text-xs"
                  required
                  value={expenseRejectReason}
                  onChange={(e) => setExpenseRejectReason(e.target.value)}
                  placeholder="Zadejte povinné zdůvodnění (min. 5 znaků)..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setRejectingExpenseId(null)}
                    className="rounded border bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={handleRejectExpense}
                    className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Potvrdit zamítnutí
                  </button>
                </div>
              </div>
            )}

            {/* Correction Form for APPROVED entry */}
            {isCorrecting && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4 animate-in fade-in">
                <h4 className="font-bold text-slate-800 text-sm">Oprava schváleného záznamu (Carry-over)</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold">
                    Nové množství (Množství)
                    <input
                      className="input bg-white w-full mt-1"
                      value={correctionQty}
                      onChange={(e) => setCorrectionQty(e.target.value)}
                      placeholder={activeDetail.quantity}
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Nová jednotková sazba (CZK)
                    <input
                      className="input bg-white w-full mt-1"
                      value={correctionRate}
                      onChange={(e) => setCorrectionRate(e.target.value)}
                      placeholder={activeDetail.appliedUnitRate || '0'}
                    />
                  </label>
                </div>
                <label className="block text-xs font-semibold">
                  Nová poznámka
                  <input
                    className="input bg-white w-full mt-1"
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    placeholder={activeDetail.note || ''}
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Důvod opravy (povinný) <span className="text-red-500">*</span>
                  <input
                    className="input bg-white w-full mt-1"
                    required
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Zadejte povinné zdůvodnění (min. 5 znaků)..."
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsCorrecting(false)}
                    className="rounded border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Zrušit opravu
                  </button>
                  <button
                    onClick={() => handleCorrect(activeDetail.id)}
                    className="rounded bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Uložit opravu
                  </button>
                </div>
              </div>
            )}

            {/* Return reason prompt modal */}
            {showReturnModal && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <h4 className="font-bold text-red-900 text-sm">Vrácení práce k opravě</h4>
                <p className="text-xs text-red-700">Uveďte prosím pracovníkovi důvod vrácení výkazu práce.</p>
                <textarea
                  className="input bg-white w-full h-16 text-xs"
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Zadejte povinný důvod vrácení (min. 5 znaků)..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowReturnModal(false);
                      setReturnReason('');
                    }}
                    className="rounded border bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={() => handleReturn(activeDetail.id)}
                    className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Vrátit k opravě
                  </button>
                </div>
              </div>
            )}

            {/* Approve late reason prompt modal */}
            {showApproveReasonModal && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <h4 className="font-bold text-amber-900 text-sm">Schválení práce po uzávěrce</h4>
                <p className="text-xs text-amber-700">Tento záznam spadá do již uzamčeného období. Zadejte povinné odůvodnění schválení:</p>
                <textarea
                  className="input bg-white w-full h-16 text-xs"
                  required
                  value={approveReason}
                  onChange={(e) => setApproveReason(e.target.value)}
                  placeholder="Zadejte důvod (min. 5 znaků)..."
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowApproveReasonModal(false);
                      setApproveReason('');
                    }}
                    className="rounded border bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Zrušit
                  </button>
                  <button
                    onClick={() => handleApprove(activeDetail.id, approveReason)}
                    className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Schválit s odůvodněním
                  </button>
                </div>
              </div>
            )}

            {/* Modal Action Controls Footer */}
            {!isCorrecting && !showReturnModal && !showApproveReasonModal && (
              <div className="flex flex-wrap gap-2 justify-end pt-3 border-t">
                <button
                  onClick={() => {
                    setActiveDetail(null);
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Zavřít
                </button>

                {activeDetail.status === 'SUBMITTED' && (
                  <>
                    <button
                      onClick={() => setShowReturnModal(true)}
                      className="rounded-xl bg-red-50 text-red-700 border border-red-200 px-4 py-2 text-sm font-semibold hover:bg-red-100 transition"
                    >
                      Vrátit k opravě
                    </button>

                    <button
                      onClick={() => handleApprove(activeDetail.id)}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                    >
                      Schválit práci
                    </button>
                  </>
                )}

                {activeDetail.status === 'APPROVED' && (
                  <button
                    onClick={() => {
                      setIsCorrecting(true);
                      setCorrectionQty(activeDetail.quantity);
                      setCorrectionRate(activeDetail.appliedUnitRate || '');
                      setCorrectionNote(activeDetail.note || '');
                    }}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
                  >
                    Provést opravu
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
