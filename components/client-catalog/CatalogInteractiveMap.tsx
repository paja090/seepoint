'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { Map as LeafletMap, TileLayer as LeafletTileLayer, Marker as LeafletMarker } from 'leaflet';
import type { CatalogSurfaceItem } from './PublicInventoryCatalogView';
import { Eye, MapPin, Layers, Check, Plus } from 'lucide-react';

declare global {
  interface Window {
    __catalogToggleSurface?: (surfaceId: string) => void;
    __catalogOpenDetail?: (surfaceId: string) => void;
  }
}

interface CatalogInteractiveMapProps {
  items: CatalogSurfaceItem[];
  selectedIds: string[];
  onToggleSurface: (surfaceId: string) => void;
  onOpenDetail: (item: CatalogSurfaceItem) => void;
  className?: string;
}

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function CatalogInteractiveMap({
  items,
  selectedIds,
  onToggleSurface,
  onOpenDetail,
  className = '',
}: CatalogInteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<LeafletTileLayer | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [mapReady, setMapReady] = useState(false);

  // Store items lookup in a ref for popup event handlers
  const itemsMapRef = useRef<Map<string, CatalogSurfaceItem>>(new Map());
  useEffect(() => {
    const map = new Map<string, CatalogSurfaceItem>();
    items.forEach((item) => map.set(item.surfaceId, item));
    itemsMapRef.current = map;
  }, [items]);

  // Keep callback refs updated to avoid stale closures in window helpers
  const onToggleRef = useRef(onToggleSurface);
  onToggleRef.current = onToggleSurface;

  const onOpenDetailRef = useRef(onOpenDetail);
  onOpenDetailRef.current = onOpenDetail;

  // Filter items with valid coordinates
  const itemsWithCoords = useMemo(() => {
    return items.filter(
      (it) =>
        typeof it.latitude === 'number' &&
        typeof it.longitude === 'number' &&
        !Number.isNaN(it.latitude) &&
        !Number.isNaN(it.longitude) &&
        it.latitude > 48.0 &&
        it.latitude < 51.5 &&
        it.longitude > 12.0 &&
        it.longitude < 19.5
    );
  }, [items]);

  // Expose global callback handlers once for popup buttons
  useEffect(() => {
    window.__catalogToggleSurface = (surfaceId: string) => {
      onToggleRef.current(surfaceId);
    };
    window.__catalogOpenDetail = (surfaceId: string) => {
      const item = itemsMapRef.current.get(surfaceId);
      if (item) onOpenDetailRef.current(item);
    };

    return () => {
      delete window.__catalogToggleSurface;
      delete window.__catalogOpenDetail;
    };
  }, []);

  // 1. Initialize Map instance once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isSubscribed = true;

    async function initMap() {
      if (!mapContainerRef.current) return;

      // Inject Leaflet CSS dynamically if not present
      if (!document.getElementById('leaflet-css-catalog')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-catalog';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = await import('leaflet');
      if (!isSubscribed || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        // Clear any previous leaflet instance id on container
        const container = mapContainerRef.current as HTMLElement & { _leaflet_id?: number | null };
        if (container._leaflet_id) {
          container._leaflet_id = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: [49.8355, 18.2535], // Ostrava default center
          zoom: 12,
          attributionControl: true,
          zoomControl: true,
        });

        const initialTileUrl =
          mapType === 'satellite'
            ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
            : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

        const tileLayer = L.tileLayer(initialTileUrl, {
          attribution: '&copy; Google Maps',
          maxZoom: 20,
        }).addTo(map);

        tileLayerRef.current = tileLayer;
        mapInstanceRef.current = map;
        setMapReady(true);
      }
    }

    void initMap();

    return () => {
      isSubscribed = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersRef.current.clear();
        setMapReady(false);
      }
    };
  }, []);

  // 2. Handle map tile type change (standard vs satellite)
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const tileUrl =
      mapType === 'satellite'
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    tileLayerRef.current.setUrl(tileUrl);
  }, [mapType]);

  // 3. Render and update markers whenever items, selectedIds or mapReady change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    let isCancelled = false;

    void import('leaflet').then((L) => {
      if (isCancelled || !mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      // Remove previous markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      if (itemsWithCoords.length === 0) return;

      const bounds = L.latLngBounds([]);
      const selectedSet = new Set(selectedIds);

      itemsWithCoords.forEach((item) => {
        const lat = item.latitude!;
        const lng = item.longitude!;
        bounds.extend([lat, lng]);

        const isSelected = selectedSet.has(item.surfaceId);
        const isFree = item.isAvailable;

        // Custom HTML pin styling
        // Selected: emerald with glow and check
        // Available: vivid green
        // Occupied: amber/slate
        let pinBg = '#059669'; // Emerald
        let borderColor = '#ffffff';
        let pinContent = '✓';
        let zIndexOffset = 100;

        if (isSelected) {
          pinBg = '#10b981';
          borderColor = '#38bdf8'; // Sky glow
          pinContent = '★';
          zIndexOffset = 500;
        } else if (!isFree) {
          pinBg = '#f59e0b'; // Amber
          pinContent = '•';
          zIndexOffset = 50;
        }

        const iconSize = isSelected ? 32 : 26;

        const customPinIcon = L.divIcon({
          className: 'custom-catalog-pin',
          html: `
            <div style="
              width: ${iconSize}px;
              height: ${iconSize}px;
              background: ${pinBg};
              border: 2px solid ${borderColor};
              border-radius: 9999px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.45);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 900;
              font-size: ${isSelected ? '14px' : '11px'};
              cursor: pointer;
              transform: translate(-50%, -50%);
              transition: transform 0.15s ease;
            ">
              ${pinContent}
            </div>
          `,
          iconSize: [0, 0],
        });

        const marker = L.marker([lat, lng], {
          icon: customPinIcon,
          zIndexOffset,
        }).addTo(map);

        // Build popup content
        const photoHtml = item.photoUrl
          ? `
            <div style="position: relative; margin-bottom: 8px; border-radius: 8px; overflow: hidden; background: #020617; border: 1px solid #334155;">
              <img src="${item.photoUrl}" alt="${escapeHtml(item.carrierCode)}" style="width: 100%; height: 110px; object-fit: cover; display: block;" loading="lazy" />
              <button
                type="button"
                onclick="window.__catalogOpenDetail && window.__catalogOpenDetail('${escapeHtml(item.surfaceId)}')"
                style="position: absolute; bottom: 4px; right: 4px; background: rgba(15,23,42,0.85); color: #38bdf8; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; border: 1px solid #475569; cursor: pointer;"
              >
                🔍 Zvětšit foto
              </button>
            </div>
          `
          : '';

        const statusLabel = isFree
          ? '<span style="display: inline-block; padding: 2px 7px; background: #064e3b; color: #6ee7b7; border-radius: 9999px; font-size: 10px; font-weight: 800;">🟢 Volná plocha</span>'
          : `<span style="display: inline-block; padding: 2px 7px; background: #78350f; color: #fde68a; border-radius: 9999px; font-size: 10px; font-weight: 800;">🟡 ${
              item.occupiedUntil ? `Obsazeno do ${new Date(item.occupiedUntil).toLocaleDateString('cs-CZ')}` : 'Obsazeno'
            }</span>`;

        const isActionDisabled = !item.isAvailable && !item.nextAvailableFrom;

        const actionButtonHtml = isActionDisabled
          ? `<button disabled style="flex: 1; padding: 7px 10px; background: #1e293b; color: #64748b; border: 1px solid #334155; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: not-allowed;">Nedostupné</button>`
          : isSelected
            ? `<button
                type="button"
                onclick="window.__catalogToggleSurface && window.__catalogToggleSurface('${escapeHtml(item.surfaceId)}')"
                style="flex: 1; padding: 7px 10px; background: #10b981; color: #020617; border: none; border-radius: 8px; font-size: 11px; font-weight: 900; cursor: pointer; box-shadow: 0 2px 6px rgba(16,185,129,0.3);"
              >
                ✓ Vybráno v nabídce
              </button>`
            : `<button
                type="button"
                onclick="window.__catalogToggleSurface && window.__catalogToggleSurface('${escapeHtml(item.surfaceId)}')"
                style="flex: 1; padding: 7px 10px; background: #0284c7; color: #ffffff; border: none; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer;"
              >
                + Přidat do nabídky
              </button>`;

        const streetViewLink = `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;

        const popupHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 230px; max-width: 270px; color: #f8fafc;">
            ${photoHtml}
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 800; color: #38bdf8;">
                ${escapeHtml(item.carrierCode)}
              </span>
              ${statusLabel}
            </div>

            <div style="font-size: 13px; font-weight: 800; color: #ffffff; line-height: 1.3; margin-bottom: 2px;">
              ${escapeHtml(item.surfaceName || item.carrierName)}
            </div>

            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
              ${escapeHtml(item.city)}${item.street ? ` · ${escapeHtml(item.street)}` : ''}
            </div>

            <div style="display: flex; align-items: baseline; justify-content: space-between; border-top: 1px solid #334155; padding-top: 6px; margin-bottom: 8px;">
              <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Měsíční nájem:</span>
              <strong style="font-size: 13px; color: #38bdf8; font-weight: 900;">
                ${item.monthlyPrice.toLocaleString('cs-CZ')} Kč
              </strong>
            </div>

            <div style="display: flex; gap: 6px; align-items: center;">
              ${actionButtonHtml}
              <a
                href="${streetViewLink}"
                target="_blank"
                rel="noreferrer"
                title="Otevřít Google Street View v novém okně"
                style="padding: 7px 9px; background: #0f172a; color: #38bdf8; border: 1px solid #334155; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none; display: flex; align-items: center; justify-content: center;"
              >
                Street View ↗
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupHtml, {
          maxWidth: 290,
          className: 'custom-dark-popup',
        });

        markersRef.current.set(item.surfaceId, marker);
      });

      // Fit bounds with comfortable padding
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [itemsWithCoords, selectedIds, mapReady]);

  // Jump to specific city
  const jumpToCity = (lat: number, lng: number, zoom = 13) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 1 });
    }
  };

  return (
    <div className={`relative rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl ${className}`}>
      {/* Top Map Bar with quick jumps and map layer switch */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* City Shortcuts */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl shadow-xl pointer-events-auto">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-sky-400" />
            Město:
          </span>
          <button
            type="button"
            onClick={() => jumpToCity(49.8355, 18.2535, 12)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-sky-600 text-white transition cursor-pointer"
          >
            Ostrava
          </button>
          <button
            type="button"
            onClick={() => jumpToCity(49.7795, 18.4350, 13)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-sky-600 text-white transition cursor-pointer"
          >
            Havířov
          </button>
          <button
            type="button"
            onClick={() => jumpToCity(49.6820, 18.3450, 13)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-sky-600 text-white transition cursor-pointer"
          >
            Frýdek-Místek
          </button>
          <button
            type="button"
            onClick={() => jumpToCity(49.8550, 18.5420, 13)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-sky-600 text-white transition cursor-pointer"
          >
            Karviná
          </button>
          <button
            type="button"
            onClick={() => jumpToCity(49.9385, 17.9025, 13)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-sky-600 text-white transition cursor-pointer"
          >
            Opava
          </button>
        </div>

        {/* Map Type Toggle */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-2xl shadow-xl pointer-events-auto">
          <Layers className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
          <button
            type="button"
            onClick={() => setMapType('standard')}
            className={`px-2.5 py-1 text-xs font-extrabold rounded-xl transition cursor-pointer ${
              mapType === 'standard'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Mapa
          </button>
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-2.5 py-1 text-xs font-extrabold rounded-xl transition cursor-pointer ${
              mapType === 'satellite'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Satelit
          </button>
        </div>
      </div>

      {/* Legend Badge at bottom-left */}
      <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-2xl shadow-xl text-[11px] font-bold text-slate-300 pointer-events-auto">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-400/50" />
          Volná plocha
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-sky-400" />
          Vybráno do nabídky ({selectedIds.length})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-amber-400/50" />
          Obsazeno
        </span>
      </div>

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-[640px] z-[1]" />

      {/* Global CSS for dark popup styling */}
      <style jsx global>{`
        .leaflet-popup-content-wrapper {
          background: #0f172a !important;
          color: #f8fafc !important;
          border-radius: 16px !important;
          border: 1px solid #334155 !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7) !important;
          padding: 8px !important;
        }
        .leaflet-popup-tip {
          background: #0f172a !important;
          border: 1px solid #334155 !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: #94a3b8 !important;
          padding: 6px !important;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          color: #ffffff !important;
        }
      `}</style>
    </div>
  );
}
