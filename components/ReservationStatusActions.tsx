'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle } from 'lucide-react';

export function ReservationStatusActions({ reservationId, currentStatus }: { reservationId: string; currentStatus: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function updateStatus(newStatus: string) {
    try {
      await fetch('/api/vehicle-reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reservationId, status: newStatus }),
      });
      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error(e);
    }
  }

  if (['FINISHED', 'CANCELLED'].includes(currentStatus)) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button
        disabled={isPending}
        onClick={() => updateStatus('FINISHED')}
        className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-900 hover:bg-emerald-200 transition"
        title="Označit rezervaci jako dokončenou"
      >
        <CheckCircle2 size={12} className="text-emerald-600" />
        <span>Dokončit</span>
      </button>

      <button
        disabled={isPending}
        onClick={() => updateStatus('CANCELLED')}
        className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-900 hover:bg-rose-200 transition"
        title="Zrušit rezervaci"
      >
        <XCircle size={12} className="text-rose-600" />
        <span>Zrušit</span>
      </button>
    </div>
  );
}
