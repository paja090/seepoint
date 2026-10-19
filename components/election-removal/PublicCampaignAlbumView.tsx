'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { Map as LeafletMap, TileLayer as LeafletTileLayer, Marker as LeafletMarker } from 'leaflet';
import {
  Camera,
  Calendar,
  Download,
  Filter,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  MapPin,
  Clock,
  LayoutGrid,
  Compass,
  ExternalLink,
  Maximize2,
} from 'lucide-react';

export interface PublicPhotoItem {
  id: string;
  url: string;
  type: string;
  fileName: string | null;
  createdAt: string;
  capturedLatitude?: number | null;
  capturedLongitude?: number | null;
  capturedByWorkerName?: string | null;
}

export interface PublicPointItem {
  id: string;
  label: string;
  description?: string | null;
  mediaType: string;
  objectType?: string | null;
  quantity: number;
  latitude: number;
  longitude: number;
  operationType?: string | null;
  photos: PublicPhotoItem[];
}

export interface PublicCampaignAlbumViewProps {
  token: string;
  campaign: {
    id: string;
    name: string;
    clientName?: string | null;
    description?: string | null;
    targetDate?: string | null;
    createdAt?: string | null;
    totalPoints: number;
    completedPoints: number;
  };
  points: PublicPointItem[];
  availablePeriods: string[]; // ["2026-10", "2026-09"]
  initialPeriod?: string;
}

const MONTH_NAMES_CS: Record<string, string> = {
  '01': 'Leden',
  '02': 'Únor',
  '03': 'Březen',
  '04': 'Duben',
  '05': 'Květen',
  '06': 'Červen',
  '07': 'Červenec',
  '08': 'Srpen',
  '09': 'Září',
  '10': 'Říjen',
  '11': 'Listopad',
  '12': 'Prosinec',
};

function formatPeriodLabel(periodKey: string): string {
  const [year, month] = periodKey.split('-');
  return `${MONTH_NAMES_CS[month] || month} ${year}`;
}

function formatCzechDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getPointCoordinates(
  point: PublicPointItem,
  preferredPhoto?: PublicPhotoItem
): { lat: number; lng: number } | null {
  if (
    typeof point.latitude === 'number' &&
    typeof point.longitude === 'number' &&
    (point.latitude !== 0 || point.longitude !== 0) &&
    !Number.isNaN(point.latitude) &&
    !Number.isNaN(point.longitude)
  ) {
    return { lat: point.latitude, lng: point.longitude };
  }
  if (
    preferredPhoto &&
    typeof preferredPhoto.capturedLatitude === 'number' &&
    typeof preferredPhoto.capturedLongitude === 'number' &&
    (preferredPhoto.capturedLatitude !== 0 || preferredPhoto.capturedLongitude !== 0) &&
    !Number.isNaN(preferredPhoto.capturedLatitude) &&
    !Number.isNaN(preferredPhoto.capturedLongitude)
  ) {
    return { lat: preferredPhoto.capturedLatitude, lng: preferredPhoto.capturedLongitude };
  }
  const photoWithGps = point.photos.find(
    (p) =>
      typeof p.capturedLatitude === 'number' &&
      typeof p.capturedLongitude === 'number' &&
      (p.capturedLatitude !== 0 || p.capturedLongitude !== 0) &&
      !Number.isNaN(p.capturedLatitude) &&
      !Number.isNaN(p.capturedLongitude)
  );
  if (photoWithGps?.capturedLatitude && photoWithGps?.capturedLongitude) {
    return { lat: photoWithGps.capturedLatitude, lng: photoWithGps.capturedLongitude };
  }
  return null;
}

export function PublicCampaignAlbumView({
  token,
  campaign,
  points,
  availablePeriods,
  initialPeriod,
}: PublicCampaignAlbumViewProps) {
  // If no initialPeriod specified, default to the latest available period or "ALL"
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    initialPeriod || (availablePeriods.length > 0 ? availablePeriods[0] : 'ALL')
  );
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INSTALL' | 'DEINSTALL' | 'CONTROL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // View mode switcher: GRID of photos vs interactive MAP of locations
  const [viewMode, setViewMode] = useState<'GRID' | 'MAP'>('GRID');
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite' | 'terrain'>('streets');
  const [activeMapPointId, setActiveMapPointId] = useState<string | null>(null);

  // Flatten all photos matching current period and filters
  const flatPhotosWithPoint = useMemo(() => {
    const list: Array<{ photo: PublicPhotoItem; point: PublicPointItem }> = [];

    for (const point of points) {
      if (
        searchQuery.trim() &&
        !point.label.toLocaleLowerCase('cs').includes(searchQuery.toLocaleLowerCase('cs')) &&
        !point.description?.toLocaleLowerCase('cs').includes(searchQuery.toLocaleLowerCase('cs'))
      ) {
        continue;
      }

      for (const photo of point.photos) {
        const d = new Date(photo.createdAt);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (selectedPeriod !== 'ALL' && ym !== selectedPeriod) {
          continue;
        }

        const isInstall = ['AFTER_INSTALLATION', 'INSTALLATION', 'BEFORE_INSTALLATION'].includes(photo.type);
        const isDeinstall = photo.type === 'AFTER_DEINSTALLATION';
        const isControl = photo.type === 'CONTROL';

        if (typeFilter === 'INSTALL' && !isInstall) continue;
        if (typeFilter === 'DEINSTALL' && !isDeinstall) continue;
        if (typeFilter === 'CONTROL' && !isControl) continue;

        list.push({ photo, point });
      }
    }

    return list;
  }, [points, selectedPeriod, typeFilter, searchQuery]);

  // Points on the map filtered by the current selection
  const mapPoints = useMemo(() => {
    const map = new Map<
      string,
      {
        point: PublicPointItem;
        lat: number;
        lng: number;
        photos: PublicPhotoItem[];
      }
    >();

    for (const item of flatPhotosWithPoint) {
      const coords = getPointCoordinates(item.point, item.photo);
      if (!coords) continue;

      const existing = map.get(item.point.id);
      if (existing) {
        if (!existing.photos.some((ph) => ph.id === item.photo.id)) {
          existing.photos.push(item.photo);
        }
      } else {
        map.set(item.point.id, {
          point: item.point,
          lat: coords.lat,
          lng: coords.lng,
          photos: [item.photo],
        });
      }
    }

    return Array.from(map.values());
  }, [flatPhotosWithPoint]);

  // Leaflet map setup
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<LeafletTileLayer | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());

  // Connect Leaflet popup buttons/clicks to full-screen Lightbox
  useEffect(() => {
    const w = window as unknown as {
      __openPublicAlbumLightbox?: (photoId: string) => void;
    };
    w.__openPublicAlbumLightbox = (photoId: string) => {
      const idx = flatPhotosWithPoint.findIndex((p) => p.photo.id === photoId);
      if (idx !== -1) {
        setLightboxIndex(idx);
      }
    };
    return () => {
      delete (window as unknown as { __openPublicAlbumLightbox?: unknown }).__openPublicAlbumLightbox;
    };
  }, [flatPhotosWithPoint]);

  // Initialize or reconfigure map
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isSubscribed = true;

    async function initOrUpdateMap() {
      if (!mapContainerRef.current) return;

      // Inject Leaflet CSS dynamically if missing
      if (!document.getElementById('leaflet-css-public-album')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-public-album';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = await import('leaflet');
      if (!isSubscribed || !mapContainerRef.current) return;

      // 1. Initialize Map instance once
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [49.8175, 15.473],
          zoom: 8,
          attributionControl: true,
        });
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // 2. Tile layer
      let tileUrl = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
      let tileAttribution = '&copy; Google Maps';
      let maxZoom = 20;

      if (mapLayer === 'satellite') {
        tileUrl = 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
        tileAttribution = '&copy; Google Maps (Satelitní)';
        maxZoom = 20;
      } else if (mapLayer === 'terrain') {
        tileUrl = 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}';
        tileAttribution = '&copy; Google Maps (Terén)';
        maxZoom = 20;
      }

      if (tileLayerRef.current) {
        tileLayerRef.current.remove();
      }
      const tileLayer = L.tileLayer(tileUrl, {
        attribution: tileAttribution,
        maxZoom,
        crossOrigin: true,
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      // 3. Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      if (mapPoints.length === 0) return;

      const bounds = L.latLngBounds([]);

      mapPoints.forEach((item, index) => {
        const lat = item.lat;
        const lng = item.lng;
        bounds.extend([lat, lng]);

        const isSelected = item.point.id === activeMapPointId;
        const primaryPhoto = item.photos[0];
        const photoCountText = item.photos.length === 1 ? '1 foto' : `${item.photos.length} fotek`;

        const iconHtml = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${isSelected ? '34px' : '28px'};
            height: ${isSelected ? '34px' : '28px'};
            background: ${isSelected ? '#0284c7' : '#0f172a'};
            color: #ffffff;
            border: 2.5px solid ${isSelected ? '#38bdf8' : '#ffffff'};
            border-radius: 9999px;
            font-size: ${isSelected ? '12px' : '10px'};
            font-weight: 800;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            transform: translate(-50%, -50%);
            cursor: pointer;
            transition: all 0.15s ease;
          ">
            ${index + 1}
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'custom-album-map-pin',
          html: iconHtml,
          iconSize: [0, 0],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        const popupHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 220px; max-width: 260px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px;">
              <span style="font-size: 10px; font-weight: 800; background: #0f172a; color: #ffffff; padding: 2px 7px; border-radius: 9999px;">
                #${index + 1}
              </span>
              <span style="font-size: 11px; font-weight: 700; color: #0284c7;">
                ${photoCountText}
              </span>
            </div>

            <strong style="font-size: 13px; font-weight: 700; color: #0f172a; display: block; line-height: 1.3;">
              ${escapeHtml(item.point.label)}
            </strong>

            ${
              item.point.description
                ? `<p style="font-size: 11px; color: #64748b; margin: 3px 0 6px 0; line-height: 1.35;">${escapeHtml(item.point.description)}</p>`
                : ''
            }

            ${
              primaryPhoto
                ? `
              <div style="position: relative; margin-top: 6px; cursor: pointer; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;" onclick="window.__openPublicAlbumLightbox && window.__openPublicAlbumLightbox('${primaryPhoto.id}')">
                <img src="${primaryPhoto.url}?thumbnail=1" style="width: 100%; height: 110px; object-fit: cover; display: block;" loading="lazy" alt="${escapeHtml(item.point.label)}" />
                <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.65); color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                  Zvětšit ↗
                </div>
              </div>
              `
                : ''
            }

            <div style="display: flex; gap: 6px; margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 8px;">
              ${
                primaryPhoto
                  ? `
                <button type="button" style="flex: 1; padding: 6px 8px; background: #0284c7; color: #ffffff; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;" onclick="window.__openPublicAlbumLightbox && window.__openPublicAlbumLightbox('${primaryPhoto.id}')">
                  Fotogalerie
                </button>
                `
                  : ''
              }
              <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 3px; padding: 6px 8px; background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; font-weight: 700; text-decoration: none;">
                Navigovat ↗
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml);
        marker.on('click', () => {
          setActiveMapPointId(item.point.id);
        });

        markersRef.current.set(item.point.id, marker);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }

    void initOrUpdateMap();

    return () => {
      isSubscribed = false;
    };
  }, [mapPoints, mapLayer, activeMapPointId]);

  // Recalculate size when switching to map view
  useEffect(() => {
    if (viewMode === 'MAP' && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [viewMode]);

  const fitAllMapBounds = () => {
    if (!mapInstanceRef.current || mapPoints.length === 0) return;
    import('leaflet').then((L) => {
      const bounds = L.latLngBounds([]);
      mapPoints.forEach((p) => bounds.extend([p.lat, p.lng]));
      if (bounds.isValid()) {
        mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    });
  };

  const focusPointOnMap = (pointId: string, lat: number, lng: number) => {
    setActiveMapPointId(pointId);
    setViewMode('MAP');
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], Math.max(mapInstanceRef.current.getZoom(), 15), { animate: true });
      const marker = markersRef.current.get(pointId);
      if (marker) {
        marker.openPopup();
      }
    }
  };

  const activeLightboxItem =
    lightboxIndex !== null && flatPhotosWithPoint[lightboxIndex] ? flatPhotosWithPoint[lightboxIndex] : null;

  const handlePrev = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    } else if (lightboxIndex === 0) {
      setLightboxIndex(flatPhotosWithPoint.length - 1);
    }
  };

  const handleNext = () => {
    if (lightboxIndex !== null && lightboxIndex < flatPhotosWithPoint.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    } else if (lightboxIndex !== null) {
      setLightboxIndex(0);
    }
  };

  const downloadZipUrl = `/api/client/fotodokumentace/${encodeURIComponent(token)}/download-zip${
    selectedPeriod !== 'ALL' ? `?month=${encodeURIComponent(selectedPeriod)}` : ''
  }`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans print:bg-white print:text-black">
      {/* Top Client Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm sticky top-0 z-20 print:static">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/seepoint-logo.svg" alt="SeePoint" className="h-8 w-auto" />
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                  Fotodokumentace zakázky
                </span>
                {campaign.clientName && (
                  <span className="text-xs text-slate-500 font-medium">pro {campaign.clientName}</span>
                )}
                {campaign.createdAt && (
                  <span className="text-xs text-slate-500 font-medium inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Vytvořeno: {formatCzechDate(campaign.createdAt)}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">{campaign.name}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
              title="Vytisknout přehled nebo uložit do PDF"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Tisk / PDF</span>
            </button>

            <a
              href={downloadZipUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Stáhnout fotografie (ZIP)</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* KPI Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Zobrazené fotografie</p>
            <p className="text-2xl font-bold text-sky-600 mt-1">{flatPhotosWithPoint.length}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Celkem lokalit</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{campaign.totalPoints}</p>
          </div>

          <div
            onClick={() => setViewMode('MAP')}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/20 transition group"
            title="Kliknutím otevřete interaktivní mapu"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Lokality na mapě</p>
              <MapPin className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-600">{mapPoints.length}</span>
              <span className="text-xs text-slate-400 group-hover:text-emerald-700 font-semibold underline">
                Zobrazit mapu →
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Stav realizace</p>
            <p className="text-base sm:text-lg font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Ověřeno v terénu</span>
            </p>
          </div>
        </div>

        {/* View mode switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2 print:hidden">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                viewMode === 'GRID'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4 text-sky-600" />
              <span>Fotogalerie</span>
              <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px]">
                {flatPhotosWithPoint.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('MAP')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
                viewMode === 'MAP'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Mapa lokalit</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px]">
                {mapPoints.length}
              </span>
            </button>
          </div>

          {viewMode === 'MAP' && (
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-400 px-2">Podklad mapy:</span>
              {(
                [
                  ['streets', 'Ulice'],
                  ['satellite', 'Satelit'],
                  ['terrain', 'Terén'],
                ] as const
              ).map(([lKey, lLabel]) => (
                <button
                  key={lKey}
                  type="button"
                  onClick={() => setMapLayer(lKey)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    mapLayer === lKey ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {lLabel}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Period & Filter Navigation Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 print:hidden">
          {/* Period selector */}
          {availablePeriods.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                <Calendar className="w-4 h-4 text-sky-600" />
                <span>Období / Měsíc:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {availablePeriods.map((period) => {
                  const isActive = selectedPeriod === period;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        isActive
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {formatPeriodLabel(period)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('ALL')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    selectedPeriod === 'ALL'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Všechna období
                </button>
              </div>
            </div>
          )}

          {/* Operation & Search Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                Filtr prací:
              </span>
              {(
                [
                  ['ALL', 'Všechny fotografie'],
                  ['INSTALL', '🛠️ Pouze Instalace'],
                  ['DEINSTALL', '🗑️ Pouze Deinstalace'],
                  ['CONTROL', '🔍 Kontroly'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTypeFilter(val)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    typeFilter === val ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="sm:max-w-xs w-full">
              <input
                type="text"
                placeholder="Hledat lokalitu / ulici…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* VIEW 1: INTERACTIVE MAP VIEW */}
        <div className={`space-y-4 ${viewMode === 'MAP' ? 'block' : 'hidden'}`}>
          {mapPoints.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Žádná lokalita v tomto výběru nemá uložené GPS souřadnice
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Fotografie si můžete prohlédnout v záložce Fotogalerie nebo zkuste upravit filtry období a prací.
              </p>
              <button
                type="button"
                onClick={() => setViewMode('GRID')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Přejít do fotogalerie</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Interactive Map Box */}
              <div className="lg:col-span-8 rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-slate-100 relative">
                <div ref={mapContainerRef} className="w-full h-[450px] sm:h-[600px] z-0" />

                {/* Floating Quick Action overlay */}
                <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fitAllMapBounds}
                    title="Vycentrovat na všechny body"
                    className="px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-sm text-slate-800 text-xs font-bold shadow-md hover:bg-white border border-slate-200 transition flex items-center gap-1"
                  >
                    <Compass className="w-3.5 h-3.5 text-sky-600" />
                    <span>Vycentrovat vše</span>
                  </button>
                </div>
              </div>

              {/* Side List of Locations */}
              <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 flex flex-col h-[600px]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Lokality na mapě</h3>
                    <p className="text-xs text-slate-400">
                      Celkem {mapPoints.length}{' '}
                      {mapPoints.length === 1 ? 'místo' : mapPoints.length < 5 ? 'místa' : 'míst'}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    Aktivní GPS
                  </span>
                </div>

                {/* Scrollable list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-100">
                  {mapPoints.map((item, idx) => {
                    const isSelected = item.point.id === activeMapPointId;
                    const primaryPhoto = item.photos[0];

                    return (
                      <div
                        key={item.point.id}
                        onClick={() => focusPointOnMap(item.point.id, item.lat, item.lng)}
                        className={`pt-2.5 first:pt-0 cursor-pointer rounded-xl p-2.5 transition flex gap-3 ${
                          isSelected
                            ? 'bg-sky-50/80 border border-sky-200 shadow-xs'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        {/* Photo Thumbnail */}
                        {primaryPhoto && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              const fIndex = flatPhotosWithPoint.findIndex((p) => p.photo.id === primaryPhoto.id);
                              if (fIndex !== -1) setLightboxIndex(fIndex);
                            }}
                            title="Kliknutím zvětšíte fotografii"
                            className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-slate-100 group/thumb"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`${primaryPhoto.url}?thumbnail=1`}
                              alt={item.point.label}
                              className="w-full h-full object-cover group-hover/thumb:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition flex items-center justify-center">
                              <Maximize2 className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        )}

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-900 text-white">
                              #{idx + 1}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 truncate">{item.point.label}</h4>
                          </div>

                          {item.point.description && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.point.description}</p>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-100">
                            <span>{item.photos.length} fotek</span>
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-sky-600 hover:text-sky-700 font-semibold inline-flex items-center gap-0.5"
                            >
                              <span>Trasa</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* VIEW 2: PHOTO GALLERY GRID */}
        <div className={`space-y-4 ${viewMode === 'GRID' ? 'block' : 'hidden'}`}>
          {flatPhotosWithPoint.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                Pro vybrané období a filtr nejsou k dispozici žádné fotografie
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Zkuste zvolit jiné období v časové liště nebo přepnout filtr typu prací.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {flatPhotosWithPoint.map(({ photo, point }, index) => {
                const isInstall = ['AFTER_INSTALLATION', 'INSTALLATION', 'BEFORE_INSTALLATION'].includes(photo.type);
                const isDeinstall = photo.type === 'AFTER_DEINSTALLATION';
                const coords = getPointCoordinates(point, photo);

                return (
                  <div
                    key={photo.id}
                    onClick={() => setLightboxIndex(index)}
                    className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer flex flex-col"
                  >
                    {/* Image Aspect Box with lazy loading */}
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${photo.url}?thumbnail=1`}
                        alt={point.label}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm text-white ${
                            isInstall ? 'bg-emerald-600' : isDeinstall ? 'bg-amber-600' : 'bg-sky-600'
                          }`}
                        >
                          {isInstall ? 'Instalace' : isDeinstall ? 'Deinstalace' : 'Kontrola'}
                        </span>
                      </div>

                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] backdrop-blur-sm">
                        {formatCzechDate(photo.createdAt)}
                      </div>
                    </div>

                    {/* Metadata Card Footer */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-sky-600 transition flex items-start gap-1.5">
                          <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{point.label}</span>
                        </h4>
                        {point.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2 pl-5.5">{point.description}</p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        {coords ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              focusPointOnMap(point.id, coords.lat, coords.lng);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                            title="Zobrazit tuto lokalitu na interaktivní mapě"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Zobrazit na mapě</span>
                          </button>
                        ) : (
                          <span>Množství: {point.quantity} ks</span>
                        )}

                        <span className="text-sky-600 font-semibold group-hover:underline">Zvětšit foto →</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Lightbox Modal */}
      {activeLightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6 print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxIndex(null);
          }}
        >
          {/* Lightbox Topbar */}
          <div className="flex items-center justify-between text-white border-b border-white/10 pb-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Fotografie {lightboxIndex! + 1} z {flatPhotosWithPoint.length}
              </p>
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-lg">
                {activeLightboxItem.point.label}
              </h3>
            </div>

            <div className="flex items-center gap-3">
              {(() => {
                const coords = getPointCoordinates(activeLightboxItem.point, activeLightboxItem.photo);
                if (!coords) return null;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setLightboxIndex(null);
                      focusPointOnMap(activeLightboxItem.point.id, coords.lat, coords.lng);
                    }}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs font-semibold flex items-center gap-1.5"
                    title="Zavřít foto a zobrazit lokalitu na mapě"
                  >
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="hidden sm:inline">Na mapě</span>
                  </button>
                );
              })()}

              <a
                href={activeLightboxItem.photo.url}
                target="_blank"
                rel="noreferrer"
                download
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs font-semibold flex items-center gap-1.5"
                title="Stáhnout fotografii v plném rozlišení"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Stáhnout</span>
              </a>

              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                title="Zavřít"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Image Viewport */}
          <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6 select-none">
            {/* Prev Button */}
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 sm:left-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 transition"
              title="Předchozí fotografie"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeLightboxItem.photo.url}
              alt={activeLightboxItem.point.label}
              style={{
                backgroundImage: `url(${activeLightboxItem.photo.url}?thumbnail=1)`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
            />

            {/* Next Button */}
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 sm:right-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 transition"
              title="Další fotografie"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Lightbox Footer Details */}
          <div className="bg-white/10 rounded-xl p-3 sm:p-4 text-white text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-4xl mx-auto w-full">
            <div className="space-y-0.5">
              <span className="font-semibold text-sky-400">{activeLightboxItem.point.label}</span>
              <p className="text-slate-300">
                Pořízeno: {formatCzechDate(activeLightboxItem.photo.createdAt)}
                {activeLightboxItem.photo.capturedByWorkerName && (
                  <span className="ml-2">· Realizoval: {activeLightboxItem.photo.capturedByWorkerName}</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 text-slate-300 text-[11px]">
              {(() => {
                const coords = getPointCoordinates(activeLightboxItem.point, activeLightboxItem.photo);
                if (!coords) return null;
                return (
                  <div className="flex items-center gap-2">
                    <span>
                      GPS: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </span>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-300 hover:text-white underline inline-flex items-center gap-0.5"
                    >
                      <span>Navigovat</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
