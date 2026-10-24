'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, TileLayer } from 'leaflet';
import type { PlanningResult, Coordinates } from '@/lib/field-planning/contracts';

export type RouteMapTileType = 'osm' | 'hybrid' | 'roadmap';

const MAP_LAYERS: Record<RouteMapTileType, { url: string; maxZoom: number; label: string; subdomains?: string[] }> = {
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19, label: 'OpenStreetMap' },
  hybrid: { url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', maxZoom: 20, label: 'Satelitní', subdomains: ['0', '1', '2', '3'] },
  roadmap: { url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', maxZoom: 20, label: 'Google Mapa', subdomains: ['0', '1', '2', '3'] },
};

function decode(encoded: string): [number, number][] {
  const points: [number, number][] = []; let i = 0; let lat = 0; let lng = 0;
  function next() { let value = 0, shift = 0, b: number; do { b = encoded.charCodeAt(i++) - 63; value |= (b & 31) << shift; shift += 5; } while (b >= 32 && i < encoded.length); return value & 1 ? ~(value >> 1) : value >> 1; }
  while (i < encoded.length) { lat += next(); lng += next(); points.push([lat / 1e5, lng / 1e5]); } return points;
}
function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

export type RouteMapWarehouse = {
  id: string;
  name: string;
  address?: string;
  location: Coordinates;
  isMain?: boolean;
};

export type RouteMapPoint = { id: string; title: string; location: Coordinates };
export function RouteMap({
  result,
  depot,
  active,
  points,
  onPointSelect,
  selectedPointId,
  warehouses,
  companyName = 'Sídlo firmy & Depo',
  depotAddress,
}: {
  result?: PlanningResult;
  depot?: Coordinates;
  active: string;
  points?: RouteMapPoint[];
  onPointSelect?: (id: string) => void;
  selectedPointId?: string;
  warehouses?: RouteMapWarehouse[];
  companyName?: string;
  depotAddress?: string;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layerInstance = useRef<TileLayer | null>(null);
  const [mapType, setMapType] = useState<RouteMapTileType>('osm');

  useEffect(() => {
    let disposed = false;
    void import('leaflet').then(L => {
      if (disposed || !element.current) return;
      const m = L.map(element.current, { zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView(depot ? [depot.latitude, depot.longitude] : [0, 0], depot ? 10 : 2);
      map.current = m;

      const initialConfig = MAP_LAYERS[mapType];
      layerInstance.current = L.tileLayer(initialConfig.url, {
        attribution: initialConfig.label === 'OpenStreetMap' ? '&copy; OpenStreetMap' : '© Google Maps',
        maxZoom: initialConfig.maxZoom,
        subdomains: initialConfig.subdomains || ['a', 'b', 'c'],
      }).addTo(m);
      const bounds = L.latLngBounds([]); const colors = ['#0369a1', '#059669', '#9333ea', '#d97706'];

      // Sídlo firmy & Hlavní depo
      if (depot && typeof depot.latitude === 'number' && typeof depot.longitude === 'number') {
        const depotPoint: [number, number] = [depot.latitude, depot.longitude];
        const depotMarker = L.marker(depotPoint, {
          zIndexOffset: 600,
          icon: L.divIcon({
            className: '',
            html: `
              <div style="
                position: relative;
                width: 36px;
                height: 36px;
                border-radius: 12px;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                border: 2.5px solid #38bdf8;
                box-shadow: 0 4px 12px rgba(15, 23, 42, 0.45);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                cursor: pointer;
              ">
                🏢
                <span style="
                  position: absolute;
                  bottom: -7px;
                  background: #0284c7;
                  color: white;
                  font-size: 9px;
                  font-weight: 800;
                  padding: 1px 5px;
                  border-radius: 4px;
                  border: 1px solid white;
                  white-space: nowrap;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                ">Depo</span>
              </div>
            `,
            iconAnchor: [18, 18],
          }),
        });
        const depotTooltip = `
          <div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.4;">
            <strong style="font-size:13px;color:#0f172a;display:block;">🏢 ${escapeHtml(companyName || 'Sídlo firmy & Centrální Depo')}</strong>
            ${depotAddress ? `<span style="color:#475569;font-size:11px;">${escapeHtml(depotAddress)}</span><br/>` : ''}
            <span style="color:#0284c7;font-size:10px;font-weight:700;">Výchozí a návratová základna posádek</span>
          </div>
        `;
        depotMarker.bindTooltip(depotTooltip, { direction: 'top', offset: [0, -12] }).addTo(m);
        bounds.extend(depotPoint);
      }

      // Sklady
      warehouses?.forEach(wh => {
        if (!wh?.location || typeof wh.location.latitude !== 'number' || typeof wh.location.longitude !== 'number') return;
        const whPoint: [number, number] = [wh.location.latitude, wh.location.longitude];
        const whMarker = L.marker(whPoint, {
          zIndexOffset: 550,
          icon: L.divIcon({
            className: '',
            html: `
              <div style="
                position: relative;
                width: 32px;
                height: 32px;
                border-radius: 10px;
                background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
                border: 2px solid white;
                box-shadow: 0 3px 10px rgba(180, 83, 9, 0.45);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                cursor: pointer;
              ">
                📦
                <span style="
                  position: absolute;
                  bottom: -6px;
                  background: #78350f;
                  color: white;
                  font-size: 8px;
                  font-weight: 800;
                  padding: 0.5px 3px;
                  border-radius: 3px;
                  border: 1px solid white;
                  white-space: nowrap;
                  text-transform: uppercase;
                ">Sklad</span>
              </div>
            `,
            iconAnchor: [16, 16],
          }),
        });
        const whTooltip = `
          <div style="font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.4;">
            <strong style="font-size:13px;color:#78350f;display:block;">📦 ${escapeHtml(wh.name)}</strong>
            ${wh.address ? `<span style="color:#475569;font-size:11px;">${escapeHtml(wh.address)}</span><br/>` : ''}
            <span style="color:#b45309;font-size:10px;font-weight:600;">Materiálový sklad / výdejní místo</span>
          </div>
        `;
        whMarker.bindTooltip(whTooltip, { direction: 'top', offset: [0, -10] }).addTo(m);
        bounds.extend(whPoint);
      });
      result?.crews.forEach((crew, index) => {
        const color = colors[index % colors.length]; let previous = crew.startLocation ?? depot;
        crew.stops.forEach(stop => {
          const point: [number, number] = [stop.location.latitude, stop.location.longitude];
          const marker = L.marker(point, { icon: L.divIcon({ className: '', html: `<span style="display:grid;place-items:center;width:28px;height:28px;border-radius:50%;border:2px solid white;background:${color};color:white;font-weight:700">${stop.routeOrder}</span>` }) });
          const tooltip = document.createElement('span'); tooltip.textContent = `${crew.name ? crew.name : crew.names.join(' + ')} · ${stop.title}`;
          marker.bindTooltip(tooltip).addTo(m); bounds.extend(point);
          const path = stop.travel.polyline ? decode(stop.travel.polyline) : previous ? [[previous.latitude, previous.longitude], point] as [number, number][] : [];
          if (path.length) L.polyline(path, { color, weight: active === crew.id ? 5 : 3, opacity: active === crew.id ? 1 : 0.5, dashArray: stop.travel.estimated ? '6 8' : undefined }).addTo(m);
          previous = stop.location;
        });
        if (crew.returnLeg.polyline) L.polyline(decode(crew.returnLeg.polyline), { color, weight: 2, opacity: 0.5 }).addTo(m);

        if (crew.liveLocation) {
          const livePoint: [number, number] = [crew.liveLocation.latitude, crew.liveLocation.longitude];
          const isRecent = crew.liveLocation.isRecent;
          const speedKmH = crew.liveLocation.speed != null ? Math.round(crew.liveLocation.speed * 3.6) : null;
          const speedText = speedKmH != null && speedKmH > 2 ? `${speedKmH} km/h` : 'Stojí na místě';
          const ageMs = Date.now() - new Date(crew.liveLocation.updatedAt).getTime();
          const ageSeconds = Math.max(0, Math.round(ageMs / 1000));
          const ageText = ageSeconds < 60 ? `před ${ageSeconds} s` : `před ${Math.round(ageSeconds / 60)} min`;

          const vehicleMarker = L.marker(livePoint, {
            zIndexOffset: 1000,
            icon: L.divIcon({
              className: '',
              html: `
                <div style="
                  position: relative;
                  width: 30px;
                  height: 30px;
                  border-radius: 50%;
                  background: ${color};
                  border: 2px solid white;
                  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 14px;
                  cursor: pointer;
                ">
                  🚐
                  <span style="
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: ${isRecent ? '#22c55e' : '#f59e0b'};
                    border: 1.5px solid white;
                    box-shadow: 0 0 4px ${isRecent ? '#22c55e' : '#f59e0b'};
                  "></span>
                </div>
              `,
              iconAnchor: [15, 15],
            }),
          });

          const tooltipHtml = `
            <div style="font-family:system-ui,-apple-system,sans-serif;font-size:11px;line-height:1.4;">
              <strong style="font-size:12px;color:#0f172a;">${escapeHtml(crew.name || `Posádka ${index + 1}`)}: ${escapeHtml(crew.names.join(' + '))}</strong><br/>
              ${crew.vehicleName ? `<span style="color:#475569;">Vozidlo: ${escapeHtml(crew.vehicleName)}</span><br/>` : ''}
              <span style="color:#0369a1;font-weight:700;">Rychlost: ${speedText}</span> · 
              <span style="color:${isRecent ? '#15803d' : '#b45309'};font-weight:600;">Signál: ${ageText}</span>
              ${crew.liveLocation.workerName ? `<br/><span style="color:#64748b;font-size:10px;">Vysílá: ${escapeHtml(crew.liveLocation.workerName)}</span>` : ''}
            </div>
          `;
          vehicleMarker.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -10] }).addTo(m);
          bounds.extend(livePoint);
        }
      });
      points?.forEach(point => {
        const position: [number, number] = [point.location.latitude, point.location.longitude];
        const marker = L.circleMarker(position, { radius: point.id === selectedPointId ? 10 : 7, color: '#fff', weight: 2, fillColor: '#64748b', fillOpacity: 1 });
        const label = document.createElement('span'); label.textContent = point.title;
        marker.bindTooltip(label).on('click', () => onPointSelect?.(point.id)).addTo(m); bounds.extend(position);
      });
      if (bounds.isValid()) m.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    });
    return () => { disposed = true; map.current?.remove(); map.current = null; };
  }, [result, depot, active, points, onPointSelect, selectedPointId, mapType, warehouses, companyName, depotAddress]);

  useEffect(() => {
    if (!map.current || !layerInstance.current) return;
    const config = MAP_LAYERS[mapType];
    layerInstance.current.setUrl(config.url);
  }, [mapType]);

  return (
    <div className="relative h-[380px] rounded-2xl border lg:h-[600px] overflow-hidden" role="region" aria-label="Mapa tras posádek">
      <div ref={element} className="h-full w-full" />
      <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
        <div className="flex overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-slate-900/10">
          {(Object.entries(MAP_LAYERS) as [RouteMapTileType, { label: string }][]).map(([key, config]) => (
            <button
              key={key}
              type="button"
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
