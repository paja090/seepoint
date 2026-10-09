'use client';
import { academyPrimaryButton } from '@/components/academy/styles';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function AcademyBootstrapButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function prepare() {
    if (busy) return; setBusy(true); setMessage(''); setFailed(false);
    try {
      const response = await fetch('/api/academy/bootstrap', { method: 'POST' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Lekce se nepodařilo připravit.');
      setMessage('Pět pilotních návrhů je připraveno k revizi. Existující revize zůstaly zachovány.'); router.refresh();
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : 'Příprava selhala.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3"><button type="button" disabled={busy} onClick={prepare} className={academyPrimaryButton}>{busy ? 'Připravuji…' : 'Připravit 5 pilotních návrhů'}</button>{message && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-sm text-red-700' : 'text-sm text-emerald-700'}>{message}</p>}</div>;
}
