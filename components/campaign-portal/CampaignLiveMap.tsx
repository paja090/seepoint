'use client';

import { useEffect, useRef } from 'react';
import type { OfferItemView } from '@/lib/offers/view-model';

export interface NavigationMapPointInput {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  status?: string;
  pillarNumber?: string | null;
  pillarType?: string | null;
  arrowDirectionEnum?: string | null;
  calculatedDistanceMeters?: number | null;
  manualDistanceValue?: number | null;
  manualDistanceUnit?: string | null;
  distanceSource?: string | null;
  visualizedPhotoUrl?: string | null;
  sitePhotoUrl?: string | null;
  installedPhotoUrl?: string | null;
}

export interface NavigationTargetInput {
  latitude: number;
  longitude: number;
  name: string;
  address?: string | null;
}

interface Props {
  items?: OfferItemView[];
  navigationPoints?: NavigationMapPointInput[];
  target?: NavigationTargetInput | null;
  onSelectCarrier?: (item: OfferItemView) => void;
  onSelectNavigationPoint?: (point: NavigationMapPointInput) => void;
}

function formatArrowText(direction?: string | null): string {
  switch (direction) {
    case 'RIGHT':
      return '➡️ Doprava';
    case 'LEFT':
      return '⬅️ Doleva';
    case 'SLIGHT_RIGHT':
      return '↗️ Mírně doprava';
    case 'SLIGHT_LEFT':
      return '↖️ Mírně doleva';
    case 'ROUNDABOUT':
      return '🔄 Kruhový objezd';
    case 'STRAIGHT':
    default:
      return '⬆️ Rovně';
  }
}

function formatDistance(point: NavigationMapPointInput): string {
  if (point.distanceSource === 'MANUAL' && point.manualDistanceValue) {
    const unit = point.manualDistanceUnit === 'KILOMETERS' ? 'km' : 'm';
    return `${point.manualDistanceValue} ${unit} od cíle`;
  }
  if (typeof point.calculatedDistanceMeters === 'number') {
    if (point.calculatedDistanceMeters >= 1000) {
      return `${(point.calculatedDistanceMeters / 1000).toFixed(1).replace('.', ',')} km od cíle`;
    }
    return `${point.calculatedDistanceMeters} m od cíle`;
  }
  return '';
}

export function CampaignLiveMap({ items = [], navigationPoints = [], target = null, onSelectCarrier, onSelectNavigationPoint }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const isNavigation = navigationPoints.length > 0;

  const validNavPoints = navigationPoints.filter(
    (p) => typeof p.latitude === 'number' && typeof p.longitude === 'number' && !isNaN(p.latitude) && !isNaN(p.longitude)
  );

  const pointsWithGps = items.filter(
    (item) =>
      typeof item.surface?.carrier?.latitude === 'number' &&
      typeof item.surface?.carrier?.longitude === 'number' &&
      !isNaN(item.surface.carrier.latitude) &&
      !isNaN(item.surface.carrier.longitude)
  );

  const hasAnyPoints = isNavigation
    ? validNavPoints.length > 0 || (target && typeof target.latitude === 'number' && typeof target.longitude === 'number')
    : pointsWithGps.length > 0;

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

      if (isNavigation && validNavPoints.length > 0) {
        centerLat = validNavPoints.reduce((sum, p) => sum + p.latitude, 0) / validNavPoints.length;
        centerLng = validNavPoints.reduce((sum, p) => sum + p.longitude, 0) / validNavPoints.length;
      } else if (target && typeof target.latitude === 'number' && typeof target.longitude === 'number') {
        centerLat = target.latitude;
        centerLng = target.longitude;
        zoom = 13;
      } else if (pointsWithGps.length > 0) {
        centerLat = pointsWithGps.reduce((sum, p) => sum + p.surface.carrier.latitude!, 0) / pointsWithGps.length;
        centerLng = pointsWithGps.reduce((sum, p) => sum + p.surface.carrier.longitude!, 0) / pointsWithGps.length;
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

      // 🎯 Render Target Marker if navigation
      if (isNavigation && target && typeof target.latitude === 'number' && typeof target.longitude === 'number') {
        bounds.extend([target.latitude, target.longitude]);

        const targetIcon = L.divIcon({
          className: 'custom-target-pin',
          html: `
            <div style="
              background: #ef4444;
              color: white;
              font-weight: 900;
              font-size: 13px;
              width: 34px;
              height: 34px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 3px solid white;
              box-shadow: 0 4px 14px rgba(239,68,68,0.5);
              cursor: pointer;
            ">
              🎯
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -17],
        });

        const targetPopup = `
          <div style="font-family: sans-serif; min-width: 200px; max-width: 260px;">
            <div style="font-size: 10px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 0.05em;">
              🎯 CÍL NAVIGACE
            </div>
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 3px;">
              ${target.name}
            </div>
            ${target.address ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">${target.address}</div>` : ''}
            <div style="margin-top: 6px; padding: 3px 8px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; font-size: 10px; font-weight: 700; color: #991b1b; display: inline-block;">
              Cílová provozovna
            </div>
          </div>
        `;

        const targetMarker = L.marker([target.latitude, target.longitude], { icon: targetIcon }).addTo(map);
        targetMarker.bindPopup(targetPopup);
      }

      // 🧭 Render Navigation Points
      if (isNavigation) {
        validNavPoints.forEach((point, index) => {
          bounds.extend([point.latitude, point.longitude]);

          const photo = point.installedPhotoUrl || point.visualizedPhotoUrl || point.sitePhotoUrl;
          const isInstalled = point.status === 'INSTALLED' || Boolean(point.installedPhotoUrl);
          const arrowStr = formatArrowText(point.arrowDirectionEnum);
          const distStr = formatDistance(point);

          const navIcon = L.divIcon({
            className: 'custom-nav-pin',
            html: `
              <div style="
                background: ${isInstalled ? '#059669' : '#009EE2'};
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
            <div style="font-family: sans-serif; min-width: 220px; max-width: 280px;">
              ${photo ? `<img src="${photo}" style="width: 100%; height: 115px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; border: 1px solid #e2e8f0;" />` : ''}
              <div style="font-size: 10px; font-weight: 800; color: #009EE2; text-transform: uppercase;">
                ${point.pillarNumber ? `SLOUP VO ${point.pillarNumber}` : `BOD ${index + 1}`} · ${point.navigationType || 'SMĚROVÁ TABULE'}
              </div>
              <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px;">
                ${point.address || point.label}
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #334155; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                <span>${arrowStr}</span>
                ${distStr ? `<span style="color: #64748b;">· ${distStr}</span>` : ''}
              </div>
              <div style="margin-top: 6px; padding: 3px 6px; background: ${isInstalled ? '#ecfdf5' : '#f0f9ff'}; border: 1px solid ${isInstalled ? '#a7f3d0' : '#bae6fd'}; border-radius: 6px; font-size: 10px; font-weight: 700; color: ${isInstalled ? '#065f46' : '#0369a1'}; display: inline-block;">
                ${isInstalled ? '✓ Osazeno na sloupu VO' : '🧭 Schválené umístění VO'}
              </div>
            </div>
          `;

          const marker = L.marker([point.latitude, point.longitude], { icon: navIcon }).addTo(map);
          marker.bindPopup(popupContent);

          if (onSelectNavigationPoint) {
            marker.on('click', () => {
              onSelectNavigationPoint(point);
            });
          }
        });
      } else {
        // Standard OOH Carriers
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
                background: #009EE2;
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
              ${photo ? `<img src="${photo}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />` : ''}
              <div style="font-size: 10px; font-weight: 800; color: #009EE2; text-transform: uppercase;">
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
      }

      const totalPinsCount = isNavigation ? validNavPoints.length + (target ? 1 : 0) : pointsWithGps.length;
      if (totalPinsCount > 1) {
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
  }, [items, navigationPoints, target, isNavigation]);

  return (
    <div className="relative w-full h-[400px] md:h-[480px] rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {!hasAnyPoints && (
        <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-xs flex items-center justify-center p-6 text-center text-slate-500 text-xs">
          {isNavigation ? 'GPS souřadnice navigačních bodů v této nabídce nejsou k dispozici.' : 'GPS souřadnice nosičů v této kampani nejsou k dispozici.'}
        </div>
      )}
    </div>
  );
}
