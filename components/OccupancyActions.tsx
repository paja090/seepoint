'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [surfaceId, setSurfaceId] = useState(surfaces[0]?.id ?? '');
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [clientName, setClientName] = useState(clients[0]?.name ?? '');
  const [campaignName, setCampaignName] = useState('Rezervace reklamní plochy');
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(activeOccupancy?.dateTo ?? today());
  const [price, setPrice] = useState(surfaces[0]?.price?.toString() ?? '');
  const [message, setMessage] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [saving, setSaving] = useState(false);

  async function parseResponse(response: Response) {
    const data = (await response.json()) as { error?: string; warning?: string; conflicts?: Conflict[] };
    setConflicts(data.conflicts ?? []);
    if (!response.ok) throw new Error(data.error || data.warning || 'Akci se nepodařilo uložit.');
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
      setMessage('✓ Rezervace byla uložena.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rezervaci se nepodařilo uložit.');
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
      setMessage(
        action === 'extend'
          ? '✓ Kampaň byla prodloužena.'
          : action === 'finish'
          ? '✓ Kampaň byla ukončena.'
          : '✓ Plocha byla označena jako volná.'
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Akci se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-xs">
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Plocha</span>
          <select
            className="input"
            value={surfaceId}
            onChange={(event) => {
              const nextSurfaceId = event.target.value;
              const surface = surfaces.find((item) => item.id === nextSurfaceId);
              setSurfaceId(nextSurfaceId);
              setPrice(surface?.price?.toString() ?? '');
            }}
          >
            {surfaces.map((surface) => (
              <option key={surface.id} value={surface.id}>
                {surface.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Klient</span>
          <input
            className="input"
            list="occupancy-action-clients"
            placeholder="Začněte psát název klienta..."
            value={clientName}
            onChange={(event) => {
              setClientName(event.target.value);
              setClientId(clients.find((client) => client.name === event.target.value)?.id ?? '');
            }}
          />
          <datalist id="occupancy-action-clients">
            {clients.map((client) => (
              <option key={client.id} value={client.name} />
            ))}
          </datalist>
        </label>

        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Kampaň</span>
          <input className="input" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
        </label>

        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Od</span>
          <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>

        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Do</span>
          <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>

        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">Cena bez DPH (Kč)</span>
          <input className="input" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
        <button
          className="btn-primary flex items-center gap-1.5"
          type="button"
          disabled={saving || !surfaceId || !clientName || !dateFrom || !dateTo}
          onClick={() => void createReservation()}
        >
          {saving ? 'Ukládám…' : 'Přidat rezervaci'}
        </button>

        {activeOccupancy && (
          <>
            <button
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              type="button"
              disabled={saving}
              onClick={() => void runAction('extend')}
            >
              Prodloužit kampaň
            </button>
            <button
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              type="button"
              disabled={saving}
              onClick={() => void runAction('finish')}
            >
              Ukončit kampaň
            </button>
            <button
              className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition"
              type="button"
              disabled={saving}
              onClick={() => void runAction('free')}
            >
              Označit jako volné
            </button>
          </>
        )}
      </div>

      {conflicts.some((conflict) => conflict.severity === 'warning') && (
        <button
          className="mt-3 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition"
          type="button"
          disabled={saving}
          onClick={() => void createReservation(true)}
        >
          Pokračovat i přes jednání
        </button>
      )}

      {message && (
        <p className="mt-3 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl" aria-live="polite">
          {message}
        </p>
      )}

      {conflicts.length > 0 && (
        <div className="mt-3 space-y-2">
          {conflicts.map((conflict) => (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-900 font-medium"
              key={`${conflict.carrierCode}-${conflict.surfaceName}-${conflict.dateFrom}`}
            >
              <b>{conflict.carrierCode} - {conflict.surfaceName}</b>: {conflict.clientName}, {conflict.campaignName}, {conflict.dateFrom} - {conflict.dateTo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
