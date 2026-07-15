'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';

type MapPoint = { id?: string; code: string; city: string; latitude?: number | null; longitude?: number | null; selected?: boolean };
export type OfferMapBounds = { north: number; south: number; east: number; west: number };
export function OfferMap({ points, className = 'h-80', onPointClick, onBoundsChange }: { points: MapPoint[]; className?: string; onPointClick?: (id: string) => void; onBoundsChange?: (bounds: OfferMapBounds) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const located = useMemo(() => points.filter((point): point is typeof point & { latitude: number; longitude: number } => typeof point.latitude === 'number' && typeof point.longitude === 'number'), [points]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!element.current || mapRef.current || located.length === 0) return;
      const L = await import('leaflet');
      if (cancelled || !element.current) return;
      const bounds = L.latLngBounds(located.map((point) => [point.latitude, point.longitude]));
      const map = L.map(element.current, { scrollWheelZoom: false }).fitBounds(bounds.pad(0.2), { maxZoom: 15 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);
      located.forEach((point) => {
        const label = document.createElement('strong');
        label.textContent = `${point.code} · ${point.city}`;
        const marker = L.circleMarker([point.latitude, point.longitude], { radius: point.selected ? 11 : 8, color: '#fff', weight: 3, fillColor: point.selected ? '#059669' : '#0f172a', fillOpacity: 1 }).bindTooltip(label).addTo(map);
        if (point.id && onPointClick) { marker.on('click', () => onPointClick(point.id!)); marker.getElement()?.setAttribute('role', 'button'); }
      });
      const reportBounds = () => {
        if (!onBoundsChange) return;
        const visible = map.getBounds();
        onBoundsChange({ north: visible.getNorth(), south: visible.getSouth(), east: visible.getEast(), west: visible.getWest() });
      };
      map.on('moveend', reportBounds);
      reportBounds();
      mapRef.current = map;
    }
    void initialize();
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [located, onBoundsChange, onPointClick]);

  if (located.length === 0) return <div className={`grid place-items-center rounded-3xl bg-slate-100 text-sm text-slate-500 ${className}`}>Vybrané nosiče nemají ověřené GPS souřadnice.</div>;
  return <div ref={element} className={`overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 ${className}`} aria-label="Mapa vybraných reklamních ploch" />;
}
