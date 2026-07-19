'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import type { Carrier, CarrierStatus, Client } from '@/lib/types';
import { carrierMapColor } from '@/lib/mock-data';
import { CarrierDetail } from './CarrierDetail';
import { CarrierForm } from './CarrierForm';

type LeafletModule = typeof import('leaflet');
type StatusFilter = 'ALL' | CarrierStatus;
type LocatedCarrier = Carrier & { latitude: number; longitude: number };
type PendingLocation = { latitude: number; longitude: number };
type ApiError = { error?: string };

const ALL_CLIENTS = '__ALL_CLIENTS__';
const WITHOUT_CLIENT = '__WITHOUT_CLIENT__';
const statusLabels: Record<StatusFilter, string> = { ALL: 'Všechny stavy', ACTIVE: 'Aktivní', INACTIVE: 'Neaktivní', MAINTENANCE: 'Údržba' };
const legend = [
  { color: '#22c55e', label: 'Volná plocha' },
  { color: '#f97316', label: 'Rezervace' },
  { color: '#ef4444', label: 'Obsazeno' },
  { color: '#64748b', label: 'Mimo provoz' },
];

function carrierCountLabel(count: number) {
  if (count === 1) return '1 nosič';
  if (count >= 2 && count <= 4) return `${count} nosiče`;
  return `${count} nosičů`;
}

function hasCoordinates(carrier: Carrier): carrier is LocatedCarrier {
  return Number.isFinite(carrier.latitude) && Number.isFinite(carrier.longitude);
}

export function MapView({
  initialCarriers,
  canEdit,
}: {
  initialCarriers: Carrier[];
  canEdit?: boolean;
}) {
  const [items, setItems] = useState(initialCarriers);
  const [selectedId, setSelectedId] = useState(initialCarriers[0]?.id);
  const [draft, setDraft] = useState<Partial<Carrier> | undefined>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [clientFilter, setClientFilter] = useState(ALL_CLIENTS);
  const [mapReady, setMapReady] = useState(false);
  const [locationEditId, setLocationEditId] = useState<string>();
  const [pendingLocation, setPendingLocation] = useState<PendingLocation>();
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState('');
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const locationEditIdRef = useRef<string | undefined>(undefined);

  const selected = items.find((carrier) => carrier.id === selectedId);
  const editingSelectedLocation = Boolean(selected && locationEditId === selected.id);
  const clientNames = useMemo(() => [...new Set(items.flatMap((carrier) =>
    carrier.surfaces.map((surface) => surface.currentClient?.name).filter((name): name is string => Boolean(name)),
  ))].sort((left, right) => left.localeCompare(right, 'cs')), [items]);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('cs');
    return items.filter((carrier) => {
      const surfaceClientNames = carrier.surfaces.map((surface) => surface.currentClient?.name).filter((name): name is string => Boolean(name));
      const matchesStatus = status === 'ALL' || carrier.status === status;
      const matchesClient = clientFilter === ALL_CLIENTS || (clientFilter === WITHOUT_CLIENT
        ? carrier.surfaces.some((surface) => !surface.currentClient)
        : surfaceClientNames.includes(clientFilter));
      const matchesQuery = !normalizedQuery || [carrier.name, carrier.code, carrier.city, carrier.address, carrier.cadastralArea, carrier.structureCode, ...surfaceClientNames]
        .some((value) => value?.toLocaleLowerCase('cs').includes(normalizedQuery));
      return matchesStatus && matchesClient && matchesQuery;
    });
  }, [clientFilter, items, query, status]);
  const mappableItems = useMemo(() => filteredItems.filter(hasCoordinates), [filteredItems]);
  const missingGpsCount = filteredItems.length - mappableItems.length;

  useEffect(() => { locationEditIdRef.current = locationEditId; }, [locationEditId]);

  useEffect(() => {
    if (filteredItems.length > 0 && !filteredItems.some((carrier) => carrier.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
      setDraft(undefined);
      setLocationEditId(undefined);
      setPendingLocation(undefined);
      setLocationError('');
    }
  }, [filteredItems, selectedId]);

  useEffect(() => {
    let cancelled = false;
    async function initializeMap() {
      const L = await import('leaflet');
      if (cancelled || !mapElementRef.current || mapRef.current) return;
      const map = L.map(mapElementRef.current, { center: [49.9, 15.3], zoom: 7, scrollWheelZoom: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
      }).addTo(map);
      const markerLayer = L.layerGroup().addTo(map);
      map.on('click', (event) => {
        if (locationEditIdRef.current) {
          setPendingLocation({ latitude: event.latlng.lat, longitude: event.latlng.lng });
          setLocationError('');
          return;
        }
        setDraft({ latitude: event.latlng.lat, longitude: event.latlng.lng, gpsStatus: 'UNVERIFIED', city: '', status: 'ACTIVE', type: 'BILLBOARD', mountingType: 'UNKNOWN' });
      });
      leafletRef.current = L;
      mapRef.current = map;
      markerLayerRef.current = markerLayer;
      setMapReady(true);
    }
    void initializeMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!mapReady || !L || !map || !markerLayer) return;
    markerLayer.clearLayers();
    const bounds = L.latLngBounds([]);
    mappableItems.forEach((carrier) => {
      const tooltip = document.createElement('div');
      const title = document.createElement('strong');
      const subtitle = document.createElement('div');
      const clients = [...new Set(carrier.surfaces.map((surface) => surface.currentClient?.name).filter((name): name is string => Boolean(name)))];
      title.textContent = carrier.name;
      subtitle.textContent = `${carrier.code} · ${carrier.city} · ${clients.join(', ') || 'klient neuveden'}`;
      tooltip.append(title, subtitle);
      L.circleMarker([carrier.latitude, carrier.longitude], {
        radius: 10, color: '#ffffff', weight: 3, fillColor: carrierMapColor(carrier), fillOpacity: 1, bubblingMouseEvents: false,
      }).bindTooltip(tooltip, { direction: 'top', offset: [0, -8] }).on('click', () => {
        if (locationEditIdRef.current) return;
        setSelectedId(carrier.id);
        setDraft(undefined);
      }).addTo(markerLayer);
      bounds.extend([carrier.latitude, carrier.longitude]);
    });
    if (locationEditId && pendingLocation) {
      L.circleMarker([pendingLocation.latitude, pendingLocation.longitude], {
        radius: 13, color: '#0f172a', weight: 3, dashArray: '5 4', fillColor: '#38bdf8', fillOpacity: 0.9,
      }).bindTooltip('Nová poloha', { permanent: true, direction: 'top', offset: [0, -10] }).addTo(markerLayer);
      map.flyTo([pendingLocation.latitude, pendingLocation.longitude], 17, { animate: false });
    } else if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { animate: false, maxZoom: 14 });
    }
  }, [locationEditId, mappableItems, mapReady, pendingLocation]);

  function focusSelected() {
    if (!selected || !hasCoordinates(selected) || !mapRef.current) return;
    mapRef.current.flyTo([selected.latitude, selected.longitude], 15, { duration: 0.8 });
  }

  function startLocationEdit() {
    if (!selected) return;
    locationEditIdRef.current = selected.id;
    setLocationEditId(selected.id);
    setPendingLocation(undefined);
    setLocationError('');
    setDraft(undefined);
    if (hasCoordinates(selected) && mapRef.current) mapRef.current.flyTo([selected.latitude, selected.longitude], 16, { duration: 0.6 });
  }

  function cancelLocationEdit() {
    locationEditIdRef.current = undefined;
    setLocationEditId(undefined);
    setPendingLocation(undefined);
    setLocationError('');
  }

  async function saveLocation() {
    if (!selected || !pendingLocation) return;
    setLocationSaving(true);
    setLocationError('');
    try {
      const response = await fetch(`/api/carriers/${selected.id}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ latitude: pendingLocation.latitude, longitude: pendingLocation.longitude, gpsStatus: 'VERIFIED' }),
      });
      const result = await response.json().catch(() => null) as Carrier | ApiError | null;
      if (!response.ok) {
        const message = result && 'error' in result && result.error;
        throw new Error(message || 'Polohu se nepodařilo uložit.');
      }
      if (!result || !('id' in result)) throw new Error('Server vrátil neplatnou odpověď.');
      setItems((current) => current.map((carrier) => carrier.id === result.id ? result : carrier));
      cancelLocationEdit();
      mapRef.current?.flyTo([pendingLocation.latitude, pendingLocation.longitude], 16, { duration: 0.6 });
    } catch (saveError) {
      setLocationError(saveError instanceof Error ? saveError.message : 'Polohu se nepodařilo uložit.');
    } finally {
      setLocationSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card flex flex-col gap-4 !p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <label className="flex-1"><span className="sr-only">Hledat nosič</span><input className="input" type="search" placeholder="Hledat podle místa, sloupu nebo klienta" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label><span className="sr-only">Filtrovat podle stavu</span><select className="input min-w-44" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span className="sr-only">Filtrovat podle klienta</span><select className="input min-w-52" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value={ALL_CLIENTS}>Všichni klienti</option><option value={WITHOUT_CLIENT}>Bez klienta</option>{clientNames.map((clientName) => <option key={clientName} value={clientName}>{clientName}</option>)}</select></label>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
          {legend.map((item) => <span key={item.label} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />{item.label}</span>)}
          <strong className="text-slate-900">{carrierCountLabel(filteredItems.length)}</strong>
          {missingGpsCount > 0 && <strong className="text-amber-700">{missingGpsCount} bez GPS</strong>}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="relative min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
          <div ref={mapElementRef} className="h-[calc(100vh-12rem)] min-h-[520px] w-full" role="application" aria-label="Mapa reklamních nosičů" />
          {!mapReady && <div className="absolute inset-0 grid place-items-center bg-slate-100 text-sm text-slate-500">Načítám mapu…</div>}
          {mapReady && filteredItems.length === 0 && <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-medium shadow">Filtru neodpovídá žádný nosič</div>}
          {mapReady && filteredItems.length > 0 && mappableItems.length === 0 && !editingSelectedLocation && <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow">Vyfiltrované nosiče zatím nemají GPS</div>}
          <div className={`pointer-events-none absolute bottom-7 left-3 z-[500] rounded-lg px-3 py-2 text-xs shadow ${editingSelectedLocation ? 'bg-sky-950 text-white' : 'bg-white/90 text-slate-600'}`}>{editingSelectedLocation ? 'Klikněte do mapy na novou polohu nosiče.' : 'Kliknutím do mapy přidáte nový nosič.'}</div>
        </section>
        <aside className="card max-h-[calc(100vh-8rem)] overflow-auto">
          {draft ? <>
            <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Nový nosič</h2><button className="text-sm text-slate-500 hover:text-slate-900" onClick={() => setDraft(undefined)}>Zrušit</button></div>
            <CarrierForm carrier={draft} onSaved={(carrier) => { setItems((current) => [...current, carrier]); setDraft(undefined); setSelectedId(carrier.id); }} />
          </> : selected ? <>
            {editingSelectedLocation ? <section className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4" aria-labelledby="location-editor-heading">
              <h2 id="location-editor-heading" className="font-bold text-sky-950">{hasCoordinates(selected) ? 'Upravit polohu nosiče' : 'Doplnit polohu nosiče'}</h2>
              <p className="mt-1 text-sm text-sky-900">Klikněte do mapy na správné místo a potom polohu uložte.</p>
              {pendingLocation && <p className="mt-3 rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700">{pendingLocation.latitude.toFixed(6)}, {pendingLocation.longitude.toFixed(6)}</p>}
              {locationError && <p className="mt-3 text-sm text-red-700" role="alert">{locationError}</p>}
              <div className="mt-4 flex gap-2">
                <button type="button" className="rounded-xl bg-sky-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!pendingLocation || locationSaving} onClick={() => void saveLocation()}>{locationSaving ? 'Ukládám…' : 'Uložit polohu'}</button>
                <button type="button" className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-medium text-sky-950" disabled={locationSaving} onClick={cancelLocationEdit}>Zrušit</button>
              </div>
            </section> : <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
              <button type="button" className="text-sm font-medium text-emerald-700 hover:text-emerald-900 disabled:cursor-not-allowed disabled:text-slate-400" disabled={!hasCoordinates(selected)} onClick={focusSelected}>{hasCoordinates(selected) ? 'Zobrazit na mapě' : 'GPS chybí'}</button>
              <button type="button" className="text-sm font-medium text-sky-700 hover:text-sky-900" onClick={startLocationEdit}>{hasCoordinates(selected) ? 'Upravit polohu' : 'Doplnit polohu'}</button>
              <Link className="ml-auto text-sm font-medium text-slate-700 hover:text-slate-950" href={`/carriers/${selected.id}`}>Otevřít celý detail →</Link>
            </div>}
            <CarrierDetail carrier={selected} canEdit={canEdit} />
          </> : <p className="text-sm text-slate-500">Vyberte nosič na mapě.</p>}
        </aside>
      </div>
    </div>
  );
}
