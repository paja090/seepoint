'use client';

import { useMemo, useState } from 'react';
import { parseNavigationImport, type NavigationImportReport } from '@/lib/navigation-import';

function reportTotal(reports: NavigationImportReport[], key: keyof Omit<NavigationImportReport, 'sheetName' | 'records'>) {
  return reports.reduce((sum, report) => sum + Number(report[key]), 0);
}

export function NavigationImportPreview() {
  const [reports, setReports] = useState<NavigationImportReport[]>([]);
  const [sheetName, setSheetName] = useState('Navigace 2025');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const previewRows = useMemo(
    () => reports.flatMap((report) => report.records).slice(0, 50),
    [reports],
  );

  function analyzeText() {
    setError('');
    try {
      setReports([parseNavigationImport(text, sheetName.trim() || 'Navigace 2025')]);
    } catch (parseError) {
      setReports([]);
      setError(parseError instanceof Error ? parseError.message : 'Data se nepodařilo analyzovat.');
    }
  }

  async function analyzeFiles(files: FileList | null) {
    if (!files?.length) return;
    setError('');

    try {
      const parsed = await Promise.all(
        [...files].map(async (file) => {
          if (/\.xlsx?$/i.test(file.name)) {
            throw new Error('Pro první bezpečný dry-run exportujte jednotlivé listy jako CSV nebo TSV. Přímé XLSX doplníme v další etapě.');
          }
          return parseNavigationImport(await file.text(), file.name.replace(/\.(csv|tsv|txt)$/i, ''));
        }),
      );
      setReports(parsed);
    } catch (parseError) {
      setReports([]);
      setError(parseError instanceof Error ? parseError.message : 'Soubory se nepodařilo analyzovat.');
    }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-bold">Dry-run importu Navigace 2025</h2>
          <p className="mt-1 text-sm text-slate-600">
            Analýza probíhá pouze v prohlížeči. Tato verze nic nezapisuje do databáze ani do původní tabulky.
          </p>
        </div>

        <label className="block text-sm font-medium">
          CSV/TSV exporty městských listů
          <input
            className="input mt-1"
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
            multiple
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
          <button type="button" className="btn mt-3" disabled={!text.trim()} onClick={analyzeText}>
            Analyzovat bez zápisu
          </button>
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </section>

      {reports.length > 0 && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ['Navigace', reports.reduce((sum, report) => sum + report.records.length, 0)],
              ['Platné GPS', reportTotal(reports, 'validGps')],
              ['Bez GPS', reportTotal(reports, 'missingGps')],
              ['S fotografií', reportTotal(reports, 'rowsWithPhotos')],
              ['Ke kontrole', reportTotal(reports, 'reviewRows')],
              ['Pomocné řádky', reportTotal(reports, 'helperRows')],
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
                <h2 className="text-xl font-bold">Náhled normalizovaných záznamů</h2>
                <p className="text-sm text-slate-500">Zobrazeno prvních {previewRows.length} řádků.</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Zápis do databáze je vypnutý
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
                    <td className="py-2 pr-3">{row.clientName}</td>
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
        </>
      )}
    </div>
  );
}
