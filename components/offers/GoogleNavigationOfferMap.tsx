'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import { NavigationPointMap, type NavigationMapPoint } from './NavigationPointMap';

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
        Marker: new (options: Record<string, unknown>) => {
          setMap: (map: unknown) => void;
          addListener: (event: string, handler: (e: { latLng?: { lat: () => number; lng: () => number } }) => void) => void;
        };
        Polyline: new (options: Record<string, unknown>) => {
          setMap: (map: unknown) => void;
        };
        LatLngBounds: new () => {
          extend: (point: { lat: number; lng: number }) => void;
        };
        Point: new (x: number, y: number) => unknown;
        geometry?: {
          encoding?: {
            decodePath: (encoded: string) => Array<{ lat: () => number; lng: () => number }>;
          };
        };
      };
    };
  }
}

export type GoogleOfferMapPoint = NavigationMapPoint & {
  arrowDirectionEnum?: string;
  pillarNumber?: string;
  pillarType?: string;
  routePolyline?: string;
  calculatedDistanceMeters?: number;
};

type SearchResultItem = {
  placeId: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
};

export function GoogleNavigationOfferMap({
  target,
  points,
  mode,
  onTargetSelect,
  onPointMove,
  onMapClick,
}: {
  target?: { latitude: number; longitude: number; label: string; address?: string; placeId?: string };
  points: GoogleOfferMapPoint[];
  mode: 'target' | 'point';
  onTargetSelect: (place: { label: string; address: string; latitude: number; longitude: number; placeId?: string }) => void;
  onPointMove: (id: string, latitude: number, longitude: number, calculatedDistanceMeters?: number, polyline?: string) => void;
  onMapClick: (latitude: number, longitude: number) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Places Autocomplete state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [sessionToken, setSessionToken] = useState<string>(() => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `st-${Date.now()}`);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Array<{ setMap: (map: unknown) => void }>>([]);
  const polylinesRef = useRef<Array<{ setMap: (map: unknown) => void }>>([]);

  // Load Google Maps Script
  useEffect(() => {
    if (!apiKey) {
      setLoadError(true);
      return;
    }

    if (window.google?.maps) {
      setMapsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-js-script';
    if (document.getElementById(scriptId)) {
      setMapsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    script.onerror = () => setLoadError(true);
    document.head.appendChild(script);
  }, [apiKey]);

  // Debounced Places Autocomplete
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 3 || !apiKey) {
      setSearchResults([]);
      return;
    }

    let isCurrent = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(searchQuery)}&sessiontoken=${sessionToken}`
        );
        if (res.ok && isCurrent) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSearchResults(
              data.slice(0, 5).map((item: Record<string, unknown>) => ({
                placeId: String(item.placeId || item.id || `loc-${item.latitude}-${item.longitude}`),
                title: String(item.label || '').split(',')[0] || String(item.label || ''),
                subtitle: String(item.label || '').split(',').slice(1).join(',').trim() || '',
                latitude: Number(item.latitude),
                longitude: Number(item.longitude),
              }))
            );
          }
        }
      } catch {
        /* fallback empty */
      } finally {
        if (isCurrent) setSearching(false);
      }
    }, 350);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [searchQuery, sessionToken, apiKey]);

  // Select Place Handler
  const handleSelectPlace = (item: SearchResultItem) => {
    onTargetSelect({
      label: item.title,
      address: item.subtitle || item.title,
      latitude: item.latitude,
      longitude: item.longitude,
      placeId: item.placeId,
    });
    setSearchQuery('');
    setSearchResults([]);
    setSessionToken(typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `st-${Date.now()}`);
  };

  // Render Google Map
  useEffect(() => {
    const googleMaps = window.google?.maps;
    if (!mapsLoaded || !containerRef.current || !googleMaps) return;

    if (!mapRef.current) {
      const center = target ? { lat: target.latitude, lng: target.longitude } : { lat: 49.82, lng: 15.48 };
      const newMap = new googleMaps.Map(containerRef.current, {
        center,
        zoom: target ? 14 : 8,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });

      (newMap as { addListener: (evt: string, fn: (e: { latLng?: { lat: () => number; lng: () => number } }) => void) => void }).addListener('click', (e) => {
        if (e.latLng) {
          onMapClick(e.latLng.lat(), e.latLng.lng());
        }
      });

      mapRef.current = newMap;
    }

    const map = mapRef.current;

    // Clear existing markers & polylines
    markersRef.current.forEach((m) => m.setMap(null));
    polylinesRef.current.forEach((p) => p.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];

    const bounds = new googleMaps.LatLngBounds();

    // 1. Target Marker (High quality SVG Glowing Brand Pin)
    if (target) {
      const targetPos = { lat: target.latitude, lng: target.longitude };
      bounds.extend(targetPos);

      const targetMarker = new googleMaps.Marker({
        position: targetPos,
        map,
        title: `CÍL: ${target.label}`,
        draggable: true,
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: '#be123c',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 2,
          anchor: new googleMaps.Point(12, 22),
        },
      });

      targetMarker.addListener('dragend', (e) => {
        if (e.latLng) {
          onTargetSelect({
            label: target.label,
            address: target.address || '',
            latitude: e.latLng.lat(),
            longitude: e.latLng.lng(),
            placeId: target.placeId,
          });
        }
      });

      markersRef.current.push(targetMarker);
    }

    // 2. Navigation Points Markers & Route Polylines
    points.forEach((point, index) => {
      const pointPos = { lat: point.latitude, lng: point.longitude };
      bounds.extend(pointPos);

      const marker = new googleMaps.Marker({
        position: pointPos,
        map,
        title: point.label,
        draggable: true,
        label: {
          text: `#${index + 1}`,
          color: '#ffffff',
          fontWeight: '900',
          fontSize: '12px',
        },
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
          fillColor: '#0284c7',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 1.8,
          anchor: new googleMaps.Point(12, 22),
        },
      });

      marker.addListener('dragend', (e) => {
        if (e.latLng) {
          onPointMove(point.id, e.latLng.lat(), e.latLng.lng());
        }
      });

      markersRef.current.push(marker);

      // Route polyline to target
      if (target) {
        let polylinePath: Array<{ lat: number; lng: number }> = [pointPos, { lat: target.latitude, lng: target.longitude }];
        if (point.routePolyline && googleMaps.geometry?.encoding) {
          try {
            const decoded = googleMaps.geometry.encoding.decodePath(point.routePolyline);
            polylinePath = decoded.map((p) => ({ lat: p.lat(), lng: p.lng() }));
          } catch {
            /* fallback */
          }
        }

        const polyline = new googleMaps.Polyline({
          path: polylinePath,
          geodesic: true,
          strokeColor: '#0284c7',
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map,
        });

        polylinesRef.current.push(polyline);
      }
    });

    if ((points.length > 0 || target) && (map as { fitBounds: (b: unknown, opts: unknown) => void }).fitBounds) {
      (map as { fitBounds: (b: unknown, opts: unknown) => void }).fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }
  }, [mapsLoaded, target, points, onMapClick, onPointMove, onTargetSelect]);

  // Graceful Leaflet Fallback if API key missing or load error
  if (loadError || !apiKey) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold">
            <AlertCircle size={16} className="text-amber-600 shrink-0" /> Google Maps API klíč není nakonfigurován. Aktivován zobrazení v OpenStreetMap (Leaflet).
          </span>
        </div>
        <NavigationPointMap
          target={target ? { latitude: target.latitude, longitude: target.longitude, label: target.label } : undefined}
          points={points}
          mode={mode}
          onMapClick={onMapClick}
          onPointMove={(id, lat, lng) => onPointMove(id, lat, lng)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Places Autocomplete Search Box */}
      <div className="relative">
        <div className="flex items-center rounded-xl border border-slate-300 bg-white shadow-xs focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20">
          <Search size={16} className="ml-3 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Vyhledat cílovou provozovnu v ČR (Google Places)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-none"
          />
          {searching && <RefreshCw size={15} className="mr-3 text-sky-600 animate-spin shrink-0" />}
        </div>

        {/* Autocomplete Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg space-y-0.5">
            {searchResults.map((item) => (
              <button
                key={item.placeId}
                type="button"
                onClick={() => handleSelectPlace(item)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 transition-all space-y-0.5"
              >
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin size={13} className="text-rose-500 shrink-0" /> {item.title}
                </div>
                {item.subtitle && <div className="text-[11px] text-slate-500 pl-4">{item.subtitle}</div>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode Status Indicator */}
      <div className={`rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between ${
        mode === 'target' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-sky-50 text-sky-800 border border-sky-200'
      }`}>
        <span>
          {mode === 'target'
            ? '📍 Kliknutím do mapy určíte polohu cílové provozovny (červený špendlík).'
            : '📍 Kliknutím do mapy přidáte nový navigační bod. Body lze přesouvat tažením myší.'}
        </span>
        <span className="text-[11px] font-extrabold uppercase bg-white px-2 py-0.5 rounded shadow-xs">
          Google Maps API (Routes Enabled)
        </span>
      </div>

      {/* Interactive Google Map Container */}
      <div
        ref={containerRef}
        aria-label="Google mapa plánování navigace"
        className="h-[520px] w-full rounded-2xl border-2 border-slate-200 bg-slate-100 shadow-inner overflow-hidden"
      />
    </div>
  );
}
