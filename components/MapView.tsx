'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import type { Carrier, CarrierStatus } from '@/lib/types';
import { carrierMapColor } from '@/lib/mock-data';
import { CarrierDetail } from './CarrierDetail';
import { CarrierForm } from './CarrierForm';

type LeafletModule = typeof import('leaflet');
type StatusFilter = 'ALL' | CarrierStatus;

const statusLabels: Record<StatusFilter, string> = {
  ALL: 'Všechny stavy',
  ACTIVE: 'Aktivní',
  INACTIVE: 'Neaktivní',
  MAINTENANCE: 'Údržba',
};

const legend = [
  { color: '#22c55e', label: 'Volná plocha' },
  { color: '#f97316', label: 'Rezervace' },
  { color: '#ef4444', label: 'Obsazeno' },
  { color: '#64748b', label: 'Mimo provoz' },
];

export function MapView({ initialCarriers }: { initialCarriers: Carrier[] }) {
  const [items, setItems] = useState(initialCarriers);
  const [selectedId, setSelectedId] = useState(initialCarriers[0]?.id);
  const [draft, setDraft] = useState<Partial<Carrier> | undefined>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [mapReady, setMapReady] = useState(false);
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);

  const selected = items.find((carrier) => carrier.id === selectedId);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('cs');
    return items.filter((carrier) => {
      const matchesStatus = status === 'ALL' || carrier.status === status;
      const matchesQuery = !normalizedQuery || [carrier.name, carrier.code, carrier.city, carrier.address]
        .some((value) => value?.toLocaleLowerCase('cs').includes(normalizedQuery));
      return matchesStatus && matchesQuery;
    });
  }, [items, query, status]);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      const L = await import('leaflet');
      if (cancelled || !mapElementRef.current || mapRef.current) return;

      const map = L.map(mapElementRef.current, {
        center: [49.9, 15.3],
        zoom: 7,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const markerLayer = L.layerGroup().addTo(map);
      map.on('click', (event) => {
        setDraft({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
          city: '',
          status: 'ACTIVE',
          type: 'BILLBOARD',
        });
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

    filteredItems.forEach((carrier) => {
      const tooltip = document.createElement('div');
      const title = document.createElement('strong');
      const subtitle = document.createElement('div');
      title.textContent = carrier.name;
      subtitle.textContent = `${carrier.code} · ${carrier.city}`;
      tooltip.append(title, subtitle);

      L.circleMarker([carrier.latitude, carrier.longitude], {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: carrierMapColor(carrier),
        fillOpacity: 1,
        bubblingMouseEvents: false,
      })
        .bindTooltip(tooltip, { direction: 'top', offset: [0, -8] })
        .on('click', () => {
          setSelectedId(carrier.id);
          setDraft(undefined);
        })
        .addTo(markerLayer);

      bounds.extend([carrier.latitude, carrier.longitude]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { animate: false, maxZoom: 14 });
    }
  }, [filteredItems, mapReady]);

  function focusSelected() {
    if (!selected || !mapRef.current) return;
    mapRef.current.flyTo([selected.latitude, selected.longitude], 15, { duration: 0.8 });
  }

  return (
    <div className="space-y-4">
      <section className="card flex flex-col gap-4 !p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Hledat nosič</span>
            <input
              className="input"
              type="search"
              placeholder="Hledat podle názvu, kódu, města nebo adresy"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label>
            <span className="sr-only">Filtrovat podle stavu</span>
            <select
              className="input min-w-44"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
          {legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
          <strong className="text-slate-900">{filteredItems.length} nosičů</strong>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="relative min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
          <div
            ref={mapElementRef}
            className="h-[calc(100vh-12rem)] min-h-[520px] w-full"
            role="application"
            aria-label="Mapa reklamních nosičů"
          />
          {!mapReady && (
            <div className="absolute inset-0 grid place-items-center bg-slate-100 text-sm text-slate-500">
              Načítám mapu…
            </div>
          )}
          {mapReady && filteredItems.length === 0 && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-medium shadow">
              Filtru neodpovídá žádný nosič
            </div>
          )}
          <div className="pointer-events-none absolute bottom-7 left-3 z-[500] rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-600 shadow">
            Kliknutím do mapy přidáte nový nosič.
          </div>
        </section>

        <aside className="card max-h-[calc(100vh-8rem)] overflow-auto">
          {draft ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Nový nosič</h2>
                <button className="text-sm text-slate-500 hover:text-slate-900" onClick={() => setDraft(undefined)}>
                  Zrušit
                </button>
              </div>
              <CarrierForm
                carrier={draft}
                onSaved={(carrier) => {
                  setItems((current) => [...current, carrier]);
                  setDraft(undefined);
                  setSelectedId(carrier.id);
                }}
              />
            </>
          ) : selected ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <button className="text-sm font-medium text-emerald-700 hover:text-emerald-900" onClick={focusSelected}>
                  Zobrazit na mapě
                </button>
                <Link className="text-sm font-medium text-slate-700 hover:text-slate-950" href={`/carriers/${selected.id}`}>
                  Otevřít celý detail →
                </Link>
              </div>
              <CarrierDetail carrier={selected} />
            </>
          ) : (
            <p className="text-sm text-slate-500">Vyberte nosič na mapě.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
