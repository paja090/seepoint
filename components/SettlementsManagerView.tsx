'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MonthlyInvoiceModal } from '@/components/MonthlyInvoiceModal';
import { MonthlyEarningsOverview, MonthlySettlementRecord } from '@/components/MonthlyEarningsOverview';
import { dateOnly, money, StatusPill } from '@/lib/internal-format';

type ManagerSettlementRow = MonthlySettlementRecord & {
  employee: {
    firstName: string;
    lastName: string;
    email?: string | null;
  };
};

type SettlementsManagerViewProps = {
  settlements: ManagerSettlementRow[];
  filterEmployee?: string;
};

export function SettlementsManagerView({ settlements, filterEmployee }: SettlementsManagerViewProps) {
  const router = useRouter();
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [showMonthlyMatrix, setShowMonthlyMatrix] = useState(Boolean(filterEmployee));

  return (
    <div className="space-y-6">
      {/* Toggle Monthly Overview */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowMonthlyMatrix(!showMonthlyMatrix)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
        >
          <span>{showMonthlyMatrix ? '🔼 Skrýt' : '📅 Zobrazit'}</span>
          <span>Měsíční přehled výdělků a uzávěrek</span>
          {filterEmployee && <span className="rounded bg-blue-100 text-blue-800 px-1.5 py-0.5 text-[10px]">({filterEmployee})</span>}
        </button>

        <span className="text-xs text-slate-500 font-mono">
          Celkem nalezeno: <b>{settlements.length}</b> vyúčtování
        </span>
      </div>

      {showMonthlyMatrix && (
        <MonthlyEarningsOverview
          settlements={settlements}
          isManager={true}
          workerName={filterEmployee || undefined}
          onRefresh={() => router.refresh()}
        />
      )}

      {/* Settlements Table */}
      <section className="card overflow-x-auto">
        <div className="mb-3 flex justify-between items-center border-b pb-3">
          <h2 className="text-lg font-bold text-slate-900">Seznam všech vyúčtování</h2>
          <p className="text-xs text-slate-500">Zobrazeno {settlements.length} záznamů</p>
        </div>

        {settlements.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500 italic">Zatím není evidované žádné vyúčtování pro zadaný filtr.</p>
        ) : (
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
              <tr>
                <th className="py-2.5 pr-3">Zaměstnanec</th>
                <th className="py-2.5 pr-3">Období</th>
                <th className="py-2.5 pr-3">Stav</th>
                <th className="py-2.5 pr-3 text-right">Za práci</th>
                <th className="py-2.5 pr-3 text-right">Ostatní náklady</th>
                <th className="py-2.5 pr-3 text-right">K výplatě</th>
                <th className="py-2.5 pr-3">Položky</th>
                <th className="py-2.5 text-right">Doklad & Akce</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((settlement) => {
                const netAdj =
                  Number(settlement.totalReimbursements) -
                  Number(settlement.totalDeductions) -
                  Number(settlement.totalAdvances);

                return (
                  <tr className="border-b last:border-0 hover:bg-slate-50/60 transition" key={settlement.id}>
                    <td className="py-3 pr-3 font-semibold text-slate-900">
                      {settlement.employee.firstName} {settlement.employee.lastName}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-xs font-mono text-slate-600">
                      {dateOnly(new Date(settlement.periodFrom))} – {dateOnly(new Date(settlement.periodTo))}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap">
                      <StatusPill value={settlement.status} />
                    </td>
                    <td className="py-3 pr-3 text-right font-medium text-slate-700 font-mono">
                      {money(Number(settlement.totalWorkAmount))}
                    </td>
                    <td
                      className={`py-3 pr-3 text-right font-medium font-mono whitespace-nowrap ${
                        netAdj < 0
                          ? 'text-red-600'
                          : netAdj > 0
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {netAdj === 0
                        ? '0 Kč'
                        : `${netAdj > 0 ? '+' : ''}${netAdj.toLocaleString('cs-CZ')} Kč`}
                    </td>
                    <td className="py-3 pr-3 text-right font-black text-slate-900 font-mono">
                      {money(Number(settlement.finalPayableAmount))}
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-500 whitespace-nowrap">
                      {settlement.items?.length || 0} položek
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveInvoiceId(settlement.id)}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 transition shadow-sm"
                          title="Zobrazit fakturu / měsíční doklad"
                        >
                          📄 Faktura
                        </button>
                        <Link
                          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
                          href={`/settlements/${settlement.id}`}
                        >
                          Detail
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Invoice Modal for Manager */}
      {activeInvoiceId && (
        <MonthlyInvoiceModal
          settlementId={activeInvoiceId}
          onClose={() => setActiveInvoiceId(null)}
          onSettlementUpdated={() => router.refresh()}
        />
      )}
    </div>
  );
}
