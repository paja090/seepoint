'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, FileSpreadsheet, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

type HistoryBatch = {
  id: string;
  fileName: string;
  sourceType: string;
  status: string;
  totalRows: number;
  validRows: number;
  importedRows: number;
  skippedRows: number;
  errorRows: number;
  createdAt: string;
  createdBy?: { name: string; email: string } | null;
  dryRunStats?: any;
};

export function ImportHistoryList() {
  const [batches, setBatches] = useState<HistoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHistory = () => {
    setLoading(true);
    fetch('/api/imports/history')
      .then((res) => res.json())
      .then((data) => {
        if (data.batches) setBatches(data.batches);
      })
      .catch((err) => {
        setError('Nepodařilo se načíst historii importů.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <Clock className="h-4 w-4 text-purple-600" />
          <span>Historie provedených importů</span>
        </h3>
        <button
          type="button"
          onClick={fetchHistory}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
          title="Obnovit historii"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

      {loading ? (
        <div className="py-8 text-center text-xs font-medium text-slate-500">Načítám historii...</div>
      ) : batches.length === 0 ? (
        <p className="text-xs font-medium text-slate-500 text-center py-6">
          Zatím nebyly provedeny žádné importy.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-xs font-bold uppercase tracking-wider text-slate-600 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Datum</th>
                <th className="py-3 px-3">Soubor</th>
                <th className="py-3 px-3">Typ</th>
                <th className="py-3 px-3">Stav</th>
                <th className="py-3 px-3 text-right">Zpracováno</th>
                <th className="py-3 px-3">Uživatel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => {
                const dateStr = new Date(b.createdAt).toLocaleString('cs-CZ', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-slate-600 font-mono text-xs">{dateStr}</td>
                    <td className="py-3 px-3 font-bold text-slate-950 max-w-xs truncate">{b.fileName}</td>
                    <td className="py-3 px-3 text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-mono font-medium">
                        {b.sourceType}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          b.status === 'COMPLETED' || b.status === 'IMPORTED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : b.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-950">
                      {b.importedRows > 0 ? b.importedRows : b.totalRows} řádků
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                      {b.createdBy?.name || b.createdBy?.email || 'Systém'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
