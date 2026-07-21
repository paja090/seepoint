'use client';

import { useState } from 'react';
import type { Client, Surface } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

type ClientOption = Pick<Client, 'id' | 'name'>;

type OtherCarrierOption = {
  id: string;
  name: string;
  code: string;
  city: string;
  street?: string;
  surfacesCount: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function getDirectionArrow(direction?: string | null) {
  if (!direction) return '🧭';
  const norm = direction.toLowerCase();
  if (norm.includes('vpravo') || norm.includes('doprava') || direction.includes('➔')) return '➔';
  if (norm.includes('vlevo') || norm.includes('doleva') || direction.includes('⬅')) return '⬅';
  if (norm.includes('rovne') || norm.includes('rovně') || norm.includes('primo') || norm.includes('přímo') || direction.includes('⬆')) return '⬆';
  return '🧭';
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
  const [inlineEditingSurfaceId, setInlineEditingSurfaceId] = useState<string | null>(null);
  const [aiExtractingSurfaceId, setAiExtractingSurfaceId] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{
    surfaceId: string;
    destinationName?: string;
    directionDescription?: string;
    directionArrow?: string;
    distanceMeters?: number;
    confidence?: string;
  } | null>(null);

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

  // Pole Merger state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [loadingOtherCarriers, setLoadingOtherCarriers] = useState(false);
  const [otherCarriers, setOtherCarriers] = useState<OtherCarrierOption[]>([]);
  const [selectedCarrierIdsToMerge, setSelectedCarrierIdsToMerge] = useState<string[]>([]);
  const [updateGpsOnMerge, setUpdateGpsOnMerge] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  // Surface Move / Detach state
  const [moveModalSurfaceId, setMoveModalSurfaceId] = useState<string | null>(null);

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

  function openInlineEdit(surface: Surface) {
    setInlineEditingSurfaceId(surface.id);
    setDestinationName(surface.destinationName ?? '');
    setDistanceMeters(surface.distanceMeters ? surface.distanceMeters.toString() : '');
    setDirectionDescription(surface.directionDescription ?? '');
  }

  async function openMergeModal() {
    setShowMergeModal(true);
    setLoadingOtherCarriers(true);
    setSelectedCarrierIdsToMerge([]);
    try {
      const response = await fetch('/api/carriers?carrierType=NAVIGATION&pageSize=2000');
      const data = (await response.json()) as { carriers?: Array<{ id: string; name: string; code: string; city: string; street?: string; surfaces?: unknown[] }> };
      if (data.carriers) {
        const filtered = data.carriers
          .filter((c) => c.id !== carrierId)
          .map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            city: c.city,
            street: c.street,
            surfacesCount: c.surfaces?.length ?? 0,
          }));
        setOtherCarriers(filtered);
      }
    } catch (err) {
      console.error('Failed to load carriers:', err);
    } finally {
      setLoadingOtherCarriers(false);
    }
  }

  async function handleExecuteMerge() {
    if (selectedCarrierIdsToMerge.length === 0) return;
    setSaving(true);
    try {
      const response = await fetch('/api/carriers/merge-navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetCarrierId: carrierId,
          sourceCarrierIds: selectedCarrierIdsToMerge,
          updateGps: updateGpsOnMerge,
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error || 'Nepodařilo se sloučit nosiče.');

      alert(data.message || 'Nosiče byly úspěšně sloučeny na tento sloup.');
      setShowMergeModal(false);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při slučování.');
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveSurface(surfaceId: string, detachToNew = false) {
    setSaving(true);
    try {
      const response = await fetch(`/api/carriers/${carrierId}/surfaces/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surfaceId,
          detachToNewPole: detachToNew,
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error || 'Nepodařilo se přesunout pozici.');

      alert(data.message || 'Pozice byla přesunuta.');
      setMoveModalSurfaceId(null);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při přesunu pozice.');
    } finally {
      setSaving(false);
    }
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
      setInlineEditingSurfaceId(null);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveInlineEdit(surface: Surface) {
    setSaving(true);
    try {
      const response = await fetch(`/api/surfaces/${surface.id}/client`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: surface.currentClient?.name ?? '',
          destinationName,
          distanceMeters: distanceMeters ? Number(distanceMeters) : undefined,
          directionDescription,
        }),
      });
      if (!response.ok) throw new Error('Nepodařilo se uložit směr a vzdálenost.');
      setInlineEditingSurfaceId(null);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setSaving(false);
    }
  }

  async function handleExtractPhotoData(surfaceId: string) {
    setAiExtractingSurfaceId(surfaceId);
    setAiResult(null);
    try {
      const response = await fetch(`/api/surfaces/${surfaceId}/extract-photo-data`);
      const data = (await response.json()) as {
        found: boolean;
        message?: string;
        extracted?: {
          destinationName?: string;
          directionDescription?: string;
          directionArrow?: string;
          distanceMeters?: number;
          confidence?: string;
        };
      };

      if (!response.ok || !data.found || !data.extracted) {
        alert(data.message || 'Z fotek nosiče se nepodařilo automaticky vyčíst směr/vzdálenost.');
        return;
      }

      setAiResult({
        surfaceId,
        ...data.extracted,
      });
    } catch {
      alert('Chyba při rozpoznávání z fotek.');
    } finally {
      setAiExtractingSurfaceId(null);
    }
  }

  async function handleApplyAiResult(surface: Surface) {
    if (!aiResult || aiResult.surfaceId !== surface.id) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/surfaces/${surface.id}/client`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: surface.currentClient?.name ?? '',
          destinationName: aiResult.destinationName ?? surface.destinationName ?? '',
          distanceMeters: aiResult.distanceMeters ?? surface.distanceMeters ?? undefined,
          directionDescription: aiResult.directionDescription ?? surface.directionDescription ?? '',
        }),
      });
      if (!response.ok) throw new Error('Nepodařilo se aplikovat návrh z fotky.');
      setAiResult(null);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při aplikaci návrhu.');
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

  const filteredOtherCarriers = otherCarriers.filter(
    (c) =>
      !searchFilter.trim() ||
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.city.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.street && c.street.toLowerCase().includes(searchFilter.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-tight text-slate-900">
            Navigační pozice na sloupu ({surfaces.length})
          </h3>
          <p className="text-xs text-slate-500">
            Každá navigační tabule má samostatného klienta, směr, cíl prodejny a historii pronájmu.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-2xl border border-sky-300 bg-white px-4 py-2 text-xs font-bold text-sky-900 shadow-sm hover:bg-sky-50 transition"
              onClick={() => void openMergeModal()}
              type="button"
            >
              🔗 Sloučit jiné navigace na tento sloup
            </button>
            <button
              className="rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-sky-700 hover:to-blue-800 transition"
              onClick={() => setShowAddPosition(!showAddPosition)}
              type="button"
            >
              {showAddPosition ? 'Zavřít' : '➕ Přidat novou pozici'}
            </button>
          </div>
        )}
      </div>

      {showAddPosition && (
        <div className="rounded-3xl border-2 border-sky-300 bg-sky-50/60 p-5 space-y-4 shadow-sm backdrop-blur-sm">
          <h4 className="font-bold text-sm text-sky-950">Nová navigační pozice na tomto sloupu</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Název pozice *</span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 shadow-sm"
                placeholder="např. Pozice 3 - Dolní tabule"
                value={newPositionName}
                onChange={(e) => setNewPositionName(e.target.value)}
              />
            </label>
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Kód pozice (sourcePosition)</span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 shadow-sm"
                placeholder="např. A3"
                value={newSourcePosition}
                onChange={(e) => setNewSourcePosition(e.target.value)}
              />
            </label>
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Směr</span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 shadow-sm"
                placeholder="např. vpravo / ul. Nádražní"
                value={newDirection}
                onChange={(e) => setNewDirection(e.target.value)}
              />
            </label>
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Cíl / Prodejna</span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 shadow-sm"
                placeholder="např. Albert Hrabůvka"
                value={newDestination}
                onChange={(e) => setNewDestination(e.target.value)}
              />
            </label>
            <label>
              <span className="block mb-1 font-semibold text-slate-700">Vzdálenost (v metrech)</span>
              <input
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 shadow-sm"
                placeholder="např. 350"
                type="number"
                value={newDistance}
                onChange={(e) => setNewDistance(e.target.value)}
              />
            </label>
          </div>
          <button
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-800 disabled:opacity-50"
            disabled={saving || !newPositionName.trim()}
            onClick={() => void handleAddPosition()}
            type="button"
          >
            Vytvořit novou pozici
          </button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {surfaces.map((surface, index) => {
          const activeOccupancy = surface.occupancies?.find(
            (o) => o.status === 'OCCUPIED' || o.status === 'RESERVED',
          );

          const isOccupied = surface.status === 'OCCUPIED' || Boolean(activeOccupancy);
          const isOutOfService = surface.status === 'OUT_OF_SERVICE';
          const arrowIcon = getDirectionArrow(surface.directionDescription);

          const isInline = inlineEditingSurfaceId === surface.id;
          const isAiActive = aiResult?.surfaceId === surface.id;

          return (
            <div
              className={`relative overflow-hidden rounded-3xl border-2 p-5 shadow-sm transition-all duration-200 ${
                isOutOfService
                  ? 'border-slate-300 bg-slate-100 opacity-80'
                  : isOccupied
                  ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30'
                  : 'border-sky-300 bg-gradient-to-br from-sky-50/40 via-white to-blue-50/20'
              }`}
              key={surface.id}
            >
              {/* Colored left accent line */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-2.5 ${
                  isOutOfService ? 'bg-slate-400' : isOccupied ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
              />

              <div className="pl-2 space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-slate-950 px-2 py-0.5 text-[11px] font-black text-white shadow-sm">
                        #{index + 1}
                      </span>
                      <h4 className="font-extrabold text-base text-slate-900">{surface.name}</h4>
                    </div>
                    {surface.sourcePosition && (
                      <span className="text-[11px] font-medium text-slate-500">Kód pozice: {surface.sourcePosition}</span>
                    )}
                  </div>
                  <StatusBadge value={isOutOfService ? 'OUT_OF_SERVICE' : isOccupied ? 'OCCUPIED' : 'AVAILABLE'} />
                </div>

                {/* Client & Rental Status */}
                <div className="rounded-2xl bg-white/80 p-3 shadow-inner border border-slate-200/50 space-y-1.5 text-xs text-slate-700">
                  <p className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900">👤 Klient:</span>
                    {surface.currentClient ? (
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-bold text-emerald-900 border border-emerald-300">
                        {surface.currentClient.name}
                      </span>
                    ) : (
                      <span className="italic text-slate-400">Volná pozice bez klienta</span>
                    )}
                  </p>

                  {activeOccupancy && (
                    <p className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">📅 Pronajato do:</span>
                      <span className="font-extrabold text-slate-900">{activeOccupancy.dateTo}</span>
                      <span className="text-[11px] text-slate-500">(od {activeOccupancy.dateFrom})</span>
                    </p>
                  )}
                </div>

                {/* Direction, Destination & Distance Grid */}
                {!isInline ? (
                  <div className="rounded-2xl border border-sky-100 bg-slate-900 p-3.5 text-white shadow-md space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>🧭 Parametry navigace</span>
                      {canEdit && (
                        <div className="flex gap-1.5">
                          <button
                            className="rounded-lg bg-sky-500/20 px-2 py-0.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/40"
                            onClick={() => openInlineEdit(surface)}
                            type="button"
                          >
                            ✏️ Upravit
                          </button>
                          <button
                            className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/40"
                            disabled={aiExtractingSurfaceId === surface.id}
                            onClick={() => void handleExtractPhotoData(surface.id)}
                            type="button"
                          >
                            {aiExtractingSurfaceId === surface.id ? '⌛ Čtení...' : '🔍 Rozpoznat z fotky'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2 text-xs grid-cols-1 sm:grid-cols-3 pt-1">
                      <div className="rounded-xl bg-slate-800/80 p-2 border border-slate-700/60">
                        <span className="block text-[10px] text-slate-400 font-semibold uppercase">Směr</span>
                        <p className="font-bold text-sky-300 flex items-center gap-1">
                          <span className="text-base">{arrowIcon}</span> {surface.directionDescription || 'neuvedeno'}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-800/80 p-2 border border-slate-700/60">
                        <span className="block text-[10px] text-slate-400 font-semibold uppercase">Cíl / Prodejna</span>
                        <p className="font-bold text-emerald-300 truncate">
                          🎯 {surface.destinationName || 'neuvedeno'}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-800/80 p-2 border border-slate-700/60">
                        <span className="block text-[10px] text-slate-400 font-semibold uppercase">Vzdálenost</span>
                        <p className="font-bold text-amber-300">
                          📏 {surface.distanceMeters !== undefined && surface.distanceMeters !== null ? `${surface.distanceMeters} m po silnici` : 'neuvedeno'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Inline Edit Form */
                  <div className="rounded-2xl border border-sky-300 bg-sky-50 p-3 space-y-2 text-xs">
                    <h5 className="font-bold text-sky-950">Rychlá úprava směru, cíle a vzdálenosti</h5>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label>
                        <span className="block mb-0.5 font-semibold text-slate-700">Směr</span>
                        <input
                          className="w-full rounded-xl border border-slate-300 p-2"
                          placeholder="vpravo / ul. Hlavní"
                          value={directionDescription}
                          onChange={(e) => setDirectionDescription(e.target.value)}
                        />
                      </label>
                      <label>
                        <span className="block mb-0.5 font-semibold text-slate-700">Cíl / Prodejna</span>
                        <input
                          className="w-full rounded-xl border border-slate-300 p-2"
                          placeholder="Albert"
                          value={destinationName}
                          onChange={(e) => setDestinationName(e.target.value)}
                        />
                      </label>
                      <label>
                        <span className="block mb-0.5 font-semibold text-slate-700">Vzdálenost (m)</span>
                        <input
                          className="w-full rounded-xl border border-slate-300 p-2"
                          placeholder="350"
                          type="number"
                          value={distanceMeters}
                          onChange={(e) => setDistanceMeters(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        className="rounded-xl border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={() => setInlineEditingSurfaceId(null)}
                        type="button"
                      >
                        Zrušit
                      </button>
                      <button
                        className="rounded-xl bg-sky-600 px-3 py-1 font-bold text-white hover:bg-sky-700 disabled:opacity-50"
                        disabled={saving}
                        onClick={() => void handleSaveInlineEdit(surface)}
                        type="button"
                      >
                        Uložit
                      </button>
                    </div>
                  </div>
                )}

                {/* AI Extracted Result Banner */}
                {isAiActive && aiResult && (
                  <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-3 text-xs space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 flex items-center gap-1">
                        ✨ Návrh rozpoznaný z fotky nosiče ({aiResult.confidence} jistota)
                      </span>
                      <button
                        className="text-emerald-700 hover:text-emerald-950 font-bold"
                        onClick={() => setAiResult(null)}
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 bg-white/80 p-2 rounded-xl border border-emerald-200">
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block">Rozpoznaný směr</span>
                        <span className="font-bold text-slate-900">{aiResult.directionArrow} {aiResult.directionDescription || 'neuvedeno'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block">Cíl</span>
                        <span className="font-bold text-slate-900">🎯 {aiResult.destinationName || 'neuvedeno'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 font-semibold block">Vzdálenost</span>
                        <span className="font-bold text-slate-900">📏 {aiResult.distanceMeters ? `${aiResult.distanceMeters} m` : 'neuvedeno'}</span>
                      </div>
                    </div>
                    <button
                      className="w-full rounded-xl bg-emerald-700 py-1.5 font-bold text-white hover:bg-emerald-800 shadow"
                      disabled={saving}
                      onClick={() => void handleApplyAiResult(surface)}
                      type="button"
                    >
                      ✅ Použít tento návrh pro pozici
                    </button>
                  </div>
                )}

                {/* Main Card Actions */}
                {canEdit && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={`rounded-xl px-4 py-2 font-bold transition shadow-sm ${
                          isOccupied
                            ? 'bg-amber-600 text-white hover:bg-amber-700'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                        onClick={() => openOccupyModal(surface)}
                        type="button"
                      >
                        {isOccupied ? '✏️ Upravit pronájem' : '✅ Nastavit jako obsazené'}
                      </button>

                      {isOccupied && (
                        <button
                          className="rounded-xl border border-rose-300 bg-white px-3 py-2 font-semibold text-rose-700 hover:bg-rose-50 shadow-sm"
                          onClick={() => void handleOccupySurface(surface.id, true)}
                          type="button"
                        >
                          🚪 Ukončit pronájem (uvolnit)
                        </button>
                      )}

                      <button
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                        onClick={() => void handleToggleOutOfService(surface)}
                        type="button"
                      >
                        {isOutOfService ? 'Obnovit provoz' : 'Mimo provoz'}
                      </button>
                    </div>

                    <button
                      className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 font-bold text-sky-900 hover:bg-sky-100 shadow-sm"
                      onClick={() => setMoveModalSurfaceId(surface.id)}
                      type="button"
                    >
                      ↗️ Přesunout / Vyčlenit
                    </button>
                  </div>
                )}

                {/* History dropdown preview */}
                {surface.occupancies && surface.occupancies.length > 0 && (
                  <details className="mt-2 text-[11px] text-slate-500">
                    <summary className="cursor-pointer font-semibold hover:text-slate-800">
                      📜 Historie pronájmů ({surface.occupancies.length})
                    </summary>
                    <ul className="mt-1 space-y-1 pl-2 border-l-2 border-slate-300">
                      {surface.occupancies.map((occ) => (
                        <li key={occ.id}>
                          {occ.clientName} ({occ.dateFrom} - {occ.dateTo}) · <StatusBadge value={occ.status} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Merge Poles */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xl font-black text-slate-900">🔗 Sloučení jiných sloupu na tento nosič</h4>
                <p className="text-xs text-slate-500">
                  Přesune všechny navigační pozice a fotky z vybraných sloupu na tento fyzický sloup.
                </p>
              </div>
              <button
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 font-bold"
                onClick={() => setShowMergeModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="block mb-1 font-semibold text-slate-700">Vyhledat sloup (podle kódu, ulice nebo město)</span>
                <input
                  className="w-full rounded-xl border border-slate-300 p-2.5 shadow-sm"
                  placeholder="Zadejte název, kód nebo ulici..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </label>

              <label className="flex items-center gap-2 rounded-xl bg-sky-50 p-3 border border-sky-200">
                <input
                  type="checkbox"
                  checked={updateGpsOnMerge}
                  onChange={(e) => setUpdateGpsOnMerge(e.target.checked)}
                />
                <span className="font-semibold text-sky-950">
                  📍 Přepočítat průměrné GPS souřadnice z vybraných sloupu pro tento nosič
                </span>
              </label>

              {loadingOtherCarriers ? (
                <div className="p-8 text-center text-slate-500">Načítám dostupné navigace...</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-200 rounded-2xl p-2 bg-slate-50">
                  {filteredOtherCarriers.length === 0 ? (
                    <p className="p-4 text-center text-slate-400">Žádné další navigace ke sloučení nenalezeny.</p>
                  ) : (
                    filteredOtherCarriers.map((c) => {
                      const isSelected = selectedCarrierIdsToMerge.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                            isSelected ? 'border-sky-500 bg-sky-100/80 font-bold' : 'border-slate-200 bg-white hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCarrierIdsToMerge([...selectedCarrierIdsToMerge, c.id]);
                                } else {
                                  setSelectedCarrierIdsToMerge(selectedCarrierIdsToMerge.filter((id) => id !== c.id));
                                }
                              }}
                            />
                            <div>
                              <p className="text-slate-900 font-semibold">{c.name} ({c.code})</p>
                              <p className="text-[11px] text-slate-500">{c.city} · {c.street || 'bez ulice'}</p>
                            </div>
                          </div>
                          <span className="rounded-lg bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {c.surfacesCount} pozic
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setShowMergeModal(false)}
                type="button"
              >
                Zrušit
              </button>
              <button
                className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white shadow hover:bg-sky-700 disabled:opacity-50"
                disabled={saving || selectedCarrierIdsToMerge.length === 0}
                onClick={() => void handleExecuteMerge()}
                type="button"
              >
                Sloučit vybrané ({selectedCarrierIdsToMerge.length}) na tento sloup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Move or Detach Surface */}
      {moveModalSurfaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-100">
            <h4 className="text-lg font-black text-slate-900">Přesun / Vyčlenění navigační pozice</h4>
            <p className="text-xs text-slate-500">
              Vyberte, zda chcete tuto pozici přesunout na jiný sloup, nebo vytvořit nový samostatný sloup.
            </p>

            <div className="space-y-3 text-xs">
              <button
                className="w-full rounded-2xl border-2 border-emerald-400 bg-emerald-50/80 p-4 font-bold text-emerald-950 hover:bg-emerald-100 text-left shadow-sm space-y-1"
                disabled={saving}
                onClick={() => void handleMoveSurface(moveModalSurfaceId, true)}
                type="button"
              >
                <span className="block text-sm font-extrabold text-emerald-900">✨ Vyčlenit na nový samostatný sloup</span>
                <span className="block text-[11px] font-normal text-emerald-700">
                  Pozice a její fotky se oddělí a vytvoří se pro ni nový samostatný nosič v databázi.
                </span>
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setMoveModalSurfaceId(null)}
                type="button"
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for setting Occupancy & Navigation Details */}
      {activeModalSurfaceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-slate-100">
            <h4 className="text-lg font-black text-slate-900">Správa pronájmu navigační pozice</h4>

            {message && (
              <div className="rounded-xl bg-amber-100 p-3 text-xs font-semibold text-amber-900">
                {message}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="block mb-1 font-semibold text-slate-700">Klient (Povinné) *</span>
                <input
                  className="w-full rounded-xl border border-slate-300 p-2.5 shadow-sm"
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
                    className="w-full rounded-xl border border-slate-300 p-2.5 shadow-sm"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label>
                  <span className="block mb-1 font-semibold text-slate-700">Pronajato do *</span>
                  <input
                    className="w-full rounded-xl border border-slate-300 p-2.5 shadow-sm"
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
                    className="w-full rounded-xl border border-slate-300 p-2.5 shadow-sm"
                    placeholder="např. Albert Hrabůvka"
                    value={destinationName}
                    onChange={(e) => setDestinationName(e.target.value)}
                  />
                </label>
                <label>
                  <span className="block mb-1 font-semibold text-slate-700">Vzdálenost (v metrech)</span>
                  <input
                    className="w-full rounded-xl border border-slate-300 p-2.5 shadow-sm"
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
                  className="w-full rounded-xl border border-slate-300 p-2.5 shadow-sm"
                  placeholder="např. vpravo / ulice Nádražní"
                  value={directionDescription}
                  onChange={(e) => setDirectionDescription(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="block mb-1 font-semibold text-slate-700">Poznámka</span>
                <textarea
                  className="w-full rounded-xl border border-slate-300 p-2.5 shadow-sm"
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
