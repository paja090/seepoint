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
        Geocoder?: new () => {
          geocode: (
            request: { location: { lat: number; lng: number } },
            callback: (results: Array<{ formatted_address: string }> | null, status: string) => void
          ) => void;
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

export type SuggestedNavigationPoint = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  score: number;
  reasons: string[];
  distanceMeters?: number;
  routeDurationSeconds?: number;
  routePolyline?: string;
  arrowDirection?: 'LEFT' | 'RIGHT' | 'STRAIGHT';
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
  compact = false,
  readOnly = false,
  userLocation,
  suggestionCount,
  maxRadiusKm = 5,
  onSuggestedPoints,
}: {
  target?: { latitude: number; longitude: number; label: string; address?: string; placeId?: string };
  points: GoogleOfferMapPoint[];
  mode: 'target' | 'point';
  onTargetSelect: (place: { label: string; address: string; latitude: number; longitude: number; placeId?: string }) => void;
  onPointMove: (id: string, latitude: number, longitude: number, calculatedDistanceMeters?: number, polyline?: string, address?: string) => void;
  onMapClick: (latitude: number, longitude: number, address?: string) => void;
  compact?: boolean;
  readOnly?: boolean;
  userLocation?: { latitude: number; longitude: number };
  suggestionCount?: number;
  maxRadiusKm?: number;
  onSuggestedPoints?: (points: SuggestedNavigationPoint[], error?: string) => void;
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
  const suggestionKeyRef = useRef('');

  useEffect(() => {
    if ((!apiKey || loadError) && target && suggestionCount && onSuggestedPoints && suggestionKeyRef.current !== 'maps-unavailable') {
      suggestionKeyRef.current = 'maps-unavailable';
      onSuggestedPoints([], 'Google mapa není dostupná. Body lze doplnit ručně po vytvoření konceptu.');
    }
  }, [apiKey, loadError, onSuggestedPoints, suggestionCount, target]);

  // Load Google Maps Script
  useEffect(() => {
    if (!apiKey) {
      setLoadError(true);
      return;
    }

    const cbName = '__initGoogleMapsCallback';
    (window as unknown as Record<string, unknown>)[cbName] = () => {
      setMapsLoaded(true);
    };

    if (window.google?.maps?.Map) {
      setMapsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-js-script';
    if (document.getElementById(scriptId)) {
      if (window.google?.maps?.Map) {
        setMapsLoaded(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=${cbName}`;
    script.async = true;
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

  // Browser Directions API can work with a browser-restricted key even when the
  // server Routes API cannot. Analyse real approach routes and select their most
  // useful decision points instead of presenting geometric radial placeholders.
  useEffect(() => {
    if (!mapsLoaded || !target || !suggestionCount || !onSuggestedPoints) return;
    const key = `${target.latitude.toFixed(5)}:${target.longitude.toFixed(5)}:${suggestionCount}:${maxRadiusKm}`;
    if (suggestionKeyRef.current === key) return;
    suggestionKeyRef.current = key;
    let cancelled = false;

    type LatLngValue = { lat: () => number; lng: () => number };
    type DirectionStep = {
      start_location: LatLngValue;
      instructions?: string;
      maneuver?: string;
    };
    type DirectionRoute = {
      legs: Array<{ steps?: DirectionStep[]; distance?: { value: number }; duration?: { value: number } }>;
      overview_polyline?: string | { points?: string };
    };
    type DirectionResult = { routes: DirectionRoute[] };
    const maps = window.google?.maps as unknown as {
      DirectionsService?: new () => { route: (request: Record<string, unknown>, callback: (result: DirectionResult | null, status: string) => void) => void };
      TravelMode?: { DRIVING?: string };
    };
    if (!maps?.DirectionsService) {
      onSuggestedPoints([], 'Google Directions není pro tento klíč dostupné. Body lze doplnit ručně po vytvoření konceptu.');
      return;
    }

    const distanceBetween = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
      const earth = 6_371_000;
      const toRad = (value: number) => value * Math.PI / 180;
      const dLat = toRad(b.latitude - a.latitude);
      const dLng = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * earth * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };
    const requestRoute = (origin: { latitude: number; longitude: number }) => new Promise<DirectionRoute | null>((resolve) => {
      new maps.DirectionsService!().route({
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: target.latitude, lng: target.longitude },
        travelMode: maps.TravelMode?.DRIVING || 'DRIVING',
        provideRouteAlternatives: false,
      }, (result, status) => resolve(status === 'OK' ? result?.routes?.[0] ?? null : null));
    });
    const plainText = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const arrowFor = (maneuver = ''): SuggestedNavigationPoint['arrowDirection'] =>
      /left|vlevo/i.test(maneuver) ? 'LEFT' : /right|vpravo/i.test(maneuver) ? 'RIGHT' : 'STRAIGHT';
    const directions = ['severu', 'severovýchodu', 'východu', 'jihovýchodu', 'jihu', 'jihozápadu', 'západu', 'severozápadu'];
    const radiusMeters = Math.max(1, maxRadiusKm) * 1000;
    const routeCount = Math.min(8, Math.max(4, suggestionCount));
    const latDelta = radiusMeters / 111_320;
    const lngDelta = radiusMeters / (111_320 * Math.max(0.2, Math.cos(target.latitude * Math.PI / 180)));
    const origins = Array.from({ length: routeCount }, (_, index) => {
      const angle = index * 2 * Math.PI / routeCount;
      return {
        latitude: target.latitude + Math.cos(angle) * latDelta,
        longitude: target.longitude + Math.sin(angle) * lngDelta,
        direction: directions[Math.round(index * 8 / routeCount) % 8],
      };
    });

    void Promise.all(origins.map(async (origin, routeIndex) => {
      const route = await requestRoute(origin);
      if (!route) return [];
      return (route.legs[0]?.steps ?? []).flatMap((step, stepIndex) => {
        const latitude = step.start_location.lat();
        const longitude = step.start_location.lng();
        const distanceMeters = distanceBetween({ latitude, longitude }, target);
        if (distanceMeters < 250 || distanceMeters > radiusMeters * 1.15) return [];
        const instruction = plainText(step.instructions);
        const isTurn = /odboč|turn|exit|výjezd|kruhov|roundabout|merge|sjezd|držte|keep/i.test(`${instruction} ${step.maneuver ?? ''}`);
        const isMainRoad = /silnic|dálnic|highway|route|tříd|avenue|\b[DI]\s?\d+|\b\d{2,3}\b/i.test(instruction);
        const usefulDistance = distanceMeters >= 500 && distanceMeters <= 3_500;
        const score = Math.min(98, 58 + (isTurn ? 22 : 0) + (isMainRoad ? 10 : 0) + (usefulDistance ? 8 : 0));
        return [{ routeIndex, stepIndex, direction: origin.direction, latitude, longitude, distanceMeters, instruction, score, maneuver: step.maneuver }];
      });
    })).then(async (groups) => {
      if (cancelled) return;
      const candidates = groups.flat().sort((a, b) => b.score - a.score || b.distanceMeters - a.distanceMeters);
      const selected: typeof candidates = [];
      for (const candidate of candidates) {
        if (selected.some((existing) => distanceBetween(existing, candidate) < 220)) continue;
        if (selected.some((existing) => existing.routeIndex === candidate.routeIndex) && selected.length < routeCount) continue;
        selected.push(candidate);
        if (selected.length >= suggestionCount) break;
      }
      for (const candidate of candidates) {
        if (selected.length >= suggestionCount) break;
        if (!selected.includes(candidate) && !selected.some((existing) => distanceBetween(existing, candidate) < 220)) selected.push(candidate);
      }
      const suggestions = await Promise.all(selected.map(async (candidate, index) => {
        const route = await requestRoute(candidate);
        const rawPolyline = route?.overview_polyline;
        const routePolyline = typeof rawPolyline === 'string' ? rawPolyline : rawPolyline?.points;
        const instruction = candidate.instruction || `rozhodovací místo při příjezdu od ${candidate.direction}`;
        return {
          id: `route-point-${candidate.routeIndex + 1}-${candidate.stepIndex + 1}`,
          title: `Rozhodovací bod: ${instruction.slice(0, 90)}`,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          score: candidate.score,
          reasons: [
            `Pokrývá příjezd od ${candidate.direction}.`,
            /odboč|turn|exit|výjezd|kruhov|roundabout|merge|sjezd/i.test(`${instruction} ${candidate.maneuver ?? ''}`)
              ? 'Řidič zde mění směr nebo volí další část trasy.'
              : 'Bod leží na důležitém úseku příjezdové trasy.',
            `${Math.round(candidate.distanceMeters)} m před cílem.`,
          ],
          distanceMeters: route?.legs[0]?.distance?.value ?? candidate.distanceMeters,
          routeDurationSeconds: route?.legs[0]?.duration?.value,
          routePolyline,
          arrowDirection: arrowFor(candidate.maneuver),
          index,
        } satisfies SuggestedNavigationPoint & { index: number };
      }));
      if (!cancelled) onSuggestedPoints(suggestions.map(({ index: _index, ...point }) => point), suggestions.length ? undefined : 'Google nenašel vhodná rozhodovací místa na příjezdových trasách.');
    }).catch(() => {
      if (!cancelled) onSuggestedPoints([], 'Analýzu příjezdových tras se nepodařilo dokončit.');
    });
    return () => { cancelled = true; };
  }, [mapsLoaded, maxRadiusKm, onSuggestedPoints, suggestionCount, target]);

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
    if (!mapsLoaded || !containerRef.current || !googleMaps || typeof googleMaps.Map !== 'function') return;

    if (!mapRef.current) {
      const center = target ? { lat: target.latitude, lng: target.longitude } : { lat: 49.82, lng: 15.48 };
      const newMap = new googleMaps.Map(containerRef.current, {
        center,
        zoom: target ? 14 : 8,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        mapId: 'DEMO_MAP_ID',
      });

      (newMap as { addListener: (evt: string, fn: (e: { latLng?: { lat: () => number; lng: () => number } }) => void) => void }).addListener('click', (e) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              const street = (status === 'OK' && results?.[0]?.formatted_address) ? results[0].formatted_address : '';
              onMapClick(lat, lng, street);
            });
          } else {
            onMapClick(lat, lng);
          }
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
        draggable: !readOnly,
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
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              const street = (status === 'OK' && results?.[0]?.formatted_address) ? results[0].formatted_address : target.address;
              onTargetSelect({
                label: target.label,
                address: street || '',
                latitude: lat,
                longitude: lng,
                placeId: target.placeId,
              });
            });
          } else {
            onTargetSelect({
              label: target.label,
              address: target.address || '',
              latitude: lat,
              longitude: lng,
              placeId: target.placeId,
            });
          }
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
        draggable: !readOnly,
        label: {
          text: `#${index + 1}`,
          color: '#000000',
          fontWeight: '900',
          fontSize: '13px',
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
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat, lng } }, (results, status) => {
              const street = (status === 'OK' && results?.[0]?.formatted_address) ? results[0].formatted_address : undefined;
              onPointMove(point.id, lat, lng, undefined, undefined, street);
            });
          } else {
            onPointMove(point.id, lat, lng);
          }
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

    // 3. User Current GPS Location Marker
    if (userLocation) {
      const userPos = { lat: userLocation.latitude, lng: userLocation.longitude };
      bounds.extend(userPos);

      const userMarker = new googleMaps.Marker({
        position: userPos,
        map,
        title: 'Moje aktuální poloha (GPS)',
        zIndex: 99999,
        label: {
          text: '📍 Jste zde',
          color: '#2563eb',
          fontWeight: '900',
          fontSize: '11px',
        },
        icon: {
          path: 'M 0,0 m -7,0 a 7,7 0 1,0 14,0 a 7,7 0 1,0 -14,0',
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 1.5,
        },
      });

      markersRef.current.push(userMarker);
    }

    if ((points.length > 0 || target || userLocation) && (map as { fitBounds: (b: unknown, opts: unknown) => void }).fitBounds) {
      (map as { fitBounds: (b: unknown, opts: unknown) => void }).fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }
  }, [mapsLoaded, target, points, userLocation, onMapClick, onPointMove, onTargetSelect, readOnly]);

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
          userLocation={userLocation}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Places Autocomplete Search Box */}
      {!compact && <div className="relative">
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
      </div>}

      {/* Mode Status Indicator */}
      {!compact && <div className={`rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between ${
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
      </div>}

      {/* Interactive Google Map Container */}
      <div
        ref={containerRef}
        aria-label="Google mapa plánování navigace"
        className={`${compact ? 'h-[330px] md:h-[390px]' : 'h-[520px]'} w-full rounded-2xl border-2 border-slate-200 bg-slate-100 shadow-inner overflow-hidden`}
      />
    </div>
  );
}
