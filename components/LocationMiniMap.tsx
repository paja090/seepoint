'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';

type LocationMiniMapProps = {
  carrierId: string;
  carrierName: string;
  latitude: number;
  longitude: number;
};

export function LocationMiniMap({ carrierId, carrierName, latitude, longitude }: LocationMiniMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      const L = await import('leaflet');
      if (cancelled || !mapElementRef.current || mapRef.current) return;

      const map = L.map(mapElementRef.current, {
        center: [latitude, longitude],
        zoom: 16,
        scrollWheelZoom: false,
        dragging: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        zoomControl: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const tooltip = document.createElement('strong');
      tooltip.textContent = carrierName;
      L.circleMarker([latitude, longitude], {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: '#059669',
        fillOpacity: 1,
      }).bindTooltip(tooltip).addTo(map);

      mapRef.current = map;
    }

    void initializeMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [carrierName, latitude, longitude]);

  return (
    <section aria-labelledby="location-map-heading">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id="location-map-heading" className="font-semibold">Umístění nosiče</h3>
        <Link className="text-sm font-medium text-emerald-700 hover:text-emerald-900" href={`/map?carrier=${encodeURIComponent(carrierId)}`}>
          Otevřít na velké mapě →
        </Link>
      </div>
      <div
        ref={mapElementRef}
        className="h-64 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
        role="region"
        aria-label={`Mapa umístění nosiče ${carrierName}`}
      />
    </section>
  );
}
