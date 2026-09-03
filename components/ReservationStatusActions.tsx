'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, PlayCircle, XCircle } from 'lucide-react';

export function ReservationStatusActions({ reservationId, currentStatus }: { reservationId: string; currentStatus: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(newStatus: string) {
    setError(null);
    try {
      const response = await fetch('/api/vehicle-reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reservationId, status: newStatus }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Stav rezervace se nepodařilo změnit.');
      startTransition(() => {
        router.refresh();
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Stav rezervace se nepodařilo změnit.');
    }
  }

  if (['FINISHED', 'CANCELLED'].includes(currentStatus)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 justify-end">
      {currentStatus === 'RESERVED' && (
        <button
          disabled={isPending}
          onClick={() => updateStatus('ACTIVE')}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-2 py-1 text-[11px] font-bold text-sky-900 hover:bg-sky-200 transition disabled:opacity-50"
          title="Označit rezervaci jako právě probíhající"
        >
          <PlayCircle size={12} className="text-sky-600" />
          <span>Zahájit</span>
        </button>
      )}
      <button
        disabled={isPending}
        onClick={() => updateStatus('FINISHED')}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-200 transition disabled:opacity-50"
        title="Označit rezervaci jako dokončenou"
      >
        <CheckCircle2 size={12} className="text-emerald-600" />
        <span>Dokončit</span>
      </button>

      <button
        disabled={isPending}
        onClick={() => updateStatus('CANCELLED')}
        className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-900 hover:bg-rose-200 transition disabled:opacity-50"
        title="Zrušit rezervaci"
      >
        <XCircle size={12} className="text-rose-600" />
        <span>Zrušit</span>
      </button>
      {error && <p className="basis-full text-right text-[11px] font-semibold text-rose-700" role="alert">{error}</p>}
    </div>
  );
}
