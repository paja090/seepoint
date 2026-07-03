'use client';

import type { WorkOrderStatus } from '@prisma/client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workStatusLabels } from '@/lib/work';

type WorkOrderActionsProps = {
  id: string;
  status: WorkOrderStatus;
  ftdSent: boolean;
  invoiced: boolean;
  requestedBy?: string | null;
};

export function WorkOrderActions({ id, status, ftdSent, invoiced, requestedBy }: WorkOrderActionsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError('');
    const response = await fetch(`/api/work-orders/${id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: form.get('status'), ftdSent: form.get('ftdSent') === 'on', invoiced: form.get('invoiced') === 'on' }),
    });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) { setError(result?.error || 'Stav se nepodařilo uložit.'); return; }
    router.refresh();
  }

  return (
    <form className="card space-y-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-bold">Aktualizace práce</h2>
      <label>Stav<select className="input mt-1" defaultValue={status} name="status">{Object.entries(workStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pracovník</p>
        <label className="mt-2 flex items-center gap-3"><input defaultChecked={ftdSent} name="ftdSent" type="checkbox" /> Fotodokumentace nahrána</label>
      </div>
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zadavatel: {requestedBy || 'neuveden'}</p>
        <label className="mt-2 flex items-center gap-3"><input defaultChecked={invoiced} name="invoiced" type="checkbox" /> Faktura vystavena</label>
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Ukládám…' : 'Uložit změny'}</button>
    </form>
  );
}
