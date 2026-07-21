'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  Maximize2,
  Printer,
  Search,
  X,
  CheckCircle2,
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
            <span style="font-size: 11px; color: #0284c7; font-weight: bold;">Směr: ${item.direction || 'Obousměrný'}</span><br/>
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
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white shadow-lg print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="SeePOINT Logo" className="h-9 w-auto bg-white/95 p-1 rounded-xl shadow-xs" src="/seepoint-logo.svg" />
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Fotodokumentace navigací</p>
              <h1 className="text-lg font-bold tracking-tight text-white">{reportData.clientName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex rounded-xl bg-sky-950 border border-sky-800 px-3 py-1.5 text-xs font-bold text-sky-300">
              {reportData.quarter ? `${reportData.quarter}. čtvrtletí ` : ''}{reportData.year}
            </span>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition"
            >
              <Printer size={14} /> Tisk / PDF
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Campaign Info & Summary Section */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                  <CheckCircle2 size={13} /> Oficiální klientský výstup
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-950">{reportData.campaignTitle}</h2>
              {reportData.description && <p className="mt-1 text-sm text-slate-600">{reportData.description}</p>}
            </div>
            <div className="text-right text-xs text-slate-500 space-y-0.5">
              <p>Aktualizováno: <strong className="text-slate-800">{new Date(reportData.publishedAt).toLocaleDateString('cs-CZ')}</strong></p>
              <p>Perioda: <strong className="text-sky-700">{reportData.quarter ? `${reportData.quarter}. čtvrtletí ` : ''}{reportData.year}</strong></p>
            </div>
          </div>

          {/* Key Metrics Dashboard */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Compass size={18} />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-black text-slate-950">{reportData.itemsCount}</p>
                <p className="text-xs font-semibold text-slate-500">Navigačních bodů</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <MapPin size={18} />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-black text-slate-950">{cities.length || 1}</p>
                <p className="text-xs font-semibold text-slate-500">Měst a lokalit</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Camera size={18} />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-black text-slate-950">{reportData.items.filter((i) => i.photoUrl).length}</p>
                <p className="text-xs font-semibold text-slate-500">Aktuálních fotografií</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Calendar size={18} />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-black text-emerald-700">100 %</p>
                <p className="text-xs font-semibold text-emerald-800">Garantovaný stav</p>
              </div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 print:hidden">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-8 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
                placeholder="Hledat podle adresy, města, směru nebo kódu…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {cities.length > 0 && (
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
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
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-sky-500 focus:outline-none"
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
        </section>

        {/* Navigation Points Cards & Map Layout */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Cards List */}
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
                    isSelected ? 'border-sky-500 ring-2 ring-sky-200 shadow-md' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="grid sm:grid-cols-[230px_1fr]">
                    {/* Photo Box */}
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
                            className="absolute bottom-2 right-2 flex items-center gap-1 rounded-xl bg-slate-950/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-xs hover:bg-slate-950"
                          >
                            <Maximize2 size={12} /> Zvětšit
                          </button>
                        </>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center p-4 text-center text-slate-400">
                          <Camera size={28} />
                          <span className="mt-1 text-xs">Bez fotografie</span>
                        </div>
                      )}
                    </div>

                    {/* Content Details Box */}
                    <div className="p-5 space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-100">
                            {item.pointCode}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            {item.status || 'INSTALLED'}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-slate-950">{item.city}</h3>
                          <p className="text-xs text-slate-600 font-semibold">{item.address}</p>
                          {item.locality && <p className="text-xs text-slate-500">{item.locality}</p>}
                        </div>

                        {/* PROMINENT DIRECTION BADGE */}
                        <div className="pt-1">
                          <div className="inline-flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900 border border-sky-100 shadow-2xs">
                            <Compass size={14} className="text-sky-600" />
                            <span>Směr: <strong>{item.direction || 'Obousměrný (A/B)'}</strong></span>
                          </div>
                        </div>
                      </div>

                      {item.clientNote && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950 space-y-0.5">
                          <strong className="block text-[11px] font-bold text-amber-900 uppercase tracking-wide">Poznámka k realizaci:</strong>
                          <p className="leading-relaxed">{item.clientNote}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t pt-2.5 text-[11px] text-slate-400">
                        <span>Fotodokumentace: {item.photoDate ? new Date(item.photoDate).toLocaleDateString('cs-CZ') : 'Aktuální'}</span>
                        {!hasGps && <span className="text-amber-600 font-medium">GPS neuvedeno</span>}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Interactive Map Section */}
          <div className="sticky top-20 h-[640px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-md print:hidden">
            <div ref={mapContainerRef} className="h-full w-full" />
          </div>
        </div>
      </main>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && filteredItems[lightboxIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 rounded-full bg-slate-800 p-2.5 text-white hover:bg-slate-700"
          >
            <X size={20} />
          </button>

          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={() => setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
              className="absolute left-4 rounded-full bg-slate-800 p-3 text-white hover:bg-slate-700"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {lightboxIndex < filteredItems.length - 1 && (
            <button
              type="button"
              onClick={() => setLightboxIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : prev))}
              className="absolute right-4 rounded-full bg-slate-800 p-3 text-white hover:bg-slate-700"
            >
              <ChevronRight size={24} />
            </button>
          )}

          <div className="max-h-[90vh] max-w-[90vw] text-center space-y-3">
            {filteredItems[lightboxIndex].photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                alt={filteredItems[lightboxIndex].pointCode}
                className="max-h-[78vh] max-w-full rounded-2xl shadow-2xl object-contain mx-auto"
                src={filteredItems[lightboxIndex].photoUrl}
              />
            ) : (
              <div className="flex h-64 w-96 flex-col items-center justify-center rounded-2xl bg-slate-800 text-slate-400 mx-auto">
                <Camera size={40} />
                <span className="mt-2 text-sm">Bez fotografie</span>
              </div>
            )}

            <div className="text-white text-xs space-y-1">
              <p className="font-bold text-sm">
                {filteredItems[lightboxIndex].pointCode} · {filteredItems[lightboxIndex].city} (Směr: {filteredItems[lightboxIndex].direction || 'Obousměrný'})
              </p>
              <p className="text-slate-300">{filteredItems[lightboxIndex].address}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
