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
  Download,
  Archive,
  ExternalLink,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-react';
import type { SnapshotItemData } from '@/lib/navigation-documentation';
import {
  exportMapToPng,
  exportPointsToGpx,
  getGoogleMapsRouteUrl,
} from '@/lib/navigation-documentation-export';

type MapTileLayerType = 'streets' | 'satellite' | 'dark';

export function PublicNavigationClientView({
  token,
  reportData,
}: {
  token?: string;
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

  // Map layer switcher
  const [mapLayer, setMapLayer] = useState<MapTileLayerType>('streets');

  // Selected item on map/list
  const [activeItemId, setActiveItemId] = useState<string | null>(reportData.items[0]?.id ?? null);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Export states
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isExportingMap, setIsExportingMap] = useState(false);

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
  const totalPhotosCount = useMemo(() => reportData.items.filter((i) => i.photoUrl).length, [reportData.items]);

  // Leaflet map setup
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const tileLayerRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const routePolylineRef = useRef<unknown>(null);

  // Initialize or reconfigure map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isSubscribed = true;

    async function initOrUpdateMap() {
      const L = await import('leaflet');

      if (!isSubscribed || !mapContainerRef.current) return;

      // 1. Initialize Map instance once
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [49.8, 15.5],
          zoom: 8,
          attributionControl: true,
        });
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current as L.Map;

      // 2. Manage Tile Layer based on mapLayer state
      if (tileLayerRef.current) {
        (tileLayerRef.current as L.TileLayer).remove();
        tileLayerRef.current = null;
      }

      let tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      let tileAttribution = '&copy; Google Maps';
      let maxZoom = 20;

      if (mapLayer === 'satellite') {
        tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        tileAttribution = '&copy; Google Maps';
        maxZoom = 20;
      } else if (mapLayer === 'dark') {
        tileUrl = 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
        tileAttribution = '&copy; Google Maps (Terén)';
        maxZoom = 20;
      }

      const tileLayer = L.tileLayer(tileUrl, {
        attribution: tileAttribution,
        maxZoom,
        crossOrigin: true, // critical for canvas map export
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // 3. Clear existing markers and route line
      markersRef.current.forEach((m) => (m as L.Layer).remove());
      markersRef.current.clear();

      if (routePolylineRef.current) {
        (routePolylineRef.current as L.Polyline).remove();
        routePolylineRef.current = null;
      }

      const validItems = filteredItems.filter(
        (i) => i.latitude !== null && i.longitude !== null && (i.latitude !== 0 || i.longitude !== 0),
      );

      if (validItems.length === 0) return;

      const bounds = L.latLngBounds([]);
      const latLngs: [number, number][] = [];

      validItems.forEach((item, index) => {
        const lat = item.latitude!;
        const lng = item.longitude!;
        bounds.extend([lat, lng]);
        latLngs.push([lat, lng]);

        const isSelected = item.id === activeItemId;

        // Custom high-contrast numbered pin icon
        const iconHtml = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${isSelected ? '32px' : '26px'};
            height: ${isSelected ? '32px' : '26px'};
            background: ${isSelected ? '#0284c7' : '#0f172a'};
            color: #ffffff;
            border: 2.5px solid ${isSelected ? '#38bdf8' : '#e2e8f0'};
            border-radius: 9999px;
            font-size: ${isSelected ? '12px' : '10px'};
            font-weight: 800;
            font-family: ui-sans-serif, system-ui, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transform: translate(-50%, -50%);
            cursor: pointer;
            transition: transform 0.15s ease;
          ">
            ${index + 1}
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'seepoint-map-pin',
          html: iconHtml,
          iconSize: [0, 0],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 210px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 6px;">Bod #${index + 1} · ${item.pointCode}</span>
              <span style="font-size: 10px; color: #15803d; font-weight: 700;">${item.status || 'INSTALLED'}</span>
            </div>
            <strong style="font-size: 13px; color: #0f172a; display: block; margin-top: 2px;">${item.city}</strong>
            <span style="font-size: 11px; color: #475569; display: block;">${item.address}</span>
            <div style="margin-top: 4px; font-size: 11px; color: #0284c7; font-weight: 700;">
              Směr: ${item.direction || 'Obousměrný'}
            </div>
            ${item.photoUrl ? `<img src="${item.photoUrl}" style="width: 100%; height: 95px; object-fit: cover; border-radius: 8px; margin-top: 8px; border: 1px solid #cbd5e1;"/>` : ''}
            <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 5px 8px; background: #0284c7; color: #ffffff; border-radius: 6px; font-size: 11px; font-weight: 700; text-decoration: none;">
                Navigovat v Google Maps ↗
              </a>
            </div>
          </div>
        `);

        marker.on('click', () => {
          setActiveItemId(item.id);
          const el = document.getElementById(`nav-card-${item.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        markersRef.current.set(item.id, marker);
      });

      // Connecting Route Line between points
      if (latLngs.length >= 2) {
        const polyline = L.polyline(latLngs, {
          color: '#0284c7',
          weight: 3.5,
          dashArray: '6, 6',
          opacity: 0.85,
        }).addTo(map);
        routePolylineRef.current = polyline;
      }

      if (validItems.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }

    initOrUpdateMap();

    return () => {
      isSubscribed = false;
    };
  }, [filteredItems, activeItemId, mapLayer]);

  function panToPoint(item: SnapshotItemData) {
    setActiveItemId(item.id);
    if (mapInstanceRef.current && item.latitude && item.longitude && (item.latitude !== 0 || item.longitude !== 0)) {
      const map = mapInstanceRef.current as {
        flyTo?: (coords: [number, number], zoom: number, options: { duration: number }) => void;
      };
      if (typeof map.flyTo === 'function') {
        map.flyTo([item.latitude, item.longitude], 15, { duration: 0.8 });
      }
      const marker = markersRef.current.get(item.id) as { openPopup?: () => void } | undefined;
      if (marker && typeof marker.openPopup === 'function') {
        marker.openPopup();
      }
    }
  }

  // Handle Download All Photos in ZIP
  function handleDownloadZip() {
    if (!token) return;
    setIsDownloadingZip(true);
    const link = document.createElement('a');
    link.href = `/api/client/navigation-documentation/${encodeURIComponent(token)}/download-zip`;
    link.setAttribute('download', `Fotodokumentace-navigaci-${reportData.year}.zip`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setIsDownloadingZip(false), 2500);
  }

  // Handle Export Map to PNG
  async function handleExportMapPng() {
    if (!mapContainerRef.current || !mapInstanceRef.current) return;
    setIsExportingMap(true);
    try {
      const periodLabel = reportData.quarter ? `${reportData.quarter}. čtvrtletí ${reportData.year}` : `${reportData.year}`;
      await exportMapToPng({
        mapElement: mapContainerRef.current,
        leafletMap: mapInstanceRef.current,
        title: reportData.campaignTitle,
        clientName: reportData.clientName,
        period: periodLabel,
        items: filteredItems,
      });
    } catch (err) {
      console.error('Export mapy selhal:', err);
      alert('Při exportu mapy do obrázku došlo k chybě.');
    } finally {
      setIsExportingMap(false);
    }
  }

  // Handle Export GPX
  function handleExportGpx() {
    exportPointsToGpx({
      reportTitle: reportData.campaignTitle,
      clientName: reportData.clientName,
      items: filteredItems,
    });
  }

  const googleMapsUrl = useMemo(() => getGoogleMapsRouteUrl(filteredItems), [filteredItems]);

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

  // Dynamic visual arrow icon & styling for direction
  function renderDirectionBadge(directionText?: string | null) {
    const d = (directionText || '').toLowerCase();
    let Icon = ArrowLeftRight;
    let badgeColor = 'bg-sky-50 text-sky-900 border-sky-100';

    if (d.includes('prav') || d.includes('right')) {
      Icon = ArrowRight;
      badgeColor = 'bg-amber-50 text-amber-900 border-amber-200';
    } else if (d.includes('lev') || d.includes('left')) {
      Icon = ArrowLeft;
      badgeColor = 'bg-blue-50 text-blue-900 border-blue-200';
    } else if (d.includes('přím') || d.includes('rovn') || d.includes('straight')) {
      Icon = ArrowUp;
      badgeColor = 'bg-emerald-50 text-emerald-900 border-emerald-200';
    }

    return (
      <div className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border shadow-2xs ${badgeColor}`}>
        <Icon size={14} className="shrink-0" />
        <span>Směr: <strong>{directionText || 'Obousměrný (A/B)'}</strong></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white shadow-lg print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Clean SeePOINT Logo - without white rectangular card */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="SeePOINT Logo" className="h-8 sm:h-9 w-auto hover:opacity-90 transition" src="/seepoint-logo.svg" />

            {reportData.clientLogoUrl && (
              <>
                <span className="text-slate-700 text-sm font-light">/</span>
                <div className="flex h-8 max-w-[130px] items-center rounded-xl bg-white/10 px-2.5 py-1 backdrop-blur-xs border border-white/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={reportData.clientName}
                    className="h-full w-auto max-w-[110px] object-contain"
                    src={reportData.clientLogoUrl}
                  />
                </div>
              </>
            )}

            <div className="hidden sm:block h-6 w-px bg-slate-800" />
            <div className="hidden sm:block">
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Fotodokumentace navigací</p>
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight">{reportData.clientName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden md:inline-flex rounded-xl bg-sky-950/80 border border-sky-800/80 px-3 py-1.5 text-xs font-bold text-sky-300">
              {reportData.quarter ? `${reportData.quarter}. čtvrtletí ` : ''}{reportData.year}
            </span>

            {/* Bulk Download ZIP Button */}
            {token && totalPhotosCount > 0 && (
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isDownloadingZip}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 sm:px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-500 transition disabled:opacity-50"
                title={`Stáhnout všech ${totalPhotosCount} fotografií v plném rozlišení (ZIP)`}
              >
                {isDownloadingZip ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                <span className="hidden xs:inline">Stáhnout vše (ZIP)</span>
                <span className="xs:hidden">ZIP</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 sm:px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition"
            >
              <Printer size={14} /> <span className="hidden sm:inline">Tisk / PDF</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Campaign Info & Summary Section */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div className="flex items-center gap-4">
              {reportData.clientLogoUrl && (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 p-2 shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={reportData.clientName} className="max-h-full max-w-full object-contain" src={reportData.clientLogoUrl} />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                    <CheckCircle2 size={13} /> Oficiální klientský výstup
                  </span>
                  <span className="hidden sm:inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 border border-sky-200 items-center gap-1">
                    <Sparkles size={12} /> Garantovaná fotodokumentace
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-950">{reportData.campaignTitle}</h2>
                {reportData.description && <p className="mt-1 text-sm text-slate-600">{reportData.description}</p>}
              </div>
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
                <p className="text-2xl font-black text-slate-950">{totalPhotosCount}</p>
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
                placeholder="Hledat podle adresy, města, směru nebo kódu sloupu…"
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
                  className={`cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 ${
                    isSelected
                      ? 'border-sky-500 ring-2 ring-sky-200 shadow-md translate-x-1'
                      : 'border-slate-200 hover:border-slate-300'
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

                          {/* Hover action overlay with Download & Expand */}
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex(index);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl bg-slate-950/85 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-xs hover:bg-slate-900 transition shadow-md"
                            >
                              <Maximize2 size={13} /> Zvětšit
                            </button>

                            <a
                              href={`${item.photoUrl}?download=1`}
                              download
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-xl bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500 transition shadow-md"
                              title="Stáhnout tuto fotografii"
                            >
                              <Download size={13} /> Stáhnout
                            </a>
                          </div>

                          {/* Static corner badges for quick view */}
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 sm:hidden">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxIndex(index);
                              }}
                              className="rounded-lg bg-slate-950/80 px-2 py-1 text-[10px] font-semibold text-white"
                            >
                              <Maximize2 size={11} className="inline mr-1" /> Zvětšit
                            </button>
                            <a
                              href={`${item.photoUrl}?download=1`}
                              download
                              onClick={(e) => e.stopPropagation()}
                              className="rounded-lg bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white"
                            >
                              <Download size={11} className="inline mr-1" /> Stáhnout
                            </a>
                          </div>
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
                          <div className="flex items-center gap-1.5">
                            {/* Sequence number badge matching map pin */}
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">
                              {index + 1}
                            </span>
                            <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-100">
                              {item.pointCode}
                            </span>
                          </div>

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
                          {renderDirectionBadge(item.direction)}
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
                        {hasGps ? (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 font-bold transition"
                            title="Navigovat k tomuto bodu v Google Maps"
                          >
                            <span>Google Maps ↗</span>
                          </a>
                        ) : (
                          <span className="text-amber-600 font-medium">GPS neuvedeno</span>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Interactive Map Section */}
          <div className="sticky top-20 flex flex-col gap-2.5 print:hidden">
            {/* Map Toolbar: Layer Switcher & Exports */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs">
              {/* Map Layer Switcher */}
              <div className="inline-flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMapLayer('streets')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    mapLayer === 'streets' ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Google Běžná
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayer('satellite')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    mapLayer === 'satellite' ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Google Letecká
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayer('dark')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    mapLayer === 'dark' ? 'bg-white text-sky-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Google Terénní
                </button>
              </div>

              {/* Map Export Tools */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleExportMapPng}
                  disabled={isExportingMap}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition disabled:opacity-50"
                  title="Stáhnout mapu s trasou a hlavičkou jako obrázek PNG"
                >
                  {isExportingMap ? <Loader2 size={13} className="animate-spin text-sky-600" /> : <Camera size={13} className="text-sky-600" />}
                  <span>Uložit mapu (PNG)</span>
                </button>

                {googleMapsUrl && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 transition"
                    title="Otevřít celou trasu v aplikaci Google Maps"
                  >
                    <ExternalLink size={13} />
                    <span>Google Maps ↗</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleExportGpx}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition"
                  title="Stáhnout GPS body ve formátu GPX (pro Mapy.cz, Garmin apod.)"
                >
                  <MapPin size={13} className="text-sky-600" />
                  <span>GPX</span>
                </button>
              </div>
            </div>

            {/* Map Container */}
            <div className="h-[620px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-md">
              <div ref={mapContainerRef} className="h-full w-full" />
            </div>
          </div>
        </div>
      </main>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && filteredItems[lightboxIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/92 p-4 backdrop-blur-md">
          {/* Top Actions in Lightbox */}
          <div className="absolute top-4 right-4 flex items-center gap-3">
            {filteredItems[lightboxIndex].photoUrl && (
              <a
                href={`${filteredItems[lightboxIndex].photoUrl}?download=1`}
                download
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-500 shadow-lg transition"
              >
                <Download size={14} /> Stáhnout foto
              </a>
            )}

            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="rounded-full bg-slate-800/80 p-2.5 text-white hover:bg-slate-700 transition"
            >
              <X size={20} />
            </button>
          </div>

          {lightboxIndex > 0 && (
            <button
              type="button"
              onClick={() => setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))}
              className="absolute left-4 rounded-full bg-slate-800/80 p-3 text-white hover:bg-slate-700 transition"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          {lightboxIndex < filteredItems.length - 1 && (
            <button
              type="button"
              onClick={() => setLightboxIndex((prev) => (prev !== null && prev < filteredItems.length - 1 ? prev + 1 : prev))}
              className="absolute right-4 rounded-full bg-slate-800/80 p-3 text-white hover:bg-slate-700 transition"
            >
              <ChevronRight size={24} />
            </button>
          )}

          <div className="max-h-[90vh] max-w-[90vw] text-center space-y-3">
            {filteredItems[lightboxIndex].photoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                alt={filteredItems[lightboxIndex].pointCode}
                className="max-h-[76vh] max-w-full rounded-2xl shadow-2xl object-contain mx-auto border border-slate-800"
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
                Bod #{lightboxIndex + 1} · {filteredItems[lightboxIndex].pointCode} · {filteredItems[lightboxIndex].city} (Směr: {filteredItems[lightboxIndex].direction || 'Obousměrný'})
              </p>
              <p className="text-slate-300">{filteredItems[lightboxIndex].address}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
