'use client';

import { useState } from 'react';
import type { MediaImportKind, MediaImportReport } from '@/lib/media-import';

const mediaSources = [
  { kind: 'CITY_POSTER', label: 'Citypostery', sheet: 'CP25 - MM', hint: '31 stran, přibližně 16 fyzických nosičů' },
  { kind: 'PROMO_BENCH', label: 'Promolavičky', sheet: 'PL25', hint: 'Úplný list bez aktivního filtru' },
  { kind: 'PROMO_HORIZON', label: 'Promohorizonty', sheet: 'PH 2025', hint: 'Jednotlivé plochy včetně směrů a GPS' },
  { kind: 'TOWER', label: 'Towery', sheet: 'T25', hint: 'Každý Tower se připraví se stranami A–D' },
] as const satisfies ReadonlyArray<{ kind: MediaImportKind; label: string; sheet: string; hint: string }>;

const emptyInputs: Record<MediaImportKind, string> = {
  CITY_POSTER: '',
  PROMO_BENCH: '',
  PROMO_HORIZON: '',
  TOWER: '',
};

type ImportPlan = {
  planHash: string;
  stats: {
    sourceRows: number;
    importableRows: number;
    blockedRows: number;
    warnings: number;
  };
};

type ImportResult = {
  batchId: string;
  createdCarriers: number;
  createdSurfaces: number;
  importedRows: number;
  skippedRows: number;
  reviewItems: number;
};

function sourcePayload(inputs: Record<MediaImportKind, string>) {
  return mediaSources
    .filter(({ kind }) => inputs[kind].trim())
    .map(({ kind }) => ({ kind, text: inputs[kind] }));
}

export function MediaImportPreview() {
  const [inputs, setInputs] = useState<Record<MediaImportKind, string>>(emptyInputs);
  const [reports, setReports] = useState<MediaImportReport[]>([]);
  const [plan, setPlan] = useState<ImportPlan>();
  const [importKey, setImportKey] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ImportResult>();
  const [busy, setBusy] = useState<'preview' | 'commit'>();
  const [error, setError] = useState('');

  function clearPreview() {
    setReports([]);
    setPlan(undefined);
    setResult(undefined);
    setConfirmed(false);
  }

  async function readFile(kind: MediaImportKind, file?: File) {
    if (!file) return;
    setInputs((current) => ({ ...current, [kind]: '' }));
    try {
      const text = await file.text();
      setInputs((current) => ({ ...current, [kind]: text }));
      clearPreview();
      setError('');
    } catch {
      setError(`Soubor ${file.name} se nepodařilo přečíst.`);
    }
  }

  async function createPreview() {
    setBusy('preview');
    setError('');
    setResult(undefined);
    try {
      const response = await fetch('/api/import/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'preview', sources: sourcePayload(inputs) }),
      });
      const data = await response.json() as { reports?: MediaImportReport[]; plan?: ImportPlan; error?: string };
      if (!response.ok || !data.reports || !data.plan) throw new Error(data.error || 'Kontrolní report se nepodařilo vytvořit.');
      setReports(data.reports);
      setPlan(data.plan);
      setConfirmed(false);
    } catch (previewError) {
      clearPreview();
      setError(previewError instanceof Error ? previewError.message : 'Kontrolní report se nepodařilo vytvořit.');
    } finally {
      setBusy(undefined);
    }
  }

  async function commitImport() {
    if (!plan || !confirmed) return;
    setBusy('commit');
    setError('');
    setResult(undefined);
    try {
      const response = await fetch('/api/import/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-import-key': importKey },
        body: JSON.stringify({
          mode: 'commit',
          sources: sourcePayload(inputs),
          planHash: plan.planHash,
          confirmation: 'IMPORTOVAT',
        }),
      });
      const data = await response.json() as { result?: ImportResult; error?: string };
      if (!response.ok || !data.result) throw new Error(data.error || 'Zápis do databáze se nepodařil.');
      setResult(data.result);
      setConfirmed(false);
      setImportKey('');
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : 'Zápis do databáze se nepodařil.');
    } finally {
      setBusy(undefined);
    }
  }

  const totals = reports.reduce((sum, current) => ({
    sourceRows: sum.sourceRows + current.stats.sourceRows,
    carriers: sum.carriers + current.stats.carriers,
    surfaces: sum.surfaces + current.stats.surfaces,
    validGps: sum.validGps + current.stats.validGps,
    missingGps: sum.missingGps + current.stats.missingGps,
    withPhotos: sum.withPhotos + current.stats.withPhotos,
    reviewRows: sum.reviewRows + current.stats.reviewRows,
  }), { sourceRows: 0, carriers: 0, surfaces: 0, validGps: 0, missingGps: 0, withPhotos: 0, reviewRows: 0 });
  const previewRows = reports.flatMap((report) => report.rows).slice(0, 100);

  return (
    <div className="space-y-6">
      <section className="card space-y-4 border-sky-200 bg-sky-50">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Nový import nosičů</p>
          <h2 className="text-xl font-bold">Citypostery, Promolavičky, Promohorizonty a Towery</h2>
          <p className="mt-1 text-sm text-slate-600">
            Náhled nic nezapisuje do databáze a nikdy nemění zdrojovou Google tabulku. Zápis je samostatný, chráněný krok.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {mediaSources.map((source) => (
            <div className="rounded-2xl border border-slate-200 bg-white p-4" key={source.kind}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{source.label}</h3>
                  <p className="text-xs text-slate-500">List {source.sheet} · {source.hint}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${inputs[source.kind].trim() ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {inputs[source.kind].trim() ? 'Data vložena' : 'Čeká na data'}
                </span>
              </div>
              <label className="mt-3 block text-xs font-medium">
                TSV, CSV nebo TXT soubor
                <input
                  className="input mt-1"
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
                  onChange={(event) => void readFile(source.kind, event.target.files?.[0])}
                />
              </label>
              <label className="mt-3 block text-xs font-medium">
                Nebo vložte zkopírované buňky
                <textarea
                  className="input mt-1 min-h-28 font-mono text-xs"
                  value={inputs[source.kind]}
                  placeholder={`Vložte celý list ${source.sheet} včetně hlavičky…`}
                  onChange={(event) => {
                    setInputs((current) => ({ ...current, [source.kind]: event.target.value }));
                    clearPreview();
                  }}
                />
              </label>
            </div>
          ))}
        </div>

        <button className="btn" type="button" disabled={Boolean(busy)} onClick={() => void createPreview()}>
          {busy === 'preview' ? 'Kontroluji data…' : 'Vytvořit bezpečný kontrolní report'}
        </button>
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      </section>

      {reports.length > 0 && plan && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Zdrojové řádky', totals.sourceRows],
              ['Fyzické nosiče', totals.carriers],
              ['Reklamní plochy', totals.surfaces],
              ['Platné GPS', totals.validGps],
              ['Bez GPS', totals.missingGps],
              ['S fotografií', totals.withPhotos],
              ['Řádky ke kontrole', totals.reviewRows],
              ['Řádky zablokované', plan.stats.blockedRows],
            ].map(([label, value]) => (
              <div className="card !p-4" key={label}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reports.map((current) => {
              const source = mediaSources.find((item) => item.kind === current.kind);
              return (
                <div className="card !p-4" key={current.kind}>
                  <h3 className="font-bold">{source?.label}</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><dt className="text-xs text-slate-500">Nosiče</dt><dd className="font-semibold">{current.stats.carriers}</dd></div>
                    <div><dt className="text-xs text-slate-500">Plochy</dt><dd className="font-semibold">{current.stats.surfaces}</dd></div>
                    <div><dt className="text-xs text-slate-500">Bez GPS</dt><dd className="font-semibold">{current.stats.missingGps}</dd></div>
                    <div><dt className="text-xs text-slate-500">Ke kontrole</dt><dd className="font-semibold">{current.stats.reviewRows}</dd></div>
                  </dl>
                </div>
              );
            })}
          </section>

          <section className="card overflow-x-auto">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold">Kontrolní náhled</h2>
                <p className="text-sm text-slate-500">Zobrazeno prvních {previewRows.length} z {totals.sourceRows} řádků.</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Bez zápisu do databáze</span>
            </div>
            <table className="min-w-[1100px] w-full text-left text-xs">
              <thead><tr className="border-b text-slate-500"><th className="py-2 pr-3">Typ</th><th className="py-2 pr-3">Řádek</th><th className="py-2 pr-3">Kód</th><th className="py-2 pr-3">Název</th><th className="py-2 pr-3">Město / adresa</th><th className="py-2 pr-3">GPS</th><th className="py-2 pr-3">Plocha</th><th className="py-2">Kontroly</th></tr></thead>
              <tbody>{previewRows.map((row) => (
                <tr className="border-b align-top" key={`${row.kind}-${row.sourceRow}-${row.sourceCode}`}>
                  <td className="py-2 pr-3">{row.kind}</td><td className="py-2 pr-3">{row.sourceRow}</td><td className="py-2 pr-3 font-mono">{row.carrierCode}</td><td className="py-2 pr-3">{row.name}</td><td className="py-2 pr-3">{row.city || '—'}<br /><span className="text-slate-500">{row.address}</span></td><td className="py-2 pr-3">{row.latitude !== undefined && row.longitude !== undefined ? `${row.latitude}, ${row.longitude}` : 'Chybí'}</td><td className="py-2 pr-3">{row.surfaceName}</td><td className="py-2">{row.issues.length ? row.issues.map((issue) => <div className="text-amber-700" key={issue.code}>{issue.message}</div>) : <span className="text-emerald-700">V pořádku</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </section>

          <section className="card space-y-4 border-amber-200 bg-amber-50">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Chráněný zápis</p>
              <h2 className="text-xl font-bold">Importovat zkontrolovaná data do databáze</h2>
              <p className="mt-1 text-sm text-slate-600">
                Importuje se {plan.stats.importableRows} řádků. {plan.stats.blockedRows} problematických řádků se přeskočí a uloží do importního reportu. Chybějící GPS a fotografie jsou pouze upozornění.
              </p>
            </div>
            <label className="block max-w-md text-sm font-medium">
              Importní klíč
              <input className="input mt-1" type="password" autoComplete="off" value={importKey} onChange={(event) => setImportKey(event.target.value)} />
            </label>
            <label className="flex max-w-2xl items-start gap-3 text-sm">
              <input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>Potvrzuji zápis do databáze. Rozumím, že zdrojová tabulka se nezmění a opakovaný import nevytvoří stejné nosiče ani plochy podruhé.</span>
            </label>
            <button className="btn" type="button" disabled={!confirmed || !importKey || Boolean(busy)} onClick={() => void commitImport()}>
              {busy === 'commit' ? 'Importuji…' : 'Importovat do databáze'}
            </button>
            {result && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
                <p className="font-bold">Import byl dokončen.</p>
                <p>Nové nosiče: {result.createdCarriers} · nové plochy: {result.createdSurfaces} · přeskočené řádky: {result.skippedRows} · položky ke kontrole: {result.reviewItems}</p>
                <p className="mt-1 text-xs">Číslo importu: {result.batchId}</p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
