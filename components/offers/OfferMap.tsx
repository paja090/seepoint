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
      const map = L.map(element.current, { scrollWheelZoom: false }).fitBounds(bounds.pad(0.3), { maxZoom: 16 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);

      located.forEach((point, idx) => {
        const isNav = point.code.startsWith('NAV-');
        const fillGradStart = isNav ? '#ea580c' : point.selected ? '#059669' : '#0f172a';
        const fillGradEnd = isNav ? '#c2410c' : point.selected ? '#047857' : '#1e293b';

        const markerHtml = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              position: absolute;
              top: -24px;
              background: #0f172a;
              color: #ffffff;
              padding: 2px 7px;
              border-radius: 8px;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 10px;
              font-weight: 800;
              white-space: nowrap;
              border: 1px solid ${fillGradStart};
              box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            ">
              ${point.code}
            </div>
            <svg width="32" height="42" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 5px 8px rgba(0,0,0,0.35));">
              <path d="M18 0C8.059 0 0 8.059 0 18C0 29.25 15.3 45.225 17.235 47.19C17.658 47.613 18.342 47.613 18.765 47.19C20.7 45.225 36 29.25 36 18C36 8.059 27.941 0 18 0Z" fill="url(#offerPinGrad_${idx})"/>
              <circle cx="18" cy="18" r="10" fill="#FFFFFF"/>
              <circle cx="18" cy="18" r="6" fill="${fillGradStart}"/>
              <defs>
                <linearGradient id="offerPinGrad_${idx}" x1="0" y1="0" x2="36" y2="48" gradientUnits="userSpaceOnUse">
                  <stop stop-color="${fillGradStart}"/>
                  <stop offset="1" stop-color="${fillGradEnd}"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        `;

        const icon = L.divIcon({
          html: markerHtml,
          className: 'custom-offer-svg-pin',
          iconSize: [120, 60],
          iconAnchor: [60, 42],
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
