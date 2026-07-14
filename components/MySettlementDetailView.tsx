'use client';

import { useState } from 'react';
import { StatusPill } from '@/lib/internal-format';

interface MySettlementDetailViewProps {
  settlement: {
    id: string;
    periodFrom: string;
    periodTo: string;
    periodYear: number;
    periodMonth: number;
    status: string;
    note: string | null;
    totalWorkAmount: string;
    totalReimbursements: string;
    totalDeductions: string;
    totalAdvances: string;
    finalPayableAmount: string;
    employee: {
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
    auditLogs: Array<{
      id: string;
      userName: string;
      action: string;
      fieldName: string | null;
      oldValue: string | null;
      newValue: string | null;
      reason: string;
      createdAt: string;
    }>;
  };
}

const adjustmentTypeLabels: Record<string, string> = {
  REIMBURSEMENT: 'Náhrada výdaje',
  BONUS: 'Prémie / Bonus',
  CARRY_OVER_ADD: 'Korekce (+) carry-over',
  ADVANCE: 'Záloha',
  DEDUCTION: 'Srážka / Odpočet',
  CARRY_OVER_SUB: 'Korekce (-) carry-over',
};

const expenseTypeLabels: Record<string, string> = {
  FUEL: 'Pohonné hmoty',
  PARKING: 'Parkovné',
  PURCHASE: 'Nákup materiálu',
  OTHER: 'Ostatní',
};

const expenseStatusLabels: Record<string, string> = {
  PENDING: 'Čeká na schválení',
  APPROVED: 'Schváleno',
  REJECTED: 'Zamítnuto',
};

export function MySettlementDetailView({ settlement }: MySettlementDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'work' | 'expenses' | 'adjustments' | 'logs'>('work');

  const formattedPeriod = `${settlement.periodMonth}/${settlement.periodYear}`;

  return (
    <div className="space-y-6">
      {/* Header Info Card */}
      <section className="card p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">
              Vyúčtování za období {formattedPeriod}
            </h2>
            <StatusPill value={settlement.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Pracovník: <b>{settlement.employee.firstName} {settlement.employee.lastName}</b> ({settlement.employee.email})
          </p>
          {settlement.note && (
            <p className="text-xs text-slate-600 mt-2 bg-slate-100 px-3 py-1.5 rounded-lg border">
              Poznámka: <i>{settlement.note}</i>
            </p>
          )}
        </div>
      </section>

      {/* Cost breakdown cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="card p-4 space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Odvedená práce</div>
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
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Odečtené zálohy</div>
          <div className="text-xl font-extrabold text-slate-900 text-red-700">
            -{Number(settlement.totalAdvances).toLocaleString('cs-CZ')} CZK
          </div>
        </div>
        <div className="card p-4 space-y-1 border-2 border-emerald-500 bg-emerald-50/50">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Čistá částka k výplatě</div>
          <div className="text-2xl font-black text-emerald-950">
            {Number(settlement.finalPayableAmount).toLocaleString('cs-CZ')} CZK
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
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
          Cestovní náhrady a výdaje ({settlement.expenses.length})
        </button>
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'adjustments' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Bonusy, srážky a zálohy ({settlement.adjustments.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'logs' ? 'border-slate-950 text-slate-950 border-b-2 border-slate-950' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Historie stavů ({settlement.auditLogs.length})
        </button>
      </div>

      {/* Tab contents */}
      <section className="card overflow-x-auto min-h-[250px]">
        {/* TAB 1: WORK ITEMS */}
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
                    <th className="py-2 pr-3">Množství</th>
                    <th className="py-2 pr-3 text-right">Sazba</th>
                    <th className="py-2 text-right">Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.items.map((item) => (
                    <tr className="border-b last:border-0" key={item.id}>
                      <td className="py-3 pr-3 text-slate-600 whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-900">
                          {item.task?.title || item.description}
                        </div>
                        {item.note && <div className="text-xs text-slate-500 mt-0.5">Poznámka: {item.note}</div>}
                      </td>
                      <td className="py-3 pr-3 text-slate-600 whitespace-nowrap">
                        {item.quantity ? `${Number(item.quantity)} ${item.unit || ''}` : '-'}
                      </td>
                      <td className="py-3 pr-3 text-slate-600 text-right whitespace-nowrap font-mono">
                        {item.unitPrice ? `${Number(item.unitPrice).toLocaleString('cs-CZ')} Kč` : '-'}
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-900 whitespace-nowrap font-mono">
                        {Number(item.amount).toLocaleString('cs-CZ')} Kč
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: EXPENSES */}
        {activeTab === 'expenses' && (
          <div>
            <h3 className="text-lg font-bold mb-3">Výpis nahlášených výdajů</h3>
            {settlement.expenses.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">Žádné nahlášené výdaje v tomto období.</p>
            ) : (
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-3">Datum práce</th>
                    <th className="py-2 pr-3">Typ výdaje</th>
                    <th className="py-2 pr-3">Popis</th>
                    <th className="py-2 pr-3">Stav</th>
                    <th className="py-2 pr-3">Doklad</th>
                    <th className="py-2 text-right">Částka</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.expenses.map((exp) => (
                    <tr className="border-b last:border-0" key={exp.id}>
                      <td className="py-3 pr-3 text-slate-600 whitespace-nowrap">
                        {new Date(exp.workDate).toLocaleDateString('cs-CZ')}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                        {expenseTypeLabels[exp.type] || exp.type}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">
                        <div>{exp.description}</div>
                        {exp.rejectionReason && (
                          <div className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded-lg border border-red-100">
                            Důvod zamítnutí: <b>{exp.rejectionReason}</b>
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <span
                          className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                            exp.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : exp.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {expenseStatusLabels[exp.status] || exp.status}
                        </span>
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        {exp.receiptUrl ? (
                          <a
                            href={exp.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-blue-600 hover:underline"
                          >
                            Zobrazit účtenku ↗
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Bez dokladu</span>
                        )}
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-900 whitespace-nowrap font-mono">
                        {Number(exp.amount).toLocaleString('cs-CZ')} Kč
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: ADJUSTMENTS */}
        {activeTab === 'adjustments' && (
          <div>
            <h3 className="text-lg font-bold mb-3">Přehled bonusů, srážek a záloh</h3>
            {settlement.adjustments.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">Žádné korekce ani vyrovnání v tomto období.</p>
            ) : (
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
                  <tr>
                    <th className="py-2 pr-3">Datum zadání</th>
                    <th className="py-2 pr-3">Typ položky</th>
                    <th className="py-2 pr-3">Popis</th>
                    <th className="py-2 pr-3">Důvod</th>
                    <th className="py-2 text-right">Částka</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.adjustments.map((adj) => {
                    const isPositive =
                      adj.type === 'REIMBURSEMENT' || adj.type === 'BONUS' || adj.type === 'CARRY_OVER_ADD';
                    return (
                      <tr className="border-b last:border-0" key={adj.id}>
                        <td className="py-3 pr-3 text-slate-600 whitespace-nowrap">
                          {new Date(adj.createdAt).toLocaleDateString('cs-CZ')}
                        </td>
                        <td className="py-3 pr-3 font-semibold text-slate-900 whitespace-nowrap">
                          {adjustmentTypeLabels[adj.type] || adj.type}
                        </td>
                        <td className="py-3 pr-3 text-slate-700">{adj.description}</td>
                        <td className="py-3 pr-3 text-slate-500 italic">{adj.reason || '-'}</td>
                        <td
                          className={`py-3 text-right font-bold whitespace-nowrap font-mono ${
                            isPositive ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {isPositive ? '+' : '-'}{Number(adj.amount).toLocaleString('cs-CZ')} Kč
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 4: AUDIT LOG */}
        {activeTab === 'logs' && (
          <div>
            <h3 className="text-lg font-bold mb-3">Historie stavů a změn</h3>
            {settlement.auditLogs.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">Žádná historie změn v tomto vyúčtování.</p>
            ) : (
              <div className="space-y-4 py-2">
                {settlement.auditLogs.map((log) => (
                  <div className="flex gap-4 items-start border-l-2 border-slate-200 pl-4 py-1" key={log.id}>
                    <div className="text-xs font-semibold text-slate-400 font-mono whitespace-nowrap pt-0.5">
                      {new Date(log.createdAt).toLocaleString('cs-CZ')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {log.action === 'STATUS_CHANGE'
                          ? `Změna stavu na ${log.newValue}`
                          : log.action === 'ITEM_UPDATE'
                          ? 'Aktualizace položky práce'
                          : log.action === 'ADJUSTMENT_ADD'
                          ? 'Přidání korekce'
                          : log.action === 'ADJUSTMENT_DELETE'
                          ? 'Odstranění korekce'
                          : log.action}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Provedl: <b>{log.userName}</b>
                      </p>
                      <p className="text-xs text-slate-700 mt-1 bg-slate-100 px-3 py-1.5 rounded-lg border inline-block">
                        Zdůvodnění: <i>{log.reason}</i>
                      </p>
                    </div>
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
