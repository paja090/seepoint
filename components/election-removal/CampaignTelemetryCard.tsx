import React from 'react';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Zap,
  Info,
} from 'lucide-react';
import type { CampaignTelemetryReport } from '@/lib/election-removal/ai-telemetry';
import { ELECTION_REMOVAL_OPERATION_LABELS } from '@/lib/election-removal/constants';

interface CampaignTelemetryCardProps {
  report: CampaignTelemetryReport;
}

export function CampaignTelemetryCard({ report }: CampaignTelemetryCardProps) {
  const hasData = report.totalCompletedWithTimes > 0;
  const isFaster = report.totalDiffMinutes > 0;
  const isSlower = report.totalDiffMinutes < 0;

  return (
    <div className="card p-6 space-y-5 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/20 border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-600 text-white shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              AI Telemetrie a kalibrace norem
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                Plán vs. Realita
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Učení z reálných časů posádek v terénu pro zpřesnění budoucího plánování
            </p>
          </div>
        </div>

        {hasData && (
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${
                isFaster
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : isSlower
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {isFaster ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              ) : isSlower ? (
                <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-slate-500" />
              )}
              Efektivita: {report.efficiencyPercent} %
            </span>
          </div>
        )}
      </div>

      {/* AI Narrative Insight Box */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/80 to-sky-50/60 border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-indigo-900">
          <Zap className="w-4 h-4 text-indigo-600" />
          <span>Vyhodnocení AI asistenta:</span>
        </div>
        <p className="leading-relaxed text-slate-700">{report.aiSummary}</p>
      </div>

      {/* KPI Stats Grid */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Naměřeno úkonů
            </span>
            <span className="text-xl font-bold text-slate-900 mt-0.5 block">
              {report.totalCompletedWithTimes} ks
            </span>
            <span className="text-[10px] text-slate-400">s časem start-cíl</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Plánovaný čas
            </span>
            <span className="text-xl font-bold text-slate-700 mt-0.5 block">
              {report.totalPlannedMinutes} min
            </span>
            <span className="text-[10px] text-slate-400">dle výchozích tabulek</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Skutečný čas
            </span>
            <span className="text-xl font-bold text-indigo-600 mt-0.5 block">
              {report.totalActualMinutes} min
            </span>
            <span className="text-[10px] text-slate-400">naměřeno stopkami</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Časový rozdíl
            </span>
            <span
              className={`text-xl font-bold mt-0.5 block ${
                isFaster
                  ? 'text-emerald-600'
                  : isSlower
                  ? 'text-amber-600'
                  : 'text-slate-800'
              }`}
            >
              {isFaster
                ? `-${report.totalDiffMinutes} min`
                : isSlower
                ? `+${Math.abs(report.totalDiffMinutes)} min`
                : '0 min'}
            </span>
            <span className="text-[10px] text-slate-400">
              {isFaster ? 'Úspora času týmu' : isSlower ? 'Zpoždění oproti plánu' : 'Dle plánu'}
            </span>
          </div>
        </div>
      )}

      {/* Telemetry Breakdown Table */}
      {hasData && report.aggregates.length > 0 && (
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
            Empirické časy podle typu média a operace
          </h4>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5">Médium a operace</th>
                  <th className="px-3 py-2.5 text-center">Vzorků</th>
                  <th className="px-3 py-2.5 text-right">Původní plán</th>
                  <th className="px-3 py-2.5 text-right">Skutečnost (medián)</th>
                  <th className="px-3 py-2.5 text-right">Rozdíl</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-indigo-700">
                    AI Kalibrovaná norma
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {report.aggregates.map((agg, idx) => {
                  const diff = agg.plannedMinutesAvg - agg.actualMinutesMedian;
                  const isSaved = diff > 0;
                  const isDelay = diff < 0;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="px-3.5 py-2.5">
                        <span className="font-bold text-slate-900 block">
                          {agg.mediaLabel}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {ELECTION_REMOVAL_OPERATION_LABELS[agg.operationType] || agg.operationType}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-center font-mono">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {agg.completedCount}×
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                        {agg.plannedMinutesAvg} min
                      </td>

                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                        {agg.actualMinutesMedian} min
                      </td>

                      <td className="px-3 py-2.5 text-right font-mono">
                        <span
                          className={`inline-flex items-center gap-0.5 font-bold ${
                            isSaved
                              ? 'text-emerald-600'
                              : isDelay
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {isSaved
                            ? `-${Math.abs(diff).toFixed(1)} min`
                            : isDelay
                            ? `+${Math.abs(diff).toFixed(1)} min`
                            : '0 min'}
                        </span>
                      </td>

                      <td className="px-3.5 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold font-mono text-xs">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          {agg.recommendedServiceMinutes} min / ks
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State Banner if no jobs timed yet */}
      {!hasData && (
        <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-600 flex items-start gap-3">
          <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">
              Jak funguje měření a AI učení v terénu:
            </p>
            <p className="text-slate-500 leading-relaxed">
              Když posádka v mobilním rozhraní klikne na tlačítko <strong>„Zahájit na místě“</strong> a po dokončení na <strong>„Demontováno (Hotovo)“</strong>, systém automaticky zaznamená přesnou dobu práce. AI z těchto dat odstraní odlehlé hodnoty a spočítá reálný medián pro každý typ média (Áčko, MiniTower, Velká věž, Výměna plachty). Tyto kalibrované hodnoty se pak automaticky nabídnou dispečerovi při plánování dalších tras.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
