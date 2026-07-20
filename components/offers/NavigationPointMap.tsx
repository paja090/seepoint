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

      // 1. Target marker (Prodejna / Cíl - Red Star Pin)
      if (target) {
        const targetHtml = `
          <div style="
            position: relative;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #e11d48, #be123c);
            color: white;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(225, 29, 72, 0.4);
            font-size: 20px;
            cursor: pointer;
            z-index: 1000;
          ">
            🎯
          </div>
        `;

        const targetIcon = L.divIcon({
          html: targetHtml,
          className: 'custom-target-marker',
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const targetMarker = L.marker([target.latitude, target.longitude], {
          icon: targetIcon,
          title: `CÍL: ${target.label}`,
          zIndexOffset: 1000,
        }).bindTooltip(`🎯 PRODEJNA: ${target.label}`, { permanent: true, direction: 'top', className: 'font-bold text-rose-700' });

        targetMarker.addTo(layer);
        bounds.extend([target.latitude, target.longitude]);
      }

      // 2. Navigation Points markers (Numbered Blue Badges with Direction Arrows)
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
          <div style="
            position: relative;
            padding: 4px 10px;
            background: linear-gradient(135deg, #0284c7, #0369a1);
            color: white;
            border-radius: 20px;
            border: 2.5px solid white;
            box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);
            font-family: sans-serif;
            font-weight: 800;
            font-size: 12px;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: move;
          ">
            <span style="background: rgba(255,255,255,0.25); border-radius: 10px; padding: 1px 6px; font-size: 11px;">#${pointNumber}</span>
            <span>${point.label}</span>
            <span style="font-size: 13px;">${arrow}</span>
          </div>
        `;

        const pointIcon = L.divIcon({
          html: pointHtml,
          className: 'custom-point-marker',
          iconSize: [120, 32],
          iconAnchor: [60, 16],
        });

        const marker = L.marker([point.latitude, point.longitude], {
          icon: pointIcon,
          draggable: true,
          title: point.label,
          zIndexOffset: 500 - index,
        }).bindTooltip(`#${pointNumber} ${point.label}`, { permanent: false, direction: 'top' });

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          moveRef.current(point.id, pos.lat, pos.lng);
        });

        marker.addTo(layer);
        bounds.extend([point.latitude, point.longitude]);

        // Draw connecting dashed line to target store
        if (target) {
          L.polyline(
            [
              [point.latitude, point.longitude],
              [target.latitude, target.longitude],
            ],
            {
              color: '#0284c7',
              weight: 2.5,
              dashArray: '6, 8',
              opacity: 0.65,
            },
          ).addTo(layer);
        }
      });

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.3), { maxZoom: 16, animate: false });
      }
    });
  }, [points, target]);

  return (
    <div>
      <div className={`mb-2 rounded-xl px-3 py-2 text-xs font-bold ${mode === 'target' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'}`}>
        {mode === 'target'
          ? '📍 Kliknutím do mapy určíte cílovou prodejnu (červený špendlík 🎯).'
          : '📍 Kliknutím do mapy přidáte nový navigační bod. Body lze přesouvat tažením myší.'}
      </div>
      <div aria-label="Mapa plánování navigace" className="h-[500px] overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-100 shadow-inner" ref={element} />
    </div>
  );
}
