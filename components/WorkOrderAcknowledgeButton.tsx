'use client';

import { useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';

export function WorkOrderAcknowledgeButton({
  workOrderId,
  initialAcknowledged,
  initialAcknowledgedAt,
}: {
  workOrderId: string;
  initialAcknowledged: boolean;
  initialAcknowledgedAt?: string | null;
}) {
  const [acknowledged, setAcknowledged] = useState(initialAcknowledged);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(initialAcknowledgedAt || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAcknowledge = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/acknowledge`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Potvrzení selhalo');

      setAcknowledged(true);
      setAcknowledgedAt(new Date().toLocaleDateString('cs-CZ') + ' v ' + new Date().toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Potvrzení selhalo');
    } finally {
      setLoading(false);
    }
  };

  if (acknowledged) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-950 flex items-center gap-2">
        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
        <div>
          <span className="font-bold block">Úkol byl převzat a odsouhlasen</span>
          {acknowledgedAt && <span className="text-[11px] text-emerald-800 font-medium">Potvrzeno: {acknowledgedAt}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleAcknowledge}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-500 active:scale-95 transition disabled:opacity-50"
      >
        {loading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
        <span>Potvrdit převzetí úkolu (Rozumím a beru na vědomí)</span>
      </button>
      {error && <p className="text-xs text-rose-600 font-bold">{error}</p>}
    </div>
  );
}
