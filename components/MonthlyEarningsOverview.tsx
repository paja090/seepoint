'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MonthlyInvoiceModal } from '@/components/MonthlyInvoiceModal';
import { StatusPill } from '@/lib/internal-format';

export type MonthlySettlementItem = {
  id: string;
  quantity?: number | string | null;
  unit?: string | null;
  rateType?: string | null;
  amount: number | string;
  workType?: string | null;
  description: string;
};

export type MonthlySettlementRecord = {
  id: string;
  periodYear: number;
  periodMonth: number;
  periodFrom: string | Date;
  periodTo: string | Date;
  status: string;
  totalWorkAmount: number | string;
  totalReimbursements: number | string;
  totalDeductions: number | string;
  totalAdvances: number | string;
  finalPayableAmount: number | string;
  items?: MonthlySettlementItem[];
  employeeId?: string;
  employeeName?: string;
};

type MonthlyEarningsOverviewProps = {
  settlements: MonthlySettlementRecord[];
  isManager?: boolean;
  workerName?: string;
  onRefresh?: () => void;
};

const MONTH_NAMES = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export function MonthlyEarningsOverview({
  settlements,
  isManager = false,
  workerName,
  onRefresh,
}: MonthlyEarningsOverviewProps) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();

  // Extract all distinct years available
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    settlements.forEach((s) => {
      if (s.periodYear) years.add(s.periodYear);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [settlements, currentYear]);

  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] || currentYear);
  const [activeInvoiceSettlementId, setActiveInvoiceSettlementId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Filter settlements for the selected year
  const yearSettlements = useMemo(() => {
    return settlements.filter((s) => s.periodYear === selectedYear);
  }, [settlements, selectedYear]);

  // Map of month 1-12 to settlement
  const settlementsByMonth = useMemo(() => {
    const map = new Map<number, MonthlySettlementRecord>();
    yearSettlements.forEach((s) => {
      map.set(s.periodMonth, s);
    });
    return map;
  }, [yearSettlements]);

  // Aggregate year statistics
  const yearStats = useMemo(() => {
    let totalEarnings = 0;
    let totalWork = 0;
    let totalReimb = 0;
    let totalDeduct = 0;
    let totalAdv = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalHours = 0;
    let totalTasks = 0;
    let activeMonthsCount = 0;

    yearSettlements.forEach((s) => {
      const payable = Number(s.finalPayableAmount) || 0;
      totalEarnings += payable;
      totalWork += Number(s.totalWorkAmount) || 0;
      totalReimb += Number(s.totalReimbursements) || 0;
      totalDeduct += Number(s.totalDeductions) || 0;
      totalAdv += Number(s.totalAdvances) || 0;

      if (s.status === 'PAID') {
        totalPaid += payable;
      } else {
        totalPending += payable;
      }

      if (payable > 0 || (s.items && s.items.length > 0)) {
        activeMonthsCount++;
      }

      if (s.items) {
        s.items.forEach((item) => {
          const qty = Number(item.quantity) || 0;
          const u = (item.unit || '').toLowerCase();
          if (item.rateType === 'HOURLY' || u === 'hod' || u === 'h' || u === 'hodina' || u === 'hodiny') {
            totalHours += qty;
          } else {
            totalTasks += qty;
          }
        });
      }
    });

    const averagePerMonth = activeMonthsCount > 0 ? Math.round(totalEarnings / activeMonthsCount) : 0;
    const netOtherCosts = totalReimb - totalDeduct - totalAdv;

    return {
      totalEarnings,
      totalWork,
      totalReimb,
      totalDeduct,
      totalAdv,
      netOtherCosts,
      totalPaid,
      totalPending,
      totalHours,
      totalTasks,
      activeMonthsCount,
      averagePerMonth,
    };
  }, [yearSettlements]);

  // Maximum monthly earnings for chart scaling
  const maxMonthEarnings = useMemo(() => {
    let max = 1000;
    yearSettlements.forEach((s) => {
      const amt = Number(s.finalPayableAmount) || 0;
      if (amt > max) max = amt;
    });
    return max;
  }, [yearSettlements]);

  const handle1ClickCloseMonth = async (settlementId: string, monthName: string) => {
    if (!confirm(`Opravdu chcete provést měsíční uzávěrku za měsíc ${monthName} ${selectedYear} a vystavit doklad vyúčtování?`)) {
      return;
    }
    setClosingId(settlementId);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`/api/settlements/${settlementId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closeMonth: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uzávěrka selhala.');
      setMessage(`Měsíční uzávěrka za ${monthName} byla úspěšně dokončena!`);
      if (onRefresh) {
        onRefresh();
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při uzávěrce.');
    } finally {
      setClosingId(null);
    }
  };

  return (
    <section className="space-y-6">
      {/* Top Header & Year Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <span>📅</span> Roční a měsíční přehled výdělků
          </div>
          <h2 className="text-2xl font-black mt-1">
            Kolik jsem vydělal v roce {selectedYear}
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            {workerName ? `Pracovník: ${workerName} • ` : ''}
            Měsíční bilance, odpracované hodiny, úkolové montáže a vyúčtování.
          </p>
        </div>

        {/* Year Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700">
          <span className="text-[11px] text-slate-400 font-semibold px-2">Rok:</span>
          {availableYears.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setSelectedYear(yr)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                selectedYear === yr
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Annual Summary KPI Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Total Annual Earnings */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm col-span-2 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Celkový výdělek za rok {selectedYear}
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono mt-1">
              {yearStats.totalEarnings.toLocaleString('cs-CZ')} Kč
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Aktivních měsíců: <strong>{yearStats.activeMonthsCount} z 12</strong></span>
            <span>Průměr: <strong className="font-mono text-slate-800">{yearStats.averagePerMonth.toLocaleString('cs-CZ')} Kč/měs</strong></span>
          </div>
        </div>

        {/* Total Hours */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              ⏱️ Odpracováno
            </div>
            <div className="text-2xl font-black text-blue-600 font-mono mt-1">
              {yearStats.totalHours.toLocaleString('cs-CZ')} <span className="text-sm font-semibold text-slate-500">h</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Hodinová mzda: {yearStats.totalWork.toLocaleString('cs-CZ')} Kč
          </div>
        </div>

        {/* Total Tasks */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              🎯 Úkolové montáže
            </div>
            <div className="text-2xl font-black text-purple-600 font-mono mt-1">
              {yearStats.totalTasks.toLocaleString('cs-CZ')} <span className="text-sm font-semibold text-slate-500">ks</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Lavičky, billboardy, polepy
          </div>
        </div>

        {/* Other Costs / Net Adjustments */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              🚗 Ostatní náklady
            </div>
            <div className={`text-2xl font-black font-mono mt-1 ${yearStats.netOtherCosts < 0 ? 'text-red-600' : yearStats.netOtherCosts > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {yearStats.netOtherCosts > 0 ? '+' : ''}{yearStats.netOtherCosts.toLocaleString('cs-CZ')} <span className="text-sm font-semibold">Kč</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Auto, telefon, nájem, palivo
          </div>
        </div>

        {/* Paid vs Pending */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              💳 Stav výplat
            </div>
            <div className="text-xs space-y-1 mt-1.5">
              <div className="flex justify-between font-mono">
                <span className="text-teal-700 font-semibold">Vyplaceno:</span>
                <strong className="text-slate-900">{yearStats.totalPaid.toLocaleString('cs-CZ')} Kč</strong>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-amber-700 font-semibold">K výplatě:</span>
                <strong className="text-slate-900">{yearStats.totalPending.toLocaleString('cs-CZ')} Kč</strong>
              </div>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-teal-500 h-1.5 rounded-full"
              style={{
                width: `${yearStats.totalEarnings > 0 ? Math.round((yearStats.totalPaid / yearStats.totalEarnings) * 100) : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Visual Monthly Progress / Bar Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            📊 Vývoj výdělku v jednotlivých měsících ({selectedYear})
          </h3>
          <span className="text-[11px] text-slate-400">
            Výška sloupce odpovídá výši výdělku v daném měsíci
          </span>
        </div>

        <div className="grid grid-cols-12 gap-1.5 sm:gap-2 items-end h-32 pt-4 pb-2 border-b border-slate-100">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((monthNum) => {
            const settlement = settlementsByMonth.get(monthNum);
            const payable = settlement ? Number(settlement.finalPayableAmount) : 0;
            const heightPercent = maxMonthEarnings > 0 && payable > 0
              ? Math.max(12, Math.round((payable / maxMonthEarnings) * 100))
              : 6;

            const isCurrentMonth = new Date().getMonth() + 1 === monthNum && new Date().getFullYear() === selectedYear;

            return (
              <div key={monthNum} className="flex flex-col items-center h-full justify-end group relative">
                {/* Tooltip on hover */}
                {payable > 0 && (
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition duration-150 rounded bg-slate-900 text-white text-[9px] px-1.5 py-0.5 whitespace-nowrap pointer-events-none z-10 font-mono">
                    {payable.toLocaleString('cs-CZ')} Kč
                  </div>
                )}

                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    payable === 0
                      ? 'bg-slate-100'
                      : settlement?.status === 'PAID'
                        ? 'bg-teal-500 hover:bg-teal-600'
                        : settlement?.status === 'LOCKED'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                  } ${isCurrentMonth ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
                  style={{ height: `${heightPercent}%` }}
                />

                <span className={`text-[10px] mt-1.5 font-bold ${isCurrentMonth ? 'text-blue-600 font-black' : 'text-slate-500'}`}>
                  {MONTH_NAMES[monthNum - 1].slice(0, 3)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 12 Monthly Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Měsíční karty vyúčtování ({selectedYear})
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500" /> Rozpracováno/Odesláno
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-600 ml-2" /> Uzavřeno
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-teal-500 ml-2" /> Vyplaceno
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((monthNum) => {
            const monthName = MONTH_NAMES[monthNum - 1];
            const settlement = settlementsByMonth.get(monthNum);
            const isCurrentMonth = new Date().getMonth() + 1 === monthNum && new Date().getFullYear() === selectedYear;

            if (!settlement) {
              return (
                <div
                  key={monthNum}
                  className={`rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4.5 flex flex-col justify-between transition hover:border-slate-300 ${
                    isCurrentMonth ? 'ring-2 ring-blue-500/20 bg-blue-50/30' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                        {String(monthNum).padStart(2, '0')} • {monthName}
                      </span>
                      {isCurrentMonth && (
                        <span className="rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                          Tento měsíc
                        </span>
                      )}
                    </div>
                    <div className="text-xl font-bold text-slate-300 font-mono mt-2">
                      0 Kč
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Žádná zapsaná práce v tomto měsíci.
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
                    <Link
                      href="/my-work-entries"
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 transition inline-flex items-center gap-1"
                    >
                      + Zapsat práci →
                    </Link>
                  </div>
                </div>
              );
            }

            const payable = Number(settlement.finalPayableAmount) || 0;
            const workAmt = Number(settlement.totalWorkAmount) || 0;
            const netOther = (Number(settlement.totalReimbursements) || 0) -
              (Number(settlement.totalDeductions) || 0) -
              (Number(settlement.totalAdvances) || 0);

            // Compute items count
            let hours = 0;
            let tasks = 0;
            if (settlement.items) {
              settlement.items.forEach((item) => {
                const qty = Number(item.quantity) || 0;
                const u = (item.unit || '').toLowerCase();
                if (item.rateType === 'HOURLY' || u === 'hod' || u === 'h' || u === 'hodina' || u === 'hodiny') {
                  hours += qty;
                } else {
                  tasks += qty;
                }
              });
            }

            const isOpen = settlement.status === 'DRAFT' || settlement.status === 'REJECTED';
            const detailHref = isManager
              ? `/settlements/${settlement.id}`
              : `/my-settlements/${settlement.id}`;

            return (
              <div
                key={monthNum}
                className={`rounded-2xl border bg-white p-4.5 shadow-sm flex flex-col justify-between transition hover:shadow-md ${
                  settlement.status === 'PAID'
                    ? 'border-teal-200'
                    : settlement.status === 'LOCKED'
                      ? 'border-purple-200'
                      : 'border-slate-200'
                } ${isCurrentMonth ? 'ring-2 ring-blue-500/30' : ''}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {String(monthNum).padStart(2, '0')} • {monthName}
                    </span>
                    <StatusPill value={settlement.status} />
                  </div>

                  <div className="mt-2.5">
                    <div className="text-2xl font-black text-slate-900 font-mono">
                      {payable.toLocaleString('cs-CZ')} Kč
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      {hours > 0 && <span>⏱️ <b>{hours} h</b></span>}
                      {tasks > 0 && <span>🎯 <b>{tasks} úkolů</b></span>}
                      {netOther !== 0 && (
                        <span className={netOther > 0 ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {netOther > 0 ? '+' : ''}{netOther.toLocaleString('cs-CZ')} Kč
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveInvoiceSettlementId(settlement.id)}
                      className="flex-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition text-center shadow-sm"
                    >
                      📄 Faktura / Doklad
                    </button>
                    <Link
                      href={detailHref}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                      title="Podrobný rozpis"
                    >
                      Detail
                    </Link>
                  </div>

                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => handle1ClickCloseMonth(settlement.id, monthName)}
                      disabled={closingId === settlement.id}
                      className="w-full rounded-xl bg-purple-50 text-purple-800 border border-purple-200 px-3 py-1.5 text-[11px] font-bold hover:bg-purple-100 transition disabled:opacity-50 text-center"
                    >
                      {closingId === settlement.id ? 'Uzavírám...' : '🔒 Uzavřít měsíc a vyúčtovat'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice Modal Popup */}
      {activeInvoiceSettlementId && (
        <MonthlyInvoiceModal
          settlementId={activeInvoiceSettlementId}
          onClose={() => setActiveInvoiceSettlementId(null)}
          onSettlementUpdated={() => {
            if (onRefresh) {
              onRefresh();
            } else {
              router.refresh();
            }
          }}
        />
      )}
    </section>
  );
}
