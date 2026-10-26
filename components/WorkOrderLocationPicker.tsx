'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap, Marker, TileLayer, DivIcon } from 'leaflet';
import { MapPin, Search, Loader2, X, Layers, Compass, Check, Trash2 } from 'lucide-react';

interface WorkOrderLocationPickerProps {
  locationAddress: string;
  onAddressChange: (address: string) => void;
  coords: { latitude: number; longitude: number } | null;
  onCoordsChange: (coords: { latitude: number; longitude: number } | null) => void;
  scope?: 'WORKSHOP' | 'FIELD';
}

const CZECH_CITIES: Record<string, [number, number]> = {
  'Ostrava': [49.83465, 18.28204],
  'Frýdek-Místek / Sviadnov': [49.68600, 18.34500],
  'Havířov': [49.77980, 18.43690],
  'Karviná': [49.85400, 18.54100],
  'Opava': [49.93870, 17.90260],
  'Olomouc': [49.59378, 17.25088],
  'Brno': [49.19506, 16.60683],
  'Praha': [50.08804, 14.42076],
  'Zlín': [49.22442, 17.66275],
  'Plzeň': [49.74747, 13.37759],
};

interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

type MapLayerType = 'hybrid' | 'roadmap';

const TILE_LAYERS: Record<MapLayerType, { url: string; attribution: string; label: string; icon: string }> = {
  hybrid: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '© Google Maps (Satelitní)',
    label: '🛰️ Letecká / Satelitní',
    icon: '🛰️',
  },
  roadmap: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '© Google Maps',
    label: '🗺️ Běžná mapa',
    icon: '🗺️',
  },
};

export function WorkOrderLocationPicker({
  locationAddress,
  onAddressChange,
  coords,
  onCoordsChange,
  scope = 'FIELD',
}: WorkOrderLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const lRef = useRef<typeof import('leaflet') | null>(null);
  const pinIconRef = useRef<DivIcon | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerType>('hybrid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [reverseAddressSuggestion, setReverseAddressSuggestion] = useState<string | null>(null);

  // Initialize Leaflet map
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

      const initialLat = coords?.latitude || 49.69608; // default around Sviadnov / Ostrava region
      const initialLng = coords?.longitude || 18.32053;
      const initialZoom = coords ? 16 : 13;

      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: true,
        attributionControl: false,
      });

      // Layer
      const currentLayerCfg = TILE_LAYERS[activeLayer];
      const tile = L.tileLayer(currentLayerCfg.url, {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
        attribution: currentLayerCfg.attribution,
      }).addTo(map);
      tileLayerRef.current = tile;

      // Custom Pin Icon
      const pinIcon = L.divIcon({
        className: 'wo-location-picker-pin',
        html: `
          <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: grab;">
            <div style="background: #0284c7; color: white; padding: 4px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 10px rgba(0,0,0,0.35); border: 2px solid white; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
              <span>📍</span> <span>Cíl výjezdu</span>
            </div>
            <div style="width: 2px; height: 12px; background: #0284c7;"></div>
            <div style="width: 10px; height: 10px; border-radius: 50%; background: #0284c7; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      pinIconRef.current = pinIcon;

      // Add existing marker if coords provided
      if (coords && coords.latitude && coords.longitude) {
        const marker = L.marker([coords.latitude, coords.longitude], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        marker.on('dragend', async (e) => {
          const latlng = e.target.getLatLng();
          const newCoords = { latitude: latlng.lat, longitude: latlng.lng };
          onCoordsChange(newCoords);
          await triggerReverseGeocode(latlng.lat, latlng.lng);
        });

        markerRef.current = marker;
      }

      // Handle map clicks
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        const newCoords = { latitude: lat, longitude: lng };
        onCoordsChange(newCoords);

        if (!markerRef.current) {
          const newMarker = L.marker([lat, lng], {
            icon: pinIcon,
            draggable: true,
          }).addTo(map);

          newMarker.on('dragend', async (dragEvt) => {
            const dragLatLng = dragEvt.target.getLatLng();
            onCoordsChange({ latitude: dragLatLng.lat, longitude: dragLatLng.lng });
            await triggerReverseGeocode(dragLatLng.lat, dragLatLng.lng);
          });
          markerRef.current = newMarker;
        } else {
          markerRef.current.setLatLng([lat, lng]);
        }

        await triggerReverseGeocode(lat, lng);
      });

      mapRef.current = map;

      setTimeout(() => {
        if (isMounted && mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 200);
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

  // Update marker position & view when external coords change (e.g. from AI parse or city jump)
  useEffect(() => {
    if (!mapRef.current || !lRef.current || !pinIconRef.current) return;

    if (coords && coords.latitude && coords.longitude) {
      if (!markerRef.current) {
        const newMarker = lRef.current
          .marker([coords.latitude, coords.longitude], {
            icon: pinIconRef.current,
            draggable: true,
          })
          .addTo(mapRef.current);

        newMarker.on('dragend', async (dragEvt) => {
          const dragLatLng = dragEvt.target.getLatLng();
          onCoordsChange({ latitude: dragLatLng.lat, longitude: dragLatLng.lng });
          await triggerReverseGeocode(dragLatLng.lat, dragLatLng.lng);
        });
        markerRef.current = newMarker;
      } else {
        markerRef.current.setLatLng([coords.latitude, coords.longitude]);
      }
      mapRef.current.setView([coords.latitude, coords.longitude], 16, { animate: true });
    } else {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    }
  }, [coords?.latitude, coords?.longitude]);

  // Handle Layer Switching (Satellite vs Street)
  const switchLayer = (type: MapLayerType) => {
    if (!mapRef.current || !lRef.current || type === activeLayer) return;
    setActiveLayer(type);

    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    const cfg = TILE_LAYERS[type];
    const newTile = lRef.current.tileLayer(cfg.url, {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: cfg.attribution,
    }).addTo(mapRef.current);
    tileLayerRef.current = newTile;
  };

  // Reverse geocoding helper
  const triggerReverseGeocode = async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    setReverseAddressSuggestion(null);
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.address) {
        setReverseAddressSuggestion(data.address);
        // If the location address is currently blank, auto-fill it
        if (!locationAddress || locationAddress.trim() === '') {
          onAddressChange(data.address);
        }
      }
    } catch {
      // Ignore background reverse geocoding errors
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  // Address search helper
  const executeSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      setSearchError('Zadejte alespoň 3 znaky pro vyhledání adresy.');
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Místo se nepodařilo vyhledat.');
      }
      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data);
        handleSelectLocation(data[0]);
      } else {
        setSearchError('Žádné odpovídající místo nebylo nalezeno.');
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Vyhledávání adresy selhalo.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSelectLocation = (result: GeocodeResult) => {
    const { latitude, longitude, label } = result;
    onCoordsChange({ latitude, longitude });
    if (!locationAddress || locationAddress.trim() === '') {
      onAddressChange(label);
    }
    setSearchResults([]);
    setSearchError(null);
    setSearchQuery('');

    if (mapRef.current) {
      mapRef.current.setView([latitude, longitude], 16, { animate: true });
    }
  };

  const handleJumpCity = (cityName: string) => {
    const cityCoords = CZECH_CITIES[cityName];
    if (cityCoords && mapRef.current) {
      mapRef.current.setView(cityCoords, 14, { animate: true });
    }
  };

  const handleClearCoords = () => {
    onCoordsChange(null);
    setReverseAddressSuggestion(null);
  };

  return (
    <div className="space-y-2.5">
      {/* Search and Layer Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Address Search Bar */}
        <div className="relative flex-1">
          <div className="flex items-center gap-1.5">
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
                placeholder="Vyhledat adresu nebo firmu v mapě (např. Nádražní 12, Ostrava nebo ČEVAS)..."
                className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setSearchError(null);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={executeSearch}
              disabled={isSearching || searchQuery.trim().length < 3}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-50 transition shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Najít</span>
            </button>
          </div>

          {/* Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-[500] bg-white rounded-xl border border-slate-200 shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
              <div className="p-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                Nalezené lokace ({searchResults.length}):
              </div>
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectLocation(res)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-sky-50 transition flex items-start gap-2 group cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <span className="line-clamp-2 text-slate-700 font-medium group-hover:text-sky-900">
                    {res.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {searchError && (
            <p className="text-[11px] font-medium text-amber-800 mt-1 px-1">{searchError}</p>
          )}
        </div>

        {/* Layer Switcher (Letecká / Satelitní vs Běžná) */}
        <div className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5 shadow-2xs shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => switchLayer('hybrid')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeLayer === 'hybrid'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>🛰️</span>
            <span>Letecká / Satelitní</span>
          </button>
          <button
            type="button"
            onClick={() => switchLayer('roadmap')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeLayer === 'roadmap'
                ? 'bg-sky-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>🗺️</span>
            <span>Běžná mapa</span>
          </button>
        </div>
      </div>

      {/* Map Viewport Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-300/80 shadow-inner bg-slate-100">
        <div
          ref={containerRef}
          style={{ height: '260px', width: '100%' }}
          className="cursor-crosshair"
        />

        {/* Quick City Jump Bar on Map */}
        <div className="absolute top-2 right-2 z-[400] bg-white/95 backdrop-blur-xs px-2 py-1 rounded-xl shadow-md border border-slate-200 flex items-center gap-1.5 text-[11px]">
          <Compass className="w-3.5 h-3.5 text-sky-700" />
          <span className="text-slate-500 font-medium">Město:</span>
          <select
            onChange={(e) => handleJumpCity(e.target.value)}
            defaultValue=""
            className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
          >
            <option value="" disabled>
              Rychlý skok...
            </option>
            {Object.keys(CZECH_CITIES).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Bottom Hint Banner */}
        <div className="absolute bottom-2 left-2 z-[400] bg-black/70 text-white text-[10px] font-medium px-2.5 py-1 rounded-lg backdrop-blur-xs pointer-events-none flex items-center gap-1.5">
          <span>💡</span>
          <span>Kliknutím do mapy nebo tažením špendlíku určíte přesné GPS místo výjezdu</span>
        </div>
      </div>

      {/* Coordinates Status Bar & Reverse Geocode Suggestion */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2">
          {coords && coords.latitude && coords.longitude ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-300">
              <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>GPS:</span>
              <span className="font-mono font-bold">
                {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
              </span>
              <button
                type="button"
                onClick={handleClearCoords}
                title="Odstranit GPS souřadnice"
                className="ml-1 text-emerald-800 hover:text-red-600 transition p-0.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>GPS není zvolena (volitelné – neblokuje vytvoření zakázky)</span>
            </div>
          )}
        </div>

        {/* Reverse geocode suggestion button */}
        {reverseAddressSuggestion && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-slate-500 font-medium hidden md:inline">Zjištěná adresa:</span>
            <button
              type="button"
              onClick={() => onAddressChange(reverseAddressSuggestion)}
              className="text-sky-700 hover:text-sky-900 font-bold underline cursor-pointer truncate max-w-xs text-left"
              title="Vložit tuto adresu do formuláře zakázky"
            >
              {reverseAddressSuggestion}
            </button>
          </div>
        )}

        {isReverseGeocoding && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Zjišťuji adresu...</span>
          </div>
        )}
      </div>
    </div>
  );
}
