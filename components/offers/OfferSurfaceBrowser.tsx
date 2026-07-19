'use client';

import Image from 'next/image';
import { Check, ChevronLeft, ChevronRight, Expand, ImageIcon, ListChecks, MapPin, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MEDIA_TYPE_META, type ProposalMediaTypeKey } from '@/lib/offers/presentation';
import { filterOfferSurfaces, isOfferSurfaceInBounds, paginateOfferSurfaces, type SurfaceAvailabilityFilter } from '@/lib/offers/surface-selection';
import type { OfferSurfaceOption } from '@/lib/offers/view-model';
import { OfferMap, type OfferMapBounds } from './OfferMap';

const PAGE_SIZE = 24;

type SurfaceConflict = { surfaceId: string; severity: 'block' | 'warning' };

function mediaLabel(value: string) {
  const key = value in MEDIA_TYPE_META ? value as ProposalMediaTypeKey : 'OTHER';
  return MEDIA_TYPE_META[key].label;
}

function money(value: string) {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 }).format(Number(value || 0));
}

export function OfferSurfaceBrowser({
  mode,
  surfaces,
  selectedIds,
  conflicts,
  query,
  onQueryChange,
  onToggle,
  onBulkToggle,
}: {
  mode: 'map' | 'list';
  surfaces: OfferSurfaceOption[];
  selectedIds: Set<string>;
  conflicts: SurfaceConflict[];
  query: string;
  onQueryChange: (value: string) => void;
  onToggle: (surface: OfferSurfaceOption) => void;
  onBulkToggle: (surfaces: OfferSurfaceOption[], select: boolean) => void;
}) {
  const [mediaType, setMediaType] = useState('');
  const [status, setStatus] = useState('');
  const [availability, setAvailability] = useState<SurfaceAvailabilityFilter>('all');
  const [gpsOnly, setGpsOnly] = useState(false);
  const [viewportOnly, setViewportOnly] = useState(false);
  const [mapBounds, setMapBounds] = useState<OfferMapBounds | null>(null);
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const conflictMap = useMemo(() => new Map(conflicts.map((conflict) => [conflict.surfaceId, conflict.severity])), [conflicts]);

  const baseFiltered = useMemo(() => filterOfferSurfaces(surfaces, { query, mediaType, status, availability, gpsOnly }, conflictMap), [availability, conflictMap, gpsOnly, mediaType, query, status, surfaces]);
  const filtered = useMemo(() => !viewportOnly || !mapBounds ? baseFiltered : baseFiltered.filter((surface) => isOfferSurfaceInBounds(surface, mapBounds)), [baseFiltered, mapBounds, viewportOnly]);
  const { currentPage, pageCount, rows: visible } = paginateOfferSurfaces(filtered, page, PAGE_SIZE);
  const active = surfaces.find((surface) => surface.id === activeId) ?? null;
  const visibleAllSelected = visible.length > 0 && visible.every((surface) => selectedIds.has(surface.id));
  const mediaTypes = useMemo(() => [...new Set(surfaces.map((surface) => surface.mediaType))].sort(), [surfaces]);
  const statuses = useMemo(() => [...new Set(surfaces.map((surface) => surface.status))].sort(), [surfaces]);
  const mapPoints = useMemo(() => baseFiltered.map((surface) => ({
    id: surface.id,
    code: surface.carrier.code,
    city: surface.carrier.city,
    latitude: surface.carrier.latitude,
    longitude: surface.carrier.longitude,
    selected: selectedIds.has(surface.id),
  })), [baseFiltered, selectedIds]);

  function resetPage() {
    setPage(1);
  }

  useEffect(() => {
    if (!active) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (lightboxOpen) setLightboxOpen(false);
      else setActiveId(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [active, lightboxOpen]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_170px_150px_170px_auto]">
        <label className="relative">
          <span className="sr-only">Hledat reklamní plochu</span>
          <Search aria-hidden className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            className="input pl-10"
            onChange={(event) => { onQueryChange(event.target.value); resetPage(); }}
            placeholder="Kód, ulice, město, lokalita nebo popis…"
            value={query}
          />
        </label>
        <select aria-label="Typ média" className="input" onChange={(event) => { setMediaType(event.target.value); resetPage(); }} value={mediaType}>
          <option value="">Všechny typy</option>
          {mediaTypes.map((type) => <option key={type} value={type}>{mediaLabel(type)}</option>)}
        </select>
        <select aria-label="Stav plochy" className="input" onChange={(event) => { setStatus(event.target.value); resetPage(); }} value={status}>
          <option value="">Všechny stavy</option>
          {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select aria-label="Dostupnost v termínu" className="input" onChange={(event) => { setAvailability(event.target.value as SurfaceAvailabilityFilter); resetPage(); }} value={availability}>
          <option value="all">Veškerá dostupnost</option>
          <option value="available">Bez známé kolize</option>
          <option value="warning">K jednání</option>
          <option value="blocked">Blokované</option>
        </select>
        <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
          <input checked={gpsOnly} onChange={(event) => { setGpsOnly(event.target.checked); resetPage(); }} type="checkbox" />
          Jen s GPS
        </label>
      </div>

      {mode === 'map' && <label className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
        <input checked={viewportOnly} disabled={!mapBounds} onChange={(event) => { setViewportOnly(event.target.checked); resetPage(); }} type="checkbox" />
        Pracovat jen s plochami v aktuálním výřezu mapy
      </label>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
        <span className="text-slate-600">Nalezeno <b className="text-slate-950">{filtered.length}</b> ploch · vybráno <b className="text-slate-950">{selectedIds.size}</b></span>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 disabled:opacity-40"
          disabled={visible.length === 0}
          onClick={() => onBulkToggle(visible, !visibleAllSelected)}
          type="button"
        >
          <ListChecks aria-hidden size={16} />
          {visibleAllSelected ? 'Odebrat zobrazené' : 'Vybrat zobrazené'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm text-slate-500">
          Žádná plocha neodpovídá zvoleným filtrům.
        </div>
      ) : mode === 'map' ? (
        <OfferMap
          className="h-[480px]"
          onBoundsChange={setMapBounds}
          onPointClick={setActiveId}
          points={mapPoints}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((surface) => {
            const selected = selectedIds.has(surface.id);
            const conflict = conflictMap.get(surface.id);
            return (
              <article className={`overflow-hidden rounded-xl border bg-white transition ${selected ? 'border-slate-950 ring-1 ring-slate-950' : 'border-slate-200 hover:border-slate-300'}`} key={surface.id}>
                <button className="block w-full text-left" onClick={() => setActiveId(surface.id)} type="button">
                  {surface.photos[0] ? (
                    <Image alt={`${surface.carrier.code} · ${surface.name}`} className="h-28 w-full object-cover" height={300} src={surface.photos[0].url} width={500} unoptimized />
                  ) : (
                    <span className="grid h-28 place-items-center bg-slate-100 text-slate-400"><ImageIcon aria-hidden /></span>
                  )}
                  <span className="block p-3">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-950">{surface.carrier.code} · {surface.name}</span>
                      {conflict && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${conflict === 'block' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{conflict === 'block' ? 'Kolize' : 'Jednání'}</span>}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{surface.carrier.city}, {surface.carrier.locality || surface.carrier.street || 'lokalita neuvedena'}</span>
                    <span className="mt-2 flex justify-between text-xs"><span>{mediaLabel(surface.mediaType)}</span><b>{money(surface.price)}</b></span>
                    <span className={`mt-1 block text-[10px] font-medium ${surface.priceSource === 'MISSING' ? 'text-amber-600' : 'text-slate-400'}`}>{surface.priceSource === 'CATALOG' ? 'Automatická cena z ceníku' : surface.priceSource === 'SURFACE' ? 'Individuální cena plochy' : 'Cena zatím není nastavena'}</span>
                  </span>
                </button>
                <button className={`m-3 mt-0 inline-flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${selected ? 'bg-slate-950 text-white' : 'border border-slate-200 text-slate-700'}`} onClick={() => onToggle(surface)} type="button">
                  {selected && <Check aria-hidden size={15} />}{selected ? 'Vybráno' : 'Přidat do nabídky'}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {mode === 'list' && pageCount > 1 && (
        <nav aria-label="Stránkování reklamních ploch" className="flex items-center justify-center gap-3">
          <button aria-label="Předchozí stránka" className="rounded-lg border border-slate-200 p-2 disabled:opacity-30" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} type="button"><ChevronLeft size={17} /></button>
          <span className="text-sm text-slate-600">Strana {currentPage} z {pageCount}</span>
          <button aria-label="Další stránka" className="rounded-lg border border-slate-200 p-2 disabled:opacity-30" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} type="button"><ChevronRight size={17} /></button>
        </nav>
      )}

      {active && (
        <div aria-labelledby="surface-detail-title" aria-modal="true" className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/55 p-4" role="dialog">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div><p className="font-semibold text-slate-950" id="surface-detail-title">{active.carrier.code} · {active.name}</p><p className="text-sm text-slate-500">{active.carrier.city} · {active.carrier.locality || active.carrier.address || 'Lokalita neuvedena'}</p></div>
              <button aria-label="Zavřít detail plochy" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => { setActiveId(null); setLightboxOpen(false); }} type="button"><X size={18} /></button>
            </div>
            {active.photos[0] ? (
              <button className="relative block w-full overflow-hidden rounded-xl border border-slate-200 text-left hover:opacity-95" onClick={() => setLightboxOpen(true)} type="button">
                <Image alt={`${active.carrier.code} · ${active.name}`} className="max-h-[440px] w-full object-cover" height={900} src={active.photos[0].url} width={1400} unoptimized />
                <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-slate-950/80 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm"><Expand size={13} /> Zvětšit fotografii</span>
              </button>
            ) : <div className="grid h-72 place-items-center bg-slate-100 text-slate-400"><ImageIcon size={36} /></div>}
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <dl className="space-y-2 text-sm"><div><dt className="text-slate-500">Typ média</dt><dd className="font-semibold">{mediaLabel(active.mediaType)}</dd></div><div><dt className="text-slate-500">Evidenční stav</dt><dd className="font-semibold">{active.status}</dd></div><div><dt className="text-slate-500">Cena</dt><dd className="font-semibold">{money(active.price)}</dd><dd className="text-xs text-slate-400">{active.priceSource === 'CATALOG' ? 'Načteno z ceníku podle média' : active.priceSource === 'SURFACE' ? 'Individuální cena této plochy' : 'Doplňte cenu v ceníku'}</dd></div></dl>
              <div><p className="text-sm text-slate-500">Popis</p><p className="mt-1 text-sm leading-6 text-slate-700">{active.carrier.description || 'Popis plochy není vyplněný.'}</p>{active.carrier.latitude != null && active.carrier.longitude != null && <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={14} />{active.carrier.latitude}, {active.carrier.longitude}</p>}</div>
              <button className={`sm:col-span-2 rounded-xl px-4 py-3 text-sm font-semibold ${selectedIds.has(active.id) ? 'border border-slate-300 text-slate-700' : 'bg-slate-950 text-white'}`} onClick={() => onToggle(active)} type="button">{selectedIds.has(active.id) ? 'Odebrat z nabídky' : 'Přidat do nabídky'}</button>
            </div>
          </div>
        </div>
      )}

      {active?.photos[0] && lightboxOpen && (
        <div className="fixed inset-0 z-[1010] flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setLightboxOpen(false)}>
          <Image alt={`${active.carrier.code} · ${active.name}`} className="max-h-[94vh] w-auto max-w-[96vw] object-contain" height={1400} src={active.photos[0].url} width={2000} unoptimized />
          <button className="absolute top-4 right-4 rounded-xl bg-white/10 p-2 text-white hover:bg-white/20" onClick={() => setLightboxOpen(false)} type="button"><X size={20} /></button>
        </div>
      )}
    </div>
  );
}
