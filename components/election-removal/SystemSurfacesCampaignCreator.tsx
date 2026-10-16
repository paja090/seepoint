'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Map as LeafletMap, LayerGroup, TileLayer } from 'leaflet';
import {
  Building2,
  Camera,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Layers,
  Loader2,
  MapPin,
  Route,
  Search,
  Sparkles,
  Square,
  Users,
} from 'lucide-react';
import type {
  SystemSurfaceCategory,
  SystemSurfaceItem,
} from '@/app/api/election-removal/system-surfaces/route';
import type { Operation } from '@/lib/election-removal/task-spec';

const CATEGORY_TABS: Array<{
  id: 'ALL' | SystemSurfaceCategory;
  label: string;
  badge: string;
}> = [
  { id: 'ALL', label: 'Všechny evidované plochy', badge: '🌐' },
  { id: 'NAVIGATION', label: 'Navigační reklama (VO)', badge: '🧭' },
  { id: 'BENCH', label: 'Lavičky', badge: '🪑' },
  { id: 'BILLBOARD', label: 'Billboardy / Bigboardy', badge: '🪧' },
  { id: 'CITYLIGHT', label: 'Citylighty (CLV)', badge: '💡' },
  { id: 'BANNER', label: 'Bannery / Plachty', badge: '🏳️' },
  { id: 'OTHER', label: 'Ostatní nosiče', badge: '📦' },
];

const OPERATION_OPTIONS: Array<{
  value: Operation;
  label: string;
  desc: string;
}> = [
  {
    value: 'INSPECTION',
    label: '📸 Kontrola a fotodokumentace (Kontrola)',
    desc: 'Nafocení stavu ploch v terénu — fotky se uloží jako Kontrola rozdělené podle klientů',
  },
  {
    value: 'REPLACE_AD',
    label: '🔄 Výměna reklamního materiálu / přelep',
    desc: 'Přelep nebo výměna plachty/motivu s fotodokumentací po instalaci',
  },
  {
    value: 'INSTALL_AD',
    label: '✨ Instalace reklamního materiálu',
    desc: 'Výlep / instalace kampaně na vybrané evidované plochy',
  },
  {
    value: 'REMOVE_AD',
    label: '🧹 Odstranění reklamního materiálu (stažení)',
    desc: 'Stažení kampaně z evidovaných ploch s fotkou po deinstalaci',
  },
  {
    value: 'REPAIR',
    label: '🔧 Servis / oprava nosiče',
    desc: 'Servisní zásah nebo údržba evidované plochy',
  },
];

export function SystemSurfacesCampaignCreator() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [surfaces, setSurfaces] = useState<SystemSurfaceItem[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | SystemSurfaceCategory>('NAVIGATION');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [onlyOccupied, setOnlyOccupied] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  // Campaign configuration
  const [operationType, setOperationType] = useState<Operation>('INSPECTION');
  const [campaignName, setCampaignName] = useState<string>('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState<boolean>(false);
  const [targetDate, setTargetDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [serviceMinutes, setServiceMinutes] = useState<number>(5);
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSurfaces() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/election-removal/system-surfaces');
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Nepodařilo se načíst plochy ze systému.');
        }
        if (!active) return;
        const loaded: SystemSurfaceItem[] = data.surfaces || [];
        setSurfaces(loaded);
        setCities(data.cities || []);

        // Default to NAVIGATION if any navigation surfaces exist, otherwise ALL
        const hasNav = loaded.some((s) => s.category === 'NAVIGATION');
        if (!hasNav) {
          setSelectedCategory('ALL');
        }
        const hasOccupied = loaded.some((s) => s.isOccupied);
        if (!hasOccupied) {
          setOnlyOccupied(false);
        }
      } catch (err: unknown) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Chyba při načítání ploch.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadSurfaces();
    return () => {
      active = false;
    };
  }, []);

  // Category counts (before category filter, respecting occupied + city)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 };
    for (const tab of CATEGORY_TABS) {
      if (tab.id !== 'ALL') counts[tab.id] = 0;
    }
    for (const s of surfaces) {
      if (onlyOccupied && !s.isOccupied) continue;
      if (selectedCity !== 'ALL' && s.city !== selectedCity) continue;
      counts.ALL = (counts.ALL || 0) + 1;
      counts[s.category] = (counts[s.category] || 0) + 1;
    }
    return counts;
  }, [surfaces, onlyOccupied, selectedCity]);

  // Filtered surfaces
  const filteredSurfaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return surfaces.filter((s) => {
      if (selectedCategory !== 'ALL' && s.category !== selectedCategory) return false;
      if (onlyOccupied && !s.isOccupied) return false;
      if (selectedCity !== 'ALL' && s.city !== selectedCity) return false;
      if (q) {
        const hay = `${s.clientName} ${s.code} ${s.label} ${s.city || ''} ${s.street || ''} ${s.motif || ''} ${s.categoryLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [surfaces, selectedCategory, onlyOccupied, selectedCity, searchQuery]);

  // Group filtered surfaces by client
  const clientGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        clientName: string;
        clientId: string | null;
        isOccupied: boolean;
        items: SystemSurfaceItem[];
        categories: Set<string>;
        cities: Set<string>;
      }
    >();

    for (const item of filteredSurfaces) {
      const key = item.clientName;
      let group = map.get(key);
      if (!group) {
        group = {
          clientName: item.clientName,
          clientId: item.clientId,
          isOccupied: item.isOccupied,
          items: [],
          categories: new Set(),
          cities: new Set(),
        };
        map.set(key, group);
      }
      group.items.push(item);
      group.categories.add(item.categoryLabel);
      if (item.city) group.cities.add(item.city);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.isOccupied !== b.isOccupied) return a.isOccupied ? -1 : 1;
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.clientName.localeCompare(b.clientName, 'cs');
    });
  }, [filteredSurfaces]);

  // Selected surface items across the entire system
  const selectedSurfaces = useMemo(() => {
    return surfaces.filter((s) => selectedIds.has(s.id));
  }, [surfaces, selectedIds]);

  // Selected clients summary
  const selectedClientsList = useMemo(() => {
    const names = new Set<string>();
    for (const s of selectedSurfaces) {
      names.add(s.clientName);
    }
    return Array.from(names);
  }, [selectedSurfaces]);

  // Auto-generate campaign name unless manually edited
  useEffect(() => {
    if (nameManuallyEdited) return;
    const opPrefix =
      operationType === 'INSPECTION'
        ? 'Kontrola'
        : operationType === 'REPLACE_AD'
          ? 'Přelep / Výměna'
          : operationType === 'INSTALL_AD'
            ? 'Instalace'
            : operationType === 'REMOVE_AD'
              ? 'Demontáž'
              : 'Servis';

    const catObj = CATEGORY_TABS.find((t) => t.id === selectedCategory);
    const catLabel =
      selectedCategory === 'ALL'
        ? 'Evidované plochy'
        : catObj?.label.replace(/^[^\wÁ-ž]+/, '') || 'Plochy';

    if (selectedClientsList.length === 1) {
      setCampaignName(`${opPrefix} — ${selectedClientsList[0]} (${catLabel})`);
    } else if (selectedClientsList.length > 1) {
      const preview = selectedClientsList.slice(0, 2).join(', ');
      const rest = selectedClientsList.length > 2 ? ` + ${selectedClientsList.length - 2} další` : '';
      setCampaignName(`${opPrefix} ${catLabel} — ${preview}${rest}`);
    } else {
      setCampaignName(`${opPrefix} — ${catLabel}`);
    }
  }, [operationType, selectedCategory, selectedClientsList, nameManuallyEdited]);

  // Initialize Leaflet map
  useEffect(() => {
    let isMounted = true;
    async function initMap() {
      if (!mapContainerRef.current || mapRef.current) return;
      const L = (await import('leaflet')).default;

      if (!document.getElementById('leaflet-css-system-surfaces')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css-system-surfaces';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [49.8175, 15.473],
        zoom: 7,
      });

      const tileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        attribution: '© Google Maps',
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);

      mapRef.current = map;
      tileLayerRef.current = tileLayer;
      markersLayerRef.current = markersLayer;
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

  // Render markers on map
  useEffect(() => {
    async function updateMarkers() {
      if (!mapRef.current || !markersLayerRef.current) return;
      const L = (await import('leaflet')).default;
      const layer = markersLayerRef.current;
      layer.clearLayers();

      const pointsToDisplay = filteredSurfaces.slice(0, 400);
      const boundsPoints: [number, number][] = [];

      for (const item of pointsToDisplay) {
        const isSelected = selectedIds.has(item.id);
        if (isSelected || selectedIds.size === 0) {
          boundsPoints.push([item.latitude, item.longitude]);
        }

        const bg = isSelected ? '#059669' : '#64748b';
        const ring = isSelected ? '0 0 0 4px rgba(16, 185, 129, 0.35)' : '0 1px 3px rgba(0,0,0,0.3)';
        const size = isSelected ? 28 : 20;

        const icon = L.divIcon({
          className: 'custom-sys-surface-pin',
          html: `<div style="
            width:${size}px;
            height:${size}px;
            border-radius:9999px;
            background:${bg};
            border:2px solid #ffffff;
            box-shadow:${ring};
            display:flex;
            align-items:center;
            justify-content:center;
            color:#fff;
            font-size:10px;
            font-weight:800;
            transition:all 0.15s ease;
          ">${isSelected ? '✓' : ''}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([item.latitude, item.longitude], { icon });
        marker.bindTooltip(
          `<div style="font-size:11px;line-height:1.35;">
            <strong style="color:#0f172a;">${item.clientName}</strong><br/>
            <span>${item.code} • ${item.categoryLabel}</span>
            ${item.city ? `<br/><span style="color:#64748b;">${item.city}${item.street ? `, ${item.street}` : ''}</span>` : ''}
          </div>`,
          { direction: 'top', offset: [0, -10] }
        );
        marker.on('click', () => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(item.id)) next.delete(item.id);
            else next.add(item.id);
            return next;
          });
        });
        marker.addTo(layer);
      }

      if (boundsPoints.length > 0 && mapRef.current) {
        const bounds = L.latLngBounds(boundsPoints);
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
        }
      }
    }
    updateMarkers();
  }, [filteredSurfaces, selectedIds]);

  const toggleClientGroup = (items: SystemSurfaceItem[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = items.every((i) => next.has(i.id));
      if (allSelected) {
        for (const i of items) next.delete(i.id);
      } else {
        for (const i of items) next.add(i.id);
      }
      return next;
    });
  };

  const toggleSingleSurface = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const s of filteredSurfaces) next.add(s.id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleExpandClient = (clientName: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(clientName)) next.delete(clientName);
      else next.add(clientName);
      return next;
    });
  };

  const handleSaveCampaign = async (goToPlan: boolean) => {
    if (selectedSurfaces.length === 0) {
      setError('Vyberte alespoň jednoho klienta nebo plochu ze systému.');
      return;
    }
    if (!campaignName.trim()) {
      setError('Zadejte název terénní zakázky.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const singleClientName =
        selectedClientsList.length === 1 ? selectedClientsList[0] : undefined;

      const payload = {
        name: campaignName.trim(),
        clientName: singleClientName,
        description:
          description.trim() ||
          `Trasa vytvořená z evidovaných ploch v systému (${selectedSurfaces.length} ploch, ${selectedClientsList.length} klientů). Režim: ${
            OPERATION_OPTIONS.find((o) => o.value === operationType)?.label || 'Kontrola'
          }.`,
        targetDate: targetDate || null,
        points: selectedSurfaces.map((s) => ({
          name: s.label,
          description: [
            `Klient: ${s.clientName}`,
            `Typ plochy: ${s.categoryLabel}`,
            s.city || s.street ? `Lokace: ${[s.city, s.street].filter(Boolean).join(', ')}` : null,
            s.dimensions ? `Rozměr: ${s.dimensions}` : null,
            s.sideLabel ? `Strana: ${s.sideLabel}` : null,
            s.motif ? `Motiv / poznámka: ${s.motif}` : null,
          ]
            .filter(Boolean)
            .join(' | '),
          layerName: s.clientName,
          mediaType: s.mediaType,
          objectType: s.objectType,
          latitude: s.latitude,
          longitude: s.longitude,
          quantity: 1,
          serviceMinutes: Math.max(1, serviceMinutes),
          operationType,
          reviewRequired: false,
          carrierId: s.carrierId,
          surfaceId: s.surfaceId,
          materialDisposition: 'LEAVE',
        })),
      };

      const res = await fetch('/api/election-removal/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se uložit terénní zakázku.');
      }

      if (goToPlan) {
        router.push(`/election-removal/${data.campaignId}/plan`);
      } else {
        router.push(`/election-removal/${data.campaignId}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání zakázky.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Info Banner */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-sky-50/70 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Výběr evidovaných ploch ze systému podle klientů
                </h2>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">
                  Kontrola &amp; Fotodokumentace
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">
                Vyberte typ plochy (např. <strong>Navigační reklama VO</strong>, <strong>Lavičky</strong>,{' '}
                <strong>Billboardy</strong> nebo cokoliv s evidovanou plochou), zaškrtněte klienty a rovnou
                vygenerujte trasu. Fotky z terénu se automaticky označí jako{' '}
                <strong className="text-emerald-800">Kontrola</strong> a ve{' '}
                <strong>Fotodokumentaci</strong> se samy rozdělí do alb podle jednotlivých klientů.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 1: Surface Category Pills */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900">
              1. Co jedete fotit / kontrolovat? (Typ evidované plochy)
            </h3>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            <input
              type="checkbox"
              checked={onlyOccupied}
              onChange={(e) => setOnlyOccupied(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Zobrazit jen plochy obsazené klientem</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => {
            const count = categoryCounts[tab.id] || 0;
            const active = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  active
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>{tab.badge}</span>
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & City Filter Row */}
        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hledat klienta, kód nosiče, ulici, město nebo motiv..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 shrink-0 text-slate-400" />
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
            >
              <option value="ALL">Všechna města ({cities.length})</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 2: Split View — Client List (Left) & Map Preview (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Clients & Surfaces */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                <span>2. Vyberte klienty a jejich plochy ({clientGroups.length} klientů)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Kliknutím na klienta vyberete všechny jeho evidované plochy, nebo rozbalte detail.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllFiltered}
                disabled={filteredSurfaces.length === 0}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                Vybrat vše ({filteredSurfaces.length})
              </button>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Zrušit výběr ({selectedIds.size})
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600 mb-2" />
              <p className="text-xs font-medium">Načítám evidované plochy a klienty ze systému...</p>
            </div>
          ) : clientGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Building2 className="h-9 w-9 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">
                Pro zvolený filtr nebyly nalezeny žádné plochy s GPS
              </p>
              <p className="mt-1 text-xs text-slate-500 max-w-md">
                Zkuste přepnout kategorii na „Všechny evidované plochy“ nebo odškrtnout filtr „Zobrazit jen plochy obsazené klientem“.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {clientGroups.map((group) => {
                const selectedInGroup = group.items.filter((i) => selectedIds.has(i.id)).length;
                const allSelected = selectedInGroup === group.items.length && group.items.length > 0;
                const partiallySelected = selectedInGroup > 0 && !allSelected;
                const isExpanded = expandedClients.has(group.clientName);

                return (
                  <div
                    key={group.clientName}
                    className={`rounded-xl border transition-all ${
                      allSelected
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-sm'
                        : partiallySelected
                          ? 'border-emerald-300 bg-emerald-50/20'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 p-3">
                      <button
                        type="button"
                        onClick={() => toggleClientGroup(group.items)}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            allSelected
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : partiallySelected
                                ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                                : 'border-slate-300 bg-white text-transparent'
                          }`}
                        >
                          {allSelected ? (
                            <CheckSquare className="h-3.5 w-3.5" />
                          ) : partiallySelected ? (
                            <span className="h-2 w-2 rounded-xs bg-emerald-600" />
                          ) : (
                            <Square className="h-3.5 w-3.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-sm font-bold text-slate-900">
                              {group.clientName}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                                selectedInGroup > 0
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {selectedInGroup > 0
                                ? `${selectedInGroup} / ${group.items.length} vybráno`
                                : `${group.items.length} ploch`}
                            </span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            {Array.from(group.categories).map((cat) => (
                              <span
                                key={cat}
                                className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200"
                              >
                                {cat}
                              </span>
                            ))}
                            {group.cities.size > 0 && (
                              <span className="truncate text-slate-500">
                                • {Array.from(group.cities).slice(0, 4).join(', ')}
                                {group.cities.size > 4 ? ` +${group.cities.size - 4}` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleExpandClient(group.clientName)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        <span>Plochy</span>
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-200/80 bg-white px-3 py-2 space-y-1.5 rounded-b-xl">
                        {group.items.map((item) => {
                          const checked = selectedIds.has(item.id);
                          return (
                            <label
                              key={item.id}
                              className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                checked
                                  ? 'border-emerald-300 bg-emerald-50/60 text-slate-900'
                                  : 'border-slate-100 bg-slate-50/50 text-slate-600 hover:bg-slate-100/70'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSingleSurface(item.id)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900">{item.code}</span>
                                    <span className="text-[10px] rounded bg-slate-200/80 px-1.5 py-0.2 font-semibold text-slate-700">
                                      {item.categoryLabel}
                                    </span>
                                    {item.sideLabel && (
                                      <span className="text-[10px] text-slate-500">
                                        ({item.sideLabel})
                                      </span>
                                    )}
                                  </div>
                                  <div className="truncate text-[11px] text-slate-500">
                                    {[item.city, item.street, item.motif].filter(Boolean).join(' • ') ||
                                      item.label}
                                  </div>
                                </div>
                              </div>

                              <span className="shrink-0 font-mono text-[10px] text-slate-400">
                                {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Map & Selection Summary */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
            <div className="flex items-center justify-between pb-2.5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">
                  Mapa ploch ({selectedIds.size} vybráno z {filteredSurfaces.length})
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Kliknutím na bod v mapě ho přidáte/odeberete
              </span>
            </div>

            <div
              ref={mapContainerRef}
              className="h-[340px] w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
            />

            {/* Selected Clients Pills */}
            {selectedClientsList.length > 0 && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <div className="text-[11px] font-bold text-emerald-900 mb-1.5 flex items-center justify-between">
                  <span>Zařazení klienti do trasy ({selectedClientsList.length}):</span>
                  <span>Celkem {selectedSurfaces.length} zastávek</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedClientsList.map((client) => {
                    const count = selectedSurfaces.filter((s) => s.clientName === client).length;
                    return (
                      <span
                        key={client}
                        className="inline-flex items-center gap-1 rounded-full bg-white border border-emerald-300 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 shadow-2xs"
                      >
                        <span>{client}</span>
                        <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] text-emerald-800">
                          {count}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Route & Operation Settings */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">
            3. Nastavení zakázky a uložení fotodokumentace
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Název zakázky / trasy
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => {
                setCampaignName(e.target.value);
                setNameManuallyEdited(true);
              }}
              placeholder="např. Kontrola navigací — Plzeň a okolí"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Termín realizace / kontroly
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Čas na 1 zastávku (min)
            </label>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                min={1}
                max={120}
                value={serviceMinutes}
                onChange={(e) => setServiceMinutes(Math.max(1, Number(e.target.value) || 5))}
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Operation Type Cards */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">
            Režim terénní práce a označení fotek ve Fotodokumentaci
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {OPERATION_OPTIONS.map((op) => {
              const active = operationType === op.value;
              return (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setOperationType(op.value)}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    active
                      ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-white'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{op.label}</span>
                    {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">{op.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Pokyny pro technika v terénu (volitelné)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="např. Nafotit každou plochu z čelního pohledu, zkontrolovat čistotu a viditelnost..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-600">
            Vybráno <strong className="text-slate-900">{selectedSurfaces.length} ploch</strong> pro{' '}
            <strong className="text-slate-900">{selectedClientsList.length} klientů</strong> •
            Odhadovaná práce na místě:{' '}
            <strong className="text-slate-900">
              {selectedSurfaces.length * serviceMinutes} min
            </strong>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={submitting || selectedSurfaces.length === 0}
              onClick={() => handleSaveCampaign(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <span>Uložit a otevřít přehled zakázky</span>
            </button>

            <button
              type="button"
              disabled={submitting || selectedSurfaces.length === 0}
              onClick={() => handleSaveCampaign(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Vytvářím trasu...</span>
                </>
              ) : (
                <>
                  <Route className="h-4 w-4" />
                  <span>Vytvořit a rovnou naplánovat trasu ({selectedSurfaces.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
