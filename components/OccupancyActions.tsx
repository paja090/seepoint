'use client';

import { useState } from 'react';
import type { Occupancy, Surface } from '@/lib/types';

type ClientOption = { id: string; name: string };
type Conflict = {
  carrierCode: string;
  surfaceName: string;
  clientName: string;
  campaignName: string;
  dateFrom: string;
  dateTo: string;
  severity: 'block' | 'warning';
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function OccupancyActions({
  surfaces,
  clients,
  activeOccupancy,
}: {
  surfaces: Pick<Surface, 'id' | 'name' | 'price'>[];
  clients: ClientOption[];
  activeOccupancy?: Occupancy;
}) {
  const [surfaceId, setSurfaceId] = useState(surfaces[0]?.id ?? '');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [clientName, setClientName] = useState(clients[0]?.name ?? '');
  const [campaignName, setCampaignName] = useState('Rezervace reklamni plochy');
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(activeOccupancy?.dateTo ?? today());
  const [price, setPrice] = useState(surfaces[0]?.price?.toString() ?? '');
  const [message, setMessage] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [saving, setSaving] = useState(false);

  async function parseResponse(response: Response) {
    const data = await response.json() as { error?: string; warning?: string; conflicts?: Conflict[] };
    setConflicts(data.conflicts ?? []);
    if (!response.ok) throw new Error(data.error || data.warning || 'Akci se nepodarilo ulozit.');
    return data;
  }

  async function createReservation(allowNegotiationConflict = false) {
    setSaving(true);
    setMessage('');
    setConflicts([]);
    try {
      const response = await fetch('/api/occupancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surfaceId,
          clientId,
          clientName,
          campaignName,
          dateFrom,
          dateTo,
          status: 'RESERVED',
          price: price ? Number(price) : undefined,
          createdBy: 'SALES',
          allowNegotiationConflict,
        }),
      });
      await parseResponse(response);
      setMessage('Rezervace byla ulozena.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rezervaci se nepodarilo ulozit.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: 'extend' | 'finish' | 'free') {
    if (!activeOccupancy) return;
    setSaving(true);
    setMessage('');
    setConflicts([]);
    try {
      const response = await fetch('/api/occupancy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeOccupancy.id, action, dateTo, updatedBy: 'SALES' }),
      });
      await parseResponse(response);
      setMessage(action === 'extend' ? 'Kampan byla prodlouzena.' : action === 'finish' ? 'Kampan byla ukoncena.' : 'Plocha byla oznacena jako volna.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Akci se nepodarilo ulozit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Plocha</span>
          <select className="input" value={surfaceId} onChange={(event) => {
            const nextSurfaceId = event.target.value;
            const surface = surfaces.find((item) => item.id === nextSurfaceId);
            setSurfaceId(nextSurfaceId);
            setPrice(surface?.price?.toString() ?? '');
          }}>
            {surfaces.map((surface) => <option key={surface.id} value={surface.id}>{surface.name}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Klient</span>
          <input
            className="input"
            list="occupancy-action-clients"
            value={clientName}
            onChange={(event) => {
              setClientName(event.target.value);
              setClientId(clients.find((client) => client.name === event.target.value)?.id ?? '');
            }}
          />
          <datalist id="occupancy-action-clients">
            {clients.map((client) => <option key={client.id} value={client.name} />)}
          </datalist>
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Kampan</span>
          <input className="input" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Od</span>
          <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Do</span>
          <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cena</span>
          <input className="input" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary" type="button" disabled={saving || !surfaceId || !clientName || !dateFrom || !dateTo} onClick={() => void createReservation()}>
          Pridat rezervaci
        </button>
        {activeOccupancy && (
          <>
            <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" type="button" disabled={saving} onClick={() => void runAction('extend')}>Prodlouzit kampan</button>
            <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" type="button" disabled={saving} onClick={() => void runAction('finish')}>Ukoncit kampan</button>
            <button className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" type="button" disabled={saving} onClick={() => void runAction('free')}>Oznacit jako volne</button>
          </>
        )}
      </div>
      {conflicts.some((conflict) => conflict.severity === 'warning') && (
        <button className="mt-2 text-sm font-semibold text-amber-800 underline" type="button" disabled={saving} onClick={() => void createReservation(true)}>
          Pokracovat i pres jednani
        </button>
      )}
      {message && <p className="mt-2 text-sm text-slate-700" aria-live="polite">{message}</p>}
      {conflicts.length > 0 && (
        <div className="mt-3 space-y-2">
          {conflicts.map((conflict) => (
            <div className="rounded-lg bg-white p-2 text-xs" key={`${conflict.carrierCode}-${conflict.surfaceName}-${conflict.dateFrom}`}>
              <b>{conflict.carrierCode} - {conflict.surfaceName}</b>: {conflict.clientName}, {conflict.campaignName}, {conflict.dateFrom} - {conflict.dateTo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
