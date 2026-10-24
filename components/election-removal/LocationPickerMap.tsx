'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap, Marker, DivIcon } from 'leaflet';
import { MapPin, Search, Loader2, X } from 'lucide-react';

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

interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

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
  const lRef = useRef<typeof import('leaflet') | null>(null);
  const pinIconRef = useRef<DivIcon | null>(null);

  const [activeCoords, setActiveCoords] = useState<{ lat: number; lng: number } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  );

  // Address search states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);

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
      lRef.current = L;

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
      pinIconRef.current = pinIcon;

      let marker: Marker | null = null;
      if (latitude && longitude) {
        marker = L.marker([latitude, longitude], { icon: pinIcon, draggable: true }).addTo(map);
        marker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          setActiveCoords({ lat: latlng.lat, lng: latlng.lng });
          setSelectedAddress(null);
          onChange({ latitude: latlng.lat, longitude: latlng.lng });
        });
      }

      // Handle map clicks
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setActiveCoords({ lat, lng });
        setSelectedAddress(null);
        onChange({ latitude: lat, longitude: lng });

        if (!markerRef.current) {
          const newMarker = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);
          newMarker.on('dragend', (dragEvt) => {
            const dragLatLng = dragEvt.target.getLatLng();
            setActiveCoords({ lat: dragLatLng.lat, lng: dragLatLng.lng });
            setSelectedAddress(null);
            onChange({ latitude: dragLatLng.lat, longitude: dragLatLng.lng });
          });
          markerRef.current = newMarker;
        } else {
          markerRef.current.setLatLng([lat, lng]);
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

  const executeSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSearchError('Zadejte alespoň 3 znaky adresy nebo názvu místa.');
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Adresu se nepodařilo vyhledat.');
      }
      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data);
        handleSelectLocation(data[0]);
      } else {
        setSearchError('Nebylo nalezeno žádné místo odpovídající hledání.');
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Vyhledávání adresy selhalo.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSelectLocation = (result: GeocodeResult) => {
    const { latitude: lat, longitude: lng, label } = result;
    setActiveCoords({ lat, lng });
    setSelectedAddress(label);
    setSearchResults([]);
    setSearchError(null);
    onChange({ latitude: lat, longitude: lng });

    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 16);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else if (lRef.current && pinIconRef.current) {
        const newMarker = lRef.current.marker([lat, lng], { icon: pinIconRef.current, draggable: true }).addTo(mapRef.current);
        newMarker.on('dragend', (dragEvt) => {
          const dragLatLng = dragEvt.target.getLatLng();
          setActiveCoords({ lat: dragLatLng.lat, lng: dragLatLng.lng });
          setSelectedAddress(null);
          onChange({ latitude: dragLatLng.lat, longitude: dragLatLng.lng });
        });
        markerRef.current = newMarker;
      }
    }
  };

  return (
    <div className="space-y-2">
      {/* Address Search Bar */}
      <div className="relative">
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (searchError) setSearchError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  executeSearch();
                }
              }}
              placeholder="Vyhledat adresu nebo místo (např. Nádražní 12, Brno)..."
              className="w-full pl-8 pr-8 py-2 text-xs rounded-xl border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchError(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Smazat hledání"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              executeSearch();
            }}
            disabled={isSearching || searchQuery.trim().length < 3}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-50 transition shrink-0 flex items-center gap-1.5 shadow-2xs"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Hledat</span>
          </button>
        </div>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-[500] bg-white rounded-xl border border-slate-200 shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
            <div className="p-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
              Nalezené adresy ({searchResults.length}) – klikněte pro přenesení do mapy:
            </div>
            {searchResults.map((res, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectLocation(res)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-sky-50 transition flex items-start gap-2 group"
              >
                <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                <span className="line-clamp-2 text-slate-700 font-medium group-hover:text-sky-900">{res.label}</span>
              </button>
            ))}
          </div>
        )}

        {searchError && (
          <p className="text-[11px] font-medium text-amber-800 mt-1 px-1">{searchError}</p>
        )}
      </div>

      {selectedAddress && (
        <div className="flex items-center gap-1.5 text-xs text-sky-900 bg-sky-50 border border-sky-200 px-2.5 py-1.5 rounded-lg">
          <MapPin className="w-3.5 h-3.5 text-sky-700 shrink-0" />
          <span className="truncate font-semibold">{selectedAddress}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
        <span className="font-semibold text-slate-700 flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-sky-600" />
          <span>Nebo klikněte přímo do mapy pro umístění špendlíku:</span>
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
          <span className="text-slate-500 font-medium pl-1">Rychlý skok:</span>
          <select
            onChange={(e) => handleJumpCity(e.target.value)}
            defaultValue=""
            className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="" disabled>Vyberte město...</option>
            {Object.keys(CZECH_CITIES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="absolute bottom-2 left-2 z-[400] bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-xs pointer-events-none">
          💡 Kliknutím nebo tažením špendlíku doladíte přesnou polohu
        </div>
      </div>
    </div>
  );
}
