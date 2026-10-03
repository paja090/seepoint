'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import { OSTRAVA_RESTRICTED_ZONES_GEOJSON } from '@/lib/maps/ostrava-restricted-zones-data';

export type SurveyPointItem = {
  id: string;
  surveyId: string;
  surfaceType: 'ACKO' | 'TOWER' | 'BANNER' | 'PLOT' | 'OTHER';
  status: 'NEW' | 'REVIEWED' | 'PARCEL_FOUND' | 'OWNER_FOUND' | 'CONTACT_FOUND' | 'INTERESTING' | 'REJECTED' | 'CONVERTED';
  latitude: number;
  longitude: number;
  gpsAccuracyMeters?: number | null;
  address?: string | null;
  note?: string | null;
  createdAt: string | Date;
  createdBy: { name: string };
  photos: Array<{ id: string; url: string; sortOrder: number }>;
  parcelData?: {
    parcelNumber?: string | null;
    cadastralArea?: string | null;
    municipality?: string | null;
    confidence: string;
    sourceUrl?: string | null;
  } | null;
  ownerData?: {
    ownerName?: string | null;
    ownerType?: string | null;
  } | null;
  contactData?: {
    company?: string | null;
    contactPerson?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  aiAnalysis?: {
    status: string;
    suggestedType?: string | null;
    isUsable?: boolean | null;
    locationDesc?: string | null;
    visibility?: string | null;
    orientation?: string | null;
    surroundings?: string | null;
    obstacles?: string | null;
    placementChar?: string | null;
    errorMessage?: string | null;
    confirmedAt?: string | Date | null;
  } | null;
};

const TYPE_COLORS: Record<string, string> = {
  ACKO: '#3b82f6', // modrá
  TOWER: '#8b5cf6', // fialová
  BANNER: '#06b6d4', // tyrkysová
  PLOT: '#f59e0b', // jantarová
  OTHER: '#64748b', // šedá
};

const TYPE_LABELS: Record<string, string> = {
  ACKO: 'Ačko',
  TOWER: 'Tower',
  BANNER: 'Banner',
  PLOT: 'Plot',
  OTHER: 'Ostatní',
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nový',
  REVIEWED: 'Zkontrolováno',
  PARCEL_FOUND: 'Parcela nalezena',
  OWNER_FOUND: 'Vlastník nalezen',
  CONTACT_FOUND: 'Kontakt nalezen',
  INTERESTING: 'Zajímavý',
  REJECTED: 'Zamítnutý',
  CONVERTED: 'Převedeno',
};

export function FieldSurveyMapView({
  points,
  selectedPointId,
  onSelectPoint,
}: {
  points: SurveyPointItem[];
  selectedPointId?: string;
  onSelectPoint: (point: SurveyPointItem) => void;
}) {
  const [mapReady, setMapReady] = useState(false);
  const [showRestrictedZones, setShowRestrictedZones] = useState(false);
  const hasOstravaPoints = points.some(point =>
    point.parcelData?.municipality?.trim().toLocaleLowerCase('cs') === 'ostrava' ||
    /\bostrava\b/i.test(point.address ?? '')
  );
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const restrictedLayerRef = useRef<LayerGroup | null>(null);

  const filteredPoints = useMemo(() => {
    const q = query.trim().toLowerCase();
    return points.filter((p) => {
      if (filterType !== 'ALL' && p.surfaceType !== filterType) return false;
      if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
      if (q) {
        const text = [
          p.address,
          p.note,
          p.createdBy?.name,
          p.parcelData?.parcelNumber,
          p.parcelData?.cadastralArea,
          p.ownerData?.ownerName,
          p.contactData?.company,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [points, filterType, filterStatus, query]);

  // Inicializace Leaflet mapy
  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const L = await import('leaflet');
      if (cancelled || !mapElementRef.current || mapRef.current) return;

      const initialCenter: [number, number] = points[0]
        ? [points[0].latitude, points[0].longitude]
        : [20, 0];

      const map = L.map(mapElementRef.current, {
        center: initialCenter,
        zoom: points.length ? 13 : 2,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const restrictedLayer = L.layerGroup();
      const markerLayer = L.layerGroup().addTo(map);

      // Načtení ostravských zón omezení
      try {
        L.geoJSON(OSTRAVA_RESTRICTED_ZONES_GEOJSON, {
          style: {
            color: '#dc2626',
            fillColor: '#ef4444',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '6, 6',
          },
          onEachFeature: (feature: { properties?: { CISLO?: string; ID?: string } }, layer: import('leaflet').Layer) => {
            const num = feature.properties?.CISLO || feature.properties?.ID || '';
            layer.bindTooltip(`Zóna zákazu reklamy č. ${num}`, { sticky: true });
          },
        }).addTo(restrictedLayer);
      } catch {
        // Ignorujeme případnou chybu geometrie
      }

      mapRef.current = map;
      markerLayerRef.current = markerLayer;
      restrictedLayerRef.current = restrictedLayer;
      setMapReady(true);
    }

    void initMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      restrictedLayerRef.current = null;
    };
  }, []);

  // Toggling zón zákazu reklamy
  useEffect(() => {
    const map = mapRef.current;
    const restrictedLayer = restrictedLayerRef.current;
    if (!map || !restrictedLayer) return;
    if (showRestrictedZones && hasOstravaPoints) {
      if (!map.hasLayer(restrictedLayer)) map.addLayer(restrictedLayer);
    } else {
      if (map.hasLayer(restrictedLayer)) map.removeLayer(restrictedLayer);
    }
  }, [showRestrictedZones, hasOstravaPoints, mapReady]);

  // Vykreslení markerů pro body průzkumu
  useEffect(() => {
    if (!mapReady || !mapRef.current || !markerLayerRef.current) return;
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    layer.clearLayers();

    import('leaflet').then((L) => {
      const bounds = L.latLngBounds([]);

      filteredPoints.forEach((point) => {
        const isSelected = point.id === selectedPointId;
        const color = TYPE_COLORS[point.surfaceType] ?? '#64748b';

        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: isSelected ? 12 : 9,
          color: isSelected ? '#0f172a' : '#ffffff',
          weight: isSelected ? 3 : 2,
          fillColor: color,
          fillOpacity: 0.95,
        });

        const tooltip = document.createElement('div');
        tooltip.className = 'text-xs space-y-1 p-1';
        tooltip.innerHTML = `
          <strong>${TYPE_LABELS[point.surfaceType] ?? point.surfaceType}</strong> · ${STATUS_LABELS[point.status] ?? point.status}
          ${point.address ? `<div class="text-slate-600">${point.address}</div>` : ''}
          ${point.parcelData?.parcelNumber ? `<div class="text-sky-700">Parcela: ${point.parcelData.parcelNumber}</div>` : ''}
          <div class="text-slate-400 font-mono">${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}</div>
        `;

        marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -8] });
        marker.on('click', () => onSelectPoint(point));
        marker.addTo(layer);

        bounds.extend([point.latitude, point.longitude]);
      });

      if (bounds.isValid() && filteredPoints.length > 0 && !selectedPointId) {
        map.fitBounds(bounds.pad(0.15), { maxZoom: 16 });
      }
    });
  }, [filteredPoints, mapReady, selectedPointId, onSelectPoint]);

  // Zaměření na vybraný bod
  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedPointId) return;
    const selected = points.find((p) => p.id === selectedPointId);
    if (selected) {
      mapRef.current.flyTo([selected.latitude, selected.longitude], 16, { duration: 0.6 });
    }
  }, [selectedPointId, points, mapReady]);

  return (
    <div className="space-y-3">
      {/* Ovládací panel / filtry */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm text-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            type="search"
            placeholder="Hledat v bodech, parcelách, adresách…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input min-w-48 flex-1"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input"
          >
            <option value="ALL">Všechny typy</option>
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input"
          >
            <option value="ALL">Všechny stavy</option>
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {hasOstravaPoints && <button
            type="button"
            onClick={() => setShowRestrictedZones((prev) => !prev)}
            aria-pressed={showRestrictedZones}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold border transition text-xs ${
              showRestrictedZones
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
            }`}
            title="Přepnout zobrazení zón zákazu reklamy (Ostrava)"
          >
            <span className={`h-2 w-2 rounded-full ${showRestrictedZones ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`} />
            <span>Zákaz reklamy Ostrava (12 zón)</span>
          </button>}
          <span className="text-xs font-semibold text-slate-600 px-2">
            {filteredPoints.length} {filteredPoints.length === 1 ? 'bod' : filteredPoints.length <= 4 ? 'body' : 'bodů'}
          </span>
        </div>
      </div>

      {/* Legenda typů */}
      <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">Legenda:</span>
        {Object.entries(TYPE_LABELS).map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COLORS[key] }} />
            {label}
          </span>
        ))}
      </div>

      {/* Samotná mapa */}
      <div className="relative min-h-[500px] h-[calc(100vh-20rem)] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
        <div ref={mapElementRef} className="h-full w-full" role="application" aria-label="Mapa průzkumu ploch" />
        {!mapReady && (
          <div className="absolute inset-0 grid place-items-center bg-slate-100 text-sm text-slate-500 z-10">
            Načítám mapu průzkumu…
          </div>
        )}
      </div>
    </div>
  );
}
