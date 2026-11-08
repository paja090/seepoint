'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import type { Map as LeafletMap, TileLayer as LeafletTileLayer, Marker as LeafletMarker } from 'leaflet';
import { MapPin, Layers } from 'lucide-react';

export type NetworkMapSurfaceItem = {
  id: string;
  carrierId: string;
  carrierCode: string;
  carrierName: string;
  city: string;
  street?: string | null;
  locality?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  surfaceName: string;
  mediaType: string;
  size: string;
  orientation: string;
  listPrice: number;
  b2bWholesalePrice: number;
  b2bDiscountPercent: number;
  visibility: string;
  isOwn: boolean;
  ownerLabel: string;
  thumbnailUrl?: string;
};

declare global {
  interface Window {
    __b2bToggleSurface?: (surfaceId: string) => void;
    __b2bSetVisibility?: (surfaceId: string, visibility: 'PRIVATE' | 'PARTNER' | 'MARKETPLACE') => void;
  }
}

interface NetworkInteractiveMapProps {
  items: NetworkMapSurfaceItem[];
  selectedIds: string[];
  canManageVisibility: boolean;
  onToggleSelect: (surfaceId: string) => void;
  onChangeVisibility?: (surfaceId: string, visibility: 'PRIVATE' | 'PARTNER' | 'MARKETPLACE') => void;
  className?: string;
}

const CZECH_CITY_COORDS: Array<{ match: string; lat: number; lng: number }> = [
  { match: 'praha', lat: 50.0755, lng: 14.4378 },
  { match: 'brno', lat: 49.1951, lng: 16.6068 },
  { match: 'ostrava', lat: 49.8209, lng: 18.2625 },
  { match: 'plzen', lat: 49.7384, lng: 13.3736 },
  { match: 'plzeň', lat: 49.7384, lng: 13.3736 },
  { match: 'liberec', lat: 50.7663, lng: 15.0543 },
  { match: 'olomouc', lat: 49.5938, lng: 17.2509 },
  { match: 'ceske budejovice', lat: 48.9745, lng: 14.4743 },
  { match: 'české budějovice', lat: 48.9745, lng: 14.4743 },
  { match: 'hradec kralove', lat: 50.2092, lng: 15.8328 },
  { match: 'hradec králové', lat: 50.2092, lng: 15.8328 },
  { match: 'pardubice', lat: 50.0343, lng: 15.7812 },
  { match: 'usti nad labem', lat: 50.6607, lng: 14.0323 },
  { match: 'ústí nad labem', lat: 50.6607, lng: 14.0323 },
  { match: 'zlin', lat: 49.2265, lng: 17.6672 },
  { match: 'zlín', lat: 49.2265, lng: 17.6672 },
  { match: 'havirov', lat: 49.7798, lng: 18.4369 },
  { match: 'havířov', lat: 49.7798, lng: 18.4369 },
  { match: 'kladno', lat: 50.1473, lng: 14.1028 },
  { match: 'most', lat: 50.503, lng: 13.6362 },
  { match: 'opava', lat: 49.9387, lng: 17.9026 },
  { match: 'frydek', lat: 49.6853, lng: 18.3504 },
  { match: 'frýdek', lat: 49.6853, lng: 18.3504 },
  { match: 'karvina', lat: 49.854, lng: 18.5417 },
  { match: 'karviná', lat: 49.854, lng: 18.5417 },
  { match: 'jihlava', lat: 49.3961, lng: 15.5912 },
  { match: 'teplice', lat: 50.6404, lng: 13.8245 },
  { match: 'karlovy vary', lat: 50.2327, lng: 12.8712 },
];

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function resolveItemCoordinates(
  item: NetworkMapSurfaceItem,
  index: number
): { lat: number; lng: number; isApproximate: boolean } {
  if (
    typeof item.latitude === 'number' &&
    typeof item.longitude === 'number' &&
    !Number.isNaN(item.latitude) &&
    !Number.isNaN(item.longitude) &&
    item.latitude > 48.0 &&
    item.latitude < 51.5 &&
    item.longitude > 12.0 &&
    item.longitude < 19.5
  ) {
    return { lat: item.latitude, lng: item.longitude, isApproximate: false };
  }

  const normalizedCity = (item.city || '').toLowerCase();
  const matchedCity = CZECH_CITY_COORDS.find((c) => normalizedCity.includes(c.match));
  const baseLat = matchedCity ? matchedCity.lat : 49.8175;
  const baseLng = matchedCity ? matchedCity.lng : 15.473;

  // Deterministic spiral offset around city center so pins don't overlap
  const seed = hashString(`${item.id}-${index}`);
  const angle = ((seed % 360) * Math.PI) / 180;
  const radius = 0.004 + ((seed % 17) * 0.0012);
  return {
    lat: baseLat + Math.sin(angle) * radius,
    lng: baseLng + Math.cos(angle) * radius * 1.4,
    isApproximate: true,
  };
}

export function NetworkInteractiveMap({
  items,
  selectedIds,
  canManageVisibility,
  onToggleSelect,
  onChangeVisibility,
  className = '',
}: NetworkInteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<LeafletTileLayer | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [mapReady, setMapReady] = useState(false);

  const onToggleRef = useRef(onToggleSelect);
  onToggleRef.current = onToggleSelect;

  const onVisibilityRef = useRef(onChangeVisibility);
  onVisibilityRef.current = onChangeVisibility;

  const resolvedItems = useMemo(() => {
    return items.map((item, idx) => ({
      item,
      coords: resolveItemCoordinates(item, idx),
    }));
  }, [items]);

  // Register global window callbacks for Leaflet HTML popup buttons
  useEffect(() => {
    window.__b2bToggleSurface = (surfaceId: string) => {
      onToggleRef.current(surfaceId);
    };
    window.__b2bSetVisibility = (surfaceId: string, visibility: 'PRIVATE' | 'PARTNER' | 'MARKETPLACE') => {
      if (onVisibilityRef.current) {
        onVisibilityRef.current(surfaceId, visibility);
      }
    };
    return () => {
      delete window.__b2bToggleSurface;
      delete window.__b2bSetVisibility;
    };
  }, []);

  // 1. Initialize Leaflet map instance
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isSubscribed = true;
    const markers = markersRef.current;

    async function initMap() {
      if (!mapContainerRef.current) return;

      if (!document.getElementById('leaflet-css-b2b-network')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-b2b-network';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const L = await import('leaflet');
      if (!isSubscribed || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const container = mapContainerRef.current as HTMLElement & { _leaflet_id?: number | null };
        if (container._leaflet_id) {
          container._leaflet_id = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: [49.8175, 15.473], // Czech Republic center
          zoom: 7,
          attributionControl: true,
          zoomControl: true,
        });

        const tileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
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
        markers.clear();
        setMapReady(false);
      }
    };
  }, []);

  // 2. Switch map tile layer (standard vs satellite)
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const tileUrl =
      mapType === 'satellite'
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    tileLayerRef.current.setUrl(tileUrl);
  }, [mapType]);

  // 3. Render markers whenever items or selection changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    let isCancelled = false;

    void import('leaflet').then((L) => {
      if (isCancelled || !mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      if (resolvedItems.length === 0) return;

      const bounds = L.latLngBounds([]);
      const selectedSet = new Set(selectedIds);

      resolvedItems.forEach(({ item, coords }) => {
        const { lat, lng, isApproximate } = coords;
        bounds.extend([lat, lng]);

        const isSelected = selectedSet.has(item.id);
        const isPrivateOwn = item.isOwn && item.visibility === 'PRIVATE';
        const isPartnerSurface = !item.isOwn;

        let pinBg = '#0284c7'; // Own published (sky blue)
        let borderColor = '#ffffff';
        let pinContent = '✓';
        let zIndexOffset = 100;

        if (isSelected) {
          pinBg = '#10b981'; // Emerald selected
          borderColor = '#fde047';
          pinContent = '★';
          zIndexOffset = 600;
        } else if (isPartnerSurface) {
          pinBg = '#4f46e5'; // Indigo B2B partner
          borderColor = '#ffffff';
          pinContent = 'B2B';
          zIndexOffset = 300;
        } else if (isPrivateOwn) {
          pinBg = '#475569'; // Slate private
          borderColor = '#cbd5e1';
          pinContent = '🔒';
          zIndexOffset = 50;
        }

        const iconWidth = isSelected ? 34 : isPartnerSurface ? 32 : 28;

        const customPinIcon = L.divIcon({
          className: 'custom-b2b-network-pin',
          html: `
            <div style="
              min-width: ${iconWidth}px;
              height: ${iconWidth}px;
              padding: 0 5px;
              background: ${pinBg};
              border: 2px solid ${borderColor};
              border-radius: 9999px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.45);
              display: flex;
              align-items: center;
              justify-content: center;
              color: #ffffff;
              font-weight: 900;
              font-size: ${isSelected ? '13px' : '10px'};
              cursor: pointer;
              transform: translate(-50%, -50%);
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

        const marginCzk = Math.max(0, item.listPrice - item.b2bWholesalePrice);
        const streetViewLink = `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;

        const badgeHtml = isPartnerSurface
          ? '<span style="display:inline-block;padding:2px 7px;background:#312e81;color:#c7d2fe;border-radius:9999px;font-size:10px;font-weight:800;">🤝 Partnerská B2B plocha</span>'
          : isPrivateOwn
            ? '<span style="display:inline-block;padding:2px 7px;background:#334155;color:#e2e8f0;border-radius:9999px;font-size:10px;font-weight:800;">🔒 Vaše soukromá plocha</span>'
            : `<span style="display:inline-block;padding:2px 7px;background:#064e3b;color:#6ee7b7;border-radius:9999px;font-size:10px;font-weight:800;">🌐 Vaše plocha (${escapeHtml(item.visibility)})</span>`;

        const approxHtml = isApproximate
          ? '<div style="font-size:10px;color:#fbbf24;margin-bottom:6px;">📍 Orientační poloha města (přesné GPS zatím nevyplněno)</div>'
          : '';

        const actionBtnHtml = isSelected
          ? `<button
              type="button"
              onclick="window.__b2bToggleSurface && window.__b2bToggleSurface('${escapeHtml(item.id)}')"
              style="flex:1;padding:7px 10px;background:#10b981;color:#020617;border:none;border-radius:8px;font-size:11px;font-weight:900;cursor:pointer;"
            >
              ✓ Vybráno v nabídce
            </button>`
          : `<button
              type="button"
              onclick="window.__b2bToggleSurface && window.__b2bToggleSurface('${escapeHtml(item.id)}')"
              style="flex:1;padding:7px 10px;background:#4f46e5;color:#ffffff;border:none;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;"
            >
              + Vybrat do B2B nabídky
            </button>`;

        const visibilityControlsHtml =
          item.isOwn && canManageVisibility
            ? `
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid #334155;">
                <div style="font-size:9px;text-transform:uppercase;font-weight:800;color:#94a3b8;margin-bottom:4px;">
                  Změnit viditelnost vaší plochy 1 klikem:
                </div>
                <div style="display:flex;gap:4px;">
                  <button
                    type="button"
                    onclick="window.__b2bSetVisibility && window.__b2bSetVisibility('${escapeHtml(item.id)}', 'PRIVATE')"
                    style="flex:1;padding:4px 6px;border-radius:6px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #475569;background:${
                      item.visibility === 'PRIVATE' ? '#f8fafc' : '#1e293b'
                    };color:${item.visibility === 'PRIVATE' ? '#0f172a' : '#cbd5e1'};"
                  >
                    Soukromá
                  </button>
                  <button
                    type="button"
                    onclick="window.__b2bSetVisibility && window.__b2bSetVisibility('${escapeHtml(item.id)}', 'PARTNER')"
                    style="flex:1;padding:4px 6px;border-radius:6px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #4f46e5;background:${
                      item.visibility === 'PARTNER' ? '#4f46e5' : '#1e1b4b'
                    };color:#ffffff;"
                  >
                    Partner
                  </button>
                  <button
                    type="button"
                    onclick="window.__b2bSetVisibility && window.__b2bSetVisibility('${escapeHtml(item.id)}', 'MARKETPLACE')"
                    style="flex:1;padding:4px 6px;border-radius:6px;font-size:10px;font-weight:800;cursor:pointer;border:1px solid #10b981;background:${
                      item.visibility === 'MARKETPLACE' ? '#059669' : '#064e3b'
                    };color:#ffffff;"
                  >
                    B2B Burza
                  </button>
                </div>
              </div>
            `
            : '';

        const popupHtml = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-width:245px;max-width:285px;color:#f8fafc;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">
              <span style="font-family:monospace;font-size:11px;font-weight:900;color:#38bdf8;">
                ${escapeHtml(item.carrierCode)}
              </span>
              ${badgeHtml}
            </div>

            <div style="font-size:13px;font-weight:900;color:#ffffff;line-height:1.3;margin-bottom:2px;">
              ${escapeHtml(item.carrierName)}
            </div>

            <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">
              ${escapeHtml(item.city)}${item.street ? ` · ${escapeHtml(item.street)}` : ''} (${escapeHtml(item.size)})
            </div>

            ${approxHtml}

            <div style="background:#020617;border:1px solid #1e293b;border-radius:10px;padding:8px;margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:3px;">
                <span>Ceníková cena:</span>
                <span style="text-decoration:line-through;">${item.listPrice.toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:900;color:#ffffff;margin-bottom:3px;">
                <span>B2B nákupní cena:</span>
                <span style="color:#818cf8;">${item.b2bWholesalePrice.toLocaleString('cs-CZ')} Kč</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#34d399;border-top:1px solid #1e293b;padding-top:3px;">
                <span>Vaše marže (${item.b2bDiscountPercent} %):</span>
                <span>+${marginCzk.toLocaleString('cs-CZ')} Kč/měs</span>
              </div>
            </div>

            <div style="display:flex;gap:6px;align-items:center;">
              ${actionBtnHtml}
              <a
                href="${streetViewLink}"
                target="_blank"
                rel="noreferrer"
                title="Otevřít Google Street View"
                style="padding:7px 9px;background:#0f172a;color:#38bdf8;border:1px solid #334155;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;"
              >
                Street View ↗
              </a>
            </div>
            ${visibilityControlsHtml}
          </div>
        `;

        marker.bindPopup(popupHtml, {
          maxWidth: 300,
          className: 'custom-b2b-dark-popup',
        });

        markersRef.current.set(item.id, marker);
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 14 });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [resolvedItems, selectedIds, canManageVisibility, mapReady]);

  const jumpToLocation = (lat: number, lng: number, zoom = 12) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], zoom, { duration: 0.9 });
    }
  };

  return (
    <div className={`relative rounded-3xl border border-slate-300 bg-slate-950 overflow-hidden shadow-xl ${className}`}>
      {/* Top Floating Bar: City Quick Jumps & Map Mode */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-1.5 rounded-2xl shadow-lg pointer-events-auto">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-indigo-400" />
            Rychlý skok:
          </span>
          <button
            type="button"
            onClick={() => jumpToLocation(49.8175, 15.473, 7)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
          >
            Celá ČR
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(50.0755, 14.4378, 12)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-indigo-600 text-white transition cursor-pointer"
          >
            Praha
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(49.1951, 16.6068, 12)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-indigo-600 text-white transition cursor-pointer"
          >
            Brno
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(49.8209, 18.2625, 12)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-indigo-600 text-white transition cursor-pointer"
          >
            Ostrava
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(49.7384, 13.3736, 12)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-indigo-600 text-white transition cursor-pointer"
          >
            Plzeň
          </button>
          <button
            type="button"
            onClick={() => jumpToLocation(49.5938, 17.2509, 13)}
            className="px-2.5 py-1 text-xs font-extrabold rounded-xl bg-slate-800 hover:bg-indigo-600 text-white transition cursor-pointer"
          >
            Olomouc
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-1.5 rounded-2xl shadow-lg pointer-events-auto">
          <Layers className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
          <button
            type="button"
            onClick={() => setMapType('standard')}
            className={`px-2.5 py-1 text-xs font-extrabold rounded-xl transition cursor-pointer ${
              mapType === 'standard'
                ? 'bg-indigo-600 text-white shadow-sm'
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
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Satelit
          </button>
        </div>
      </div>

      {/* Bottom Legend */}
      <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 px-3.5 py-2 rounded-2xl shadow-xl text-[11px] font-bold text-slate-200 pointer-events-auto">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-600 ring-2 ring-white/80 inline-block" />
          <span>Partnerská B2B plocha</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-sky-600 ring-2 ring-white/80 inline-block" />
          <span>Vaše publikovaná plocha</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-yellow-300 inline-block" />
          <span>Vybráno do B2B nabídky ({selectedIds.length})</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-600 ring-1 ring-slate-300 inline-block" />
          <span>Soukromá (kliknutím lze zveřejnit)</span>
        </span>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-[580px] z-[1]" />

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
