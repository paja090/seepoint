'use client';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { PlanningResult, Coordinates } from '@/lib/field-planning/contracts';
function decode(encoded: string): [number, number][] {
  const points: [number, number][] = []; let i = 0; let lat = 0; let lng = 0;
  function next() { let value = 0, shift = 0, b: number; do { b = encoded.charCodeAt(i++) - 63; value |= (b & 31) << shift; shift += 5; } while (b >= 32 && i < encoded.length); return value & 1 ? ~(value >> 1) : value >> 1; }
  while (i < encoded.length) { lat += next(); lng += next(); points.push([lat / 1e5, lng / 1e5]); } return points;
}
export function RouteMap({ result, depot, active }: { result?: PlanningResult; depot?: Coordinates; active: string }) {
  const element = useRef<HTMLDivElement>(null); const map = useRef<LeafletMap | null>(null);
  useEffect(() => {
    let disposed = false;
    void import('leaflet').then(L => {
      if (disposed || !element.current) return;
      const m = L.map(element.current).setView(depot ? [depot.latitude, depot.longitude] : [0, 0], depot ? 10 : 2); map.current = m;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(m);
      const bounds = L.latLngBounds([]); const colors = ['#0369a1', '#059669', '#9333ea', '#d97706'];
      result?.crews.forEach((crew, index) => {
        const color = colors[index % colors.length]; let previous = crew.startLocation ?? depot;
        crew.stops.forEach(stop => {
          const point: [number, number] = [stop.location.latitude, stop.location.longitude];
          const marker = L.marker(point, { icon: L.divIcon({ className: '', html: `<span style="display:grid;place-items:center;width:28px;height:28px;border-radius:50%;border:2px solid white;background:${color};color:white;font-weight:700">${stop.routeOrder}</span>` }) });
          const tooltip = document.createElement('span'); tooltip.textContent = `${crew.names.join(' + ')} · ${stop.title}`;
          marker.bindTooltip(tooltip).addTo(m); bounds.extend(point);
          const path = stop.travel.polyline ? decode(stop.travel.polyline) : previous ? [[previous.latitude, previous.longitude], point] as [number, number][] : [];
          if (path.length) L.polyline(path, { color, weight: active === crew.id ? 5 : 3, opacity: active === crew.id ? 1 : 0.5, dashArray: stop.travel.estimated ? '6 8' : undefined }).addTo(m);
          previous = stop.location;
        });
        if (crew.returnLeg.polyline) L.polyline(decode(crew.returnLeg.polyline), { color, weight: 2, opacity: 0.5 }).addTo(m);
      });
      if (bounds.isValid()) m.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    });
    return () => { disposed = true; map.current?.remove(); map.current = null; };
  }, [result, depot, active]);
  return <div ref={element} className="h-[380px] rounded-2xl border lg:h-[600px]" role="region" aria-label="Mapa tras posádek" />;
}
