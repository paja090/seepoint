'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, CheckCircle2, AlertTriangle, Clock, Trash2, Check, X } from 'lucide-react';

type Item = {
  id: string;
  carrierId: string | null;
  surfaceId: string | null;
  crmRealizationId: string | null;
  description: string | null;
  estimatedMinutes: number | null;
  status: string;
  issue: string | null;
};

export function WorkItemsEditor({
  workOrderId,
  items,
  carriers,
  realizations,
}: {
  workOrderId: string;
  items: Item[];
  carriers: Array<{ id: string; code: string; name: string; surfaces: Array<{ id: string; name: string }> }>;
  realizations: Array<{ id: string; carrierId: string | null; surfaceId: string | null }>;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  async function submit(form: FormData, id?: string, action = 'save') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          requestKey,
          carrierId: form.get('carrier') || null,
          surfaceId: form.get('surface') || null,
          crmRealizationId: form.get('realization') || null,
          description: form.get('description') || null,
          estimatedMinutes: form.get('minutes') ? Number(form.get('minutes')) : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setRequestKey(crypto.randomUUID());
      setAddingNew(false);
      setEditingItemId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení položky selhalo.');
    } finally {
      setBusy(false);
    }
  }

  const getStatusBadge = (status: string, issue: string | null) => {
    if (issue) {
      return (
        <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
          <AlertTriangle size={12} />
          <span>Problém v terénu</span>
        </span>
      );
    }
    switch (status) {
      case 'DONE':
        return (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 size={12} />
            <span>Hotovo</span>
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
            <Clock size={12} />
            <span>Probíhá</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
            <span>Naplánováno</span>
          </span>
        );
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950 flex items-center gap-2">
            <MapPin size={18} className="text-sky-600" />
            <span>Montážní lokality a nosiče zakázky</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pokud zakázka zahrnuje více různých míst nebo nosičů, každé místo tvoří samostatnou zastávku v trase.
          </p>
        </div>

        {!addingNew && (
          <button
            type="button"
            onClick={() => setAddingNew(true)}
            className="flex items-center gap-1.5 rounded-xl bg-sky-50 border border-sky-200 px-3.5 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 transition shadow-sm"
          >
            <Plus size={14} />
            <span>Přidat montážní místo</span>
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      {/* Adding form */}
      {addingNew && (
        <form
          action={(f) => submit(f)}
          className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-900">
              Nové montážní místo
            </h3>
            <button
              type="button"
              onClick={() => setAddingNew(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              Zrušit
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block">Nosič</label>
              <select name="carrier" className="input mt-1 w-full text-xs font-medium">
                <option value="">Vyberte reklamní nosič…</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block">Orientační délka práce (minuty)</label>
              <input
                type="number"
                min={5}
                max={480}
                name="minutes"
                placeholder="Např. 45"
                defaultValue={45}
                className="input mt-1 w-full text-xs font-medium"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block">Pokyny pro montážníka na místě</label>
              <input
                type="text"
                name="description"
                placeholder="Např. Plachta na levé straně, žebřík nutný…"
                className="input mt-1 w-full text-xs font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAddingNew(false)}
              className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Zrušit
            </button>
            <button
              disabled={busy}
              className="rounded-xl bg-sky-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-600 disabled:opacity-50"
            >
              {busy ? 'Ukládám…' : 'Uložit místo'}
            </button>
          </div>
        </form>
      )}

      {/* Items list */}
      <div className="space-y-2.5">
        {items.length === 0 && !addingNew ? (
          <p className="text-center py-6 text-xs text-slate-400 font-medium">
            Tato zakázka zatím nemá rozepsaná dílčí montážní místa. Celá zakázka se plánuje jako 1 výjezd.
          </p>
        ) : (
          items.map((item) => {
            const carrier = carriers.find((c) => c.id === item.carrierId);
            const isEditing = editingItemId === item.id;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 transition hover:border-slate-300"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900">
                      {carrier ? `${carrier.code} · ${carrier.name}` : item.description || 'Montážní bod'}
                    </span>
                    {getStatusBadge(item.status, item.issue)}
                    {item.estimatedMinutes && (
                      <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                        ⏱️ {item.estimatedMinutes} min
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.issue && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const f = new FormData();
                          void submit(f, item.id, 'resolve');
                        }}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-sm"
                      >
                        ✓ Problém vyřešen
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (confirm('Opravdu chcete tuto montážní položku zrušit?')) {
                          const f = new FormData();
                          void submit(f, item.id, 'cancel');
                        }
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Zrušit položku"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {item.description && (
                  <p className="text-xs text-slate-600 font-medium bg-white p-2.5 rounded-xl border border-slate-100">
                    {item.description}
                  </p>
                )}

                {item.issue && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Nahlášený problém z terénu:</strong>
                      <span>{item.issue}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
