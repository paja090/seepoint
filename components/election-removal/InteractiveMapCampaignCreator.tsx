'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Map as LeafletMap, Marker, Polyline, TileLayer, LayerGroup } from 'leaflet';
import {
  MapPin,
  Calendar,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Search,
  RotateCcw,
  Navigation,
  Truck,
  Building2,
  Maximize2,
  Loader2,
  X,
  MoveUp,
  MoveDown,
} from 'lucide-react';
import {
  DEFAULT_MEDIA_SERVICE_MINUTES,
  ELECTION_REMOVAL_MEDIA_LABELS,
  type ElectionRemovalMediaType,
  type ElectionRemovalOperationType,
} from '@/lib/election-removal/constants';

interface PlannedPointItem {
  tempId: string;
  label: string;
  latitude: number;
  longitude: number;
  mediaType: ElectionRemovalMediaType;
  operationType: ElectionRemovalOperationType;
  relocationDestination?: string;
  quantity: number;
  serviceMinutes: number;
  note?: string;
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
  'Jihlava': [49.39611, 15.59125],
};

const GOOGLE_LAYERS = {
  roadmap: {
    url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    label: 'Google Běžná',
  },
  hybrid: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    label: 'Satelitní',
  },
  terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    label: 'Terénní',
  },
};

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function InteractiveMapCampaignCreator() {
  const router = useRouter();

  // Campaign info
  const [campaignName, setCampaignName] = useState('Přesuny a demontáže nosičů');
  const [targetDate, setTargetDate] = useState('');
  const [description, setDescription] = useState('');
  const [depotName, setDepotName] = useState('Centrální sklad');

  // List of planned points
  const [points, setPoints] = useState<PlannedPointItem[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const polylineRef = useRef<Polyline | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'hybrid' | 'terrain'>('roadmap');

  // Map click & add point modal
  const [isClickAddActive, setIsClickAddActive] = useState(true);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form for adding a new point
  const [newLabel, setNewLabel] = useState('');
  const [newMediaType, setNewMediaType] = useState<ElectionRemovalMediaType>('ACKO');
  const [newOperationType, setNewOperationType] = useState<ElectionRemovalOperationType>('RELOCATION');
  const [newRelocationDest, setNewRelocationDest] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newServiceMinutes, setNewServiceMinutes] = useState(15);
  const [newNote, setNewNote] = useState('');

  // Search address state
  const [searchAddress, setSearchAddress] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Calculate total route distance
  const routeDistanceKm = useMemo(() => {
    if (points.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < points.length - 1; i++) {
      dist += haversineDistanceKm(
        points[i].latitude,
        points[i].longitude,
        points[i + 1].latitude,
        points[i + 1].longitude
      );
    }
    // Road factor approx 1.3
    return Math.round(dist * 1.3 * 10) / 10;
  }, [points]);

  const totalServiceMinutes = useMemo(() => {
    return points.reduce((acc, p) => acc + p.serviceMinutes * p.quantity, 0);
  }, [points]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let isMounted = true;

    async function initMap() {
      const L = await import('leaflet');
      if (!isMounted || !mapContainerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [49.8175, 15.473], // Czech Republic center
        zoom: 8,
        zoomControl: true,
        attributionControl: false,
      });

      const initialLayer = L.tileLayer(GOOGLE_LAYERS[mapType].url, {
        maxZoom: 20,
        subdomains: ['0', '1', '2', '3'],
        attribution: '© Google Maps',
      }).addTo(map);

      tileLayerRef.current = initialLayer;
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;
      mapRef.current = map;

      // Map click handler to add points
      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setPendingCoords({ lat, lng });
        setNewLabel(`Bod ${points.length + 1}`);
        setModalOpen(true);
      });
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map type
  const handleMapTypeChange = async (type: 'roadmap' | 'hybrid' | 'terrain') => {
    setMapType(type);
    if (!mapRef.current || !tileLayerRef.current) return;
    const L = await import('leaflet');
    mapRef.current.removeLayer(tileLayerRef.current);
    const newLayer = L.tileLayer(GOOGLE_LAYERS[type].url, {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: '© Google Maps',
    }).addTo(mapRef.current);
    newLayer.bringToBack();
    tileLayerRef.current = newLayer;
  };

  // Redraw markers and route line whenever points change
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    let isMounted = true;
    async function updateMarkers() {
      const L = await import('leaflet');
      if (!isMounted || !mapRef.current || !markersLayerRef.current) return;

      markersLayerRef.current.clearLayers();

      if (polylineRef.current) {
        mapRef.current.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }

      const latLngs: [number, number][] = [];

      points.forEach((point, index) => {
        const isSelected = selectedPointId === point.tempId;
        const color =
          point.operationType === 'RELOCATION'
            ? '#0284c7' // sky blue
            : point.operationType === 'BANNER_CHANGE'
            ? '#d97706' // amber
            : '#7c3aed'; // purple for warehouse return

        const iconHtml = `
          <div style="position: relative; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="
              background: ${color};
              color: white;
              font-weight: 800;
              font-size: 11px;
              width: 26px;
              height: 26px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              border: ${isSelected ? '3px solid #fef08a' : '2px solid white'};
              box-shadow: 0 4px 8px rgba(0,0,0,0.35);
            ">
              ${index + 1}
            </div>
            <div style="
              background: rgba(15, 23, 42, 0.85);
              color: white;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              font-weight: 600;
              white-space: nowrap;
              margin-top: 2px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.25);
            ">
              ${point.label}
            </div>
          </div>
        `;

        const icon = L.divIcon({
          className: 'interactive-point-pin',
          html: iconHtml,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([point.latitude, point.longitude], { icon });
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          setSelectedPointId(point.tempId);
        });

        markersLayerRef.current!.addLayer(marker);
        latLngs.push([point.latitude, point.longitude]);
      });

      // Draw route connecting line between points
      if (latLngs.length > 1) {
        polylineRef.current = L.polyline(latLngs, {
          color: '#0284c7',
          weight: 3.5,
          opacity: 0.8,
          dashArray: '6, 8',
        }).addTo(mapRef.current);
      }
    }

    updateMarkers();

    return () => {
      isMounted = false;
    };
  }, [points, selectedPointId]);

  // Jump to city
  const handleJumpToCity = (cityName: string) => {
    const coords = CZECH_CITIES[cityName];
    if (coords && mapRef.current) {
      mapRef.current.flyTo(coords, 13, { duration: 1.2 });
    }
  };

  // Address geocoding search
  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchAddress.trim() || !mapRef.current) return;
    setIsSearching(true);

    try {
      const q = encodeURIComponent(`${searchAddress.trim()}, Česká republika`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`, {
        headers: { 'Accept-Language': 'cs' },
      });
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        mapRef.current.flyTo([lat, lon], 14, { duration: 1.2 });
      } else {
        alert('Lokalita nebyla nalezena. Zkuste upřesnit název města nebo ulice.');
      }
    } catch {
      alert('Chyba při vyhledávání adresy.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle adding confirmed point
  const handleConfirmAddPoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCoords) return;

    const newPoint: PlannedPointItem = {
      tempId: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: newLabel.trim() || `Bod ${points.length + 1}`,
      latitude: pendingCoords.lat,
      longitude: pendingCoords.lng,
      mediaType: newMediaType,
      operationType: newOperationType,
      relocationDestination:
        newOperationType === 'RELOCATION' ? newRelocationDest.trim() || undefined : undefined,
      quantity: Math.max(1, newQuantity),
      serviceMinutes: newServiceMinutes,
      note: newNote.trim() || undefined,
    };

    setPoints((prev) => [...prev, newPoint]);
    setModalOpen(false);
    setPendingCoords(null);
    setNewNote('');
    setNewRelocationDest('');
  };

  // Reordering points
  const movePoint = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= points.length) return;

    const updated = [...points];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setPoints(updated);
  };

  const removePoint = (tempId: string) => {
    setPoints((prev) => prev.filter((p) => p.tempId !== tempId));
    if (selectedPointId === tempId) setSelectedPointId(null);
  };

  // Submit and create campaign
  const handleSaveCampaign = async () => {
    if (!campaignName.trim()) {
      alert('Zadejte název akce.');
      return;
    }
    if (points.length === 0) {
      alert('Přidejte do mapy alespoň jeden bod přesunu nebo deinstalace.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const payload = {
        name: campaignName.trim(),
        description: description.trim() || null,
        targetDate: targetDate || null,
        kmlFileName: null, // created interactively on map
        points: points.map((p, idx) => ({
          name: p.label,
          description: p.note
            ? `[Pořadí: ${idx + 1}] ${p.note}`
            : `[Pořadí: ${idx + 1}]`,
          layerName:
            p.operationType === 'RELOCATION'
              ? 'Přesun na jiné místo'
              : p.operationType === 'BANNER_CHANGE'
              ? 'Výměna plachty'
              : 'Svoz na sklad',
          mediaType: p.mediaType,
          operationType: p.operationType,
          relocationDestination: p.relocationDestination || null,
          latitude: p.latitude,
          longitude: p.longitude,
          quantity: p.quantity,
          serviceMinutes: p.serviceMinutes,
        })),
      };

      const res = await fetch('/api/election-removal/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se vytvořit akční kampaň.');
      }

      // Redirect to campaign detail or plan
      router.push(`/election-removal/${data.campaign.id}`);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Chyba při ukládání akce.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Configuration Card */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-sky-600" />
              Základní informace o plánovaném výjezdu
            </h2>
            <p className="text-xs text-slate-500">
              Pojmenujte akci a klikáním do mapy naplánujte jednotlivé zastávky pro posádky.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              📍 {points.length} bodů v trase
            </span>
            {routeDistanceKm > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                🚗 cca {routeDistanceKm} km
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Název akce / výjezdu *
            </label>
            <input
              type="text"
              required
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="např. Přesun konstrukcí a výměna plachet – Praha & Střední Čechy"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Plánovaný termín
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              Název výchozího skladu / depa
            </label>
            <input
              type="text"
              value={depotName}
              onChange={(e) => setDepotName(e.target.value)}
              placeholder="např. Centrální sklad Praha - Horní Počernice"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Poznámka / Instrukce pro dispečink
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="např. Nejprve naložit náhradní plachty na skladě a vyrazit směrem na Brno."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Big Google Map & Control Toolbar */}
      <div className="card overflow-hidden border border-slate-200 shadow-sm">
        {/* Map Header Toolbar */}
        <div className="p-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
          {/* Quick city jump */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
              <Navigation className="w-3.5 h-3.5 text-sky-400" />
              Skok na město:
            </span>
            {Object.keys(CZECH_CITIES).slice(0, 7).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleJumpToCity(city)}
                className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition shrink-0"
              >
                {city}
              </button>
            ))}
          </div>

          {/* Map Layer switcher & Add mode info */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 text-xs font-medium">
              {(['roadmap', 'hybrid', 'terrain'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleMapTypeChange(type)}
                  className={`px-2 py-1 rounded-md transition text-[11px] ${
                    mapType === type ? 'bg-sky-600 text-white font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {GOOGLE_LAYERS[type].label}
                </button>
              ))}
            </div>

            <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Kliknutím do mapy přidáte bod</span>
            </div>
          </div>
        </div>

        {/* Address Search Bar directly above map */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <form onSubmit={handleAddressSearch} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                placeholder="Vyhledat adresu v ČR (např. Vodičkova 30, Praha)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-hidden focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition disabled:opacity-50"
            >
              {isSearching ? 'Hledám…' : 'Najít'}
            </button>
          </form>

          <div className="text-xs text-slate-500 flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-sky-600 inline-block"></span> Převoz na jiné místo
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span> Odvoz na sklad
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-amber-600 inline-block"></span> Výměna plachty
            </span>
          </div>
        </div>

        {/* Big Leaflet Container */}
        <div
          ref={mapContainerRef}
          style={{ height: '560px', width: '100%', cursor: 'crosshair' }}
          className="relative bg-slate-100"
        />

        {/* Bottom map summary ribbon */}
        <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800">
              Celkem naplánováno: {points.length} zastávek
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">
              Odhadovaná trasa přejezdů: <strong>{routeDistanceKm} km</strong>
            </span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">
              Čas servisu: <strong>{Math.floor(totalServiceMinutes / 60)} h {totalServiceMinutes % 60} min</strong>
            </span>
          </div>

          <div className="text-slate-400 text-[11px]">
            Tip: Klikněte kamkoli do mapy pro přidání nového bodu. Pořadí bodů můžete měnit v seznamu níže.
          </div>
        </div>
      </div>

      {/* Planned Points List & Order Reordering */}
      {points.length > 0 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" />
                Seznam zastávek a pořadí přejezdu ({points.length})
              </h3>
              <p className="text-xs text-slate-500">
                Trasa proběhne od 1. bodu po poslední. Pořadí můžete posouvat šipkami nahoru a dolů.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm('Opravdu chcete vymazat všechny naplánované body z mapy?')) {
                  setPoints([]);
                }
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Vymazat všechny body
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            {points.map((pt, idx) => (
              <div
                key={pt.tempId}
                className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                  selectedPointId === pt.tempId ? 'bg-sky-50/70 border-l-4 border-l-sky-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">{pt.label}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {ELECTION_REMOVAL_MEDIA_LABELS[pt.mediaType] || pt.mediaType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          pt.operationType === 'RELOCATION'
                            ? 'bg-sky-100 text-sky-800'
                            : pt.operationType === 'BANNER_CHANGE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {pt.operationType === 'RELOCATION'
                          ? 'Přesun na jiné místo'
                          : pt.operationType === 'BANNER_CHANGE'
                          ? 'Výměna plachty'
                          : 'Odvoz na sklad'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3">
                      <span>GPS: {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}</span>
                      <span>Počet: {pt.quantity} ks</span>
                      <span>Čas: {pt.serviceMinutes} min</span>
                      {pt.relocationDestination && (
                        <span className="text-sky-700 font-semibold">
                          Cíl: {pt.relocationDestination}
                        </span>
                      )}
                    </div>

                    {pt.note && (
                      <p className="text-[11px] text-slate-600 italic mt-0.5">
                        Poznámka: {pt.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => movePoint(idx, 'up')}
                    title="Posunout dříve v trase"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === points.length - 1}
                    onClick={() => movePoint(idx, 'down')}
                    title="Posunout později v trase"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePoint(pt.tempId)}
                    title="Odstranit bod"
                    className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Error */}
      {saveError && (
        <div className="p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 text-xs font-semibold">
          ⚠️ {saveError}
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="card p-5 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            Jste připraveni uložit akci a spustit optimalizaci výjezdů?
          </h4>
          <p className="text-xs text-slate-600">
            Po uložení budete přesměrováni na dispečink, kde systém rozdělí body do tras pro jednotlivé posádky.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveCampaign}
          disabled={isSaving || points.length === 0}
          className="btn bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md inline-flex items-center gap-2 disabled:opacity-50 transition"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Ukládám akci a body…</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Vytvořit akci s {points.length} body a přejít k trasám &rarr;</span>
            </>
          )}
        </button>
      </div>

      {/* Modal: Add Point at Clicked Coordinates */}
      {modalOpen && pendingCoords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Přidat bod na vybrané místo v mapě
                  </h3>
                  <p className="text-xs text-slate-500">
                    GPS: {pendingCoords.lat.toFixed(5)}, {pendingCoords.lng.toFixed(5)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddPoint} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Označení bodu / nosiče *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="např. Billboard u kruhového objezdu, Áčko před prodejnou..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Typ nosiče / média
                  </label>
                  <select
                    value={newMediaType}
                    onChange={(e) => {
                      const type = e.target.value as ElectionRemovalMediaType;
                      setNewMediaType(type);
                      setNewServiceMinutes(DEFAULT_MEDIA_SERVICE_MINUTES[type] || 15);
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden bg-white"
                  >
                    {Object.entries(ELECTION_REMOVAL_MEDIA_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operace se zařízením
                  </label>
                  <select
                    value={newOperationType}
                    onChange={(e) =>
                      setNewOperationType(e.target.value as ElectionRemovalOperationType)
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden bg-white font-bold"
                  >
                    <option value="RELOCATION">🔄 Převoz na jiné místo</option>
                    <option value="FULL_REMOVAL">📦 Odvoz na sklad</option>
                    <option value="BANNER_CHANGE">🔨 Výměna plachty (zůstává na místě)</option>
                  </select>
                </div>
              </div>

              {newOperationType === 'RELOCATION' && (
                <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/50 space-y-1">
                  <label className="block text-xs font-bold text-sky-900">
                    Cílové stanoviště přesunu (adresa nebo název nového místa)
                  </label>
                  <input
                    type="text"
                    value={newRelocationDest}
                    onChange={(e) => setNewRelocationDest(e.target.value)}
                    placeholder="např. Praha 4, ulice Na Strži / další křižovatka"
                    className="w-full rounded-lg border border-sky-300 px-2.5 py-1.5 text-xs text-slate-900 bg-white focus:outline-hidden"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Počet kusů
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Servisní čas (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newServiceMinutes}
                    onChange={(e) => setNewServiceMinutes(parseInt(e.target.value) || 15)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Poznámka / Instrukce pro montéra
                </label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="např. Přístup ze dvora, naložit na přívěsný vozík"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-xs font-bold text-white shadow-xs"
                >
                  Přidat do trasy jako bod {points.length + 1}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
