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
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="h-4 w-4 text-purple-400" />
          <span>Historie provedených importů</span>
        </h3>
        <button
          type="button"
          onClick={fetchHistory}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-500">Načítám historii...</div>
      ) : batches.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">
          Zatím nebyly provedeny žádné importy.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              <tr>
                <th className="py-2.5 px-3">Datum</th>
                <th className="py-2.5 px-3">Soubor</th>
                <th className="py-2.5 px-3">Typ</th>
                <th className="py-2.5 px-3">Stav</th>
                <th className="py-2.5 px-3 text-right">Zpracováno</th>
                <th className="py-2.5 px-3">Uživatel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {batches.map((b) => {
                const dateStr = new Date(b.createdAt).toLocaleString('cs-CZ', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={b.id} className="hover:bg-slate-800/20 transition">
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{dateStr}</td>
                    <td className="py-2.5 px-3 font-bold text-white max-w-xs truncate">{b.fileName}</td>
                    <td className="py-2.5 px-3 text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono">
                        {b.sourceType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          b.status === 'COMPLETED' || b.status === 'IMPORTED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : b.status === 'FAILED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                              : 'bg-purple-950 text-purple-300 border border-purple-800/60'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                      {b.importedRows > 0 ? b.importedRows : b.totalRows} řádků
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
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
