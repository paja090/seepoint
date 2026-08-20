'use client';

import { useEffect, useRef } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';

export type NavigationMapPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  orientation?: string;
};

export function NavigationPointMap({
  target,
  points,
  mode,
  onMapClick,
  onPointMove,
}: {
  target?: { latitude: number; longitude: number; label: string };
  points: NavigationMapPoint[];
  mode: 'target' | 'point';
  onMapClick: (latitude: number, longitude: number) => void;
  onPointMove: (id: string, latitude: number, longitude: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  const moveRef = useRef(onPointMove);

  clickRef.current = onMapClick;
  moveRef.current = onPointMove;

  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !element.current || mapRef.current) return;
      const map = L.map(element.current, { center: [49.82, 15.48], zoom: 8, scrollWheelZoom: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (event) => clickRef.current(event.latlng.lat, event.latlng.lng));
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    void import('leaflet').then((L) => {
      layer.clearLayers();
      const bounds = L.latLngBounds([]);

      // 1. Target marker (Prodejna / Cíl - Premium Red Pin with Glowing Wave)
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
              <path d="M20 0C8.954 0 0 8.954 0 20C0 32.5 17 49 19.15 51.1C19.62 51.56 20.38 51.56 20.85 51.1C23 49 40 32.5 40 20C40 8.954 31.046 0 20 0Z" fill="url(#targetGrad)"/>
              <circle cx="20" cy="20" r="13" fill="#FFFFFF"/>
              <text x="20" y="25" text-anchor="middle" font-size="15">🏬</text>
              <defs>
                <linearGradient id="targetGrad" x1="0" y1="0" x2="40" y2="52" gradientUnits="userSpaceOnUse">
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
          className: 'custom-target-pin',
          iconSize: [140, 80],
          iconAnchor: [70, 52],
        });

        const targetMarker = L.marker([target.latitude, target.longitude], {
          icon: targetIcon,
          title: `CÍL: ${target.label}`,
          zIndexOffset: 1000,
        });

        targetMarker.addTo(layer);
        bounds.extend([target.latitude, target.longitude]);
      }

      // 2. Navigation Points markers (Sleek Blue Teardrop Pins with Number & Arrow)
      points.forEach((point, index) => {
        const pointNumber = index + 1;
        const arrow = point.orientation?.includes('vpravo')
          ? '➔'
          : point.orientation?.includes('vlevo')
          ? '⬅'
          : point.orientation?.includes('rovně')
          ? '⬆'
          : '🧭';

        const pointHtml = `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: move;">
            <div style="
              position: absolute;
              top: -30px;
              background: #0f172a;
              color: #ffffff;
              padding: 3px 9px;
              border-radius: 10px;
              font-family: system-ui, -apple-system, sans-serif;
              font-size: 11px;
              font-weight: 800;
              white-space: nowrap;
              border: 1.5px solid #38bdf8;
              box-shadow: 0 4px 10px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span>#${pointNumber}</span>
              <span style="color: #38bdf8;">${arrow}</span>
              <span>${point.label}</span>
            </div>

            <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 6px 10px rgba(2, 132, 199, 0.45));">
              <path d="M18 0C8.059 0 0 8.059 0 18C0 29.25 15.3 45.225 17.235 47.19C17.658 47.613 18.342 47.613 18.765 47.19C20.7 45.225 36 29.25 36 18C36 8.059 27.941 0 18 0Z" fill="url(#pointGrad_${index})"/>
              <circle cx="18" cy="18" r="12" fill="#FFFFFF" stroke="#0284c7" stroke-width="2.5"/>
              <text x="18" y="22" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="13" fill="#000000">#${pointNumber}</text>
              <defs>
                <linearGradient id="pointGrad_${index}" x1="0" y1="0" x2="36" y2="48" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#0284c7"/>
                  <stop offset="1" stop-color="#0369a1"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
        `;

        const pointIcon = L.divIcon({
          html: pointHtml,
          className: 'custom-nav-pin',
          iconSize: [160, 80],
          iconAnchor: [80, 48],
        });

        const marker = L.marker([point.latitude, point.longitude], {
          icon: pointIcon,
          draggable: true,
          title: point.label,
          zIndexOffset: 500 - index,
        });

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          moveRef.current(point.id, pos.lat, pos.lng);
        });

        marker.addTo(layer);
        bounds.extend([point.latitude, point.longitude]);

        // Draw smooth polyline route line connecting to target
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
          ).addTo(layer);
        }
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.35), { maxZoom: 16, animate: false });
      }
    });
  }, [points, target]);

  return (
    <div>
      <div className={`mb-2 rounded-xl px-3 py-2 text-xs font-bold ${mode === 'target' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'}`}>
        {mode === 'target'
          ? '📍 Kliknutím do mapy určíte cílovou prodejnu (červený špendlík 🏬).'
          : '📍 Kliknutím do mapy přidáte nový navigační bod. Body lze přesouvat tažením myší.'}
      </div>
      <div aria-label="Mapa plánování navigace" className="h-[520px] overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100 shadow-inner" ref={element} />
    </div>
  );
}
