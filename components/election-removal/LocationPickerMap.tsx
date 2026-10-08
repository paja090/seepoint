'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker, TileLayer } from 'leaflet';
import { MapPin, Search } from 'lucide-react';

interface LocationPickerMapProps {
  latitude?: number | null;
  longitude?: number | null;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  height?: string;
  defaultCenter?: { latitude: number; longitude: number };
  pinLabel?: string;
}

const CZECH_CITIES: Record<string, [number, number]> = {
  'Praha': [50.08804, 14.42076],
  'Brno': [49.19506, 16.60683],
  'Ostrava': [49.83465, 18.28204],
  'Plzeň': [49.74747, 13.37759],
  'Liberec': [50.76711, 15.05619],
  'Olomouc': [49.59378, 17.25088],
  'České Budějovice': [48.97447, 14.47434],
  'Hradec Králové': [50.20923, 15.83277],
  'Pardubice': [50.03431, 15.78120],
  'Ústí nad Labem': [50.66070, 14.03227],
  'Zlín': [49.22442, 17.66275],
};

export function LocationPickerMap({
  latitude,
  longitude,
  onChange,
  height = '240px',
  defaultCenter = { latitude: 49.834, longitude: 18.282 },
  pinLabel = 'Vybrané místo',
}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [activeCoords, setActiveCoords] = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  );

  useEffect(() => {
    if (latitude && longitude) {
      setActiveCoords({ lat: latitude, lng: longitude });
      if (markerRef.current && mapRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      }
    }
  }, [latitude, longitude]);

  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;

    async function init() {
      const L = await import('leaflet');
      if (!isMounted || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const initialLat = latitude || defaultCenter.latitude || 49.834;
      const initialLng = longitude || defaultCenter.longitude || 18.282;
      const initialZoom = latitude && longitude ? 15 : 12;

      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
        attribution: '© Google Maps',
      }).addTo(map);

      // Custom icon
      const pinIcon = L.divIcon({
        className: 'location-picker-pin',
        html: `
          <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: grab;">
            <div style="background: #0284c7; color: white; padding: 4px 8px; border-radius: 9999px; font-weight: bold; font-size: 11px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2px solid white; white-space: nowrap;">
              📍 ${pinLabel}
            </div>
            <div style="width: 2px; height: 10px; background: #0284c7;"></div>
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #0284c7; border: 2px solid white;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      let marker: Marker | null = null;
      if (latitude && longitude) {
        marker = L.marker([latitude, longitude], { icon: pinIcon, draggable: true }).addTo(map);
        marker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          setActiveCoords({ lat: latlng.lat, lng: latlng.lng });
          onChange({ latitude: latlng.lat, longitude: latlng.lng });
        });
      }

      // Handle map clicks
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setActiveCoords({ lat, lng });
        onChange({ latitude: lat, longitude: lng });

        if (!marker) {
          marker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
          marker.on('dragend', (dragEvt) => {
            const dragLatLng = dragEvt.target.getLatLng();
            setActiveCoords({ lat: dragLatLng.lat, lng: dragLatLng.lng });
            onChange({ latitude: dragLatLng.lat, longitude: dragLatLng.lng });
          });
          markerRef.current = marker;
        } else {
          marker.setLatLng([lat, lng]);
        }
      });

      markerRef.current = marker;
      mapRef.current = map;

      setTimeout(() => {
        if (isMounted && mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 150);
    }

    init();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const handleJumpCity = (cityName: string) => {
    const coords = CZECH_CITIES[cityName];
    if (coords && mapRef.current) {
      mapRef.current.setView(coords, 14);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
        <span className="font-semibold text-slate-700 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-sky-600" />
          <span>Klikněte kamkoliv do mapy pro umístění bodu:</span>
        </span>

        {activeCoords ? (
          <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            {activeCoords.lat.toFixed(5)}, {activeCoords.lng.toFixed(5)}
          </span>
        ) : (
          <span className="text-amber-700 italic">Špendlík zatím neumístěn</span>
        )}
      </div>

      <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-inner">
        <div ref={containerRef} style={{ height, width: '100%' }} className="cursor-crosshair" />

        {/* Quick city jump toolbar */}
        <div className="absolute top-2 right-2 z-[400] bg-white/90 backdrop-blur-xs p-1 rounded-lg shadow-md border border-slate-200 flex items-center gap-1 text-[10px]">
          <span className="text-slate-500 font-medium pl-1">Město:</span>
          <select
            onChange={(e) => handleJumpCity(e.target.value)}
            defaultValue=""
            className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="" disabled>Skočit na...</option>
            {Object.keys(CZECH_CITIES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="absolute bottom-2 left-2 z-[400] bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-xs pointer-events-none">
          💡 Kliknutím nebo tažením špendlíku zvolíte polohu
        </div>
      </div>
    </div>
  );
}
