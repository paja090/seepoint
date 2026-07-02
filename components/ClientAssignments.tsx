'use client';

import { useEffect, useState } from 'react';
import type { Client, Occupancy, Surface, SurfaceStatus } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

type ClientOption = Pick<Client, 'id' | 'name'>;
type ClientChangeHandler = (
  surfaceId: string,
  currentClient: ClientOption | undefined,
  status: SurfaceStatus,
) => void;
type SurfaceSavedHandler = (
  surfaceId: string,
  currentClient: ClientOption | undefined,
  status: SurfaceStatus,
  occupancy?: Occupancy,
) => void;

type AssignmentResponse = {
  id: string;
  currentClientId: string | null;
  currentClient: ClientOption | null;
  status: SurfaceStatus;
  occupancy: Occupancy | null;
  error?: string;
};

function titleWithoutRepeatedDirection(surface: Surface) {
  const direction = surface.directionDescription?.trim();
  if (!direction) return surface.name;
  const name = surface.name.trim();
  if (!name.toLocaleLowerCase('cs').endsWith(direction.toLocaleLowerCase('cs'))) return name;
  return name.slice(0, -direction.length).replace(/[\s·–-]+$/, '').trim();
}

function SurfaceClientRow({
  surface,
  clients,
  onSaved,
}: {
  surface: Surface;
  clients: ClientOption[];
  onSaved: SurfaceSavedHandler;
}) {
  const editableCampaign = surface.occupancies.find((occupancy) =>
    occupancy.status === 'ACTIVE' || occupancy.status === 'RESERVED');
  const [clientName, setClientName] = useState(surface.currentClient?.name ?? '');
  const [dateFrom, setDateFrom] = useState(editableCampaign?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(editableCampaign?.dateTo ?? '');
  const [occupancyId, setOccupancyId] = useState(editableCampaign?.id);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const listId = `clients-${surface.id}`;
  const repeatedOrientation = surface.orientation?.trim().toLocaleLowerCase('cs')
    === surface.directionDescription?.trim().toLocaleLowerCase('cs');
  const legacyDescription = [
    surface.size,
    repeatedOrientation ? undefined : surface.orientation,
    surface.price ? `${surface.price.toLocaleString('cs-CZ')} Kč` : undefined,
  ].filter(Boolean).join(' · ');
  const mediaLabel = surface.mediaType === 'NAVIGATION_SIGN' ? 'Navigace' : surface.mediaType;

  async function save(nextClientName: string) {
    setSaving(true);
    setMessage('');
    try {
      if (nextClientName.trim() && Boolean(dateFrom) !== Boolean(dateTo)) {
        throw new Error('Vyplňte datum od i datum do.');
      }
      const response = await fetch(`/api/surfaces/${surface.id}/client`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextClientName.trim()
          ? { clientName: nextClientName, dateFrom, dateTo, occupancyId }
          : { clientName: '' }),
      });
      const data = await response.json() as AssignmentResponse;
      if (!response.ok) throw new Error(data.error || 'Klienta a termín se nepodařilo uložit.');
      setClientName(data.currentClient?.name ?? '');
      if (data.occupancy) {
        setDateFrom(data.occupancy.dateFrom);
        setDateTo(data.occupancy.dateTo);
        setOccupancyId(data.occupancy.id);
      }
      if (!data.currentClient) {
        setDateFrom('');
        setDateTo('');
        setOccupancyId(undefined);
      }
      setMessage(data.currentClient
        ? data.occupancy ? 'Klient a termín kampaně byly uloženy.' : 'Klient byl uložen.'
        : 'Klient byl odebrán.');
      onSaved(surface.id, data.currentClient ?? undefined, data.status, data.occupancy ?? undefined);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Klienta a termín se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-xl border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold">{titleWithoutRepeatedDirection(surface)}</h4>
          <p className="text-xs text-slate-500">{mediaLabel}</p>
        </div>
        <div className="shrink-0 pt-0.5"><StatusBadge value={surface.status} /></div>
      </div>
      {surface.directionDescription && (
        <p className="mt-2 text-sm"><span className="font-medium">Směr:</span> {surface.directionDescription}</p>
      )}
      {legacyDescription && <p className="text-sm text-slate-500">{legacyDescription}</p>}

      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Klient a kampaň</span>
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
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save(clientName);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700">Klient</span>
            <input
              className="input w-full"
              list={listId}
              placeholder="Vyberte nebo napište nového klienta"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
            />
            <datalist id={listId}>
              {clients.map((client) => <option key={client.id} value={client.name} />)}
            </datalist>
            <span className="mt-1 block text-xs text-slate-500">
              Pokud klient v nabídce není, napište nový název. Vytvoří se automaticky při uložení.
            </span>
          </label>

          <fieldset>
            <legend className="mb-1 text-xs font-medium text-slate-700">Platnost kampaně (volitelné)</legend>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="mb-1 block text-xs text-slate-500">Od</span>
                <input className="input w-full" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              </label>
              <label>
                <span className="mb-1 block text-xs text-slate-500">Do</span>
                <input className="input w-full" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              </label>
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary whitespace-nowrap" type="submit" disabled={saving || !clientName.trim()}>
              {saving ? 'Ukládám…' : 'Uložit klienta a termín'}
            </button>
            {surface.currentClient && (
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                type="button"
                disabled={saving}
                onClick={() => void save('')}
              >
                Odebrat klienta
              </button>
            )}
          </div>
        </form>
        {message && <p className="mt-2 text-xs text-slate-600" aria-live="polite">{message}</p>}
      </div>
    </article>
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

  function handleSaved(
    surfaceId: string,
    currentClient: ClientOption | undefined,
    status: SurfaceStatus,
    occupancy?: Occupancy,
  ) {
    setSurfaces((current) => current.map((surface) => {
      if (surface.id !== surfaceId) return surface;
      const occupancies = occupancy
        ? surface.occupancies.some((item) => item.id === occupancy.id)
          ? surface.occupancies.map((item) => item.id === occupancy.id ? occupancy : item)
          : [...surface.occupancies, occupancy]
        : surface.occupancies;
      return { ...surface, currentClientId: currentClient?.id, currentClient, status, occupancies };
    }));
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
