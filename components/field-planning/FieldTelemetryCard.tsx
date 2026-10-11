'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Clock,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Plus,
  Trash2,
  ShieldAlert,
  Tag,
} from 'lucide-react';
import type { OrganizationFieldTelemetryReport } from '@/lib/field-planning/ai-telemetry';

interface FieldTelemetryCardProps {
  onProfileUpdated?: () => void;
  compact?: boolean;
}

export function FieldTelemetryCard({ onProfileUpdated, compact = false }: FieldTelemetryCardProps) {
  const [report, setReport] = useState<OrganizationFieldTelemetryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Custom activity form state
  const [selectedCategory, setSelectedCategory] = useState<string>('Vše');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMinutes, setNewMinutes] = useState(20);
  const [newCategory, setNewCategory] = useState('Vlastní činnosti');
  const [busyAction, setBusyAction] = useState(false);

  const fetchTelemetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/field-planning/telemetry');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se načíst telemetrii.');
      }
      setReport(data.report);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při načítání dat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const handleApplyCalibration = async () => {
    if (!report?.recommendedCalibration) return;
    setApplying(true);
    setError(null);
    setAppliedSuccess(false);

    try {
      const res = await fetch('/api/field-planning/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calibration: report.recommendedCalibration,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Aplikace kalibrace selhala.');
      }

      setAppliedSuccess(true);
      if (onProfileUpdated) {
        onProfileUpdated();
      }
      await fetchTelemetry();
      setTimeout(() => setAppliedSuccess(false), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání kalibrace.');
    } finally {
      setApplying(false);
    }
  };

  const handleAddCustomActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusyAction(true);
    setError(null);
    try {
      const res = await fetch('/api/field-planning/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addCustomActivity',
          label: newLabel.trim(),
          defaultMinutes: Number(newMinutes) || 20,
          category: newCategory.trim() || 'Vlastní činnosti',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Nepodařilo se přidat úkol.');
      setNewLabel('');
      setNewMinutes(20);
      setIsAddFormOpen(false);
      if (onProfileUpdated) onProfileUpdated();
      await fetchTelemetry();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání úkolu.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteCustomActivity = async (key: string) => {
    if (!confirm('Opravdu chcete tuto vlastní činnost odstranit z katalogu?')) return;
    setBusyAction(true);
    setError(null);
    try {
      const res = await fetch('/api/field-planning/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteCustomActivity',
          key,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Nepodařilo se smazat úkol.');
      if (onProfileUpdated) onProfileUpdated();
      await fetchTelemetry();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při mazání úkolu.');
    } finally {
      setBusyAction(false);
    }
  };

  const categories = useMemo(() => {
    if (!report) return ['Vše'];
    const cats = new Set<string>();
    report.aggregates.forEach((a) => {
      if (a.category) cats.add(a.category);
    });
    return ['Vše', ...Array.from(cats)];
  }, [report]);

  const filteredAggregates = useMemo(() => {
    if (!report) return [];
    if (selectedCategory === 'Vše') return report.aggregates;
    return report.aggregates.filter((a) => a.category === selectedCategory);
  }, [report, selectedCategory]);

  if (loading) {
    return (
      <div className="card p-6 flex items-center justify-center gap-3 text-slate-500 bg-white border border-slate-200">
        <RefreshCw className="w-5 h-5 animate-spin text-sky-600" />
        <span className="text-xs font-semibold">Analyzuji telemetrická data posádek v terénu...</span>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="card p-5 bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={fetchTelemetry}
          className="text-rose-900 font-bold underline text-xs"
        >
          Zkusit znovu
        </button>
      </div>
    );
  }

  if (!report) return null;

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
              Katalog činností SeePoint & Kalibrace norem
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                AI Telemetrie
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Přesné měření časů pro konkrétní SeePoint činnosti (lavičky, billboardy, horizonty, věže, navigace, svozy).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasData && (
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
              Efektivita: {report.overallEfficiencyPercent} %
            </span>
          )}

          <button
            type="button"
            onClick={fetchTelemetry}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 bg-white cursor-pointer"
            title="Aktualizovat data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsAddFormOpen(!isAddFormOpen)}
            className="btn bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold py-2 px-3 rounded-xl shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-sky-600" />
            <span>Přidat vlastní úkol</span>
          </button>

          {hasData && (
            <button
              type="button"
              disabled={applying}
              onClick={handleApplyCalibration}
              className="btn bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-sm inline-flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {applying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sliders className="w-3.5 h-3.5" />
              )}
              <span>Aplikovat AI kalibraci do profilu</span>
            </button>
          )}
        </div>
      </div>

      {/* Applied Success Notification */}
      {appliedSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Nové empirické normy byly úspěšně uloženy do profilu plánování výjezdů vaší organizace!
          </span>
        </div>
      )}

      {/* Add Custom Activity Drawer */}
      {isAddFormOpen && (
        <form
          onSubmit={handleAddCustomActivity}
          className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 space-y-3 animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-sky-600" />
              <span>Přidat novou činnost do katalogu SeePoint</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsAddFormOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Zavřít
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Název činnosti (např. Nátěr konstrukce, Výlep A1)
              </label>
              <input
                type="text"
                required
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Název úkolu…"
                className="input w-full text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Výchozí norma plánování (min)
              </label>
              <input
                type="number"
                min={1}
                max={480}
                required
                value={newMinutes}
                onChange={(e) => setNewMinutes(Number(e.target.value))}
                className="input w-full text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Kategorie
              </label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="např. Údržba, Výlepy, Lavičky…"
                className="input w-full text-xs font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddFormOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white rounded-lg transition cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={busyAction}
              className="px-4 py-1.5 text-xs font-bold bg-sky-700 hover:bg-sky-600 text-white rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {busyAction ? 'Ukládám…' : 'Uložit do katalogu norem'}
            </button>
          </div>
        </form>
      )}

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
            <span className="text-[10px] text-slate-400">s reálným časem v terénu</span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 block">
              Původní plán
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
            <span className="text-[10px] text-slate-400">naměřeno posádkami</span>
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

          {/* Ignored Too Fast Warning Banner */}
          {report.ignoredTooFastCount > 0 && (
            <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900 col-span-2 sm:col-span-4 flex items-center gap-2 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Vyřazeno {report.ignoredTooFastCount} úkonů s časem &lt; 1 min</strong>: pracovník pravděpodobně zapomněl včas kliknout na „Zahájit práci“ a označil úkol ihned jako hotový. Tyto odchylky systém automaticky vyřadil z výpočtu, aby nezkreslovaly průměrné normy.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1 pr-1 shrink-0">
          <Tag size={12} />
          Kategorie:
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Telemetry Breakdown Table */}
      {filteredAggregates.length > 0 && !compact && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
              Katalog činností SeePoint ({filteredAggregates.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              Zobrazeno pro organizaci SeePoint
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5">Činnost / Typ práce</th>
                  <th className="px-3 py-2.5">Kategorie</th>
                  <th className="px-3 py-2.5 text-center">Vzorků</th>
                  <th className="px-3 py-2.5 text-right">Současná norma</th>
                  <th className="px-3 py-2.5 text-right">Skutečnost (medián)</th>
                  <th className="px-3 py-2.5 text-right">Odchylka</th>
                  <th className="px-3.5 py-2.5 text-right font-bold text-indigo-700">
                    AI Kalibrovaná norma
                  </th>
                  <th className="px-2 py-2.5 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredAggregates.map((agg, idx) => {
                  const hasSamples = agg.completedCount > 0;
                  const diff = agg.currentProfileMinutes - agg.actualMinutesMedian;
                  const isSaved = diff > 0 && hasSamples;
                  const isDelay = diff < 0 && hasSamples;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition">
                      <td className="px-3.5 py-2.5">
                        <span className="font-bold text-slate-900 block">
                          {agg.workTypeLabel}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {agg.workType}
                        </span>
                      </td>

                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {agg.category || 'Ostatní'}
                        </span>
                      </td>

                      <td className="px-3 py-2.5 text-center font-mono">
                        {hasSamples ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                            {agg.completedCount}×
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">–</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right font-mono text-slate-600 font-medium">
                        {agg.currentProfileMinutes} min
                      </td>

                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-800">
                        {hasSamples ? `${agg.actualMinutesMedian} min` : '–'}
                      </td>

                      <td className="px-3 py-2.5 text-right font-mono">
                        {hasSamples ? (
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
                              ? `-${Math.abs(diff).toFixed(0)} min`
                              : isDelay
                              ? `+${Math.abs(diff).toFixed(0)} min`
                              : '0 min'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-normal">Bez odchylky</span>
                        )}
                      </td>

                      <td className="px-3.5 py-2.5 text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold font-mono text-xs">
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          {agg.recommendedServiceMinutes} min
                        </span>
                      </td>

                      <td className="px-2 py-2.5 text-center">
                        {agg.isCustom && (
                          <button
                            type="button"
                            title="Odstranit tuto vlastní činnost"
                            disabled={busyAction}
                            onClick={() => handleDeleteCustomActivity(agg.workType)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
