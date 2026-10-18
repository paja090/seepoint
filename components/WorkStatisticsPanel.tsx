'use client';

import React, { useState } from 'react';
import {
  computeWorkStatistics,
  type StatWorkItemInput,
  type CategoryBreakdownRow,
} from '@/lib/work-entry-stats';

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
  title = 'Statistika práce a rozdělení podle činností',
  selectedActivity,
  onSelectActivity,
  financialExtras,
}: WorkStatisticsPanelProps) {
  const stats = computeWorkStatistics(items);
  const [viewMode, setViewMode] = useState<'CATEGORY' | 'ACTIVITY'>('CATEGORY');
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>(null);

  const toggleCategoryExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategoryKey((prev) => (prev === key ? null : key));
  };

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

      {/* Breakdown Section: Toggle between Categories (Navigace, Lavičky, Billboardy...) and Activities */}
      {(stats.byCategory.length > 0 || stats.byActivity.length > 0) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {viewMode === 'CATEGORY'
                  ? 'Sjednocený přehled odměn podle kategorií médií (Navigace, Lavičky, Billboardy, CLV, Výlep...).'
                  : 'Přehled odpracovaných hodin, kusů a odměn podle jednotlivých konkrétních činností a úkolů.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle Switch */}
              <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewMode('CATEGORY')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === 'CATEGORY'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🏷️</span> Sjednocené kategorie ({stats.byCategory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('ACTIVITY')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    viewMode === 'ACTIVITY'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>📝</span> Konkrétní činnosti ({stats.byActivity.length})
                </button>
              </div>

              {selectedActivity && onSelectActivity && (
                <button
                  type="button"
                  onClick={() => onSelectActivity('')}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Zrušit filtr ({stats.entriesCount})
                </button>
              )}
            </div>
          </div>

          {/* 1. Categorized View (Navigace, Lavičky, Billboardy...) */}
          {viewMode === 'CATEGORY' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.byCategory.map((cat: CategoryBreakdownRow) => {
                const isExpanded = expandedCategoryKey === cat.key;
                const hasMatchingSelectedActivity = cat.activities.some((a) => a.name === selectedActivity);

                return (
                  <div
                    key={cat.key}
                    className={`rounded-xl border p-3.5 transition flex flex-col justify-between ${
                      hasMatchingSelectedActivity
                        ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      {/* Category Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl" role="img" aria-label={cat.label}>
                            {cat.icon}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 text-sm leading-snug">
                              {cat.label}
                            </div>
                            <div className="text-[11px] font-medium text-slate-400">
                              {cat.entriesCount} {cat.entriesCount === 1 ? 'záznam' : cat.entriesCount < 5 ? 'záznamy' : 'záznamů'}
                              {' · '}
                              {cat.activities.length} {cat.activities.length === 1 ? 'činnost' : cat.activities.length < 5 ? 'činnosti' : 'činností'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="whitespace-nowrap font-mono text-base font-extrabold text-slate-900">
                            {cat.totalAmount.toLocaleString('cs-CZ')} Kč
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400">
                            {cat.sharePercent} % z celku
                          </div>
                        </div>
                      </div>

                      {/* Work Metric Badges */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                        {cat.hours > 0 && (
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 border border-blue-100">
                            ⏱️ {cat.hours.toLocaleString('cs-CZ')} hod
                          </span>
                        )}
                        {cat.taskUnits > 0 && (
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700 border border-indigo-100">
                            📦 {cat.taskUnits.toLocaleString('cs-CZ')} ks
                          </span>
                        )}
                        {cat.fixedCount > 0 && (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 border border-amber-100">
                            💰 {cat.fixedCount}× zakázka
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-slate-800 transition-all"
                          style={{ width: `${Math.min(100, Math.max(5, cat.sharePercent))}%` }}
                        />
                      </div>

                      {/* Included Activities Breakdown */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                          <span>Zahrnuté úkoly v kategorii:</span>
                          {cat.activities.length > 2 && (
                            <button
                              type="button"
                              onClick={(e) => toggleCategoryExpand(cat.key, e)}
                              className="text-blue-600 hover:text-blue-800 font-bold"
                            >
                              {isExpanded ? 'Sbalit' : `+${cat.activities.length - 2} další`}
                            </button>
                          )}
                        </div>

                        <div className="space-y-1">
                          {(isExpanded ? cat.activities : cat.activities.slice(0, 2)).map((sub) => {
                            const isSubSelected = selectedActivity === sub.name;
                            return (
                              <div
                                key={sub.name}
                                onClick={() => onSelectActivity && onSelectActivity(isSubSelected ? '' : sub.name)}
                                className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] transition ${
                                  onSelectActivity ? 'cursor-pointer' : ''
                                } ${
                                  isSubSelected
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'bg-white text-slate-700 border border-slate-200/60 hover:border-slate-300'
                                }`}
                                title={onSelectActivity ? `Filtrovat podle: ${sub.name}` : undefined}
                              >
                                <span className="truncate pr-2">{sub.name}</span>
                                <span className="whitespace-nowrap font-mono font-medium">
                                  {sub.entriesCount}× · {sub.amount.toLocaleString('cs-CZ')} Kč
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. Detailed Activity View (Existing itemized breakdown) */}
          {viewMode === 'ACTIVITY' && (
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
          )}
        </section>
      )}
    </div>
  );
}

