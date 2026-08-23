'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function OrganizationStatusButton({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/organizations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Změna stavu selhala.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Změna stavu selhala.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <button className={isActive ? 'btn-secondary' : 'btn-primary'} disabled={busy} onClick={toggle} type="button">
        {busy ? 'Ukládám…' : isActive ? 'Deaktivovat organizaci' : 'Aktivovat organizaci'}
      </button>
      {error ? <p aria-live="polite" className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
