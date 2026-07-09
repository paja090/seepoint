'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Carrier } from '@/lib/types';

type ApiError = { error?: string };

export function CarrierArchiveActions({ carrier }: { carrier: Carrier }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function archiveCarrier() {
    const archiveReason = window.prompt('Proč se nosič archivuje? Stačí krátká poznámka.');
    if (archiveReason === null) return;
    if (!window.confirm('Archivovat tento nosič? Zůstane v databázi, ale zmizí ze standardního seznamu a mapy.')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/carriers/${carrier.id}/archive`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ archiveReason }),
      });
      const data = await response.json().catch(() => null) as ApiError | null;
      if (!response.ok) throw new Error(data?.error || 'Nosič se nepodařilo archivovat.');
      router.refresh();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Nosič se nepodařilo archivovat.');
    } finally {
      setBusy(false);
    }
  }

  async function restoreCarrier() {
    if (!window.confirm('Obnovit nosič zpět mezi aktivní?')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/carriers/${carrier.id}/archive`, { method: 'DELETE' });
      const data = await response.json().catch(() => null) as ApiError | null;
      if (!response.ok) throw new Error(data?.error || 'Nosič se nepodařilo obnovit.');
      router.refresh();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Nosič se nepodařilo obnovit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {carrier.archivedAt ? (
        <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="button" onClick={() => void restoreCarrier()}>
          {busy ? 'Obnovuji…' : 'Obnovit nosič'}
        </button>
      ) : (
        <button className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60" disabled={busy} type="button" onClick={() => void archiveCarrier()}>
          {busy ? 'Archivuji…' : 'Archivovat nosič'}
        </button>
      )}
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}
