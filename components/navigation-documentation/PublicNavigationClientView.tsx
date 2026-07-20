'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  Maximize2,
  Search,
  X,
} from 'lucide-react';
import type { SnapshotItemData } from '@/lib/navigation-documentation';

export function PublicNavigationClientView({
  reportData,
}: {
  reportData: {
    title: string;
    description?: string | null;
    quarter?: number | null;
    year: number;
    publishedAt: string;
    clientName: string;
    clientLogoUrl?: string | null;
    campaignTitle: string;
    itemsCount: number;
    items: SnapshotItemData[];
  };
}) {
  const [query, setQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Selected item on map/list
  const [activeItemId, setActiveItemId] = useState<string | null>(reportData.items[0]?.id ?? null);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Filter items
  const filteredItems = useMemo(() => {
    return reportData.items.filter((item) => {
      if (selectedCity && item.city !== selectedCity) return false;
      if (selectedStatus && item.status !== selectedStatus) return false;
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const text = `${item.pointCode} ${item.address} ${item.city} ${item.locality} ${item.direction}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [reportData.items, selectedCity, selectedStatus, query]);

  const cities = useMemo(() => Array.from(new Set(reportData.items.map((i) => i.city))).filter(Boolean), [reportData.items]);
  const statuses = useMemo(() => Array.from(new Set(reportData.items.map((i) => i.status))).filter(Boolean), [reportData.items]);

  // Leaflet map setup
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isSubscribed = true;

    async function initMap() {
      const L = await import('leaflet');
      // @ts-expect-error Leaflet CSS import has no type definitions
      await import('leaflet/dist/leaflet.css');

      if (!isSubscribed || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current).setView([49.8, 15.5], 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current as L.Map;
      markersRef.current.forEach((m) => (m as L.Layer).remove());
      markersRef.current.clear();

      const validItems = filteredItems.filter((i) => i.latitude !== null && i.longitude !== null && (i.latitude !== 0 || i.longitude !== 0));
      if (validItems.length === 0) return;

      const bounds = L.latLngBounds([]);

      validItems.forEach((item) => {
        const lat = item.latitude!;
        const lng = item.longitude!;
        bounds.extend([lat, lng]);

        const marker = L.circleMarker([lat, lng], {
          radius: item.id === activeItemId ? 10 : 7,
          color: item.id === activeItemId ? '#0284c7' : '#334155',
          fillColor: item.id === activeItemId ? '#38bdf8' : '#0284c7',
          fillOpacity: 0.9,
          weight: 2,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 180px;">
            <strong style="font-size: 13px; color: #0f172a;">${item.pointCode}</strong><br/>
            <span style="font-size: 11px; color: #64748b;">${item.address}</span><br/>
            ${item.photoUrl ? `<img src="${item.photoUrl}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 6px; margin-top: 6px;"/>` : ''}
          </div>
        `);

        marker.on('click', () => {
          setActiveItemId(item.id);
          const el = document.getElementById(`nav-card-${item.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        markersRef.current.set(item.id, marker);
      });

      if (validItems.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    initMap();

    return () => {
      isSubscribed = false;
    };
  }, [filteredItems, activeItemId]);

  function panToPoint(item: SnapshotItemData) {
    setActiveItemId(item.id);
    if (mapInstanceRef.current && item.latitude && item.longitude && (item.latitude !== 0 || item.longitude !== 0)) {
      const map = mapInstanceRef.current as { flyTo?: (coords: [number, number], zoom: number, options: { duration: number }) => void };
      if (typeof map.flyTo === 'function') {
        map.flyTo([item.latitude, item.longitude], 14, { duration: 1 });
      }
      const marker = markersRef.current.get(item.id) as { openPopup?: () => void } | undefined;
      if (marker && typeof marker.openPopup === 'function') {
        marker.openPopup();
      }
    }
  }

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : prev));
      if (e.key === 'ArrowLeft') setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, filteredItems.length]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b bg-slate-950 text-white px-4 py-6 shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="SeePOINT" className="h-10 w-auto" src="/seepoint-logo.svg" />
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-400">Fotodokumentace navigací</p>
              <h1 className="text-xl font-bold tracking-tight text-white">{reportData.clientName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-sky-950 border border-sky-800 px-3 py-1.5 text-xs font-bold text-sky-300">
              {reportData.quarter ? `${reportData.quarter}. čtvrtletí ` : ''}{reportData.year}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Campaign Info & Stats */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-950">{reportData.campaignTitle}</h2>
              {reportData.description && <p className="mt-1 text-sm text-slate-600">{reportData.description}</p>}
            </div>
            <p className="text-xs text-slate-500">
              Datum aktualizace: <strong>{new Date(reportData.publishedAt).toLocaleDateString('cs-CZ')}</strong>
            </p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Compass size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-950">{reportData.itemsCount}</p>
              <p className="text-xs font-medium text-slate-500">Nosičů v dokumentaci</p>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <MapPin size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-950">{cities.length || 1}</p>
              <p className="text-xs font-medium text-slate-500">Měst a lokalit</p>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Camera size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-950">{reportData.items.filter((i) => Boolean(i.photoUrl)).length}</p>
              <p className="text-xs font-medium text-slate-500">Aktuálních fotografií</p>
            </div>

            <div className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Calendar size={18} />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-950">100%</p>
              <p className="text-xs font-medium text-slate-500">Garantovaný stav</p>
            </div>
          </div>
        </section>

        {/* Filter Toolbar */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400"
                placeholder="Hledat podle adresy nebo kódu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {cities.length > 0 && (
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <option value="">Všechna města ({cities.length})</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            )}

            {statuses.length > 0 && (
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">Všechny stavy</option>
                {statuses.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}
          </div>

          <p className="text-xs font-semibold text-slate-500">
            Zobrazeno {filteredItems.length} z {reportData.itemsCount} položek
          </p>
        </section>

        {/* Map & Grid Container */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Cards Grid */}
          <div className="space-y-4">
            {filteredItems.map((item, index) => {
              const isSelected = item.id === activeItemId;
              const hasGps = item.latitude !== null && item.longitude !== null && (item.latitude !== 0 || item.longitude !== 0);

              return (
                <article
                  id={`nav-card-${item.id}`}
                  key={item.id}
                  onClick={() => panToPoint(item)}
                  className={`cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                    isSelected ? 'border-sky-500 ring-2 ring-sky-200' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="grid sm:grid-cols-[220px_1fr]">
                    {/* Photo Container */}
                    <div className="relative aspect-[4/3] sm:aspect-auto sm:h-full overflow-hidden bg-slate-900 group">
                      {item.photoUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            alt={item.pointCode}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            src={item.photoUrl}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxIndex(index);
                            }}
                            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-slate-950/80 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-slate-900"
                          >
                            <Maximize2 size={13} /> Zvětšit
                          </button>
                        </>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-400">
                          <Camera size={28} />
                          <span className="mt-1 text-xs font-medium">Fotodokumentace v přípravě</span>
                        </div>
                      )}
                    </div>

                    {/* Content Details */}
                    <div className="flex flex-col justify-between p-5 space-y-3">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-900">
                              {item.pointCode}
                            </span>
                            <h3 className="mt-1.5 text-base font-bold text-slate-950">{item.address}</h3>
                          </div>
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                            {item.status}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {item.city} {item.locality ? `· ${item.locality}` : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t pt-3 text-[11px] text-slate-600">
                        <div>
                          <span className="block text-slate-400">Směr / Cíl:</span>
                          <span className="font-semibold text-slate-800">{item.direction}</span>
                        </div>
                        <div>
                          <span className="block text-slate-400">Datum pořízení fotky:</span>
                          <span className="font-semibold text-slate-800">
                            {item.photoDate ? new Date(item.photoDate).toLocaleDateString('cs-CZ') : 'Neuvedeno'}
                          </span>
                        </div>
                      </div>

                      {item.clientNote && (
                        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-3 text-xs text-sky-950">
                          <strong className="block text-[11px] text-sky-800">Poznámka k umístění:</strong>
                          {item.clientNote}
                        </div>
                      )}

                      {!hasGps && (
                        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                          <AlertTriangle size={12} /> Bez GPS (nelze zobrazit na mapě)
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Interactive Map Sticky Panel */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <MapPin size={16} className="text-sky-600" />
                  <span>Mapa navigačních nosičů</span>
                </div>
                <span className="text-[11px] text-slate-500">Kliknutím na kartu se mapa zaměří</span>
              </div>

              <div ref={mapContainerRef} className="h-[520px] w-full rounded-2xl border border-slate-200 bg-slate-100" />
            </div>
          </div>
        </div>
      </main>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && filteredItems[lightboxIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm">
          <button
            aria-label="Zavřít"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 rounded-full bg-slate-800/80 p-2 text-white hover:bg-slate-700"
            type="button"
          >
            <X size={24} />
          </button>

          {lightboxIndex > 0 && (
            <button
              aria-label="Předchozí"
              onClick={() => setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
              className="absolute left-4 z-10 rounded-full bg-slate-800/80 p-3 text-white hover:bg-slate-700"
              type="button"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {lightboxIndex < filteredItems.length - 1 && (
            <button
              aria-label="Další"
              onClick={() => setLightboxIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : prev))}
              className="absolute right-4 z-10 rounded-full bg-slate-800/80 p-3 text-white hover:bg-slate-700"
              type="button"
            >
              <ChevronRight size={24} />
            </button>
          )}

          <div className="flex max-h-full max-w-5xl flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={filteredItems[lightboxIndex].pointCode}
              src={filteredItems[lightboxIndex].photoUrl || ''}
              className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />

            <div className="text-center text-white space-y-1">
              <h3 className="text-base font-bold">
                {filteredItems[lightboxIndex].pointCode} · {filteredItems[lightboxIndex].address}
              </h3>
              <p className="text-xs text-slate-400">
                {filteredItems[lightboxIndex].city} · Pořízeno:{' '}
                {filteredItems[lightboxIndex].photoDate
                  ? new Date(filteredItems[lightboxIndex].photoDate!).toLocaleDateString('cs-CZ')
                  : 'Neuvedeno'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
