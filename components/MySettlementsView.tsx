'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MonthlyEarningsOverview, MonthlySettlementRecord } from '@/components/MonthlyEarningsOverview';
import { MonthlyInvoiceModal } from '@/components/MonthlyInvoiceModal';
import { WorkStatisticsPanel } from '@/components/WorkStatisticsPanel';
import { dateOnly, money, StatusPill } from '@/lib/internal-format';

type MySettlementsViewProps = {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
  };
  settlements: Array<MonthlySettlementRecord & {
    note?: string | null;
  }>;
};

export function MySettlementsView({ employee, settlements }: MySettlementsViewProps) {
  const router = useRouter();
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);

  const latestSettlement = settlements[0];
  const statEntries = latestSettlement?.items
    ? latestSettlement.items.map((item) => ({
        quantity: item.quantity?.toString() ?? '0',
        unit: item.unit ?? null,
        remunerationMethod: item.rateType ?? null,
        rateType: item.rateType ?? null,
        calculatedAmount: item.amount.toString(),
        amount: item.amount.toString(),
        workType: item.workType ?? 'OTHER',
        carrierTypeLabel: null,
        taskTitle: null,
        description: item.description,
      }))
    : [];

  return (
    <div className="space-y-8">
      {/* 1. Monthly Earnings Overview & Annual Matrix */}
      <MonthlyEarningsOverview
        settlements={settlements}
        workerName={`${employee.firstName} ${employee.lastName}`}
        onRefresh={() => router.refresh()}
      />

      {/* 2. Active Period Task Breakdown Statistics */}
      {latestSettlement && statEntries.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              Podrobný rozpad prací za aktuální období
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              {dateOnly(new Date(latestSettlement.periodFrom))} – {dateOnly(new Date(latestSettlement.periodTo))}
            </span>
          </div>

          <WorkStatisticsPanel
            items={statEntries}
            financialExtras={{
              reimbursements: Number(latestSettlement.totalReimbursements) || 0,
              deductions: Number(latestSettlement.totalDeductions) || 0,
              advances: Number(latestSettlement.totalAdvances) || 0,
              finalPayable: Number(latestSettlement.finalPayableAmount) || 0,
            }}
            title={`Aktuální vyúčtování (${dateOnly(new Date(latestSettlement.periodFrom))} – ${dateOnly(new Date(latestSettlement.periodTo))})`}
          />
        </div>
      )}

      {/* 3. Comprehensive Period Table */}
      <section className="card">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Historie všech zúčtovacích období
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Přehled všech uzavřených i rozpracovaných měsíců s možností okamžitého zobrazení a tisku dokladu.
            </p>
          </div>
          <Link
            href="/my-work-entries"
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            + Zapsat práci
          </Link>
        </div>

        {settlements.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500 italic mb-3">
              Zatím nemáte žádné vygenerované vyúčtování. Jakmile zapíšete první práci nebo náklad, období se vytvoří automaticky.
            </p>
            <Link
              href="/my-work-entries"
              className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
            >
              Zapsat první práci
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="text-xs uppercase tracking-wide text-slate-500 border-b">
                <tr>
                  <th className="py-2.5 pr-3">Období</th>
                  <th className="py-2.5 pr-3">Stav</th>
                  <th className="py-2.5 pr-3">Položky</th>
                  <th className="py-2.5 pr-3 text-right">Za práci</th>
                  <th className="py-2.5 pr-3 text-right">Ostatní náklady</th>
                  <th className="py-2.5 pr-3 text-right">K výplatě</th>
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
                    <tr
                      key={settlement.id}
                      className="border-b last:border-0 hover:bg-slate-50/70 transition"
                    >
                      <td className="py-3 pr-3 font-semibold text-slate-900 whitespace-nowrap font-mono text-xs">
                        {dateOnly(new Date(settlement.periodFrom))} – {dateOnly(new Date(settlement.periodTo))}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <StatusPill value={settlement.status} />
                      </td>
                      <td className="py-3 pr-3 text-slate-500 whitespace-nowrap text-xs">
                        {settlement.items?.length || 0} položek
                      </td>
                      <td className="py-3 pr-3 text-right font-medium text-slate-700 whitespace-nowrap font-mono">
                        {money(Number(settlement.totalWorkAmount))}
                      </td>
                      <td
                        className={`py-3 pr-3 text-right font-medium whitespace-nowrap font-mono ${
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
                      <td className="py-3 pr-3 text-right font-bold text-slate-900 whitespace-nowrap font-mono">
                        {money(Number(settlement.finalPayableAmount))}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveInvoiceId(settlement.id)}
                            className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-sm"
                            title="Zobrazit fakturu a podklad k vyúčtování"
                          >
                            📄 Faktura
                          </button>
                          <Link
                            href={`/my-settlements/${settlement.id}`}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-sm"
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
          </div>
        )}
      </section>

      {/* Invoice Modal */}
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
