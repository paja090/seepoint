'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STATUS_OPTIONS = [
  { value: 'TRIAL', label: 'Zkušební doba (pilot)' },
  { value: 'ACTIVE', label: 'Aktivní – zaplaceno' },
  { value: 'PAST_DUE', label: 'Po splatnosti' },
  { value: 'CANCELLED', label: 'Zrušeno' },
  { value: 'INTERNAL', label: 'Interní (neplatí)' },
];

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function daysLeft(value: string | null): number | null {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

export function OrganizationSubscriptionCard({
  organizationId,
  initialStatus,
  initialTrialEndsAt,
}: {
  organizationId: string;
  initialStatus: string;
  initialTrialEndsAt: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [trialEndsAt, setTrialEndsAt] = useState(toDateInput(initialTrialEndsAt));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const remaining = daysLeft(initialTrialEndsAt);

  function extendTrial(days: number) {
    const base = trialEndsAt ? new Date(`${trialEndsAt}T12:00:00Z`) : new Date();
    const from = base.getTime() < Date.now() ? new Date() : base;
    from.setUTCDate(from.getUTCDate() + days);
    setTrialEndsAt(from.toISOString().slice(0, 10));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/organizations/${encodeURIComponent(organizationId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscriptionStatus: status, trialEndsAt: trialEndsAt || null }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Uložení selhalo.');
      setMessage({ ok: true, text: 'Předplatné uloženo.' });
      router.refresh();
    } catch (cause) {
      setMessage({ ok: false, text: cause instanceof Error ? cause.message : 'Uložení selhalo.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Předplatné a fakturace</h2>
          <p className="text-sm text-slate-500">Po zaplacení faktury přepněte stav na „Aktivní“.</p>
        </div>
        {initialStatus === 'TRIAL' && remaining !== null ? (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${remaining < 0 ? 'bg-rose-100 text-rose-700' : remaining <= 7 ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
            {remaining < 0 ? `Zkouška skončila před ${Math.abs(remaining)} dny` : `Zkouška končí za ${remaining} dní`}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Stav předplatného
          <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Konec zkušební doby
          <input className="input mt-1" type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} />
          <span className="mt-2 flex gap-2">
            <button type="button" className="btn-secondary text-xs" onClick={() => extendTrial(14)}>+14 dní</button>
            <button type="button" className="btn-secondary text-xs" onClick={() => extendTrial(30)}>+30 dní</button>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Ukládám…' : 'Uložit předplatné'}</button>
        {message ? <p aria-live="polite" className={`text-sm font-semibold ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</p> : null}
      </div>
    </div>
  );
}
