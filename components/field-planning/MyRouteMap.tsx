'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, TileLayer } from 'leaflet';
import type { MyRouteDTO } from '@/lib/field-planning/execution';

export type GoogleMapType = 'roadmap' | 'hybrid';

const GOOGLE_MAP_LAYERS: Record<GoogleMapType, { url: string; maxZoom: number; label: string }> = {
  roadmap: { url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', maxZoom: 20, label: 'Google Mapa' },
  hybrid: { url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', maxZoom: 20, label: 'Satelitní' },
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

export function MyRouteMap({ route, height = 'h-[400px]' }: { route: MyRouteDTO; height?: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<LeafletMap | null>(null);
  const layerInstance = useRef<TileLayer | null>(null);
  const [mapType, setMapType] = useState<GoogleMapType>('hybrid');

  useEffect(() => {
    let disposed = false;

    void import('leaflet').then((L) => {
      if (disposed || !mapRef.current) return;

      const m = L.map(mapRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([49.8, 15.5], 7);
      
      mapInstance.current = m;

      layerInstance.current = L.tileLayer(GOOGLE_MAP_LAYERS[mapType].url, {
        maxZoom: GOOGLE_MAP_LAYERS[mapType].maxZoom,
        subdomains: ['0', '1', '2', '3'],
      }).addTo(m);

      const bounds = L.latLngBounds([]);

      route.stops.forEach((stop, i) => {
        if (!stop.location) return;
        const pt: [number, number] = [stop.location.latitude, stop.location.longitude];
        
        let color = '#0ea5e9'; // sky-500 (planned)
        if (stop.status === 'DONE') color = '#10b981'; // emerald-500
        else if (stop.status === 'IN_PROGRESS') color = '#3b82f6'; // blue-500
        else if (stop.status === 'CANCELLED') color = '#ef4444'; // red-500

        const isDone = stop.status === 'DONE';
        
        const iconHtml = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background-color: ${color};
            color: white;
            border-radius: 12px;
            font-weight: 900;
            font-size: 14px;
            border: 2px solid white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            opacity: ${isDone ? 0.7 : 1};
          ">
            ${isDone ? '✓' : i + 1}
          </div>
        `;

        const marker = L.marker(pt, {
          icon: L.divIcon({ className: '', html: iconHtml, iconSize: [32, 32], iconAnchor: [16, 16] })
        });
        
        const tooltipHtml = `
          <div style="font-weight: bold; font-family: sans-serif; font-size: 12px;">
            ${escapeHtml(stop.title)}
          </div>
          <div style="font-size: 11px; color: #64748b; font-family: sans-serif; margin-top: 2px;">
            ${escapeHtml(stop.clientName || stop.workType)}
          </div>
        `;
        
        marker.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -16] }).addTo(m);
        bounds.extend(pt);
      });

      if (bounds.isValid()) {
        m.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    });

    return () => {
      disposed = true;
      mapInstance.current?.remove();
      mapInstance.current = null;
      layerInstance.current = null;
    };
  }, [route]);

  useEffect(() => {
    if (!mapInstance.current || !layerInstance.current) return;
    layerInstance.current.setUrl(GOOGLE_MAP_LAYERS[mapType].url);
  }, [mapType]);

  return (
    <div className={`relative w-full overflow-hidden rounded-3xl border border-slate-200 shadow-sm ${height}`}>
      <div ref={mapRef} className="h-full w-full" />
      
      {/* Map controls over the map */}
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
        <div className="flex overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-slate-900/10">
          {(Object.entries(GOOGLE_MAP_LAYERS) as [GoogleMapType, { label: string }][]).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setMapType(key)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${
                mapType === key
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
