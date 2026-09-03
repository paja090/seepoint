'use client';

import { useEffect, useRef } from 'react';
import type { OfferItemView } from '@/lib/offers/view-model';

interface Props {
  items: OfferItemView[];
  onSelectCarrier?: (item: OfferItemView) => void;
}

export function CampaignLiveMap({ items, onSelectCarrier }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const pointsWithGps = items.filter(
    (item) =>
      typeof item.surface?.carrier?.latitude === 'number' &&
      typeof item.surface?.carrier?.longitude === 'number' &&
      !isNaN(item.surface.carrier.latitude) &&
      !isNaN(item.surface.carrier.longitude)
  );

  useEffect(() => {
    if (!mapContainerRef.current) return;
    let isMounted = true;

    async function initMap() {
      if (typeof window === 'undefined') return;

      if (!document.getElementById('leaflet-css-portal')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-portal';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Dynamically load leaflet
      const L = await import('leaflet');

      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Default center fallback: Ostrava
      let centerLat = 49.8209;
      let centerLng = 18.2625;
      let zoom = 12;

      if (pointsWithGps.length > 0) {
        const avgLat = pointsWithGps.reduce((sum, p) => sum + p.surface.carrier.latitude!, 0) / pointsWithGps.length;
        const avgLng = pointsWithGps.reduce((sum, p) => sum + p.surface.carrier.longitude!, 0) / pointsWithGps.length;
        centerLat = avgLat;
        centerLng = avgLng;
      }

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      mapInstanceRef.current = map;

      const bounds = L.latLngBounds([]);

      pointsWithGps.forEach((item, index) => {
        const lat = item.surface.carrier.latitude!;
        const lng = item.surface.carrier.longitude!;
        const carrier = item.surface.carrier;
        const photo = item.surface.photos?.[0]?.url;

        bounds.extend([lat, lng]);

        const customIcon = L.divIcon({
          className: 'custom-campaign-pin',
          html: `
            <div style="
              background: #7c3aed;
              color: white;
              font-weight: 800;
              font-size: 11px;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 2px solid white;
              box-shadow: 0 4px 10px rgba(0,0,0,0.3);
              cursor: pointer;
            ">
              ${index + 1}
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
        });

        const popupContent = `
          <div style="font-family: sans-serif; min-width: 200px; max-width: 260px;">
            ${
              photo
                ? `<img src="${photo}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />`
                : ''
            }
            <div style="font-size: 10px; font-weight: 800; color: #7c3aed; text-transform: uppercase;">
              ${carrier.code || 'NOSIČ'} · ${item.surface.mediaType || 'Plocha'}
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">
              ${carrier.name || carrier.address || 'Reklamní plocha'}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
              ${carrier.street ? `${carrier.street}, ` : ''}${carrier.city || ''}
            </div>
            <div style="margin-top: 6px; padding: 3px 6px; background: #ecfdf5; border-radius: 6px; font-size: 10px; font-weight: 700; color: #065f46; display: inline-block;">
              ✓ Vylepeno & Ověřeno
            </div>
          </div>
        `;

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent);

        if (onSelectCarrier) {
          marker.on('click', () => {
            onSelectCarrier(item);
          });
        }
      });

      if (pointsWithGps.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [items]);

  return (
    <div className="relative w-full h-[400px] md:h-[480px] rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {pointsWithGps.length === 0 && (
        <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-xs flex items-center justify-center p-6 text-center text-slate-500 text-xs">
          GPS souřadnice nosičů v této kampani nejsou k dispozici.
        </div>
      )}
    </div>
  );
}
