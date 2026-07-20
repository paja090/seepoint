'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';

type MapPoint = {
  id?: string;
  code: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  selected?: boolean;
};

export type OfferMapBounds = { north: number; south: number; east: number; west: number };

export function OfferMap({
  points,
  className = 'h-80',
  onPointClick,
  onBoundsChange,
}: {
  points: MapPoint[];
  className?: string;
  onPointClick?: (id: string) => void;
  onBoundsChange?: (bounds: OfferMapBounds) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const located = useMemo(
    () => points.filter((point): point is typeof point & { latitude: number; longitude: number } => typeof point.latitude === 'number' && typeof point.longitude === 'number'),
    [points],
  );

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!element.current || mapRef.current || located.length === 0) return;
      const L = await import('leaflet');
      if (cancelled || !element.current) return;

      const bounds = L.latLngBounds(located.map((point) => [point.latitude, point.longitude]));
      const map = L.map(element.current, { scrollWheelZoom: false }).fitBounds(bounds.pad(0.25), { maxZoom: 16 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);

      located.forEach((point) => {
        const isNav = point.code.startsWith('NAV-');
        const color = isNav ? '#ea580c' : point.selected ? '#059669' : '#0f172a';

        const markerHtml = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 3px 8px;
            background: ${color};
            color: white;
            border-radius: 16px;
            border: 2px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            font-family: sans-serif;
            font-weight: 800;
            font-size: 11px;
            white-space: nowrap;
            cursor: pointer;
          ">
            <span>${point.code}</span>
          </div>
        `;

        const icon = L.divIcon({
          html: markerHtml,
          className: 'custom-offer-marker',
          iconSize: [80, 26],
          iconAnchor: [40, 13],
        });

        const marker = L.marker([point.latitude, point.longitude], { icon, title: `${point.code} · ${point.city}` }).addTo(map);

        marker.bindTooltip(`<strong>${point.code}</strong> · ${point.city}`, { permanent: false, direction: 'top' });

        if (point.id && onPointClick) {
          marker.on('click', () => onPointClick(point.id!));
        }
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
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [located, onBoundsChange, onPointClick]);

  if (located.length === 0) {
    return (
      <div className={`grid place-items-center rounded-3xl bg-slate-100 p-6 text-center text-sm font-semibold text-slate-500 ${className}`}>
        Vybrané reklamní a navigační nosiče nemají zadané platné GPS souřadnice.
      </div>
    );
  }

  return <div aria-label="Mapa vybraných reklamních a navigačních nosičů" className={`overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 ${className}`} ref={element} />;
}
