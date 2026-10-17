'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { dateOnly } from '@/lib/internal-format';
import type { WorkCategory } from '@/lib/work-categories';
import { DEFAULT_WORK_CATEGORIES } from '@/lib/work-categories';
import { WorkStatisticsPanel } from '@/components/WorkStatisticsPanel';
import { QuickOtherCostForm } from '@/components/QuickOtherCostForm';
import { WorkRateCatalogPanel, type RateCatalogItem } from '@/components/WorkRateCatalogPanel';
import { resolveActivityName } from '@/lib/work-entry-stats';

type EmployeePayload = {
  id: string;
  firstName: string;
  lastName: string;
};

type WorkOrderOption = {
  id: string;
  title: string;
  workType: string;
  clientName: string;
  price: number | null;
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
  employee: { firstName: string; lastName: string };
  workTask: { title: string } | null;
  workOrder: { title: string } | null;
  expenses: ExpensePayload[];
  rejectionReason?: string | null;
};

type WorkEntriesManagerProps = {
  employees: EmployeePayload[];
  initialEntries: EntryPayload[];
  workCategories?: WorkCategory[];
  workOrders?: WorkOrderOption[];
  companyRates?: RateCatalogItem[];
  employeeRates?: RateCatalogItem[];
};

const rateTypeLabels: Record<string, string> = {
  HOURLY: '⏱️ Hodinová práce',
  TASK: '📦 Úkolová práce (ks)',
  FIXED: '💰 Cena za zakázku',
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

export function WorkEntriesManager({
  employees,
  initialEntries,
  workCategories,
  workOrders = [],
  companyRates = [],
  employeeRates = [],
}: WorkEntriesManagerProps) {
  const categories = workCategories && workCategories.length > 0 ? workCategories : DEFAULT_WORK_CATEGORIES;
  const [entries, setEntries] = useState<EntryPayload[]>(initialEntries);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [orderQuery, setOrderQuery] = useState('');

  // Active form panel: 'work' | 'cost' | null
  const [activeFormPanel, setActiveFormPanel] = useState<'work' | 'cost' | null>(null);
  const [editingEntry, setEditingEntry] = useState<EntryPayload | null>(null);

  // Simplified Work Entry Form state
  const [targetEmployeeId, setTargetEmployeeId] = useState(employees[0]?.id || '');
  const [activityTitle, setActivityTitle] = useState(
    categories[0]?.label || 'Instalace lavičky / městského mobiliáře'
  );
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [workType, setWorkType] = useState<string>(categories[0]?.defaultWorkType || 'INSTALLATION');
  const [remunerationMethod, setRemunerationMethod] = useState<'HOURLY' | 'TASK' | 'FIXED'>('HOURLY');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('hod');
  const [unitRate, setUnitRate] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail / Correction Modal state
  const [activeDetail, setActiveDetail] = useState<EntryPayload | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showApproveReasonModal, setShowApproveReasonModal] = useState(false);
  const [approveReason, setApproveReason] = useState('');

  // Error/Success messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const findCatalogRateForTitle = (title: string) => {
    const norm = title.trim().toLowerCase();
    if (!norm) return null;
    const empMatch = employeeRates.find(
      (r) =>
        (!r.employeeId || r.employeeId === targetEmployeeId) &&
        (r.name.trim().toLowerCase() === norm ||
          r.carrierTypeLabel?.trim().toLowerCase() === norm)
    );
    if (empMatch) return empMatch;
    const compMatch = companyRates.find(
      (r) =>
        r.name.trim().toLowerCase() === norm ||
        r.carrierTypeLabel?.trim().toLowerCase() === norm
    );
    return compMatch || null;
  };

  // Auto-resolve rate from backend when employee / workType / remunerationMethod / workDate / order / activityTitle changes
  useEffect(() => {
    if (activeFormPanel !== 'work' || !targetEmployeeId || editingEntry) return;
    let cancelled = false;
    const fetchRate = async () => {
      try {
        const orderParam = selectedOrderId ? `&workOrderId=${selectedOrderId}` : '';
        const titleParam = activityTitle ? `&activityTitle=${encodeURIComponent(activityTitle)}` : '';
        const res = await fetch(
          `/api/work-entries/resolve-rate?employeeId=${targetEmployeeId}&workType=${workType}&workDate=${workDate}&remunerationMethod=${remunerationMethod}${orderParam}${titleParam}`
        );
        const data = await res.json();
        if (!cancelled && res.ok && data.rate) {
          setUnitRate(String(Number(data.rate)));
          if (remunerationMethod === 'TASK' && data.unit) {
            setUnit(data.unit);
          }
        }
      } catch {}
    };
    fetchRate();
    return () => {
      cancelled = true;
    };
  }, [activeFormPanel, targetEmployeeId, workType, remunerationMethod, workDate, selectedOrderId, activityTitle, editingEntry]);

  const handleSelectCategory = (cat: WorkCategory) => {
    setActivityTitle(cat.label);
    setWorkType(cat.defaultWorkType);
    const catalogMatch = findCatalogRateForTitle(cat.label);
    if (catalogMatch) {
      const m = (catalogMatch.type as 'HOURLY' | 'TASK' | 'FIXED') || 'TASK';
      setRemunerationMethod(m);
      setUnit(catalogMatch.unit || (m === 'HOURLY' ? 'hod' : m === 'FIXED' ? 'zakázka' : 'ks'));
      if (m === 'FIXED') setQuantity('1');
      setUnitRate(String(Number(catalogMatch.amount)));
      return;
    }

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
      if (!activityTitle) setActivityTitle(ord.title);
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
      const res = await fetch('/api/work-entries');
      const data = await res.json();
      if (res.ok) {
        setEntries(data);
        if (activeDetail) {
          const freshDetail = data.find((e: EntryPayload) => e.id === activeDetail.id);
          if (freshDetail) setActiveDetail(freshDetail);
        }
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

    if (!targetEmployeeId && !editingEntry) {
      setErrorMsg('Vyberte pracovníka.');
      return;
    }

    const effectiveQty = remunerationMethod === 'FIXED' ? '1' : quantity;
    if (!effectiveQty || !String(effectiveQty).trim()) {
      setErrorMsg(remunerationMethod === 'HOURLY' ? 'Zadejte počet odpracovaných hodin.' : 'Zadejte počet kusů / úkolů.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employeeId: editingEntry ? editingEntry.employeeId : targetEmployeeId,
        workTaskId: editingEntry ? editingEntry.workTaskId : undefined,
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
        throw new Error(out.error || 'Uložení práce selhalo.');
      }

      setSuccessMsg(
        editingEntry
          ? 'Záznam práce byl upraven a přepočítán ve vyúčtování.'
          : 'Záznam práce byl vytvořen a rovnou započítán do vyúčtování pracovníka.'
      );
      setActiveFormPanel(null);
      resetForm();
      await refreshList();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Operace se nezdařila.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (entry: EntryPayload) => {
    setEditingEntry(entry);
    setTargetEmployeeId(entry.employeeId);
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
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || 'Smazání selhalo.');
      setSuccessMsg('Záznam práce byl smazán.');
      await refreshList();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při mazání.');
    }
  };

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
          setShowApproveReasonModal(true);
          return;
        }
        throw new Error(out.error || 'Schválení selhalo.');
      }
      setSuccessMsg('Záznam práce byl schválen a zapsán do vyúčtování.');
      setShowApproveReasonModal(false);
      setApproveReason('');
      setActiveDetail(null);
      await refreshList();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Operace se nezdařila.');
    }
  };

  const handleReturn = async (entryId: string) => {
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
      if (!res.ok) throw new Error(out.error || 'Vrácení selhalo.');
      setSuccessMsg('Záznam byl vrácen pracovníkovi k opravě.');
      setShowReturnModal(false);
      setReturnReason('');
      setActiveDetail(null);
      await refreshList();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Operace se nezdařila.');
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (employeeFilter && entry.employeeId !== employeeFilter) return false;
    if (statusFilter && entry.status !== statusFilter) return false;
    if (monthFilter && !entry.workDate.startsWith(monthFilter)) return false;
    if (activityFilter && resolveActivityName(entry) !== activityFilter) return false;
    if (orderQuery) {
      const q = orderQuery.toLowerCase();
      const act = resolveActivityName(entry).toLowerCase();
      const orderTitle = entry.workOrder?.title.toLowerCase() || '';
      const empName = `${entry.employee.firstName} ${entry.employee.lastName}`.toLowerCase();
      if (!act.includes(q) && !orderTitle.includes(q) && !empName.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Odvedená práce & Statistiky úkolů</h1>
          <p className="mt-1 text-sm text-slate-500">
            Přehled hodinové a úkolové práce, cen za zakázku, rozdělení podle činností a ostatních nákladů všech pracovníků.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              resetForm();
              if (employeeFilter) setTargetEmployeeId(employeeFilter);
              setActiveFormPanel(activeFormPanel === 'work' ? null : 'work');
            }}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition"
          >
            ➕ Zapsat práci (Hodiny / Úkol / Zakázka)
          </button>

          <button
            type="button"
            onClick={() => {
              if (employeeFilter) setTargetEmployeeId(employeeFilter);
              setActiveFormPanel(activeFormPanel === 'cost' ? null : 'cost');
            }}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-900 shadow-sm hover:bg-indigo-100 transition"
          >
            🚗 + Ostatní náklad (Auto, Nájem, Telefon, Záloha)
          </button>

          <Link
            href="/settlements"
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition shadow-sm"
          >
            📊 Přehled vyúčtování →
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

      {/* Rate Catalog Preview & Quick Manager */}
      <WorkRateCatalogPanel
        companyRates={companyRates}
        employeeRates={employeeRates}
        selectedEmployeeId={employeeFilter || targetEmployeeId}
        workCategories={categories}
        canManage={true}
        onSelectRate={(r) => {
          setActiveFormPanel('work');
          setActivityTitle(r.name);
          setWorkType(r.workType || 'INSTALLATION');
          setRemunerationMethod(r.type);
          setUnit(r.unit || (r.type === 'HOURLY' ? 'hod' : r.type === 'FIXED' ? 'zakázka' : 'ks'));
          if (r.type === 'FIXED') setQuantity('1');
          setUnitRate(String(Number(r.amount)));
        }}
      />

      {/* PANEL 1: Simplified Work Form */}
      {activeFormPanel === 'work' && (
        <section className="rounded-2xl border-2 border-slate-900 bg-white p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {editingEntry ? '✏️ Upravit záznam práce' : '⚡ Zápis odvedené práce pracovníka'}
              </h2>
              <p className="text-xs text-slate-500">
                Vyberte pracovníka, klikněte na činnost (např. Instalace lavičky, Lepení billboardu), zadejte hodiny, kusy nebo cenu za zakázku.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveFormPanel(null);
                resetForm();
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Zavřít ✕
            </button>
          </div>

          <form onSubmit={handleSubmitWork} className="space-y-4">
            {/* Activity chips */}
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                1. Vyberte úkol / činnost (nebo napište vlastní)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => {
                  const isSelected = activityTitle === cat.label;
                  const matchedRate = findCatalogRateForTitle(cat.label);
                  const rateBadge = matchedRate
                    ? `${Number(matchedRate.amount).toLocaleString('cs-CZ')} Kč/${matchedRate.unit || (matchedRate.type === 'HOURLY' ? 'hod' : 'ks')}`
                    : cat.defaultRate
                    ? `${cat.defaultRate.toLocaleString('cs-CZ')} Kč`
                    : null;
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
                      {rateBadge && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {rateBadge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold text-slate-700">
                Pracovník *
                <select
                  required
                  disabled={!!editingEntry}
                  value={targetEmployeeId}
                  onChange={(e) => setTargetEmployeeId(e.target.value)}
                  className="input mt-1 w-full text-sm font-semibold"
                >
                  <option value="">Vyberte pracovníka...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </label>

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
                  <option value="">— Obecná práce / Bez zakázky —</option>
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

            {/* Remuneration Method */}
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Typ odměny
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['HOURLY', 'TASK', 'FIXED'] as const).map((method) => {
                  const active = remunerationMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => handleSelectMethod(method)}
                      className={`rounded-xl border p-2.5 text-left transition ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-sm font-bold">{rateTypeLabels[method]}</div>
                      <div className={`text-[11px] ${active ? 'text-slate-300' : 'text-slate-500'}`}>
                        {method === 'HOURLY' && 'Odpracované hodiny × hodinová sazba'}
                        {method === 'TASK' && 'Počet kusů / úkolů × sazba za kus'}
                        {method === 'FIXED' && 'Pevná částka za celou zakázku'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity & Rate */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
              {remunerationMethod !== 'FIXED' && (
                <label className="text-xs font-bold text-slate-700">
                  {remunerationMethod === 'HOURLY' ? 'Počet hodin *' : 'Počet kusů / úkolů *'}
                  <input
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={remunerationMethod === 'HOURLY' ? 'např. 4.5 nebo 4:30' : 'např. 8'}
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
                  placeholder={remunerationMethod === 'HOURLY' ? 'např. 350' : remunerationMethod === 'TASK' ? 'např. 250' : 'např. 5000'}
                  className="input mt-1 w-full text-base font-bold"
                />
              </label>

              <label className="text-xs font-bold text-slate-700">
                Poznámka (volitelné)
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Upřesnění..."
                  className="input mt-1 w-full text-sm font-normal"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">Celková částka:</span>
                <span className="text-xl font-black text-slate-900">
                  {previewAmount.toLocaleString('cs-CZ')} Kč
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFormPanel(null);
                    resetForm();
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-slate-950 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  {submitting ? 'Ukládám...' : editingEntry ? '💾 Uložit změny' : '✅ Uložit práci a započítat'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* PANEL 2: Quick Other Costs Form */}
      {activeFormPanel === 'cost' && (
        <QuickOtherCostForm
          settlementId="current"
          employeeId={employeeFilter || targetEmployeeId}
          employees={employees}
          onSuccess={(msg) => {
            setSuccessMsg(msg);
            setActiveFormPanel(null);
          }}
          onCancel={() => setActiveFormPanel(null)}
        />
      )}

      {/* Filters Bar */}
      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-bold text-slate-700">
          Pracovník
          <select
            className="input mt-1 w-full font-normal text-sm"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
          >
            <option value="">Všichni pracovníci ({employees.length})</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold text-slate-700">
          Období (měsíc)
          <input
            type="month"
            className="input mt-1 w-full font-normal text-sm"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          />
        </label>

        <label className="text-xs font-bold text-slate-700">
          Stav
          <select
            className="input mt-1 w-full font-normal text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Všechny stavy</option>
            <option value="APPROVED">Schváleno (vč. vyúčtování)</option>
            <option value="SUBMITTED">Čeká na schválení</option>
            <option value="DRAFT">Koncept</option>
            <option value="RETURNED">Vráceno</option>
          </select>
        </label>

        <label className="text-xs font-bold text-slate-700">
          Hledat úkol / zakázku
          <input
            className="input mt-1 w-full font-normal text-sm"
            value={orderQuery}
            onChange={(e) => setOrderQuery(e.target.value)}
            placeholder="např. lavičky, billboard..."
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setEmployeeFilter('');
              setStatusFilter('');
              setMonthFilter('');
              setActivityFilter('');
              setOrderQuery('');
            }}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition w-full"
          >
            Zrušit filtry
          </button>
        </div>
      </div>

      {/* Statistics & Activity Breakdown */}
      <WorkStatisticsPanel
        items={filteredEntries}
        title="Statistika celkového počtu hodin a rozdělení podle úkolů"
        selectedActivity={activityFilter}
        onSelectActivity={setActivityFilter}
      />

      {/* Main List */}
      <section className="card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Přehled záznamů odvedené práce</h2>
          <span className="text-sm text-slate-500">Zobrazeno {filteredEntries.length} záznamů</span>
        </div>

        {filteredEntries.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">Nebyly nalezeny žádné záznamy práce pro zvolený filtr.</p>
        ) : (
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
              <tr>
                <th className="py-2.5 pr-3">Pracovník</th>
                <th className="py-2.5 pr-3">Datum</th>
                <th className="py-2.5 pr-3">Úkol / Činnost / Zakázka</th>
                <th className="py-2.5 pr-3">Typ odměny</th>
                <th className="py-2.5 pr-3">Množství</th>
                <th className="py-2.5 pr-3">Sazba</th>
                <th className="py-2.5 pr-3">Částka</th>
                <th className="py-2.5 pr-3">Stav</th>
                <th className="py-2.5 text-right">Akce</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => {
                const activityName = resolveActivityName(entry);
                return (
                  <tr className="border-b last:border-0 hover:bg-slate-50/50" key={entry.id}>
                    <td className="py-3 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                      {entry.employee.firstName} {entry.employee.lastName}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">{dateOnly(new Date(entry.workDate))}</td>
                    <td className="py-3 pr-3">
                      <div className="font-bold text-slate-900">{activityName}</div>
                      {entry.workOrder?.title && (
                        <div className="text-xs text-slate-500">Zakázka: {entry.workOrder.title}</div>
                      )}
                      {entry.note && <div className="text-xs text-slate-500 italic">{entry.note}</div>}
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
                      {entry.appliedUnitRate ? (
                        `${Number(entry.appliedUnitRate).toLocaleString('cs-CZ')} Kč`
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          Chybí sazba
                        </span>
                      )}
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
                      {entry.status !== 'APPROVED' && entry.appliedUnitRate && (
                        <button
                          type="button"
                          onClick={() => handleApprove(entry.id)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                        >
                          Schválit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEdit(entry)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        Upravit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(entry.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
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

      {/* Late Approval Reason Modal */}
      {showApproveReasonModal && activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">Schválení práce po uzávěrce</h3>
            <input
              className="input w-full"
              value={approveReason}
              onChange={(e) => setApproveReason(e.target.value)}
              placeholder="Zadejte důvod..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApproveReasonModal(false)}
                className="rounded-xl border px-4 py-2 text-xs font-bold"
              >
                Zrušit
              </button>
              <button
                onClick={() => handleApprove(activeDetail.id, approveReason)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
              >
                Schválit
              </button>
            </div>
          </div>
        </div>
      )}

      {showReturnModal && activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">Vrátit záznam k opravě</h3>
            <input
              className="input w-full"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Důvod vrácení..."
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReturnModal(false)}
                className="rounded-xl border px-4 py-2 text-xs font-bold"
              >
                Zrušit
              </button>
              <button
                onClick={() => handleReturn(activeDetail.id)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white"
              >
                Vrátit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
