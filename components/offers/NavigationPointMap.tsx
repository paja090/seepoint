'use client';

import { useEffect, useRef } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';

export type NavigationMapPoint = { id: string; label: string; latitude: number; longitude: number };

export function NavigationPointMap({ target, points, mode, onMapClick, onPointMove }: { target?: { latitude: number; longitude: number; label: string }; points: NavigationMapPoint[]; mode: 'target' | 'point'; onMapClick: (latitude: number, longitude: number) => void; onPointMove: (id: string, latitude: number, longitude: number) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  const moveRef = useRef(onPointMove);
  clickRef.current = onMapClick; moveRef.current = onPointMove;

  useEffect(() => {
    let cancelled = false;
    void import('leaflet').then((L) => {
      if (cancelled || !element.current || mapRef.current) return;
      const map = L.map(element.current, { center: [49.82, 15.48], zoom: 7, scrollWheelZoom: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 19 }).addTo(map);
      map.on('click', (event) => clickRef.current(event.latlng.lat, event.latlng.lng));
      mapRef.current = map; layerRef.current = L.layerGroup().addTo(map);
    });
    return () => { cancelled = true; mapRef.current?.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current; const layer = layerRef.current;
    if (!map || !layer) return;
    void import('leaflet').then((L) => {
      layer.clearLayers(); const bounds = L.latLngBounds([]);
      if (target) { L.circleMarker([target.latitude, target.longitude], { radius: 13, color: '#fff', weight: 3, fillColor: '#e11d48', fillOpacity: 1 }).bindTooltip(`Cíl: ${target.label}`, { permanent: true, direction: 'top' }).addTo(layer); bounds.extend([target.latitude, target.longitude]); }
      points.forEach((point, index) => {
        const marker = L.marker([point.latitude, point.longitude], { draggable: true, title: point.label }).bindTooltip(`${index + 1}. ${point.label}`).addTo(layer);
        marker.on('dragend', () => { const position = marker.getLatLng(); moveRef.current(point.id, position.lat, position.lng); });
        bounds.extend([point.latitude, point.longitude]);
      });
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.25), { maxZoom: 16, animate: false });
    });
  }, [points, target]);

  return <div><div className={`mb-2 rounded-xl px-3 py-2 text-sm font-medium ${mode === 'target' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>{mode === 'target' ? 'Kliknutím do mapy určíte cílové místo.' : 'Kliknutím přidáte navigační bod. Body lze přesouvat tažením.'}</div><div aria-label="Mapa plánování navigace" className="h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100" ref={element} /></div>;
}
