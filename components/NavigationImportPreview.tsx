'use client';

import { useMemo, useState } from 'react';
import type { NavigationImportReport } from '@/lib/navigation-import';
import type { NavigationImportPlan } from '@/lib/navigation-import-plan';

type ImportSource = { sheetName: string; text: string };
type ImportResult = {
  batchId: string;
  createdCarriers: number;
  createdNavigations: number;
  skippedNavigations: number;
  createdOccupancies: number;
  reviewItems: number;
};

type PreviewResponse = { reports?: NavigationImportReport[]; plan?: NavigationImportPlan; error?: string };
type CommitResponse = { ok?: boolean; result?: ImportResult; error?: string };

function reportTotal(reports: NavigationImportReport[], key: keyof Omit<NavigationImportReport, 'sheetName' | 'records'>) {
  return reports.reduce((sum, report) => sum + Number(report[key]), 0);
}

export function NavigationImportPreview() {
  const [reports, setReports] = useState<NavigationImportReport[]>([]);
  const [plan, setPlan] = useState<NavigationImportPlan>();
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [sheetName, setSheetName] = useState('Navigace 2025');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busyMode, setBusyMode] = useState<'preview' | 'commit'>();
  const [importKey, setImportKey] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ImportResult>();

  const previewRows = useMemo(
    () => reports.flatMap((report) => report.records).slice(0, 50),
    [reports],
  );

  async function analyzeSources(nextSources: ImportSource[]) {
    setError('');
    setResult(undefined);
    setConfirmed(false);
    setBusyMode('preview');
    try {
      const response = await fetch('/api/import/navigation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', sources: nextSources }),
      });
      const payload = await response.json().catch(() => null) as PreviewResponse | null;
      if (!response.ok || !payload?.reports || !payload.plan) {
        throw new Error(payload?.error || 'Kontrolní report se nepodařilo vytvořit.');
      }
      setSources(nextSources);
      setReports(payload.reports);
      setPlan(payload.plan);
    } catch (previewError) {
      setSources([]);
      setReports([]);
      setPlan(undefined);
      setError(previewError instanceof Error ? previewError.message : 'Data se nepodařilo analyzovat.');
    } finally {
      setBusyMode(undefined);
    }
  }

  function analyzeText() {
    void analyzeSources([{ sheetName: sheetName.trim() || 'Navigace 2025', text }]);
  }

  async function analyzeFiles(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    try {
      const nextSources = await Promise.all(
        [...files].map(async (file) => {
          if (/\.xlsx?$/i.test(file.name)) {
            throw new Error('Exportujte jednotlivé listy jako CSV nebo TSV. Přímé XLSX zatím není zapnuté.');
          }
          return {
            sheetName: file.name.replace(/\.(csv|tsv|txt)$/i, ''),
            text: await file.text(),
          };
        }),
      );
      await analyzeSources(nextSources);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'Soubory se nepodařilo načíst.');
    }
  }

  async function commitImport() {
    if (!plan || !confirmed || !importKey || !sources.length) return;
    setError('');
    setBusyMode('commit');
    try {
      const response = await fetch('/api/import/navigation', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-import-key': importKey,
        },
        body: JSON.stringify({
          mode: 'commit',
          sources,
          planHash: plan.planHash,
          confirmation: 'IMPORTOVAT',
        }),
      });
      const payload = await response.json().catch(() => null) as CommitResponse | null;
      if (!response.ok || !payload?.ok || !payload.result) {
        throw new Error(payload?.error || 'Zápis importu se nepodařil.');
      }
      setResult(payload.result);
      setImportKey('');
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Zápis importu se nepodařil.');
    } finally {
      setBusyMode(undefined);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold">Import navigací ve dvou bezpečných krocích</h2>
          <p className="mt-1 text-sm text-slate-600">
            Nejprve se vytvoří kontrolní report bez zápisu. Teprve potom lze samostatně potvrdit import do databáze.
          </p>
        </div>

        <label className="block text-sm font-medium">
          CSV/TSV exporty městských listů
          <input
            className="input mt-1"
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            multiple
            disabled={Boolean(busyMode)}
            onChange={(event) => void analyzeFiles(event.target.files)}
          />
        </label>

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">Nebo vložte zkopírované buňky jednoho listu</p>
          <div className="grid gap-3 md:grid-cols-[240px_1fr]">
            <label className="text-sm">
              Název listu
              <input className="input mt-1" value={sheetName} onChange={(event) => setSheetName(event.target.value)} />
            </label>
            <label className="text-sm">
              Data
              <textarea
                className="input mt-1 min-h-32 font-mono text-xs"
                placeholder="Vložte tabulku včetně hlavičky…"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </label>
          </div>
          <button type="button" className="btn mt-3" disabled={!text.trim() || Boolean(busyMode)} onClick={analyzeText}>
            {busyMode === 'preview' ? 'Vytvářím report…' : 'Vytvořit kontrolní report'}
          </button>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>

      {reports.length > 0 && plan && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Fyzické sloupy', plan.stats.carriers],
              ['Navigace', plan.stats.navigations],
              ['Unikátní klienti', plan.stats.clients],
              ['Sloupy s více navigacemi', plan.stats.multiNavigationCarriers],
              ['Platné GPS', reportTotal(reports, 'validGps')],
              ['Sloupy bez GPS', plan.stats.carriersWithoutGps],
              ['S fotografií', reportTotal(reports, 'rowsWithPhotos')],
              ['Řádky ke kontrole', plan.stats.reviewRows],
            ].map(([label, value]) => (
              <div className="card !p-4" key={label}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </section>

          <section className="card overflow-x-auto">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">Kontrolní report</h2>
                <p className="text-sm text-slate-500">Zobrazeno prvních {previewRows.length} z {plan.stats.navigations} navigací.</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Report vytvořen bez zápisu
              </span>
            </div>
            <table className="min-w-[1100px] w-full text-left text-xs">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-3">List / řádek</th>
                  <th className="py-2 pr-3">Pozice</th>
                  <th className="py-2 pr-3">Sloup</th>
                  <th className="py-2 pr-3">Ulice</th>
                  <th className="py-2 pr-3">Klient</th>
                  <th className="py-2 pr-3">GPS</th>
                  <th className="py-2">Kontroly</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr className="border-b align-top" key={`${row.sheetName}-${row.sourceRow}`}>
                    <td className="py-2 pr-3">{row.sheetName} / {row.sourceRow}</td>
                    <td className="py-2 pr-3">{row.sourcePosition || '—'}<br /><span className="text-slate-500">{row.directionDescription}</span></td>
                    <td className="py-2 pr-3">{row.structureCode || '—'}</td>
                    <td className="py-2 pr-3">{row.street || '—'}<br /><span className="text-slate-500">{row.cadastralArea}</span></td>
                    <td className="py-2 pr-3">{row.clientName || '—'}</td>
                    <td className="py-2 pr-3">
                      {row.latitude !== undefined && row.longitude !== undefined
                        ? `${row.latitude}, ${row.longitude}`
                        : 'Chybí'}
                    </td>
                    <td className="py-2">
                      {row.issues.length
                        ? row.issues.map((issue) => <div className="text-amber-700" key={issue.code}>{issue.message}</div>)
                        : <span className="text-emerald-700">V pořádku</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card space-y-4 border-amber-300 bg-amber-50">
            <div>
              <h2 className="text-xl font-bold">Krok 2: potvrzený zápis</h2>
              <p className="mt-1 text-sm text-slate-700">
                Zápis je chráněný importním klíčem z Vercelu. Opakovaný import nevytvoří stejné navigace podruhé.
              </p>
            </div>
            <label className="block max-w-md text-sm font-medium">
              Importní klíč
              <input
                className="input mt-1"
                type="password"
                autoComplete="off"
                value={importKey}
                onChange={(event) => setImportKey(event.target.value)}
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>Potvrzuji zápis {plan.stats.navigations} navigací seskupených do {plan.stats.carriers} fyzických sloupů.</span>
            </label>
            <button
              type="button"
              className="rounded-xl bg-amber-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!confirmed || !importKey || Boolean(busyMode) || Boolean(result)}
              onClick={() => void commitImport()}
            >
              {busyMode === 'commit' ? 'Importuji…' : 'Zapsat do databáze'}
            </button>
            {result && (
              <div className="rounded-xl bg-emerald-100 p-4 text-sm text-emerald-900" role="status">
                Import dokončen: {result.createdCarriers} nových sloupů, {result.createdNavigations} nových navigací,
                {' '}{result.createdOccupancies} záznamů obsazenosti. Přeskočeno jako již existující: {result.skippedNavigations}.
                {' '}Položek k ruční kontrole: {result.reviewItems}. Číslo dávky: {result.batchId}.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
