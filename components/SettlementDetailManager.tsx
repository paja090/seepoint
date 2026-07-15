'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { dateOnly } from '@/lib/internal-format';

type SettlementDetail = {
  id: string;
  periodFrom: string;
  periodTo: string;
  periodYear: number;
  periodMonth: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'LOCKED' | 'PAID' | 'REJECTED';
  note: string | null;
  totalWorkAmount: string;
  totalReimbursements: string;
  totalDeductions: string;
  totalAdvances: string;
  finalPayableAmount: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  items: Array<{
    id: string;
    date: string;
    description: string;
    quantity: string | null;
    unit: string | null;
    unitPrice: string | null;
    amount: string;
    appliedRate: string;
    rateType: string | null;
    rateSource: string | null;
    workType: string | null;
    task: { title: string } | null;
    note: string | null;
  }>;
  adjustments: Array<{
    id: string;
    type: string;
    category: string;
    description: string;
    amount: string;
    reason: string | null;
    changedByUserId: string | null;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    userId: string;
    userName: string;
    action: string;
    fieldName: string | null;
    oldValue: string | null;
    newValue: string | null;
    reason: string;
    createdAt: string;
  }>;
  expenses: Array<{
    id: string;
    type: string;
    description: string;
    amount: string;
    status: string;
    rejectionReason: string | null;
    receiptUrl: string | null;
    workDate: string;
  }>;
};

type SettlementDetailManagerProps = {
  settlement: SettlementDetail;
  currentUser: {
    id: string;
    email: string;
    role: string;
  };
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Koncept',
  SUBMITTED: 'Odesláno ke schválení',
  APPROVED: 'Schváleno',
  LOCKED: 'Uzamčeno',
  PAID: 'Vyplaceno',
  REJECTED: 'Zamítnuto',
};

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-800 border-slate-200',
  SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-200',
  APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  LOCKED: 'bg-purple-100 text-purple-800 border-purple-200',
  PAID: 'bg-teal-100 text-teal-800 border-teal-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200 font-bold',
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

const categoryLabels: Record<string, string> = {
  PHONE: 'Telefon',
  RENT: 'Nájemné',
  PARKING: 'Parkovné',
  FUEL: 'Pohonné hmoty',
  PURCHASE: 'Nákup materiálu',
  PENALTY: 'Penále / Pokuta',
  OTHER: 'Ostatní',
};

const adjustmentTypeLabels: Record<string, string> = {
  REIMBURSEMENT: 'Náhrada výdaje',
  BONUS: 'Prémie / Bonus',
  CARRY_OVER_ADD: 'Korekce (+) carry-over',
  ADVANCE: 'Záloha',
  DEDUCTION: 'Srážka / Odpočet',
  CARRY_OVER_SUB: 'Korekce (-) carry-over',
};

export function SettlementDetailManager({ settlement }: SettlementDetailManagerProps) {
  const router = useRouter();

  // Tabs state
  const [activeTab, setActiveTab] = useState<'work' | 'expenses' | 'adjustments' | 'logs'>('work');

  // Error/Success messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Rejection modal for Settlement
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Manual Adjustment Form state
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjCategory, setAdjCategory] = useState('OTHER');
  const [adjDescription, setAdjDescription] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // Deletion modal for Adjustment
  const [deletingAdjId, setDeletingAdjId] = useState<string | null>(null);
  const [deleteAdjReason, setDeleteAdjReason] = useState('');

  const refreshData = async () => {
    try {
      router.refresh();
      window.location.reload();
    } catch {}
  };

  const handleAction = async (action: string, confirmText?: string) => {
    setErrorMsg('');
    setSuccessMsg('');

    if (confirmText && !window.confirm(confirmText)) return;

    try {
      const res = await fetch(`/api/settlements/${settlement.id}/${action}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Akce selhala.');
      }
      setSuccessMsg('Stav vyúčtování byl úspěšně změněn.');
      await refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nastala chyba při změně stavu.';
      setErrorMsg(message);
    }
  };

  const handleReject = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!rejectReason.trim()) {
      setErrorMsg('Důvod zamítnutí je povinný.');
      return;
    }

    try {
      const res = await fetch(`/api/settlements/${settlement.id}/reject`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Zamítnutí selhalo.');
      }
      setSuccessMsg('Vyúčtování bylo zamítnuto.');
      setShowRejectModal(false);
      setRejectReason('');
      await refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nastala chyba.';
      setErrorMsg(message);
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const amt = parseFloat(adjAmount);
    if (isNaN(amt) || amt === 0) {
      setErrorMsg('Částka musí být platné číslo různé od nuly.');
      return;
    }
    if (!adjDescription.trim()) {
      setErrorMsg('Popis korekce je povinný.');
      return;
    }
    if (!adjReason.trim()) {
      setErrorMsg('Důvod korekce je povinný.');
      return;
    }

    try {
      const res = await fetch(`/api/settlements/${settlement.id}/adjustments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          category: adjCategory,
          description: adjDescription,
          reason: adjReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Přidání korekce selhalo.');
      }
      setSuccessMsg('Korekce byla přidána.');
      setShowAdjForm(false);
      setAdjAmount('');
      setAdjDescription('');
      setAdjReason('');
      await refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nastala chyba.';
      setErrorMsg(message);
    }
  };

  const handleDeleteAdjustment = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (!deleteAdjReason.trim()) {
      setErrorMsg('Důvod pro smazání je povinný.');
      return;
    }

    try {
      const res = await fetch(`/api/settlements/adjustments/${deletingAdjId}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: deleteAdjReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Smazání selhalo.');
      }
      setSuccessMsg('Korekce byla úspěšně smazána.');
      setDeletingAdjId(null);
      setDeleteAdjReason('');
      await refreshData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Nastala chyba.';
      setErrorMsg(message);
    }
  };

  const isEditable = settlement.status === 'DRAFT' || settlement.status === 'SUBMITTED' || settlement.status === 'APPROVED' || settlement.status === 'REJECTED';

  return (
    <div className="space-y-6">
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

      {/* Main Info Card */}
      <section className="card grid gap-6 md:grid-cols-3 items-start">
        <div className="space-y-2 md:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold border ${statusClasses[settlement.status]}`}>
              {statusLabels[settlement.status]}
            </span>
            <span className="text-sm font-medium text-slate-500">
              Období: <strong>{dateOnly(new Date(settlement.periodFrom))} – {dateOnly(new Date(settlement.periodTo))}</strong>
            </span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">
            {settlement.employee.firstName} {settlement.employee.lastName}
          </h2>
          <p className="text-sm text-slate-500">{settlement.employee.email}</p>
          {settlement.note && (
            <div className="rounded-lg bg-slate-50 border p-3 text-xs text-slate-700 whitespace-pre-wrap">
              <strong>Poznámka vyúčtování:</strong> {settlement.note}
            </div>
          )}
        </div>

        {/* Action Controls Panel */}
        <div className="flex flex-col gap-2 justify-end border-t md:border-t-0 pt-4 md:pt-0">
          <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-2 text-right">Akce vyúčtování</h4>
          
          {(settlement.status === 'DRAFT' || settlement.status === 'REJECTED') && (
            <button
              onClick={() => handleAction('submit')}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition w-full"
            >
              Odeslat ke schválení
            </button>
          )}

          {settlement.status === 'SUBMITTED' && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowRejectModal(true);
                  setRejectReason('');
                }}
                className="rounded-xl bg-red-50 text-red-700 border border-red-200 px-4 py-2.5 text-sm font-semibold hover:bg-red-100 transition flex-1"
              >
                Zamítnout
              </button>
              <button
                onClick={() => handleAction('approve')}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition flex-1"
              >
                Schválit
              </button>
            </div>
          )}

          {settlement.status === 'APPROVED' && (
            <button
              onClick={() => handleAction('lock', 'Opravdu chcete UZAMKNOUT toto období vyúčtování? Záznamy práce a výdajů v daném měsíci již nebude možné upravovat. Případné budoucí změny se vyřeší vyrovnáním v dalším měsíci.')}
              className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition w-full"
            >
              Uzamknout období (LOCK)
            </button>
          )}

          {settlement.status === 'LOCKED' && (
            <button
              onClick={() => handleAction('pay', 'Opravdu chcete označit toto vyúčtování jako VYPLACENÉ?')}
              className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 transition w-full"
            >
              Označit jako vyplacené (PAY)
            </button>
          )}

          {settlement.status === 'PAID' && (
            <div className="rounded-xl bg-slate-50 border p-3 text-center text-xs font-semibold text-slate-500">
              🔒 Vyplaceno (Terminální stav)
            </div>
          )}
        </div>
      </section>

      {/* Rejection Settlement Reason Modal */}
      {showRejectModal && (
        <section className="card border border-red-200 bg-red-50 space-y-3">
          <h3 className="text-lg font-bold text-red-900">Zamítnutí vyúčtování</h3>
          <p className="text-xs text-red-700">Uveďte prosím povinné zdůvodnění zamítnutí vyúčtování:</p>
          <textarea
            className="input bg-white w-full h-20 text-sm"
            required
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Důvod zamítnutí (min. 5 znaků)..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowRejectModal(false)}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Zrušit
            </button>
            <button
              onClick={handleReject}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Potvrdit zamítnutí
            </button>
          </div>
        </section>
      )}

      {/* Cost breakdown cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Práce</div>
          <div className="text-xl font-extrabold text-slate-900">
            {Number(settlement.totalWorkAmount).toLocaleString('cs-CZ')} CZK
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Výdaje / Náhrady</div>
          <div className="text-xl font-extrabold text-slate-900 text-emerald-700">
            +{Number(settlement.totalReimbursements).toLocaleString('cs-CZ')} CZK
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Srážky</div>
          <div className="text-xl font-extrabold text-slate-900 text-red-700">
            -{Number(settlement.totalDeductions).toLocaleString('cs-CZ')} CZK
          </div>
        </div>
        <div className="card p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Zálohy</div>
          <div className="text-xl font-extrabold text-slate-900 text-red-700">
            -{Number(settlement.totalAdvances).toLocaleString('cs-CZ')} CZK
          </div>
        </div>
        <div className="card p-4 space-y-1 border-2 border-emerald-500 bg-emerald-50/50">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">K výplatě (Čistá suma)</div>
          <div className="text-2xl font-black text-emerald-950">
            {Number(settlement.finalPayableAmount).toLocaleString('cs-CZ')} CZK
          </div>
        </div>
      </div>

      {/* Add Adjustment Form */}
      {showAdjForm && (
        <section className="card">
          <div className="mb-4 flex items-center justify-between border-b pb-3">
            <h3 className="text-xl font-bold">Přidat ruční finanční korekci (adjustment)</h3>
            <button
              onClick={() => setShowAdjForm(false)}
              className="text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Zrušit
            </button>
          </div>

          <form onSubmit={handleAddAdjustment} className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-semibold">
              Částka (Kladná zvyšuje, záporná snižuje) <span className="text-red-500">*</span>
              <input
                type="number"
                step="any"
                required
                className="input mt-1 w-full"
                value={adjAmount}
                onChange={(e) => setAdjAmount(e.target.value)}
                placeholder="např. 1500 nebo -800"
              />
            </label>

            <label className="text-sm font-semibold">
              Kategorie <span className="text-red-500">*</span>
              <select
                className="input mt-1 w-full"
                value={adjCategory}
                onChange={(e) => setAdjCategory(e.target.value)}
              >
                {Object.entries(categoryLabels).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Popis korekce <span className="text-red-500">*</span>
              <input
                required
                className="input mt-1 w-full"
                value={adjDescription}
                onChange={(e) => setAdjDescription(e.target.value)}
                placeholder="např. Prémie za mimořádný výkon"
              />
            </label>

            <label className="md:col-span-3 text-sm font-semibold">
              Důvod pro provedení korekce (povinný) <span className="text-red-500">*</span>
              <input
                required
                className="input mt-1 w-full"
                value={adjReason}
                onChange={(e) => setAdjReason(e.target.value)}
                placeholder="Zadejte důvod uložení do auditu (min. 5 znaků)..."
              />
            </label>

            <div className="md:col-span-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdjForm(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Zrušit
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition"
              >
                Uložit korekci
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Deletion modal for Adjustment */}
      {deletingAdjId && (
        <section className="card border border-red-200 bg-red-50 space-y-3">
          <h3 className="text-lg font-bold text-red-900">Smazání korekce</h3>
          <p className="text-xs text-red-700">Uveďte prosím povinné zdůvodnění smazání této korekce:</p>
          <textarea
            className="input bg-white w-full h-16 text-sm"
            required
            value={deleteAdjReason}
            onChange={(e) => setDeleteAdjReason(e.target.value)}
            placeholder="Důvod smazání (min. 5 znaků)..."
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setDeletingAdjId(null)}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Zrušit
            </button>
            <button
              onClick={handleDeleteAdjustment}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Potvrdit smazání
            </button>
          </div>
        </section>
      )}

      {/* Tabs headers */}
      <div className="border-b flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('work')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'work' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Odvedená práce ({settlement.items.length})
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'expenses' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Výdaje a náhrady ({settlement.expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'adjustments' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Korekce a vyrovnání ({settlement.adjustments.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'logs' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Audit log ({settlement.auditLogs.length})
        </button>
      </div>

      {/* Tab contents */}
      <section className="card overflow-x-auto min-h-[250px]">
        {activeTab === 'work' && (
          <div>
            <h3 className="text-lg font-bold mb-3">Výpis odpracované práce za období</h3>
            {settlement.items.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">Žádné položky práce v tomto období.</p>
            ) : (
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-3">Datum</th>
                    <th className="py-2 pr-3">Úkol / Popis</th>
                    <th className="py-2 pr-3">Druh práce</th>
                    <th className="py-2 pr-3">Množství</th>
                    <th className="py-2 pr-3">Sazba</th>
                    <th className="py-2 text-right">Částka</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.items.map((item) => (
                    <tr className="border-b last:border-0 hover:bg-slate-50/50" key={item.id}>
                      <td className="py-3 pr-3 font-medium">{dateOnly(new Date(item.date))}</td>
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-950">{item.task?.title || 'Interní úkol'}</div>
                        <div className="text-xs text-slate-500">{item.description}</div>
                        {item.note && <div className="text-xs text-slate-500 italic">Pozn: {item.note}</div>}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">{item.workType ? workTypeLabels[item.workType] : '-'}</td>
                      <td className="py-3 pr-3">
                        {item.quantity ? `${Number(item.quantity).toLocaleString('cs-CZ')} ${item.unit || ''}` : '-'}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        {item.unitPrice ? `${Number(item.unitPrice).toLocaleString('cs-CZ')} CZK` : '-'}
                      </td>
                      <td className="py-3 font-semibold text-slate-900 text-right">
                        {Number(item.amount).toLocaleString('cs-CZ')} CZK
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'expenses' && (
          <div>
            <h3 className="text-lg font-bold mb-3">Záznamy o výdajích a účtenkách</h3>
            {settlement.expenses.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">Žádné evidované výdaje v tomto období.</p>
            ) : (
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-3">Datum práce</th>
                    <th className="py-2 pr-3">Typ výdaje</th>
                    <th className="py-2 pr-3">Popis</th>
                    <th className="py-2 pr-3">Částka</th>
                    <th className="py-2 pr-3">Stav</th>
                    <th className="py-2 text-right">Příloha</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.expenses.map((expense) => (
                    <tr className="border-b last:border-0 hover:bg-slate-50/50" key={expense.id}>
                      <td className="py-3 pr-3">{dateOnly(new Date(expense.workDate))}</td>
                      <td className="py-3 pr-3 font-semibold text-slate-900">{expense.type}</td>
                      <td className="py-3 pr-3 text-slate-600">
                        {expense.description}
                        {expense.status === 'REJECTED' && expense.rejectionReason && (
                          <div className="text-xs text-red-700 font-medium">Důvod zamítnutí: {expense.rejectionReason}</div>
                        )}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-900">
                        {Number(expense.amount).toLocaleString('cs-CZ')} CZK
                      </td>
                      <td className="py-3 pr-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${expenseStatusClasses[expense.status]}`}>
                          {expenseStatusLabels[expense.status]}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {expense.receiptUrl ? (
                          <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline font-bold"
                          >
                            Zobrazit účtenku
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Bez přílohy</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'adjustments' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Korekce, náhrady a adjustments</h3>
              {isEditable && (
                <button
                  onClick={() => {
                    setShowAdjForm(true);
                    setAdjAmount('');
                    setAdjDescription('');
                    setAdjReason('');
                  }}
                  className="rounded bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                >
                  Přidat ruční korekci
                </button>
              )}
            </div>

            {settlement.adjustments.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">Žádné evidované korekce v tomto vyúčtování.</p>
            ) : (
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-3">Kategorie</th>
                    <th className="py-2 pr-3">Typ vyrovnání</th>
                    <th className="py-2 pr-3">Popis</th>
                    <th className="py-2 pr-3">Odůvodnění (Audit)</th>
                    <th className="py-2 pr-3">Částka</th>
                    {isEditable && <th className="py-2 text-right">Akce</th>}
                  </tr>
                </thead>
                <tbody>
                  {settlement.adjustments.map((adj) => {
                    const isManual = adj.type === 'BONUS' || adj.type === 'DEDUCTION';
                    const isPositive = adj.type === 'BONUS' || adj.type === 'REIMBURSEMENT' || adj.type === 'CARRY_OVER_ADD';
                    return (
                      <tr className="border-b last:border-0 hover:bg-slate-50/50" key={adj.id}>
                        <td className="py-3 pr-3 font-medium">{categoryLabels[adj.category] || adj.category}</td>
                        <td className="py-3 pr-3 text-slate-700">{adjustmentTypeLabels[adj.type] || adj.type}</td>
                        <td className="py-3 pr-3 text-slate-700">{adj.description}</td>
                        <td className="py-3 pr-3 text-slate-500 text-xs italic">{adj.reason || '-'}</td>
                        <td className={`py-3 pr-3 font-bold ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                          {isPositive ? '+' : '-'}{Number(adj.amount).toLocaleString('cs-CZ')} CZK
                        </td>
                        {isEditable && (
                          <td className="py-3 text-right">
                            {isManual && (
                              <button
                                onClick={() => {
                                  setDeletingAdjId(adj.id);
                                  setDeleteAdjReason('');
                                }}
                                className="rounded bg-red-50 text-red-700 border border-red-100 px-2 py-1 text-xs font-semibold hover:bg-red-100 transition"
                              >
                                Smazat
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div>
            <h3 className="text-lg font-bold mb-3">Auditní historie vyúčtování</h3>
            {settlement.auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">Žádná historie změn pro toto vyúčtování.</p>
            ) : (
              <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-6 text-xs text-slate-600 my-4">
                {settlement.auditLogs.map((log) => (
                  <div className="relative" key={log.id}>
                    <div className="absolute -left-[31px] top-1 bg-white rounded-full border-2 border-slate-300 w-4.5 h-4.5 flex items-center justify-center">
                      <div className="bg-slate-400 rounded-full w-1.5 h-1.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 mr-2">
                        {log.userName}
                      </span>
                      <span className="text-slate-400">
                        {new Date(log.createdAt).toLocaleString('cs-CZ')}
                      </span>
                    </div>
                    <div className="font-bold text-slate-800 mt-1">
                      {log.action === 'STATUS_CHANGE'
                        ? `Změna stavu: ${statusLabels[log.oldValue || ''] || log.oldValue} → ${statusLabels[log.newValue || ''] || log.newValue}`
                        : log.action === 'ADJUSTMENT_ADD'
                        ? `Přidána korekce: ${log.newValue}`
                        : log.action === 'ADJUSTMENT_DELETE'
                        ? `Smazána korekce: ${log.oldValue}`
                        : `${log.action} (${log.fieldName})`}
                    </div>
                    {log.reason && (
                      <div className="mt-1 bg-slate-50 border rounded p-2 text-slate-700 font-medium">
                        Důvod: {log.reason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
