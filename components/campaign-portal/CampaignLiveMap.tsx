'use client';

import type { Map as LeafletMap, TileLayer as LeafletTileLayer } from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { OfferItemView } from '@/lib/offers/view-model';
import { getPointPinColor } from '@/lib/offers/navigation-carrier-types';
import { getGoogleMapsRouteUrl } from '@/lib/navigation-documentation-export';

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
  navigationType?: string | null;
  variant?: string | null;
  color?: string | null;
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
    case 'SLANTED_RIGHT':
    case 'SLIGHT_RIGHT':
      return '↗️ Šikmo vpravo';
    case 'SLANTED_LEFT':
    case 'SLIGHT_LEFT':
      return '↖️ Šikmo vlevo';
    case 'U_TURN':
      return '↩️ Otočení do protisměru';
    case 'TWO_WAY':
      return '↔️ Obousměrný';
    case 'ROUNDABOUT_1':
      return '🔄 Kruhový objezd (1. výjezd)';
    case 'ROUNDABOUT_2':
      return '🔄 Kruhový objezd (2. výjezd)';
    case 'ROUNDABOUT_3':
      return '🔄 Kruhový objezd (3. výjezd)';
    case 'ROUNDABOUT_4':
      return '🔄 Kruhový objezd (4. výjezd)';
    case 'ROUNDABOUT_5':
      return '🔄 Kruhový objezd (5. výjezd)';
    case 'ROUNDABOUT':
      return '🔄 Kruhový objezd';
    case 'STRAIGHT':
      return '⬆️ Rovně';
    default:
      if (!direction) return '⬆️ Rovně';
      return direction;
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
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<LeafletTileLayer | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

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

  const allRouteCoords = isNavigation
    ? [
        ...validNavPoints.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        ...(target && typeof target.latitude === 'number' && typeof target.longitude === 'number'
          ? [{ latitude: target.latitude, longitude: target.longitude }]
          : []),
      ]
    : pointsWithGps.map((i) => ({
        latitude: i.surface?.carrier?.latitude,
        longitude: i.surface?.carrier?.longitude,
      }));

  const googleMapsRouteUrl = getGoogleMapsRouteUrl(allRouteCoords);

  // Switch Google Maps tile layer dynamically when user clicks layer switcher
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const url =
      mapType === 'satellite'
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    tileLayerRef.current.setUrl(url);
  }, [mapType]);

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
        tileLayerRef.current = null;
      }

      // Empty campaigns do not imply a location for the organization.
      let centerLat = 49.82;
      let centerLng = 15.48;
      let zoom = 8;

      if (isNavigation && validNavPoints.length > 0) {
        zoom = 12;
        centerLat = validNavPoints.reduce((sum, p) => sum + p.latitude, 0) / validNavPoints.length;
        centerLng = validNavPoints.reduce((sum, p) => sum + p.longitude, 0) / validNavPoints.length;
      } else if (target && typeof target.latitude === 'number' && typeof target.longitude === 'number') {
        centerLat = target.latitude;
        centerLng = target.longitude;
        zoom = 13;
      } else if (pointsWithGps.length > 0) {
        zoom = 12;
        centerLat = pointsWithGps.reduce((sum, p) => sum + p.surface.carrier.latitude!, 0) / pointsWithGps.length;
        centerLng = pointsWithGps.reduce((sum, p) => sum + p.surface.carrier.longitude!, 0) / pointsWithGps.length;
      }

      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      // Google Maps Tile Layer (no browser API key needed, never 403 blocked)
      const tileUrl =
        mapType === 'satellite'
          ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 20,
        attribution: '&copy; Google Maps',
      }).addTo(map);

      tileLayerRef.current = tileLayer;
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
          <div style="font-family: sans-serif; min-width: 220px; max-width: 280px; padding: 2px;">
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
            <div style="margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 6px;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 10px; background: #ef4444; color: #ffffff; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none;">
                Navigovat do cíle v Google Maps ↗
              </a>
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

          const photo = point.installedPhotoUrl;
          const isInstalled = point.status === 'INSTALLED' || Boolean(point.installedPhotoUrl);
          const arrowStr = formatArrowText(point.arrowDirectionEnum);
          const distStr = formatDistance(point);
          const pinColor = getPointPinColor(point);

          const navIcon = L.divIcon({
            className: 'custom-nav-pin',
            html: `
              <div style="
                background: ${isInstalled ? '#059669' : pinColor};
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

          const rawVariant = point.variant ? point.variant.trim() : '';
          const normalizedVariant = rawVariant === '670x900 mm' ? '670 × 900 mm' : rawVariant === '120x80 cm' ? '120 × 80 cm' : rawVariant;
          const variantBadge = normalizedVariant ? ` · ${normalizedVariant}` : '';

          const popupContent = `
            <div style="font-family: sans-serif; min-width: 230px; max-width: 290px; padding: 2px;">
              ${photo ? `<img src="${photo}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; border: 1px solid #e2e8f0;" />` : ''}
              <div style="font-size: 10px; font-weight: 800; color: #009EE2; text-transform: uppercase;">
                ${point.pillarNumber ? `SLOUP VO ${point.pillarNumber}` : `BOD ${index + 1}`} · ${point.navigationType || 'SMĚROVÁ TABULE'}${variantBadge}
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
              <div style="margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 6px;">
                <a href="https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 10px; background: #0284c7; color: #ffffff; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none;">
                  Navigovat k bodu v Google Maps ↗
                </a>
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

        // Connecting Route Line between points and target
        const routeCoords: [number, number][] = validNavPoints.map((p) => [p.latitude, p.longitude]);
        if (target && typeof target.latitude === 'number' && typeof target.longitude === 'number') {
          routeCoords.push([target.latitude, target.longitude]);
        }
        if (routeCoords.length > 1) {
          L.polyline(routeCoords, {
            color: '#0284c7',
            weight: 3.5,
            dashArray: '6, 6',
            opacity: 0.85,
          }).addTo(map);
        }
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
            <div style="font-family: sans-serif; min-width: 220px; max-width: 280px; padding: 2px;">
              ${photo ? `<img src="${photo}" style="width: 100%; height: 115px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />` : ''}
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
              <div style="margin-top: 8px; border-top: 1px solid #f1f5f9; padding-top: 6px;">
                <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 10px; background: #0284c7; color: #ffffff; border-radius: 8px; font-size: 11px; font-weight: 700; text-decoration: none;">
                  Zobrazit v Google Maps ↗
                </a>
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
        tileLayerRef.current = null;
      }
    };
  }, [items, navigationPoints, target, isNavigation]);

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm bg-slate-900">
      {/* Top Map Toolbar: Layer Switcher & Route Export */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Layer toggle buttons */}
        <div className="pointer-events-auto inline-flex items-center rounded-xl bg-white/95 backdrop-blur-md p-1 shadow-md border border-slate-200/80">
          <button
            type="button"
            onClick={() => setMapType('roadmap')}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              mapType === 'roadmap' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Běžná
          </button>
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              mapType === 'satellite' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Letecká
          </button>
        </div>

        {/* Route button */}
        {googleMapsRouteUrl && (
          <a
            href={googleMapsRouteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-xl bg-white/95 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-sky-800 shadow-md border border-sky-200 hover:bg-sky-50 transition"
            title="Otevřít celou trasu v aplikaci Google Maps"
          >
            <ExternalLink className="h-3.5 w-3.5 text-sky-600" />
            <span>Otevřít trasu v Google Maps ↗</span>
          </a>
        )}
      </div>

      <div ref={mapContainerRef} className="w-full h-[420px] md:h-[500px] z-0" />

      {!hasAnyPoints && (
        <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-xs flex items-center justify-center p-6 text-center text-slate-500 text-xs">
          {isNavigation ? 'GPS souřadnice navigačních bodů v této nabídce nejsou k dispozici.' : 'GPS souřadnice nosičů v této kampani nejsou k dispozici.'}
        </div>
      )}
    </div>
  );
}
