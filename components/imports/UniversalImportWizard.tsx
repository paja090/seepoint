'use client';

import { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Sliders,
  Check,
  X,
  Eye,
  Layers,
  Database,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import {
  TARGET_FIELDS_BY_ENTITY,
  type ColumnMappingProposal,
  type DryRunRowResult,
  type DryRunStats,
  type SheetAnalysisSummary,
  type SheetClassificationType,
} from '@/lib/imports/types';

type Step = 'UPLOAD' | 'SHEETS' | 'MAPPING' | 'DRY_RUN' | 'CONFLICTS' | 'REPORT';

const CLASSIFICATION_LABELS: Record<SheetClassificationType, { label: string; icon: string }> = {
  CARRIERS: { label: '📍 Reklamní nosiče', icon: '📍' },
  SURFACES: { label: '🖼️ Reklamní plochy / strany', icon: '🖼️' },
  CLIENTS: { label: '👥 Adresář inzerentů / Klienti', icon: '👥' },
  OCCUPANCY: { label: '📅 Obsazenost & Kampaně', icon: '📅' },
  CAMPAIGNS: { label: '📢 Kampaně', icon: '📢' },
  PRICES: { label: '💰 Ceník nosičů', icon: '💰' },
  NAVIGATION: { label: '🧭 Navigační směrovky VO', icon: '🧭' },
  UNKNOWN: { label: '❓ Neznámý typ listu', icon: '❓' },
};

export function UniversalImportWizard({ onImportComplete }: { onImportComplete?: () => void }) {
  const [step, setStep] = useState<Step>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [runningDryRun, setRunningDryRun] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Batch state
  const [batchId, setBatchId] = useState<string | null>(null);
  const [sheets, setSheets] = useState<SheetAnalysisSummary[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);

  // Dry run state
  const [dryRunStats, setDryRunStats] = useState<DryRunStats | null>(null);
  const [sampleRows, setSampleRows] = useState<DryRunRowResult[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, 'USE_IMPORT' | 'KEEP_DATABASE' | 'SKIP'>>({});

  // Commit state
  const [confirmationText, setConfirmationText] = useState('');
  const [saveProfileAs, setSaveProfileAs] = useState('');
  const [commitResult, setCommitResult] = useState<any>(null);

  // --- Step 1: Upload ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/imports/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nahrání souboru selhalo.');

      setBatchId(data.batchId);
      setDuplicateWarning(data.duplicateWarning);

      // Trigger automatic AI analysis
      setAnalyzing(true);
      setStep('SHEETS');

      const analyzeRes = await fetch(`/api/imports/${data.batchId}/analyze`, {
        method: 'POST',
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) throw new Error(analyzeData.error || 'Analýza listů selhala.');

      setSheets(analyzeData.sheets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při nahrávání.');
      setStep('UPLOAD');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  // --- Step 2 & 3: Sheet Classification & Column Mapping ---
  const handleClassificationChange = (sheetIdx: number, newClass: SheetClassificationType) => {
    setSheets((prev) => {
      const next = [...prev];
      next[sheetIdx] = { ...next[sheetIdx], classification: newClass };
      return next;
    });
  };

  const handleColumnTargetChange = (sheetIdx: number, sourceCol: string, targetField: string) => {
    setSheets((prev) => {
      const next = [...prev];
      const sheet = { ...next[sheetIdx] };
      sheet.columnMappings = sheet.columnMappings.map((m) =>
        m.sourceColumn === sourceCol ? { ...m, targetField, isCustom: true } : m
      );
      next[sheetIdx] = sheet;
      return next;
    });
  };

  const handleSaveMappingsAndRunDryRun = async () => {
    if (!batchId) return;
    setRunningDryRun(true);
    setError('');

    try {
      // 1. Save mappings
      const saveRes = await fetch(`/api/imports/${batchId}/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheets: sheets.map((s) => ({
            sheetId: (s as any).id,
            classification: s.classification,
            columnMappings: s.columnMappings,
          })),
        }),
      });

      if (!saveRes.ok) {
        const d = await saveRes.json();
        throw new Error(d.error || 'Uložení mapování selhalo.');
      }

      // 2. Execute dry run
      const dryRes = await fetch(`/api/imports/${batchId}/dry-run`, {
        method: 'POST',
      });

      const dryData = await dryRes.json();
      if (!dryRes.ok) throw new Error(dryData.error || 'Dry-run kontrola selhala.');

      setDryRunStats(dryData.stats);
      setSampleRows(dryData.sampleRows || []);

      if (dryData.stats.conflictCount > 0) {
        setStep('CONFLICTS');
      } else {
        setStep('DRY_RUN');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při kontrolním náhledu.');
    } finally {
      setRunningDryRun(false);
    }
  };

  // --- Step 5: Conflict Resolution ---
  const handleResolveConflict = (rowId: string, choice: 'USE_IMPORT' | 'KEEP_DATABASE' | 'SKIP') => {
    setResolutions((prev) => ({ ...prev, [rowId]: choice }));
  };

  // --- Step 6: Commit Import ---
  const handleCommit = async () => {
    if (!batchId) return;
    if (confirmationText !== 'IMPORTOVAT') {
      setError('Pro spuštění importu zadejte přesný text „IMPORTOVAT“.');
      return;
    }

    setCommitting(true);
    setError('');

    try {
      const res = await fetch(`/api/imports/${batchId}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: confirmationText,
          resolutions,
          saveProfileAs: saveProfileAs.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Zápis importu selhal.');

      setCommitResult(data.result);
      setStep('REPORT');
      if (onImportComplete) onImportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při provádění importu.');
    } finally {
      setCommitting(false);
    }
  };

  const currentSheet = sheets[activeSheetIdx];
  const targetFieldOptions = currentSheet
    ? TARGET_FIELDS_BY_ENTITY[currentSheet.classification] || TARGET_FIELDS_BY_ENTITY.CARRIERS
    : [];

  return (
    <div className="space-y-6">
      {/* Wizard Step Progress Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          {[
            { id: 'UPLOAD', label: '1. Nahrání souboru' },
            { id: 'SHEETS', label: '2. Klasifikace listů' },
            { id: 'MAPPING', label: '3. Mapování sloupců' },
            { id: 'DRY_RUN', label: '4. Kontrolní náhled (Dry-Run)' },
            { id: 'CONFLICTS', label: '5. Konflikty' },
            { id: 'REPORT', label: '6. Výsledek & Report' },
          ].map((s, idx) => {
            const isActive = step === s.id;
            const isDone =
              (s.id === 'UPLOAD' && step !== 'UPLOAD') ||
              (s.id === 'SHEETS' && ['MAPPING', 'DRY_RUN', 'CONFLICTS', 'REPORT'].includes(step)) ||
              (s.id === 'MAPPING' && ['DRY_RUN', 'CONFLICTS', 'REPORT'].includes(step)) ||
              (s.id === 'DRY_RUN' && ['CONFLICTS', 'REPORT'].includes(step)) ||
              (s.id === 'CONFLICTS' && step === 'REPORT');

            return (
              <div
                key={s.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-sm'
                    : isDone
                      ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                      : 'text-slate-600 bg-slate-50 border border-slate-200'
                }`}
              >
                <span>{isDone ? '✓' : `${idx + 1}.`}</span>
                <span>{s.label.split('. ')[1]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {duplicateWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <span>{duplicateWarning}</span>
        </div>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 'UPLOAD' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center space-y-6 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 shadow-xs">
            <UploadCloud className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-950">Nahrát databázi venkovní reklamy</h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
              Podporovány jsou soubory <strong className="text-slate-900 font-bold">.xlsx</strong>, <strong className="text-slate-900 font-bold">.xls</strong> a <strong className="text-slate-900 font-bold">.csv</strong> libovolné
              struktury (více listů, různé názvy sloupců, GPS, obsazenost, ceníky).
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-purple-600 bg-slate-50 hover:bg-purple-50/40 rounded-2xl p-8 cursor-pointer transition">
              <FileSpreadsheet className="h-12 w-12 text-slate-400 mb-3" />
              <span className="text-sm font-bold text-slate-900">
                {file ? file.name : 'Vyberte soubor nebo jej přetáhněte sem'}
              </span>
              <span className="text-xs font-medium text-slate-500 mt-1">Podporované formáty: XLSX, XLS, CSV, TSV (max. 30 MB)</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {file && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Nahrávám a analyzuji soubor...</span>
                  </>
                ) : (
                  <>
                    <span>Spustit AI analýzu souboru</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: SHEETS CLASSIFICATION */}
      {step === 'SHEETS' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">Rozpoznané listy v souboru</h2>
              <p className="text-sm text-slate-600">
                AI analyzovala obsah jednotlivých listů a navrhla jejich význam v SeePointu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('MAPPING')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-sm transition"
            >
              <span>Pokračovat na mapování sloupců</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {analyzing ? (
            <div className="py-16 text-center space-y-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Sémantická AI analýza listů probíhá...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sheets.map((sheet, idx) => (
                <div
                  key={sheet.name}
                  className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm hover:border-slate-300 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-950 text-base flex items-center gap-2">
                        <Layers className="h-4 w-4 text-purple-600" />
                        <span>{sheet.name}</span>
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">
                        {sheet.totalRows} řádků • {sheet.totalColumns} sloupců
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      {(sheet.confidence * 100).toFixed(0)} % jistota
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                      Přiřazený význam
                    </label>
                    <select
                      value={sheet.classification}
                      onChange={(e) =>
                        handleClassificationChange(idx, e.target.value as SheetClassificationType)
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-950 text-sm font-semibold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                    >
                      {Object.entries(CLASSIFICATION_LABELS).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium">{sheet.headers.length} sloupců k mapování</span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSheetIdx(idx);
                        setStep('MAPPING');
                      }}
                      className="text-purple-600 hover:text-purple-800 font-bold"
                    >
                      Upravit sloupce →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: COLUMN MAPPING */}
      {step === 'MAPPING' && currentSheet && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setStep('SHEETS')}
                  className="text-slate-500 hover:text-slate-900 p-1 rounded-lg hover:bg-slate-100 transition"
                  title="Zpět na listy"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-2xl font-bold text-slate-950">
                  Mapování sloupců: <span className="text-purple-700">{currentSheet.name}</span>
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                Přiřaďte zdrojové sloupce na interní pole modelu SeePointu.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {sheets.length > 1 && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  {sheets.map((s, idx) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => setActiveSheetIdx(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeSheetIdx === idx
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveMappingsAndRunDryRun}
                disabled={runningDryRun}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {runningDryRun ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Provádím Dry-Run...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    <span>Spustit kontrolní náhled (Dry-Run)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Column Mapping Table */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Zdrojový sloupec</th>
                    <th className="py-3.5 px-4">Vzorek hodnot</th>
                    <th className="py-3.5 px-4">Cílové pole SeePointu</th>
                    <th className="py-3.5 px-4">Spolehlivost AI</th>
                    <th className="py-3.5 px-4">Transformace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentSheet.columnMappings.map((mapping) => {
                    const confPercent = Math.round(mapping.confidence * 100);
                    return (
                      <tr key={mapping.sourceColumn} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-950">
                          {mapping.sourceColumn}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs max-w-xs truncate">
                          <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 border border-slate-200 inline-block truncate max-w-full">
                            {mapping.sampleValues.join(' • ') || '(prázdné)'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={mapping.targetField}
                            onChange={(e) =>
                              handleColumnTargetChange(
                                activeSheetIdx,
                                mapping.sourceColumn,
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-950 text-xs font-semibold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100"
                          >
                            <option value="IGNORE">🚫 Ignorovat tento sloupec</option>
                            <option value="UNKNOWN">❓ Neznámé pole</option>
                            <optgroup label="Cílová pole SeePointu">
                              {targetFieldOptions.map((opt) => (
                                <option key={opt.field} value={opt.field}>
                                  {opt.label} ({opt.field})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                              confPercent >= 90
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : confPercent >= 70
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {confPercent} %
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                          {mapping.transformation && mapping.transformation !== 'NONE' ? (
                            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                              {mapping.transformation}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 & 5: DRY RUN & CONFLICTS */}
      {(step === 'DRY_RUN' || step === 'CONFLICTS') && dryRunStats && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-950 flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                <span>Kontrolní náhled (Dry-Run simulace)</span>
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Všechna data byla otestována proti existující databázi. Žádné záznamy dosud nebyly změněny.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('MAPPING')}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-xs"
              >
                ← Zpět na mapování
              </button>
            </div>
          </div>

          {/* Stats KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1 shadow-sm">
              <span className="text-slate-500 block font-medium">Celkem řádků</span>
              <strong className="text-2xl font-black text-slate-950">{dryRunStats.totalRows}</strong>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-1 shadow-sm">
              <span className="text-emerald-800 block font-bold">Nové záznamy</span>
              <strong className="text-2xl font-black text-emerald-700">+{dryRunStats.createCount}</strong>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 space-y-1 shadow-sm">
              <span className="text-sky-800 block font-bold">Aktualizace</span>
              <strong className="text-2xl font-black text-sky-700">~{dryRunStats.updateCount}</strong>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1 shadow-sm">
              <span className="text-slate-600 block font-medium">Beze změny</span>
              <strong className="text-2xl font-black text-slate-700">{dryRunStats.unchangedCount}</strong>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-1 shadow-sm">
              <span className="text-amber-800 block font-bold">Konflikty</span>
              <strong className="text-2xl font-black text-amber-700">{dryRunStats.conflictCount}</strong>
            </div>
            <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-4 space-y-1 shadow-sm">
              <span className="text-purple-800 block font-bold">Ke kontrole</span>
              <strong className="text-2xl font-black text-purple-700">{dryRunStats.needsReviewCount}</strong>
            </div>
          </div>

          {/* Sample Rows / Conflicts View */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-3 p-5">
            <h3 className="font-bold text-slate-950 text-base">
              {step === 'CONFLICTS' ? '⚠️ Řešení detekovaných konfliktů' : '🔍 Ukázka zpracovaných řádků'}
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {sampleRows
                .filter((r) => (step === 'CONFLICTS' ? r.action === 'CONFLICT' : true))
                .slice(0, 30)
                .map((row) => (
                  <div
                    key={`${row.sheetName}-${row.rowNumber}`}
                    className={`rounded-xl border p-4 text-xs space-y-2.5 transition ${
                      row.action === 'CONFLICT'
                        ? 'border-amber-300 bg-amber-50/60'
                        : row.action === 'CREATE'
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : row.action === 'UPDATE'
                            ? 'border-sky-200 bg-sky-50/40'
                            : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        <span className="text-slate-500">
                          {row.sheetName} (řádek {row.rowNumber}):
                        </span>
                        <span className="text-slate-950 text-sm">{row.targetIdentifier || 'Neznámý záznam'}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase ${
                          row.action === 'CONFLICT'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : row.action === 'CREATE'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : row.action === 'UPDATE'
                                ? 'bg-sky-100 text-sky-900 border border-sky-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {row.action}
                      </span>
                    </div>

                    {/* Diff display */}
                    {row.diff && row.diff.length > 0 && (
                      <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-1 font-mono text-xs">
                        {row.diff.map((d) => (
                          <div key={d.field} className="flex items-center gap-2 flex-wrap">
                            <span className="text-slate-600 font-semibold">{d.label}:</span>
                            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 line-through">{String(d.oldValue)}</span>
                            <span className="text-slate-400 font-bold">→</span>
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold">{String(d.newValue)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Conflict decision buttons */}
                    {row.action === 'CONFLICT' && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1 border-t border-amber-200">
                        <span className="text-amber-900 font-semibold">
                          {row.conflictDetails?.message || 'Rozpor mezi importem a databází.'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleResolveConflict(String(row.rowNumber), 'KEEP_DATABASE')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition border ${
                              resolutions[String(row.rowNumber)] === 'KEEP_DATABASE'
                                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                            }`}
                          >
                            Ponechat v DB
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveConflict(String(row.rowNumber), 'USE_IMPORT')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition border ${
                              resolutions[String(row.rowNumber)] === 'USE_IMPORT'
                                ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                                : 'bg-white border-purple-300 text-purple-900 hover:bg-purple-100'
                            }`}
                          >
                            Použít z importu
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveConflict(String(row.rowNumber), 'SKIP')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition border ${
                              resolutions[String(row.rowNumber)] === 'SKIP'
                                ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                : 'bg-white border-rose-300 text-rose-900 hover:bg-rose-100'
                            }`}
                          >
                            Přeskočit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Confirm Import Box */}
          <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-white to-white p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-950">Potvrzení a provedení importu</h3>
              <p className="text-xs text-slate-600 mt-1">
                Data budou bezpečně zapsána do databáze v transakci. Existující fotografie nosičů zůstanou zachovány.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Uložit profil pro budoucí importy této firmy (volitelné)
                </label>
                <input
                  type="text"
                  value={saveProfileAs}
                  onChange={(e) => setSaveProfileAs(e.target.value)}
                  placeholder="např. Měsíční databáze nosičů ABC"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-950 text-sm font-medium focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 shadow-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Pro potvrzení zadejte text „IMPORTOVAT“
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="IMPORTOVAT"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-950 font-mono text-sm font-bold focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 shadow-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleCommit}
                disabled={committing || confirmationText !== 'IMPORTOVAT'}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {committing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Zapisuji schválená data...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Dokončit a importovat data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: REPORT */}
      {step === 'REPORT' && commitResult && (
        <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center space-y-6 shadow-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-950">Import byl úspěšně dokončen!</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Všechna data byla převedena do doménového modelu SeePointu a jsou okamžitě dostupná v systému.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-600 block font-medium">Vytvořené nosiče</span>
              <strong className="text-2xl font-black text-emerald-700">
                +{commitResult.createdCarriers}
              </strong>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-600 block font-medium">Aktualizované nosiče</span>
              <strong className="text-2xl font-black text-sky-700">
                ~{commitResult.updatedCarriers}
              </strong>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-600 block font-medium">Vytvoření klienti</span>
              <strong className="text-2xl font-black text-purple-700">
                +{commitResult.createdClients}
              </strong>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-600 block font-medium">Položky ceníku</span>
              <strong className="text-2xl font-black text-amber-700">
                +{commitResult.createdPrices}
              </strong>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStep('UPLOAD');
                setFile(null);
                setBatchId(null);
                setCommitResult(null);
                setConfirmationText('');
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs transition shadow-xs"
            >
              Nahrát další soubor
            </button>
            <a
              href="/map"
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-xs"
            >
              Zobrazit nosiče na mapě →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
