'use client';

import type { WorkOrderStatus, WorkPriority } from '@prisma/client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workPriorityLabels, workStatusLabels } from '@/lib/work';

type WorkOrderActionsProps = {
  id: string;
  status: WorkOrderStatus;
  priority: WorkPriority;
  price?: string | null;
  ftdSent: boolean;
  invoiced: boolean;
  requestedBy?: string | null;
};

export function WorkOrderActions({ id, status, priority, price, ftdSent, invoiced, requestedBy }: WorkOrderActionsProps) {
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
      body: JSON.stringify({ status: form.get('status'), priority: form.get('priority'), price: form.get('price'), ftdSent: form.get('ftdSent') === 'on', invoiced: form.get('invoiced') === 'on' }),
    });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) { setError(result?.error || 'Změny se nepodařilo uložit.'); return; }
    router.refresh();
  }

  return (
    <form className="card space-y-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold text-slate-950">Aktualizace práce</h2>
      <label>Stav<select className="input mt-1" defaultValue={status} name="status">{Object.entries(workStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pracovník</p>
        <label className="mt-2 flex items-center gap-3"><input defaultChecked={ftdSent} name="ftdSent" type="checkbox" /> Fotodokumentace nahrána</label>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zadavatel: {requestedBy || 'neuveden'}</p>
        <label className="block text-sm">Priorita<select className="input mt-1" defaultValue={priority} name="priority">{Object.entries(workPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm">Cena za úkol v Kč<input className="input mt-1" defaultValue={price || ''} min="0" name="price" step="0.01" type="number" /></label>
        <label className="flex items-center gap-3"><input defaultChecked={invoiced} name="invoiced" type="checkbox" /> Faktura vystavena</label>
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Ukládám…' : 'Uložit změny'}</button>
    </form>
  );
}
