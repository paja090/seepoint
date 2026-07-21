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
  target,
  className = 'h-80',
  onPointClick,
  onBoundsChange,
}: {
  points: MapPoint[];
  target?: { label: string; latitude: number; longitude: number } | null;
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
      if (!element.current || mapRef.current || (located.length === 0 && !target)) return;
      const L = await import('leaflet');
      if (cancelled || !element.current) return;

      const allCoords: Array<[number, number]> = located.map((point) => [point.latitude, point.longitude]);
      if (target) allCoords.push([target.latitude, target.longitude]);

      const bounds = L.latLngBounds(allCoords);
      const map = L.map(element.current, { scrollWheelZoom: false }).fitBounds(bounds.pad(0.3), { maxZoom: 16 });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);

      // 1. Render Target Store Pin if present
      if (target) {
        const targetHtml = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              position: absolute;
              top: -8px;
              width: 52px;
              height: 52px;
              border-radius: 50%;
              background: rgba(225, 29, 72, 0.25);
              box-shadow: 0 0 12px rgba(225, 29, 72, 0.6);
            "></div>
            <svg width="40" height="52" viewBox="0 0 40 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 8px 12px rgba(225, 29, 72, 0.5));">
              <path d="M20 0C8.954 0 0 8.954 0 20C0 32.5 17 49 19.15 51.1C19.62 51.56 20.38 51.56 20.85 51.1C23 49 40 32.5 40 20C40 8.954 31.046 0 20 0Z" fill="url(#offerTargetGrad)"/>
              <circle cx="20" cy="20" r="13" fill="#FFFFFF"/>
              <text x="20" y="25" text-anchor="middle" font-size="15">🏬</text>
              <defs>
                <linearGradient id="offerTargetGrad" x1="0" y1="0" x2="40" y2="52" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#f43f5e"/>
                  <stop offset="1" stop-color="#be123c"/>
                </linearGradient>
              </defs>
            </svg>
            <div style="
              margin-top: -6px;
              background: #be123c;
              color: #ffffff;
              padding: 3px 10px;
              border-radius: 12px;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 11px;
              font-weight: 800;
              white-space: nowrap;
              border: 2px solid #ffffff;
              box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            ">
              🎯 PRODEJNA: ${target.label}
            </div>
          </div>
        `;

        const targetIcon = L.divIcon({
          html: targetHtml,
          className: 'custom-proposal-target-pin',
          iconSize: [140, 80],
          iconAnchor: [70, 52],
        });

        L.marker([target.latitude, target.longitude], {
          icon: targetIcon,
          title: `CÍL: ${target.label}`,
          zIndexOffset: 1000,
        }).addTo(map);
      }

      // 2. Render Point Markers & Polyline Route Lines
      located.forEach((point, idx) => {
        const isNav = point.code.startsWith('NAV-');
        const fillGradStart = isNav ? '#0284c7' : point.selected ? '#059669' : '#0f172a';
        const fillGradEnd = isNav ? '#0369a1' : point.selected ? '#047857' : '#1e293b';

        const markerHtml = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              position: absolute;
              top: -24px;
              background: #0f172a;
              color: #ffffff;
              padding: 2px 8px;
              border-radius: 8px;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 11px;
              font-weight: 800;
              white-space: nowrap;
              border: 1px solid #38bdf8;
              box-shadow: 0 3px 8px rgba(0,0,0,0.3);
            ">
              ${point.code}
            </div>
            <svg width="34" height="44" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 5px 8px rgba(0,0,0,0.35));">
              <path d="M18 0C8.059 0 0 8.059 0 18C0 29.25 15.3 45.225 17.235 47.19C17.658 47.613 18.342 47.613 18.765 47.19C20.7 45.225 36 29.25 36 18C36 8.059 27.941 0 18 0Z" fill="url(#offerPinGrad_${idx})"/>
              <circle cx="18" cy="18" r="11" fill="#FFFFFF" stroke="${fillGradStart}" stroke-width="2"/>
              <text x="18" y="22" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="11" fill="${fillGradStart}">#${idx + 1}</text>
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
          iconAnchor: [60, 44],
        });

        const marker = L.marker([point.latitude, point.longitude], { icon, title: `${point.code} · ${point.city}` }).addTo(map);

        marker.bindTooltip(`<strong>${point.code}</strong> · ${point.city}`, { permanent: false, direction: 'top' });

        if (point.id && onPointClick) {
          marker.on('click', () => onPointClick(point.id!));
        }

        // Draw polyline connecting point to target
        if (target) {
          L.polyline(
            [
              [point.latitude, point.longitude],
              [target.latitude, target.longitude],
            ],
            {
              color: '#0284c7',
              weight: 3,
              dashArray: '8, 8',
              opacity: 0.7,
            },
          ).addTo(map);
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
  }, [located, target, onBoundsChange, onPointClick]);

  if (located.length === 0 && !target) {
    return (
      <div className={`grid place-items-center rounded-3xl bg-slate-100 p-6 text-center text-sm font-semibold text-slate-500 ${className}`}>
        Vybrané reklamní a navigační nosiče nemají zadané platné GPS souřadnice.
      </div>
    );
  }

  return <div aria-label="Mapa vybraných reklamních a navigačních nosičů" className={`overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 ${className}`} ref={element} />;
}
