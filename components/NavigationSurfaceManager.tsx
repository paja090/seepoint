'use client';

import { useState } from 'react';
import type { Client, Surface } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

type ClientOption = Pick<Client, 'id' | 'name'>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function NavigationSurfaceManager({
  carrierId,
  surfaces,
  clients,
  canEdit = true,
}: {
  carrierId: string;
  surfaces: Surface[];
  clients: ClientOption[];
  canEdit?: boolean;
}) {
  const [activeModalSurfaceId, setActiveModalSurfaceId] = useState<string | null>(null);

  // Form states for setting client / rental
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [distanceMeters, setDistanceMeters] = useState('');
  const [directionDescription, setDirectionDescription] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Form states for adding a new position on the pole
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [newPositionName, setNewPositionName] = useState('');
  const [newSourcePosition, setNewSourcePosition] = useState('');
  const [newDirection, setNewDirection] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [newDistance, setNewDistance] = useState('');

  function openOccupyModal(surface: Surface) {
    setActiveModalSurfaceId(surface.id);
    setClientName(surface.currentClient?.name ?? '');
    setClientId(surface.currentClientId ?? '');
    setDateFrom(today());
    const activeOcc = surface.occupancies?.find(
      (o) => o.status === 'OCCUPIED' || o.status === 'RESERVED',
    );
    setDateTo(activeOcc?.dateTo ?? '');
    setDestinationName(surface.destinationName ?? '');
    setDistanceMeters(surface.distanceMeters ? surface.distanceMeters.toString() : '');
    setDirectionDescription(surface.directionDescription ?? '');
    setNote(surface.note ?? '');
    setMessage('');
  }

  async function handleOccupySurface(surfaceId: string, isFree = false) {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/surfaces/${surfaceId}/client`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: isFree ? null : clientId || undefined,
          clientName: isFree ? '' : clientName,
          dateFrom: isFree ? undefined : dateFrom,
          dateTo: isFree ? undefined : dateTo,
          destinationName,
          distanceMeters: distanceMeters ? Number(distanceMeters) : undefined,
          directionDescription,
          note,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Akci se nepodařilo uložit.');

      setMessage(isFree ? 'Pozice byla uvolněna.' : 'Pronájem byl úspěšně uložen.');
      setActiveModalSurfaceId(null);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPosition() {
    if (!newPositionName.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/carriers/${carrierId}/surfaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPositionName,
          sourcePosition: newSourcePosition,
          directionDescription: newDirection,
          destinationName: newDestination,
          distanceMeters: newDistance ? Number(newDistance) : undefined,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Nepodařilo se přidat pozici.');

      setShowAddPosition(false);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při přidávání pozice.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleOutOfService(surface: Surface) {
    const nextStatus = surface.status === 'OUT_OF_SERVICE' ? 'AVAILABLE' : 'OUT_OF_SERVICE';
    setSaving(true);
    try {
      const response = await fetch(`/api/carriers/${carrierId}/surfaces`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surfaceId: surface.id,
          status: nextStatus,
        }),
      });
      if (!response.ok) throw new Error('Nepodařilo se změnit stav pozice.');
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při změně stavu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Navigační pozice na tomto sloupu ({surfaces.length})</h3>
          <p className="text-xs text-slate-500">
            Každá tabule na sloupu má samostatného klienta, směr, cíl a historii pronájmu.
          </p>
        </div>
        {canEdit && (
          <button
            className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
            onClick={() => setShowAddPosition(!showAddPosition)}
            type="button"
          >
            {showAddPosition ? 'Zavřít formulář' : '➕ Přidat další pozici na sloup'}
          </button>
        )}
      </div>

      {showAddPosition && (
        <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4 space-y-3">
          <h4 className="font-semibold text-sm text-sky-900">Nová navigační pozice</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Název / Číslo pozice *</span>
              <input
                className="w-full rounded-xl border border-slate-300 p-2"
                placeholder="např. Pozice 3 - Dolní tabule"
                value={newPositionName}
                onChange={(e) => setNewPositionName(e.target.value)}
              />
            </label>
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Označení pozice (sourcePosition)</span>
              <input
                className="w-full rounded-xl border border-slate-300 p-2"
                placeholder="např. A3"
                value={newSourcePosition}
                onChange={(e) => setNewSourcePosition(e.target.value)}
              />
            </label>
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Směr</span>
              <input
                className="w-full rounded-xl border border-slate-300 p-2"
                placeholder="např. vpravo / ul. Nádražní"
                value={newDirection}
                onChange={(e) => setNewDirection(e.target.value)}
              />
            </label>
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Cíl / Prodejna</span>
              <input
                className="w-full rounded-xl border border-slate-300 p-2"
                placeholder="např. Albert Hrabůvka"
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
              />
            </label>
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Vzdálenost (v metrech)</span>
              <input
                className="w-full rounded-xl border border-slate-300 p-2"
                placeholder="např. 350"
                type="number"
                value={newDistance}
                onChange={(e) => setNewDistance(e.target.value)}
              />
            </label>
          </div>
          <button
            className="rounded-xl bg-sky-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            disabled={saving || !newPositionName.trim()}
            onClick={() => void handleAddPosition()}
            type="button"
          >
            Vytvořit novou pozici
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {surfaces.map((surface, index) => {
          const activeOccupancy = surface.occupancies?.find(
            (o) => o.status === 'OCCUPIED' || o.status === 'RESERVED',
          );

          const isOccupied = surface.status === 'OCCUPIED' || Boolean(activeOccupancy);
          const isOutOfService = surface.status === 'OUT_OF_SERVICE';

          return (
            <div
              className={`rounded-2xl border p-4 shadow-sm space-y-3 transition ${
                isOutOfService
                  ? 'border-slate-300 bg-slate-100 opacity-75'
                  : isOccupied
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-sky-300 bg-white'
              }`}
              key={surface.id}
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-200/60 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-extrabold text-white">
                      #{index + 1}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900">{surface.name}</h4>
                  </div>
                  {surface.sourcePosition && (
                    <span className="text-[11px] text-slate-500">Kód pozice: {surface.sourcePosition}</span>
                  )}
                </div>
                <StatusBadge value={isOutOfService ? 'OUT_OF_SERVICE' : isOccupied ? 'OCCUPIED' : 'AVAILABLE'} />
              </div>

              <div className="grid gap-1.5 text-xs text-slate-700">
                <p>
                  <strong className="text-slate-900">Klient:</strong>{' '}
                  {surface.currentClient ? (
                    <span className="font-semibold text-emerald-800">{surface.currentClient.name}</span>
                  ) : (
                    <span className="italic text-slate-400">Volná pozice bez klienta</span>
                  )}
                </p>

                {activeOccupancy && (
                  <p>
                    <strong className="text-slate-900">Pronajato do:</strong>{' '}
                    <span className="font-bold text-slate-900">{activeOccupancy.dateTo}</span> (od {activeOccupancy.dateFrom})
                  </p>
                )}

                {(surface.destinationName || surface.directionDescription || surface.distanceMeters) && (
                  <div className="mt-1 rounded-xl bg-slate-100/80 p-2 space-y-1 text-[11px]">
                    {surface.destinationName && (
                      <p>🎯 <strong>Cíl / Prodejna:</strong> {surface.destinationName}</p>
                    )}
                    {surface.directionDescription && (
                      <p>🧭 <strong>Směr:</strong> {surface.directionDescription}</p>
                    )}
                    {surface.distanceMeters !== undefined && surface.distanceMeters !== null && (
                      <p>📏 <strong>Vzdálenost:</strong> {surface.distanceMeters} m po silnici</p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons for Surface */}
              {canEdit && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/60 text-xs">
                  <button
                    className={`rounded-xl px-3 py-1.5 font-bold transition ${
                      isOccupied
                        ? 'bg-amber-600 text-white hover:bg-amber-700'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                    onClick={() => openOccupyModal(surface)}
                    type="button"
                  >
                    {isOccupied ? '✏️ Upravit / Prodloužit' : '✅ Nastavit jako obsazené'}
                  </button>

                  {isOccupied && (
                    <button
                      className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-50"
                      onClick={() => void handleOccupySurface(surface.id, true)}
                      type="button"
                    >
                      🚪 Ukončit pronájem (uvolnit)
                    </button>
                  )}

                  <button
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => void handleToggleOutOfService(surface)}
                    type="button"
                  >
                    {isOutOfService ? 'Obnovit provoz' : 'Mimo provoz'}
                  </button>
                </div>
              )}

              {/* History dropdown preview */}
              {surface.occupancies && surface.occupancies.length > 0 && (
                <details className="mt-2 text-[11px] text-slate-500">
                  <summary className="cursor-pointer font-medium hover:text-slate-800">
                    📜 Historie pronájmů ({surface.occupancies.length})
                  </summary>
                  <ul className="mt-1 space-y-1 pl-2 border-l border-slate-300">
                    {surface.occupancies.map((occ) => (
                      <li key={occ.id}>
                        {occ.clientName} ({occ.dateFrom} - {occ.dateTo}) · <StatusBadge value={occ.status} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal for setting Occupancy & Navigation Details */}
      {activeModalSurfaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <h4 className="text-lg font-bold text-slate-900">Správa pronájmu navigační pozice</h4>
            
            {message && (
              <div className="rounded-xl bg-amber-100 p-3 text-xs font-semibold text-amber-900">
                {message}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="block mb-1 font-semibold text-slate-700">Klient (Povinné) *</span>
                <input
                  className="w-full rounded-xl border border-slate-300 p-2.5"
                  list="nav-modal-clients"
                  placeholder="Vyberte nebo zadejte jméno klienta"
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    const match = clients.find((c) => c.name === e.target.value);
                    setClientId(match?.id ?? '');
                  }}
                />
                <datalist id="nav-modal-clients">
                  {clients.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="block mb-1 font-semibold text-slate-700">Pronajato od *</span>
                  <input
                    className="w-full rounded-xl border border-slate-300 p-2.5"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label>
                  <span className="block mb-1 font-semibold text-slate-700">Pronajato do *</span>
                  <input
                    className="w-full rounded-xl border border-slate-300 p-2.5"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="block mb-1 font-semibold text-slate-700">Cíl / Prodejna</span>
                  <input
                    className="w-full rounded-xl border border-slate-300 p-2.5"
                    placeholder="např. Albert Hrabůvka"
                    value={destinationName}
                    onChange={(e) => setDestinationName(e.target.value)}
                  />
                </label>
                <label>
                  <span className="block mb-1 font-semibold text-slate-700">Vzdálenost (v metrech)</span>
                  <input
                    className="w-full rounded-xl border border-slate-300 p-2.5"
                    placeholder="např. 350"
                    type="number"
                    value={distanceMeters}
                    onChange={(e) => setDistanceMeters(e.target.value)}
                  />
                </label>
              </div>

              <label className="block">
                <span className="block mb-1 font-semibold text-slate-700">Směr navigace</span>
                <input
                  className="w-full rounded-xl border border-slate-300 p-2.5"
                  placeholder="např. vpravo / ulice Nádražní"
                  value={directionDescription}
                  onChange={(e) => setDirectionDescription(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="block mb-1 font-semibold text-slate-700">Poznámka</span>
                <textarea
                  className="w-full rounded-xl border border-slate-300 p-2.5"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setActiveModalSurfaceId(null)}
                type="button"
              >
                Zrušit
              </button>
              <button
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                disabled={saving || !clientName.trim() || !dateFrom || !dateTo}
                onClick={() => void handleOccupySurface(activeModalSurfaceId)}
                type="button"
              >
                Uložit pronájem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
