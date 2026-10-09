'use client';

import { useEffect, useRef, useMemo, useState } from 'react';
import type { Map as LeafletMap, LayerGroup, TileLayer } from 'leaflet';
import { ELECTION_REMOVAL_MEDIA_LABELS } from '@/lib/election-removal/constants';
import {
  parsePointMetadata,
  cleanLayerName,
  buildGoogleMapsRouteUrl,
} from '@/lib/election-removal/point-metadata';
import { Maximize2, ExternalLink } from 'lucide-react';

export interface ElectionRemovalMapPoint {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  status: string; // 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ISSUE'
  mediaType: string;
  layerName?: string | null;
  description?: string | null;
  plannedOrder?: number | null;
}

export type GoogleMapType = 'roadmap' | 'hybrid' | 'terrain';

const GOOGLE_MAP_LAYERS: Record<
  GoogleMapType,
  { url: string; maxZoom: number; label: string }
> = {
  roadmap: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    maxZoom: 20,
    label: 'Google Běžná',
  },
  hybrid: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    maxZoom: 20,
    label: 'Satelitní',
  },
  terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    maxZoom: 20,
    label: 'Terénní',
  },
};

interface ElectionRemovalMapProps {
  points: ElectionRemovalMapPoint[];
  selectedPointId?: string | null;
  onSelectPoint?: (pointId: string) => void;
  onMapClick?: (coords: { latitude: number; longitude: number }) => void;
  isAddMode?: boolean;
  className?: string;
  height?: string;
  showLegend?: boolean;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function ElectionRemovalMap({
  points,
  selectedPointId,
  onSelectPoint,
  onMapClick,
  isAddMode = false,
  className = '',
  height = '380px',
  showLegend = true,
}: ElectionRemovalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const markerGroupRef = useRef<LayerGroup | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const markersMapRef = useRef<Map<string, import('leaflet').Marker>>(new Map());

  const [mapType, setMapType] = useState<GoogleMapType>('roadmap');

  // Filter valid coordinates
  const validPoints = useMemo(() => {
    return points.filter(
      (p) =>
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        !Number.isNaN(p.latitude) &&
        !Number.isNaN(p.longitude) &&
        p.latitude !== 0 &&
        p.longitude !== 0
    );
  }, [points]);

  // Statistics for legend
  const completedCount = validPoints.filter((p) => p.status === 'COMPLETED').length;
  const inProgressCount = validPoints.filter((p) => p.status === 'IN_PROGRESS').length;
  const issueCount = validPoints.filter((p) => p.status === 'ISSUE').length;
  const pendingCount = validPoints.length - completedCount - inProgressCount - issueCount;

  // Change Google Maps layer
  const handleMapTypeChange = async (type: GoogleMapType) => {
    setMapType(type);
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const L = await import('leaflet');
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const newTileLayer = L.tileLayer(GOOGLE_MAP_LAYERS[type].url, {
      maxZoom: GOOGLE_MAP_LAYERS[type].maxZoom,
      subdomains: ['0', '1', '2', '3'],
      attribution: '© Google Maps',
    }).addTo(mapInstanceRef.current);
    newTileLayer.bringToBack();
    tileLayerRef.current = newTileLayer;
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let isMounted = true;

    async function initMap() {
      const L = await import('leaflet');
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Default center: Ostrava coordinates or center of points
      let centerLat = 49.834;
      let centerLng = 18.282;
      const zoom = 12;

      if (validPoints.length > 0) {
        centerLat =
          validPoints.reduce((sum, p) => sum + p.latitude, 0) / validPoints.length;
        centerLng =
          validPoints.reduce((sum, p) => sum + p.longitude, 0) / validPoints.length;
      }

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      // Default Google Maps Roadmap layer
      const tileLayer = L.tileLayer(GOOGLE_MAP_LAYERS.roadmap.url, {
        maxZoom: GOOGLE_MAP_LAYERS.roadmap.maxZoom,
        subdomains: ['0', '1', '2', '3'],
        attribution: '© Google Maps',
      }).addTo(map);
      tileLayerRef.current = tileLayer;

      const markerGroup = L.layerGroup().addTo(map);
      markerGroupRef.current = markerGroup;
      mapInstanceRef.current = map;

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        if (onMapClickRef.current) {
          onMapClickRef.current({
            latitude: e.latlng.lat,
            longitude: e.latlng.lng,
          });
        }
      });

      // Initial render of markers
      renderMarkers(L, map, markerGroup);

      // Handle map resizing
      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Render or Update Markers when points or selection change
  useEffect(() => {
    async function updateMarkers() {
      const L = await import('leaflet');
      if (!mapInstanceRef.current || !markerGroupRef.current) return;
      renderMarkers(L, mapInstanceRef.current, markerGroupRef.current);
    }
    updateMarkers();
  }, [validPoints, selectedPointId]);

  function renderMarkers(
    L: typeof import('leaflet'),
    map: LeafletMap,
    markerGroup: LayerGroup
  ) {
    markerGroup.clearLayers();
    markersMapRef.current.clear();

    if (validPoints.length === 0) return;

    const bounds = L.latLngBounds([]);

    validPoints.forEach((point, index) => {
      bounds.extend([point.latitude, point.longitude]);

      const isCompleted = point.status === 'COMPLETED';
      const isInProgress = point.status === 'IN_PROGRESS';
      const isIssue = point.status === 'ISSUE';
      const isSelected = point.id === selectedPointId;

      // Color coding: Completed is GREEN (#10b981), In Progress is Amber, Issue is Red, Pending is Blue
      const bgColor = isCompleted
        ? '#10b981'
        : isInProgress
        ? '#f59e0b'
        : isIssue
        ? '#ef4444'
        : '#0284c7';

      const borderColor = isSelected ? '#1e293b' : '#ffffff';
      const borderWidth = isSelected ? '3px' : '2px';
      const size = isSelected ? 34 : 28;
      const orderText = point.plannedOrder != null ? String(point.plannedOrder) : String(index + 1);
      const iconLabel = isCompleted ? '✓' : isIssue ? '!' : orderText;

      const markerHtml = `
        <div style="
          background: ${bgColor};
          color: white;
          font-weight: 800;
          font-size: ${isCompleted ? '14px' : '11px'};
          font-family: ui-sans-serif, system-ui, sans-serif;
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: ${borderWidth} solid ${borderColor};
          box-shadow: 0 3px 10px rgba(0,0,0,0.3);
          cursor: pointer;
          transform: translate(-50%, -50%);
          transition: transform 0.15s ease, background-color 0.3s ease;
        " title="${escapeHtml(point.label)}">
          ${iconLabel}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'election-point-pin',
        html: markerHtml,
        iconSize: [0, 0],
      });

      const marker = L.marker([point.latitude, point.longitude], {
        icon: customIcon,
      });

      // Parse metadata for rich popup
      const meta = parsePointMetadata(point.description);
      const mediaLabel =
        ELECTION_REMOVAL_MEDIA_LABELS[point.mediaType as keyof typeof ELECTION_REMOVAL_MEDIA_LABELS] || point.mediaType;
      const cleanLayer = cleanLayerName(point.layerName);

      const statusBadgeHtml = isCompleted
        ? `<span style="background:#dcfce7;color:#166534;font-weight:700;padding:2px 8px;border-radius:9999px;font-size:11px;">✓ Hotovo</span>`
        : isInProgress
        ? `<span style="background:#fef3c7;color:#92400e;font-weight:700;padding:2px 8px;border-radius:9999px;font-size:11px;">⏳ Na místě</span>`
        : isIssue
        ? `<span style="background:#ffe4e6;color:#9f1239;font-weight:700;padding:2px 8px;border-radius:9999px;font-size:11px;">⚠ Problém</span>`
        : `<span style="background:#f1f5f9;color:#475569;font-weight:700;padding:2px 8px;border-radius:9999px;font-size:11px;">Čeká</span>`;

      const addressHtml = meta.fullAddress
        ? `<div style="font-size:11px;color:#334155;margin-top:4px;">📍 <strong>Adresa:</strong> ${escapeHtml(
            meta.fullAddress
          )}</div>`
        : '';

      const localityHtml = meta.locality
        ? `<div style="font-size:11px;color:#334155;margin-top:2px;">🏢 <strong>Lokalita:</strong> ${escapeHtml(
            meta.locality
          )}</div>`
        : '';

      const photoBtnHtml = meta.photoUrl
        ? `<a href="${escapeHtml(
            meta.photoUrl
          )}" target="_blank" rel="noopener noreferrer" style="
            display:inline-block;
            background:#ecfdf5;
            color:#065f46;
            border:1px solid #a7f3d0;
            padding:5px 9px;
            border-radius:8px;
            font-size:11px;
            font-weight:700;
            text-decoration:none;
            text-align:center;
            flex:1;
          ">📷 Fotodokumentace ↗</a>`
        : '';

      const popupHtml = `
        <div style="font-family:ui-sans-serif,system-ui,sans-serif;min-width:210px;padding:2px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:700;color:#0284c7;background:#e0f2fe;padding:2px 6px;border-radius:6px;">
              #${orderText} · ${escapeHtml(mediaLabel)}
            </span>
            ${statusBadgeHtml}
          </div>
          <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:2px;">
            ${escapeHtml(point.label)}
          </div>
          ${cleanLayer ? `<div style="font-size:10px;color:#64748b;margin-bottom:4px;">Vrstva: ${escapeHtml(cleanLayer)}</div>` : ''}
          ${localityHtml}
          ${addressHtml}

          <div style="display:flex;gap:4px;margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}" target="_blank" rel="noopener noreferrer" style="
              display:inline-block;
              background:#f0f9ff;
              color:#0369a1;
              border:1px solid #bae6fd;
              padding:5px 9px;
              border-radius:8px;
              font-size:11px;
              font-weight:700;
              text-decoration:none;
              text-align:center;
              flex:1;
            ">Google Maps ↗</a>
            <a href="https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes" target="_blank" rel="noopener noreferrer" style="
              display:inline-block;
              background:#eef2ff;
              color:#4338ca;
              border:1px solid #c7d2fe;
              padding:5px 9px;
              border-radius:8px;
              font-size:11px;
              font-weight:700;
              text-decoration:none;
              text-align:center;
              flex:1;
            ">Waze ↗</a>
            ${photoBtnHtml}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 280 });

      marker.on('click', () => {
        if (onSelectPoint) {
          onSelectPoint(point.id);
        }
      });

      marker.addTo(markerGroup);
      markersMapRef.current.set(point.id, marker);

      if (isSelected) {
        marker.openPopup();
      }
    });

    // Auto-fit bounds if we have points and no specific selection
    if (validPoints.length > 0 && !selectedPointId && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  }

  // Handle zooming to selected point
  useEffect(() => {
    if (!selectedPointId || !mapInstanceRef.current) return;
    const marker = markersMapRef.current.get(selectedPointId);
    if (marker) {
      const latLng = marker.getLatLng();
      mapInstanceRef.current.setView(latLng, Math.max(mapInstanceRef.current.getZoom(), 15), {
        animate: true,
      });
      marker.openPopup();
    }
  }, [selectedPointId]);

  const handleResetView = () => {
    if (!mapInstanceRef.current || validPoints.length === 0) return;
    const L = (window as unknown as { L?: typeof import('leaflet') }).L;
    if (L) {
      const bounds = L.latLngBounds(validPoints.map((p) => [p.latitude, p.longitude]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
  };

  const googleMapsRouteUrl = useMemo(() => {
    return buildGoogleMapsRouteUrl(validPoints);
  }, [validPoints]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50 ${className}`}>
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        style={{ height, width: '100%' }}
        className={`z-0 ${isAddMode ? 'cursor-crosshair' : ''}`}
      />

      {/* Mode Banner */}
      {isAddMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-sky-600/95 backdrop-blur-sm text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg border border-sky-400 flex items-center gap-2 pointer-events-none animate-pulse">
          <span className="text-sm">📍</span>
          <span>Klikněte kamkoliv do mapy pro umístění nového bodu</span>
        </div>
      )}

      {/* Top Controls: Google Maps Layer Switcher & Actions */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Google Maps Layer Switcher */}
        <div className="flex items-center rounded-xl border border-slate-200/90 bg-white/95 p-0.5 shadow-md backdrop-blur-sm pointer-events-auto">
          <button
            type="button"
            onClick={() => handleMapTypeChange('roadmap')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
              mapType === 'roadmap'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Běžná
          </button>
          <button
            type="button"
            onClick={() => handleMapTypeChange('hybrid')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
              mapType === 'hybrid'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Satelitní
          </button>
          <button
            type="button"
            onClick={() => handleMapTypeChange('terrain')}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
              mapType === 'terrain'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Terénní
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5 ml-auto pointer-events-auto">
          {validPoints.length > 0 && (
            <a
              href={googleMapsRouteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-1 px-2.5 bg-white/95 hover:bg-white text-slate-700 hover:text-sky-700 rounded-xl shadow-md border border-slate-200 transition text-[11px] font-bold flex items-center gap-1 active:scale-95 backdrop-blur-sm"
              title="Otevřít celou trasu v aplikaci Google Maps"
            >
              <ExternalLink className="w-3 h-3 text-sky-600" />
              <span className="hidden sm:inline">Google Maps trasa</span>
            </a>
          )}
          <button
            type="button"
            onClick={handleResetView}
            className="p-1.5 bg-white/95 hover:bg-white text-slate-700 hover:text-slate-900 rounded-xl shadow-md border border-slate-200 transition text-[11px] font-bold flex items-center gap-1 active:scale-95 backdrop-blur-sm"
            title="Zobrazit všechny body"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden md:inline">Centrovat</span>
          </button>
        </div>
      </div>

      {/* Floating Legend */}
      {showLegend && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto z-10 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-200 shadow-md flex items-center gap-3 text-[11px] font-bold text-slate-700 overflow-x-auto">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white inline-block shadow-sm" />
            <span>Hotovo ({completedCount})</span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-full bg-sky-600 border border-white inline-block shadow-sm" />
            <span>Čeká ({pendingCount})</span>
          </div>
          {inProgressCount > 0 && (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-3 h-3 rounded-full bg-amber-500 border border-white inline-block shadow-sm" />
              <span>Na místě ({inProgressCount})</span>
            </div>
          )}
          {issueCount > 0 && (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-3 h-3 rounded-full bg-rose-500 border border-white inline-block shadow-sm" />
              <span>Problém ({issueCount})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
