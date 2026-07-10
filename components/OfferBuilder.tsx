'use client';

import { useState } from 'react';
import type { Offer, OfferStatus } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

type ClientOption = { id: string; name: string };
type SurfaceOption = {
  id: string;
  name: string;
  mediaType: string;
  status: string;
  price?: number;
  carrier: { code: string; name: string; city: string };
};
type Conflict = {
  surfaceId: string;
  surfaceName: string;
  carrierName: string;
  carrierCode: string;
  status: string;
  clientName: string;
  campaignName: string;
  dateFrom: string;
  dateTo: string;
  severity: 'block' | 'warning';
};

export function OfferBuilder({ clients, surfaces }: { clients: ClientOption[]; surfaces: SurfaceOption[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [title, setTitle] = useState('Nabidka reklamnich ploch');
  const [surfaceId, setSurfaceId] = useState(surfaces[0]?.id ?? '');
  const selectedSurface = surfaces.find((surface) => surface.id === surfaceId);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [price, setPrice] = useState(selectedSurface?.price?.toString() ?? '');
  const [validUntil, setValidUntil] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<OfferStatus>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [createdOffer, setCreatedOffer] = useState<Offer | null>(null);

  async function saveOffer() {
    setSaving(true);
    setMessage('');
    setConflicts([]);
    setCreatedOffer(null);
    try {
      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, title, status, validUntil, note, createdBy: 'SALES', items: [{ surfaceId, dateFrom, dateTo, price }] }),
      });
      const data = await response.json() as { offer?: Offer; conflicts?: Conflict[]; error?: string };
      setConflicts(data.conflicts ?? []);
      if (!response.ok) throw new Error(data.error || 'Nabidku se nepodarilo ulozit.');
      setCreatedOffer(data.offer ?? null);
      setMessage((data.conflicts?.length ?? 0) > 0 ? 'Nabidka je ulozena, ale ma terminove upozorneni.' : 'Nabidka je ulozena bez kolizi.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nabidku se nepodarilo ulozit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Nova nabidka</h2>
          <p className="text-sm text-slate-500">Prvni verze vybira plochu ze seznamu. Konflikty se zobrazi pred ulozenim.</p>
        </div>
        {createdOffer && <StatusBadge value={createdOffer.status} />}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Klient</span><select className="input" value={clientId} onChange={(event) => setClientId(event.target.value)}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nazev nabidky</span><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="lg:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reklamni plocha</span><select className="input" value={surfaceId} onChange={(event) => { setSurfaceId(event.target.value); const next = surfaces.find((surface) => surface.id === event.target.value); setPrice(next?.price?.toString() ?? ''); }}>{surfaces.map((surface) => <option key={surface.id} value={surface.id}>{surface.carrier.code} - {surface.carrier.city} - {surface.name} - {surface.status}</option>)}</select></label>
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Termin od</span><input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Termin do</span><input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cena</span><input className="input" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Platnost nabidky do</span><input className="input" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
        <label><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Stav nabidky</span><select className="input" value={status} onChange={(event) => setStatus(event.target.value as OfferStatus)}><option value="DRAFT">Draft</option><option value="SENT">Odeslana</option></select></label>
        <label className="lg:col-span-2"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Poznamka</span><textarea className="input min-h-24" value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="btn-primary" type="button" disabled={saving} onClick={() => void saveOffer()}>{saving ? 'Ukladam...' : 'Ulozit nabidku'}</button>
        {message && <p className="text-sm text-slate-600" aria-live="polite">{message}</p>}
      </div>

      {conflicts.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">Report kolizi terminu</h3>
          <div className="mt-2 space-y-2">
            {conflicts.map((conflict) => (
              <div className="rounded-xl bg-white p-3 text-sm" key={`${conflict.surfaceId}-${conflict.dateFrom}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><b>{conflict.carrierCode} - {conflict.surfaceName}</b><span className={conflict.severity === 'block' ? 'text-red-700' : 'text-amber-700'}>{conflict.severity === 'block' ? 'Blokujici konflikt' : 'Upozorneni'}</span></div>
                <p className="text-slate-600">{conflict.clientName} - {conflict.campaignName} - {conflict.dateFrom} - {conflict.dateTo}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
