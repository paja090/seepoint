'use client';

import { useEffect, useState } from 'react';
import type { Client, Surface, SurfaceStatus } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

type ClientOption = Pick<Client, 'id' | 'name'>;
type ClientChangeHandler = (
  surfaceId: string,
  currentClient: ClientOption | undefined,
  status: SurfaceStatus,
) => void;

type AssignmentResponse = {
  id: string;
  currentClientId: string | null;
  currentClient: ClientOption | null;
  status: SurfaceStatus;
  error?: string;
};

function SurfaceClientRow({
  surface,
  clients,
  onSaved,
}: {
  surface: Surface;
  clients: ClientOption[];
  onSaved: ClientChangeHandler;
}) {
  const [clientName, setClientName] = useState(surface.currentClient?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const listId = `clients-${surface.id}`;
  const legacyDescription = [
    surface.size,
    surface.orientation,
    surface.price ? `${surface.price.toLocaleString('cs-CZ')} Kč` : undefined,
  ].filter(Boolean).join(' · ');

  async function save(nextClientName: string) {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/surfaces/${surface.id}/client`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: nextClientName }),
      });
      const data = await response.json() as AssignmentResponse;
      if (!response.ok) throw new Error(data.error || 'Klienta se nepodařilo uložit.');
      setClientName(data.currentClient?.name ?? '');
      setMessage(data.currentClient ? 'Klient uložen.' : 'Klient odebrán.');
      onSaved(surface.id, data.currentClient ?? undefined, data.status);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Klienta se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border p-3">
      <div className="flex justify-between gap-3">
        <div>
          <b>{surface.name}</b>
          <p className="text-xs text-slate-500">
            {[surface.mediaType, surface.sourcePosition].filter(Boolean).join(' · ')}
          </p>
        </div>
        <StatusBadge value={surface.status} />
      </div>
      {surface.directionDescription && <p className="mt-2 text-sm">{surface.directionDescription}</p>}
      {legacyDescription && <p className="text-sm text-slate-500">{legacyDescription}</p>}

      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Klient</span>
          {surface.currentClient ? (
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
              {surface.currentClient.name}
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
              Klient neuveden
            </span>
          )}
        </div>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void save(clientName);
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Klient pro {surface.name}</span>
            <input
              className="input w-full"
              list={listId}
              placeholder="Vyberte nebo napište klienta"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
            />
            <datalist id={listId}>
              {clients.map((client) => <option key={client.id} value={client.name} />)}
            </datalist>
          </label>
          <button className="btn-primary whitespace-nowrap" type="submit" disabled={saving || !clientName.trim()}>
            {saving ? 'Ukládám…' : 'Uložit klienta'}
          </button>
          {surface.currentClient && (
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
              type="button"
              disabled={saving}
              onClick={() => void save('')}
            >
              Odebrat
            </button>
          )}
        </form>
        {message && <p className="mt-2 text-xs text-slate-600" aria-live="polite">{message}</p>}
      </div>
    </div>
  );
}

export function ClientAssignments({
  initialSurfaces,
  onChanged,
}: {
  initialSurfaces: Surface[];
  onChanged?: ClientChangeHandler;
}) {
  const [surfaces, setSurfaces] = useState(initialSurfaces);
  const [clients, setClients] = useState<ClientOption[]>(() => {
    const unique = new Map<string, ClientOption>();
    initialSurfaces.forEach((surface) => {
      if (surface.currentClient) unique.set(surface.currentClient.id, surface.currentClient);
    });
    return [...unique.values()];
  });

  useEffect(() => setSurfaces(initialSurfaces), [initialSurfaces]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/clients', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Seznam klientů se nepodařilo načíst.');
        return response.json() as Promise<ClientOption[]>;
      })
      .then(setClients)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error(error);
      });
    return () => controller.abort();
  }, []);

  function handleSaved(surfaceId: string, currentClient: ClientOption | undefined, status: SurfaceStatus) {
    setSurfaces((current) => current.map((surface) => surface.id === surfaceId
      ? { ...surface, currentClientId: currentClient?.id, currentClient, status }
      : surface));
    if (currentClient) {
      setClients((current) => current.some((client) => client.id === currentClient.id)
        ? current
        : [...current, currentClient].sort((left, right) => left.name.localeCompare(right.name, 'cs')));
    }
    onChanged?.(surfaceId, currentClient, status);
  }

  if (surfaces.length === 0) {
    return <p className="text-sm text-slate-500">Tento nosič zatím nemá žádnou reklamní plochu ani navigaci.</p>;
  }

  return (
    <div className="space-y-2">
      {surfaces.map((surface) => (
        <SurfaceClientRow key={surface.id} surface={surface} clients={clients} onSaved={handleSaved} />
      ))}
    </div>
  );
}
