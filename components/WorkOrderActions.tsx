'use client';

import type { WorkOrderStatus, WorkPriority } from '@prisma/client';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { workPriorityLabels, workStatusLabels } from '@/lib/work';
import { Trash2, Copy } from 'lucide-react';

type WorkOrderActionsProps = {
  id: string;
  title?: string;
  status: WorkOrderStatus;
  priority: WorkPriority;
  price?: string | null;
  ftdSent: boolean;
  invoiced: boolean;
  requestedBy?: string | null;
};

export function WorkOrderActions({
  id,
  title = '',
  status,
  priority,
  price,
  ftdSent,
  invoiced,
  requestedBy,
}: WorkOrderActionsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError('');
    const response = await fetch(`/api/work-orders/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: form.get('status'),
        priority: form.get('priority'),
        price: form.get('price'),
        ftdSent: form.get('ftdSent') === 'on',
        invoiced: form.get('invoiced') === 'on',
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) {
      setError(result?.error || 'Změny se nepodařilo uložit.');
      return;
    }
    router.refresh();
  }

  const handleDelete = async () => {
    if (!confirm(`Opravdu chcete odebrat pracovní úkol "${title || id}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/work-orders/${id}`, { method: 'DELETE' });
      const out = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(out.error || 'Odebrání selhalo');
      if (out.message) alert(out.message);
      router.push('/work');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při mazání úkolu.');
      setDeleting(false);
    }
  };

  return (
    <form className="card space-y-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-black text-slate-900">Aktualizace stavu zakázky</h2>
      <label className="block text-xs font-bold text-slate-700">
        Stav úkolu
        <select className="input mt-1 font-semibold" defaultValue={status} name="status">
          {Object.entries(workStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Montážník / Terén</p>
        <label className="flex items-center gap-3 text-xs font-extrabold text-slate-800 cursor-pointer">
          <input
            defaultChecked={ftdSent}
            name="ftdSent"
            type="checkbox"
            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
          />
          Fotodokumentace nahrána na Google Disk
        </label>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 p-3 bg-slate-50">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Zadavatel: {requestedBy || 'neuveden'}
        </p>
        <label className="block text-xs font-bold text-slate-700">
          Priorita
          <select className="input mt-1 font-semibold" defaultValue={priority} name="priority">
            {Object.entries(workPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <input type="hidden" name="price" value={price || ''} />

        <label className="flex items-center gap-3 text-xs font-extrabold text-slate-800 cursor-pointer">
          <input
            defaultChecked={invoiced}
            name="invoiced"
            type="checkbox"
            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
          />
          Faktura vystavena
        </label>
      </div>

      {error && <p className="text-xs font-bold text-rose-700">{error}</p>}

      <div className="space-y-2 pt-1">
        <button
          className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 transition shadow-sm"
          disabled={saving}
          type="submit"
        >
          {saving ? 'Ukládám…' : '💾 Uložit změny'}
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-extrabold text-rose-800 hover:bg-rose-100 transition disabled:opacity-50"
        >
          <Trash2 size={14} /> {deleting ? 'Odebírám…' : '🗑️ Odebrat zakázku'}
        </button>
      </div>
    </form>
  );
}
