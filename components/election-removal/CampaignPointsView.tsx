'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ElectionRemovalPoint } from '@prisma/client';
import {
  Search,
  ExternalLink,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock3,
  List,
  Map as MapIcon,
  Image as ImageIcon,
  Trash2,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import {
  ELECTION_REMOVAL_MEDIA_LABELS,
  type ElectionRemovalMediaType,
  type ElectionRemovalOperationType,
} from '@/lib/election-removal/constants';
import { ElectionRemovalMap } from './ElectionRemovalMap';
import { parsePointMetadata, cleanLayerName } from '@/lib/election-removal/point-metadata';
import { detectOperationTypeFromText } from '@/lib/election-removal/kml-parser';

interface CampaignPointsViewProps {
  points: ElectionRemovalPoint[];
  campaignId?: string;
}

export function CampaignPointsView({
  points: initialPoints,
  campaignId: propCampaignId,
}: CampaignPointsViewProps) {
  const router = useRouter();
  const [points, setPoints] = useState<ElectionRemovalPoint[]>(initialPoints);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingPointId, setUpdatingPointId] = useState<string | null>(null);
  const [selectedPointIds, setSelectedPointIds] = useState<Set<string>>(new Set());
  const [isBatchUpdating, setIsBatchUpdating] = useState<boolean>(false);

  const [layerFilter, setLayerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [operationFilter, setOperationFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TABLE' | 'MAP'>('TABLE');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const campaignId = propCampaignId || (points.length > 0 ? points[0].campaignId : '');

  // Add Point Modal State
  const [isAddingPointOpen, setIsAddingPointOpen] = useState(false);
  const [isCreatingPoint, setIsCreatingPoint] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newMediaType, setNewMediaType] = useState<ElectionRemovalMediaType>('ACKO');
  const [newOperationType, setNewOperationType] = useState<ElectionRemovalOperationType>('RELOCATION');
  const [newRelocationDest, setNewRelocationDest] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newLocality, setNewLocality] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newNote, setNewNote] = useState('');

  const handleCreatePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId) {
      alert('Chybí identifikátor kampaně.');
      return;
    }
    if (!newLabel.trim()) {
      alert('Zadejte název nebo označení bodu.');
      return;
    }
    const lat = parseFloat(newLat);
    const lng = parseFloat(newLng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert('Zadejte platné GPS souřadnice (zeměpisná šířka a délka).');
      return;
    }

    setIsCreatingPoint(true);
    try {
      const res = await fetch('/api/election-removal/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          label: newLabel.trim(),
          mediaType: newMediaType,
          operationType: newOperationType,
          relocationDestination:
            newOperationType === 'RELOCATION' ? newRelocationDest.trim() : null,
          latitude: lat,
          longitude: lng,
          locality: newLocality.trim() || null,
          fullAddress: newAddress.trim() || null,
          note: newNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se přidat bod.');
      }

      setPoints((prev) => [data.point as ElectionRemovalPoint, ...prev]);
      setIsAddingPointOpen(false);
      setNewLabel('');
      setNewRelocationDest('');
      setNewLat('');
      setNewLng('');
      setNewLocality('');
      setNewAddress('');
      setNewNote('');
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při vytváření bodu.');
    } finally {
      setIsCreatingPoint(false);
    }
  };

  // Set of point IDs that have an identical label or identical GPS in the campaign
  const duplicatePointIds = useMemo(() => {
    const dups = new Set<string>();
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        if (
          a.label === b.label &&
          Math.abs(a.latitude - b.latitude) < 0.0005 &&
          Math.abs(a.longitude - b.longitude) < 0.0005
        ) {
          dups.add(a.id);
          dups.add(b.id);
        }
      }
    }
    return dups;
  }, [points]);

  const handleDeletePoint = async (pointId: string, pointLabel: string) => {
    if (!confirm(`Opravdu chcete smazat bod "${pointLabel}" z kampaně?`)) {
      return;
    }
    setDeletingId(pointId);
    try {
      const res = await fetch(`/api/election-removal/points/${pointId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se smazat bod.');
      }
      setPoints((prev) => prev.filter((p) => p.id !== pointId));
      setSelectedPointIds((prev) => {
        const next = new Set(prev);
        next.delete(pointId);
        return next;
      });
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při mazání bodu.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOperationChange = async (
    pointId: string,
    newOperation: ElectionRemovalOperationType,
    dest?: string
  ) => {
    const pt = points.find((p) => p.id === pointId);
    if (!pt) return;

    let destination = dest;
    if (newOperation === 'RELOCATION' && dest === undefined) {
      const existingDest = parsePointMetadata(pt.description).relocationDestination || '';
      const entered = prompt(
        'Kam se má konstrukce převézt? (Cílová adresa nebo lokalita, volitelné):',
        existingDest
      );
      if (entered === null) {
        return; // Uživatel stiskl Storno
      }
      destination = entered;
    }

    setUpdatingPointId(pointId);
    try {
      const res = await fetch(`/api/election-removal/points/${pointId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationType: newOperation,
          relocationDestination: destination,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se změnit typ operace.');
      }
      setPoints((prev) =>
        prev.map((p) => (p.id === pointId ? (data.point as ElectionRemovalPoint) : p))
      );
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při změně operace.');
    } finally {
      setUpdatingPointId(null);
    }
  };

  const handleBatchOperation = async (newOperation: ElectionRemovalOperationType) => {
    if (selectedPointIds.size === 0) return;

    let destination: string | undefined = undefined;
    if (newOperation === 'RELOCATION') {
      const entered = prompt(
        `Kam se mají konstrukce převézt? (Cílová adresa pro ${selectedPointIds.size} bodů, volitelné):`,
        ''
      );
      if (entered === null) return;
      destination = entered;
    }

    setIsBatchUpdating(true);
    try {
      const res = await fetch('/api/election-removal/points/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointIds: Array.from(selectedPointIds),
          operationType: newOperation,
          relocationDestination: destination,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se hromadně změnit operace.');
      }
      const updatedMap = new Map<string, ElectionRemovalPoint>(
        (data.points as ElectionRemovalPoint[]).map((p) => [p.id, p])
      );
      setPoints((prev) => prev.map((p) => updatedMap.get(p.id) || p));
      setSelectedPointIds(new Set());
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při hromadné změně operací.');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const toggleSelectAll = (visiblePointIds: string[]) => {
    if (selectedPointIds.size === visiblePointIds.length && visiblePointIds.length > 0) {
      setSelectedPointIds(new Set());
    } else {
      setSelectedPointIds(new Set(visiblePointIds));
    }
  };

  const toggleSelectPoint = (pointId: string) => {
    setSelectedPointIds((prev) => {
      const next = new Set(prev);
      if (next.has(pointId)) {
        next.delete(pointId);
      } else {
        next.add(pointId);
      }
      return next;
    });
  };

  // Extract distinct layers
  const layers = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => {
      if (p.layerName) set.add(p.layerName);
    });
    return Array.from(set).sort();
  }, [points]);

  // Filtered points
  const filteredPoints = useMemo(() => {
    return points.filter((p) => {
      const matchLayer = layerFilter === 'ALL' || p.layerName === layerFilter;
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchSearch =
        !search ||
        p.label.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        (p.layerName && p.layerName.toLowerCase().includes(search.toLowerCase()));

      let matchOp = true;
      if (operationFilter !== 'ALL') {
        const rawText = `${p.layerName || ''} ${p.label || ''} ${p.description || ''}`;
        const op = detectOperationTypeFromText(rawText);
        matchOp = op === operationFilter;
      }

      return matchLayer && matchStatus && matchSearch && matchOp;
    });
  }, [points, layerFilter, statusFilter, operationFilter, search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Hotovo
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock3 className="w-3 h-3 text-amber-600" /> V realizaci
          </span>
        );
      case 'ISSUE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3 text-rose-600" /> Problém
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            Čeká na plánování
          </span>
        );
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-sky-600" />
            Body demontáže ({filteredPoints.length} / {points.length})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Každý záznam je konkrétní fyzické médium určené k demontáži.
          </p>
        </div>

        {/* Filter controls & view switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'TABLE'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabulka</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MAP')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'MAP'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5 text-sky-600" />
              <span>Mapa</span>
            </button>
          </div>

          {layers.length > 0 && (
            <select
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:outline-none"
            >
              <option value="ALL">Všechny vrstvy ({points.length})</option>
              {layers.map((l) => (
                <option key={l} value={l}>
                  {cleanLayerName(l) || l}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:outline-none"
          >
            <option value="ALL">Všechny stavy</option>
            <option value="PENDING">Čeká na plánování</option>
            <option value="ASSIGNED">Naplánováno</option>
            <option value="IN_PROGRESS">V realizaci</option>
            <option value="COMPLETED">Hotovo</option>
            <option value="ISSUE">Hlášen problém</option>
          </select>

          <select
            value={operationFilter}
            onChange={(e) => setOperationFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white focus:outline-none"
          >
            <option value="ALL">Všechny operace</option>
            <option value="FULL_REMOVAL">📦 Odvoz na sklad</option>
            <option value="RELOCATION">🚚 Přímý převoz</option>
            <option value="BANNER_CHANGE">🎨 Pouze výměna plachty</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Hledat bod..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-36 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsAddingPointOpen(true)}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
            title="Přidat další stanoviště nebo cíl přesunu"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Přidat bod</span>
          </button>
        </div>
      </div>

      {/* Add Point Modal Dialog */}
      {isAddingPointOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Přidat bod do kampaně</h3>
                  <p className="text-xs text-slate-500">Zadejte nové stanoviště pro svoz nebo cíl přesunu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingPointOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePoint} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Název média / označení bodu *
                </label>
                <input
                  type="text"
                  required
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="např. Áčko – Náměstí Míru nebo MiniTower #8"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Typ média *
                  </label>
                  <select
                    value={newMediaType}
                    onChange={(e) => setNewMediaType(e.target.value as ElectionRemovalMediaType)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                  >
                    <option value="ACKO">Áčko</option>
                    <option value="MINI_TOWER">Mini Tower</option>
                    <option value="TOWER">Velká věž (Tower)</option>
                    <option value="BENCH">Lavička</option>
                    <option value="BANNER">Banner</option>
                    <option value="CITY_POSTER">City Poster</option>
                    <option value="PLOT">Plotová reklama</option>
                    <option value="OTHER">Jiné médium</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Typ operace / logistika *
                  </label>
                  <select
                    value={newOperationType}
                    onChange={(e) => setNewOperationType(e.target.value as ElectionRemovalOperationType)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none"
                  >
                    <option value="RELOCATION">🚚 Přímý převoz na jiné místo</option>
                    <option value="FULL_REMOVAL">📦 Odvoz do centrálního skladu</option>
                    <option value="BANNER_CHANGE">🎨 Pouze výměna plachty</option>
                  </select>
                </div>
              </div>

              {newOperationType === 'RELOCATION' && (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1">
                  <label className="block font-bold text-purple-900">
                    🚚 Cíl převozu (kam se konstrukce veze)
                  </label>
                  <input
                    type="text"
                    value={newRelocationDest}
                    onChange={(e) => setNewRelocationDest(e.target.value)}
                    placeholder="např. Náměstí Svobody 15 nebo Roh Masarykovy"
                    className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-xs bg-white focus:outline-none"
                  />
                  <p className="text-[10px] text-purple-700">
                    Montér po naložení převeze konstrukci přímo na toto stanoviště a tam ji složí/nainstaluje.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-700">
                    GPS souřadnice stanoviště *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if ('geolocation' in navigator) {
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setNewLat(pos.coords.latitude.toFixed(5));
                            setNewLng(pos.coords.longitude.toFixed(5));
                          },
                          () => alert('Nepodařilo se zjistit aktuální GPS polohu.')
                        );
                      }
                    }}
                    className="text-[11px] font-semibold text-sky-600 hover:text-sky-800 underline flex items-center gap-1"
                  >
                    📍 Moje poloha
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    placeholder="Zeměpisná šířka (např. 50.088)"
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                    placeholder="Zeměpisná délka (např. 14.420)"
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lokalita / Město (volitelné)
                  </label>
                  <input
                    type="text"
                    value={newLocality}
                    onChange={(e) => setNewLocality(e.target.value)}
                    placeholder="např. Brno-střed"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ulice a č.p. (volitelné)
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="např. Masarykova 10"
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Poznámka pro montéry (volitelné)
                </label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="např. Vjezd ze dvora, klíč u vrátného"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddingPointOpen(false)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPoint}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isCreatingPoint && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Uložit bod do kampaně</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Actions Toolbar when items are selected */}
      {selectedPointIds.size > 0 && (
        <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sky-900">
              Vybráno {selectedPointIds.size} z {filteredPoints.length} bodů
            </span>
            <button
              type="button"
              onClick={() => setSelectedPointIds(new Set())}
              className="text-slate-500 hover:text-slate-800 underline ml-2"
            >
              Zrušit výběr
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-600 font-semibold">Změnit logistiku na:</span>
            <button
              type="button"
              disabled={isBatchUpdating}
              onClick={() => handleBatchOperation('FULL_REMOVAL')}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-bold text-slate-700 shadow-sm transition disabled:opacity-50 flex items-center gap-1"
            >
              📦 Odvoz na sklad
            </button>
            <button
              type="button"
              disabled={isBatchUpdating}
              onClick={() => handleBatchOperation('RELOCATION')}
              className="px-2.5 py-1 bg-purple-50 border border-purple-300 hover:bg-purple-100 rounded-lg font-bold text-purple-800 shadow-sm transition disabled:opacity-50 flex items-center gap-1"
            >
              🚚 Přímý převoz
            </button>
            <button
              type="button"
              disabled={isBatchUpdating}
              onClick={() => handleBatchOperation('BANNER_CHANGE')}
              className="px-2.5 py-1 bg-teal-50 border border-teal-300 hover:bg-teal-100 rounded-lg font-bold text-teal-800 shadow-sm transition disabled:opacity-50 flex items-center gap-1"
            >
              🎨 Pouze plachta
            </button>
            {isBatchUpdating && (
              <span className="flex items-center gap-1 text-slate-500 font-medium ml-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                Ukládám...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Map View */}
      {viewMode === 'MAP' ? (
        <div className="space-y-2">
          <ElectionRemovalMap
            points={filteredPoints}
            selectedPointId={selectedPointId}
            onSelectPoint={(id) => setSelectedPointId(id)}
            height="500px"
          />
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider z-10">
              <tr>
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      filteredPoints.length > 0 && selectedPointIds.size === filteredPoints.length
                    }
                    onChange={() => toggleSelectAll(filteredPoints.map((p) => p.id))}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                    title="Vybrat všechny filtrované body"
                  />
                </th>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Název média a adresa</th>
                <th className="py-2.5 px-3">Vrstva</th>
                <th className="py-2.5 px-3">Médium & Operace</th>
                <th className="py-2.5 px-3">GPS / Navigace</th>
                <th className="py-2.5 px-3 text-center">Stav</th>
                <th className="py-2.5 px-3 text-right">Čas demontáže</th>
                <th className="py-2.5 px-3 text-right">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPoints.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    Žádné body neodpovídají zvolenému filtru.
                  </td>
                </tr>
              ) : (
                filteredPoints.map((pt, idx) => {
                  const meta = parsePointMetadata(pt.description);
                  const cleanLayer = cleanLayerName(pt.layerName);

                  return (
                    <tr
                      key={pt.id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        selectedPointIds.has(pt.id) ? 'bg-sky-50/40' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedPointIds.has(pt.id)}
                          onChange={() => toggleSelectPoint(pt.id)}
                          className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {pt.plannedOrder || idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900">{pt.label}</p>
                          {duplicatePointIds.has(pt.id) && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200"
                              title="V kampani je další bod se stejným názvem a shodnou GPS (ko-lokace)"
                            >
                              ⚠️ Shodná GPS
                            </span>
                          )}
                        </div>
                        {meta.locality && (
                          <p className="text-[11px] font-semibold text-slate-700">
                            🏢 {meta.locality}
                          </p>
                        )}
                        {meta.fullAddress && (
                          <p className="text-[11px] text-slate-500">
                            📍 {meta.fullAddress}
                          </p>
                        )}
                        {meta.otherNotes && (
                          <p className="text-[10px] text-slate-400 italic line-clamp-1">
                            {meta.otherNotes}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        {cleanLayer || '–'}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                            {ELECTION_REMOVAL_MEDIA_LABELS[pt.mediaType] || pt.mediaType}
                          </span>
                          {(() => {
                            const rawText = `${pt.layerName || ''} ${pt.label || ''} ${pt.description || ''}`;
                            const op = detectOperationTypeFromText(rawText);
                            const isUpdating = updatingPointId === pt.id;

                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <select
                                    value={op}
                                    disabled={isUpdating}
                                    onChange={(e) =>
                                      handleOperationChange(
                                        pt.id,
                                        e.target.value as ElectionRemovalOperationType
                                      )
                                    }
                                    className={`text-[10px] font-bold px-2 py-1 rounded-md border cursor-pointer focus:outline-none transition shadow-sm ${
                                      op === 'BANNER_CHANGE'
                                        ? 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
                                        : op === 'RELOCATION'
                                        ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                                    } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                                    title="Kliknutím přepnete logistiku bodu: Odvoz na sklad / Přímý převoz na jiné místo / Pouze výměna plachty"
                                  >
                                    <option value="FULL_REMOVAL">📦 Odvoz na sklad</option>
                                    <option value="RELOCATION">🚚 Přímý převoz jinam</option>
                                    <option value="BANNER_CHANGE">🎨 Pouze plachta</option>
                                  </select>
                                  {isUpdating && (
                                    <Loader2 className="w-3 h-3 animate-spin text-sky-600" />
                                  )}
                                </div>

                                {op === 'RELOCATION' && (
                                  <div className="flex items-center gap-1 text-[10px] text-purple-800 font-medium max-w-[200px]">
                                    <span className="truncate" title={meta.relocationDestination || 'Bez cílové adresy'}>
                                      📍 {meta.relocationDestination ? meta.relocationDestination : 'Bez cílové adresy'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newDest = prompt(
                                          'Zadejte novou cílovou adresu nebo stanoviště převozu:',
                                          meta.relocationDestination || ''
                                        );
                                        if (newDest !== null) {
                                          handleOperationChange(pt.id, 'RELOCATION', newDest);
                                        }
                                      }}
                                      className="text-purple-600 hover:text-purple-900 font-bold underline shrink-0 cursor-pointer"
                                      title="Upravit cílovou adresu"
                                    >
                                      Upravit
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        <div className="flex flex-col gap-0.5">
                          <a
                            href={`https://www.google.com/maps?q=${pt.latitude},${pt.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-600 hover:underline inline-flex items-center gap-1"
                            title="Zobrazit v Google Maps"
                          >
                            <span>
                              {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
                            </span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                          {meta.photoUrl && (
                            <a
                              href={meta.photoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1 text-[11px]"
                            >
                              <ImageIcon className="w-3 h-3 text-emerald-600" />
                              <span>Fotodokumentace ↗</span>
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {getStatusBadge(pt.status)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                        {pt.serviceMinutes} min
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          disabled={deletingId === pt.id}
                          onClick={() => handleDeletePoint(pt.id, pt.label)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50 inline-flex items-center"
                          title="Smazat tento bod z kampaně"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
