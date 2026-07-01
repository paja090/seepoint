'use client';

import { useState, type FormEvent } from 'react';
import type { Carrier } from '@/lib/types';

const types: Carrier['type'][] = ['BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE', 'LED_SCREEN', 'OTHER'];
const statuses: Carrier['status'][] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

type ApiError = { error?: string };

export function CarrierForm({ carrier, onSaved }: { carrier?: Partial<Carrier>; onSaved?: (carrier: Carrier) => void }) {
  const [form, setForm] = useState<Partial<Carrier>>(carrier ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const payload = {
      ...form,
      name: form.name?.trim(),
      code: form.code?.trim(),
      city: form.city?.trim(),
      address: form.address?.trim(),
      note: form.note?.trim(),
    };

    if (!payload.name || !payload.code || !payload.city) {
      setError('Vyplňte název, interní kód a město.');
      return;
    }

    if (!Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
      setError('Vyberte platné místo na mapě.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/carriers${form.id ? `/${form.id}` : ''}`, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null) as Carrier | ApiError | null;

      if (!response.ok) {
        const message = result && 'error' in result && result.error;
        throw new Error(message || 'Nosič se nepodařilo uložit.');
      }
      if (!result || !('id' in result)) throw new Error('Server vrátil neplatnou odpověď.');

      onSaved?.(result);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nosič se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  const set = (key: keyof Carrier, value: string | number) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <form className="grid gap-3" onSubmit={save} noValidate>
      <input className="input" placeholder="Název" aria-label="Název" required value={form.name ?? ''} onChange={(event) => set('name', event.target.value)} />
      <input className="input" placeholder="Interní kód" aria-label="Interní kód" required value={form.code ?? ''} onChange={(event) => set('code', event.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <select className="input" aria-label="Typ nosiče" value={form.type ?? 'BILLBOARD'} onChange={(event) => set('type', event.target.value)}>
          {types.map((type) => <option key={type}>{type}</option>)}
        </select>
        <select className="input" aria-label="Stav nosiče" value={form.status ?? 'ACTIVE'} onChange={(event) => set('status', event.target.value)}>
          {statuses.map((status) => <option key={status}>{status}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input className="input" aria-label="Latitude" type="number" step="any" required placeholder="Latitude" value={form.latitude ?? ''} onChange={(event) => set('latitude', Number(event.target.value))} />
        <input className="input" aria-label="Longitude" type="number" step="any" required placeholder="Longitude" value={form.longitude ?? ''} onChange={(event) => set('longitude', Number(event.target.value))} />
      </div>
      <input className="input" placeholder="Adresa" aria-label="Adresa" value={form.address ?? ''} onChange={(event) => set('address', event.target.value)} />
      <input className="input" placeholder="Město" aria-label="Město" required value={form.city ?? ''} onChange={(event) => set('city', event.target.value)} />
      <textarea className="input" placeholder="Poznámka" aria-label="Poznámka" value={form.note ?? ''} onChange={(event) => set('note', event.target.value)} />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={saving} className="rounded-xl bg-slate-950 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60">
        {saving ? 'Ukládám…' : 'Uložit nosič'}
      </button>
    </form>
  );
}
