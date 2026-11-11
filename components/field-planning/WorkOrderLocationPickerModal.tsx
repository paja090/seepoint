'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as LeafletMap, Marker, DivIcon } from 'leaflet';
import {
  MapPin,
  Search,
  Loader2,
  X,
  ExternalLink,
  Check,
  Trash2,
  Navigation,
} from 'lucide-react';

export type WorkOrderLocationPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderTitle: string;
  locationNote?: string | null;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialLocationAddress?: string | null;
  onLocationSaved?: (result: {
    latitude: number | null;
    longitude: number | null;
    address?: string | null;
  }) => void;
};

const CZECH_REGIONS: Record<string, [number, number]> = {
  'Praha': [50.08804, 14.42076],
  'Brno': [49.19506, 16.60683],
  'Ostrava': [49.83465, 18.28204],
  'Plzeň': [49.74747, 13.37759],
  'Liberec': [50.76711, 15.05619],
  'Olomouc': [49.59378, 17.25088],
  'České Budějovice': [48.97447, 14.47434],
  'Hradec Králové': [50.20923, 15.83277],
  'Pardubice': [50.03431, 15.78120],
  'Ústí n. L.': [50.66070, 14.03227],
  'Zlín': [49.22442, 17.66275],
};

function guessCenterFromNote(note?: string | null): [number, number] | null {
  if (!note) return null;
  const lower = note.toLowerCase();
  for (const [city, coords] of Object.entries(CZECH_REGIONS)) {
    if (lower.includes(city.toLowerCase())) return coords;
  }
  return null;
}

interface GeocodeItem {
  latitude: number;
  longitude: number;
  label: string;
}

export function WorkOrderLocationPickerModal({
  isOpen,
  onClose,
  orderId,
  orderTitle,
  locationNote,
  initialLatitude,
  initialLongitude,
  initialLocationAddress,
  onLocationSaved,
}: WorkOrderLocationPickerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const lRef = useRef<typeof import('leaflet') | null>(null);
  const pinIconRef = useRef<DivIcon | null>(null);

  const [activeCoords, setActiveCoords] = useState<{ lat: number; lng: number } | null>(
    initialLatitude && initialLongitude
      ? { lat: initialLatitude, lng: initialLongitude }
      : null
  );
  const [activeAddress, setActiveAddress] = useState<string | null>(
    initialLocationAddress || null
  );

  const [searchQuery, setSearchQuery] = useState(locationNote || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodeItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasExistingGps = Boolean(initialLatitude && initialLongitude);

  // Sync coords when opened with new props
  useEffect(() => {
    if (isOpen) {
      if (initialLatitude && initialLongitude) {
        setActiveCoords({ lat: initialLatitude, lng: initialLongitude });
      } else {
        setActiveCoords(null);
      }
      setActiveAddress(initialLocationAddress || null);
      setSearchQuery(locationNote || '');
      setSearchResults([]);
      setSearchError(null);
      setSaveError(null);
    }
  }, [isOpen, initialLatitude, initialLongitude, initialLocationAddress, locationNote]);

  // Reverse geocoding helper
  const performReverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (!res.ok) return;
      const data = (await res.json()) as { address?: string | null };
      if (data?.address) {
        setActiveAddress(data.address);
      }
    } catch {
      // Best-effort reverse geocoding
    }
  }, []);

  // Initialize Leaflet map
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    let isMounted = true;

    async function initMap() {
      const L = await import('leaflet');
      if (!isMounted || !containerRef.current) return;
      lRef.current = L;

      // Clean up previous instance
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const container = containerRef.current as unknown as { _leaflet_id?: unknown };
      if (container._leaflet_id) {
        container._leaflet_id = null;
      }

      // Determine initial center and zoom
      let center: [number, number] = [49.8175, 15.4730]; // Czech Republic center
      let zoom = 8;

      if (initialLatitude && initialLongitude) {
        center = [initialLatitude, initialLongitude];
        zoom = 15;
      } else {
        const guessed = guessCenterFromNote(locationNote);
        if (guessed) {
          center = guessed;
          zoom = 13;
        }
      }

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
        attribution: '© Google Maps',
      }).addTo(map);

      // Custom high-contrast marker icon
      const pinIcon = L.divIcon({
        className: 'seepoint-work-pin',
        html: `
          <div style="position: relative; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: grab;">
            <div style="background: #0284c7; color: white; padding: 4px 10px; border-radius: 9999px; font-weight: 800; font-size: 11px; box-shadow: 0 4px 8px -1px rgba(0,0,0,0.35); border: 2px solid white; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
              <span>📍 Místo realizace</span>
            </div>
            <div style="width: 2px; height: 10px; background: #0284c7;"></div>
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #0284c7; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      pinIconRef.current = pinIcon;

      // Add marker if coords already exist
      let marker: Marker | null = null;
      if (initialLatitude && initialLongitude) {
        marker = L.marker([initialLatitude, initialLongitude], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        marker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          setActiveCoords({ lat: latlng.lat, lng: latlng.lng });
          void performReverseGeocode(latlng.lat, latlng.lng);
        });
      }

      // Handle clicking anywhere on the map
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setActiveCoords({ lat, lng });

        if (!markerRef.current) {
          const newMarker = L.marker([lat, lng], {
            icon: pinIcon,
            draggable: true,
          }).addTo(map);

          newMarker.on('dragend', (dragEvt) => {
            const dragLatLng = dragEvt.target.getLatLng();
            setActiveCoords({ lat: dragLatLng.lat, lng: dragLatLng.lng });
            void performReverseGeocode(dragLatLng.lat, dragLatLng.lng);
          });
          markerRef.current = newMarker;
        } else {
          markerRef.current.setLatLng([lat, lng]);
        }

        void performReverseGeocode(lat, lng);
      });

      markerRef.current = marker;
      mapRef.current = map;

      // Ensure proper tile sizing after mount
      setTimeout(() => {
        if (isMounted && mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 200);
    }

    void initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isOpen, initialLatitude, initialLongitude, locationNote, performReverseGeocode]);

  // Execute address search via /api/geocode
  const executeSearch = useCallback(async (queryToRun?: string) => {
    const q = (queryToRun ?? searchQuery).trim();
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
        // Automatically select first result
        const first = data[0];
        setActiveCoords({ lat: first.latitude, lng: first.longitude });
        setActiveAddress(first.label);

        if (mapRef.current) {
          mapRef.current.setView([first.latitude, first.longitude], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([first.latitude, first.longitude]);
          } else if (lRef.current && pinIconRef.current) {
            const newMarker = lRef.current
              .marker([first.latitude, first.longitude], {
                icon: pinIconRef.current,
                draggable: true,
              })
              .addTo(mapRef.current);

            newMarker.on('dragend', (dragEvt) => {
              const dragLatLng = dragEvt.target.getLatLng();
              setActiveCoords({ lat: dragLatLng.lat, lng: dragLatLng.lng });
              void performReverseGeocode(dragLatLng.lat, dragLatLng.lng);
            });
            markerRef.current = newMarker;
          }
        }
      } else {
        setSearchError('Nebylo nalezeno žádné místo odpovídající hledání.');
      }
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : 'Vyhledávání adresy selhalo.'
      );
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, performReverseGeocode]);

  const handleSelectLocation = (result: GeocodeItem) => {
    const { latitude: lat, longitude: lng, label } = result;
    setActiveCoords({ lat, lng });
    setActiveAddress(label);
    setSearchResults([]);
    setSearchError(null);

    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 16);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else if (lRef.current && pinIconRef.current) {
        const newMarker = lRef.current
          .marker([lat, lng], {
            icon: pinIconRef.current,
            draggable: true,
          })
          .addTo(mapRef.current);

        newMarker.on('dragend', (dragEvt) => {
          const dragLatLng = dragEvt.target.getLatLng();
          setActiveCoords({ lat: dragLatLng.lat, lng: dragLatLng.lng });
          void performReverseGeocode(dragLatLng.lat, dragLatLng.lng);
        });
        markerRef.current = newMarker;
      }
    }
  };

  const handleJumpCity = (cityName: string) => {
    const coords = CZECH_REGIONS[cityName];
    if (coords && mapRef.current) {
      mapRef.current.setView(coords, 13);
    }
  };

  // Save coordinates to backend
  const handleSave = async () => {
    if (!activeCoords) {
      setSaveError('Nejdříve klikněte do mapy pro umístění GPS špendlíku.');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/work-orders/${orderId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: activeCoords.lat,
          longitude: activeCoords.lng,
          locationAddress: activeAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se uložit GPS polohu.');
      }

      if (onLocationSaved) {
        onLocationSaved({
          latitude: activeCoords.lat,
          longitude: activeCoords.lng,
          address: activeAddress,
        });
      }
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Uložení GPS polohy selhalo.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Clear GPS coordinates
  const handleClearGps = async () => {
    if (!window.confirm('Opravdu chcete odebrat GPS souřadnice z této zakázky? Dispečink ji bez nich nebude moci zařadit do automatické trasy.')) {
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/work-orders/${orderId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearGps: true }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se odstranit GPS polohu.');
      }

      if (onLocationSaved) {
        onLocationSaved({
          latitude: null,
          longitude: null,
          address: null,
        });
      }
      onClose();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Odstranění GPS polohy selhalo.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gps-modal-title"
    >
      <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs shrink-0">
              <Navigation size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="gps-modal-title" className="text-base sm:text-lg font-black text-slate-900 truncate">
                Vybrat GPS polohu v mapě pro dispečink
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate">
                Zakázka: <strong className="text-slate-700">{orderTitle}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition shrink-0"
            aria-label="Zavřít"
          >
            <X size={20} />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
          {/* Quick Note Chip if locationNote is available */}
          {locationNote && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-950">
              <div className="flex items-center gap-2 truncate">
                <MapPin size={16} className="text-amber-600 shrink-0" />
                <span className="font-semibold text-slate-600">Zadání zakázky:</span>
                <span className="font-bold truncate">{locationNote}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery(locationNote);
                  void executeSearch(locationNote);
                }}
                disabled={isSearching}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 px-2.5 py-1 text-[11px] font-bold text-white transition shadow-2xs shrink-0"
              >
                {isSearching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                <span>Dohledat tuto adresu v mapě</span>
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
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
                      void executeSearch();
                    }
                  }}
                  placeholder="Vyhledat adresu (např. Rohanské nábřeží 678, Praha nebo Vídeňská 100, Brno)..."
                  className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-transparent shadow-2xs font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                      setSearchError(null);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title="Vymazat"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => void executeSearch()}
                disabled={isSearching || searchQuery.trim().length < 3}
                className="px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-50 transition shrink-0 flex items-center gap-1.5 shadow-2xs"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                <span>Hledat</span>
              </button>
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 z-[600] bg-white rounded-2xl border border-slate-200 shadow-2xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                <div className="p-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50">
                  Nalezené výsledky ({searchResults.length}) – klikněte pro přenesení do mapy:
                </div>
                {searchResults.map((res, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectLocation(res)}
                    className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-sky-50 transition flex items-start gap-2.5 group"
                  >
                    <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span className="line-clamp-2 text-slate-700 font-medium group-hover:text-sky-900 leading-snug">
                      {res.label}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {searchError && (
              <p className="text-xs font-semibold text-rose-700 mt-1 px-1">{searchError}</p>
            )}
          </div>

          {/* Map Container */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
            <div
              ref={containerRef}
              style={{ height: '360px', width: '100%' }}
              className="cursor-crosshair bg-slate-100"
            />

            {/* Quick city jump toolbar */}
            <div className="absolute top-2 right-2 z-[400] bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-xl shadow-md border border-slate-200 flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-semibold">Skok na město:</span>
              <select
                onChange={(e) => handleJumpCity(e.target.value)}
                defaultValue=""
                className="bg-transparent font-bold text-slate-800 focus:outline-none cursor-pointer text-xs"
              >
                <option value="" disabled>Vyberte město…</option>
                {Object.keys(CZECH_REGIONS).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Bottom map hint */}
            <div className="absolute bottom-2 left-2 z-[400] bg-slate-950/75 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg backdrop-blur-xs pointer-events-none shadow-xs">
              💡 Kliknutím do mapy nebo přetažením špendlíku zaměříte přesný bod montáže
            </div>
          </div>

          {/* Selected Coordinates & Address Card */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-600 text-white shrink-0">
                  <MapPin size={14} />
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-sky-950">
                  Vybraný GPS bod:
                </span>
              </div>

              {activeCoords ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-sky-900 bg-white border border-sky-300 px-2.5 py-1 rounded-lg shadow-2xs">
                    {activeCoords.lat.toFixed(6)}, {activeCoords.lng.toFixed(6)}
                  </span>
                  <a
                    href={`https://mapy.cz/zakladni?q=${activeCoords.lat},${activeCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 hover:underline"
                    title="Otevřít v Mapy.cz"
                  >
                    <span>Mapy.cz</span>
                    <ExternalLink size={12} />
                  </a>
                  <a
                    href={`https://www.google.com/maps?q=${activeCoords.lat},${activeCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 hover:underline"
                    title="Otevřít v Google Maps"
                  >
                    <span>Google</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              ) : (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                  ⚠️ Bod zatím není umístěn – klikněte do mapy
                </span>
              )}
            </div>

            {activeAddress && (
              <p className="text-xs text-slate-700 font-medium bg-white/80 border border-sky-100 p-2 rounded-xl truncate">
                <strong className="text-slate-900 font-bold">Lokalita:</strong> {activeAddress}
              </p>
            )}
          </div>

          {saveError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-900">
              {saveError}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 shrink-0">
          <div>
            {hasExistingGps && (
              <button
                type="button"
                onClick={() => void handleClearGps()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition shadow-2xs"
              >
                <Trash2 size={14} />
                <span>Odstranit GPS</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              Zrušit
            </button>

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !activeCoords}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:opacity-50 px-5 py-2 text-xs font-black text-white transition shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Ukládám…</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Uložit GPS pro dispečink</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
