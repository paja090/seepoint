'use client';

import React from 'react';
import { computeWorkStatistics, type StatWorkItemInput } from '@/lib/work-entry-stats';

type WorkStatisticsPanelProps = {
  items: StatWorkItemInput[];
  title?: string;
  selectedActivity?: string;
  onSelectActivity?: (activity: string) => void;
  financialExtras?: {
    reimbursements: number;
    deductions: number;
    advances: number;
    finalPayable: number;
  };
};

export function WorkStatisticsPanel({
  items,
  title = 'Statistika práce a rozdělení podle úkolů',
  selectedActivity,
  onSelectActivity,
  financialExtras,
}: WorkStatisticsPanelProps) {
  const stats = computeWorkStatistics(items);

  return (
    <div className="space-y-4">
      {/* KPI Summary Cards */}
      <div className={`grid gap-3 sm:grid-cols-2 ${financialExtras ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              ⏱️ Hodinová práce
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
              {stats.totalHours.toLocaleString('cs-CZ')} hod
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {stats.totalHours.toLocaleString('cs-CZ')} <span className="text-sm font-semibold text-slate-500">hod</span>
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            Odměna: <strong className="text-slate-800">{stats.hourlyAmount.toLocaleString('cs-CZ')} Kč</strong>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              📦 Úkolová práce
            </span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
              {stats.totalTaskUnits.toLocaleString('cs-CZ')} ks
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {stats.totalTaskUnits.toLocaleString('cs-CZ')} <span className="text-sm font-semibold text-slate-500">ks / úkolů</span>
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            Odměna: <strong className="text-slate-800">{stats.taskAmount.toLocaleString('cs-CZ')} Kč</strong>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              💰 Cena za zakázku
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
              {stats.totalFixedJobs} zakázek
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {stats.fixedAmount.toLocaleString('cs-CZ')} <span className="text-sm font-semibold text-slate-500">Kč</span>
          </div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            Pevné sazby za hotové zakázky
          </div>
        </div>

        <div className="rounded-2xl border-2 border-slate-900 bg-slate-900 p-4 text-white shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              📊 Celkem za práci
            </span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-white">
              {stats.entriesCount} záznamů
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-white">
            {stats.totalWorkAmount.toLocaleString('cs-CZ')} <span className="text-sm font-semibold text-slate-300">Kč</span>
          </div>
          <div className="mt-1 text-xs text-slate-300">
            {stats.totalHours.toLocaleString('cs-CZ')} hod • {stats.totalTaskUnits.toLocaleString('cs-CZ')} ks • {stats.totalFixedJobs} zak.
          </div>
        </div>

        {financialExtras && (
          <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                💵 Čistá k výplatě
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">po nákladech</span>
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-950">
              {financialExtras.finalPayable.toLocaleString('cs-CZ')} <span className="text-sm font-semibold">Kč</span>
            </div>
            <div className="mt-1 text-[11px] font-medium text-emerald-800">
              Náhrady +{financialExtras.reimbursements.toLocaleString('cs-CZ')} • Srážky/Auto/Nájem -
              {(financialExtras.deductions + financialExtras.advances).toLocaleString('cs-CZ')} Kč
            </div>
          </div>
        )}
      </div>

      {/* Breakdown by Activity / Task */}
      {stats.byActivity.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">
                Přehled odpracovaných hodin, kusů a odměn podle jednotlivých činností (např. Instalace lavičky, Lepení billboardu, Montáž...).
              </p>
            </div>
            {selectedActivity && onSelectActivity && (
              <button
                type="button"
                onClick={() => onSelectActivity('')}
                className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Zobrazit všechny činnosti ({stats.entriesCount})
              </button>
            )}
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {stats.byActivity.map((row) => {
              const isSelected = selectedActivity === row.activity;
              return (
                <div
                  key={row.activity}
                  onClick={() => onSelectActivity && onSelectActivity(isSelected ? '' : row.activity)}
                  className={`rounded-xl border p-3 transition ${
                    onSelectActivity ? 'cursor-pointer' : ''
                  } ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900/5 ring-1 ring-slate-900'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-slate-900 text-sm leading-snug">{row.activity}</div>
                    <div className="whitespace-nowrap font-mono text-sm font-extrabold text-slate-900">
                      {row.totalAmount.toLocaleString('cs-CZ')} Kč
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="rounded bg-white px-2 py-0.5 font-medium border border-slate-200">
                      {row.entriesCount}× záznam
                    </span>
                    {row.hours > 0 && (
                      <span className="rounded bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 border border-blue-100">
                        ⏱️ {row.hours.toLocaleString('cs-CZ')} hod
                      </span>
                    )}
                    {row.taskUnits > 0 && (
                      <span className="rounded bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 border border-indigo-100">
                        📦 {row.taskUnits.toLocaleString('cs-CZ')} ks
                      </span>
                    )}
                    {row.fixedCount > 0 && (
                      <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 border border-amber-100">
                        💰 {row.fixedCount}× zakázka
                      </span>
                    )}
                    <span className="ml-auto text-[11px] font-semibold text-slate-400">
                      {row.sharePercent} %
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900 transition-all"
                      style={{ width: `${Math.min(100, Math.max(4, row.sharePercent))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
