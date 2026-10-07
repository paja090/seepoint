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
} from 'lucide-react';
import { ELECTION_REMOVAL_MEDIA_LABELS } from '@/lib/election-removal/constants';
import { ElectionRemovalMap } from './ElectionRemovalMap';
import { parsePointMetadata, cleanLayerName } from '@/lib/election-removal/point-metadata';

interface CampaignPointsViewProps {
  points: ElectionRemovalPoint[];
}

export function CampaignPointsView({ points: initialPoints }: CampaignPointsViewProps) {
  const router = useRouter();
  const [points, setPoints] = useState<ElectionRemovalPoint[]>(initialPoints);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [layerFilter, setLayerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [viewMode, setViewMode] = useState<'TABLE' | 'MAP'>('TABLE');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

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
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při mazání bodu.');
    } finally {
      setDeletingId(null);
    }
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

      return matchLayer && matchStatus && matchSearch;
    });
  }, [points, layerFilter, statusFilter, search]);

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

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Hledat bod..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-40 focus:outline-none"
            />
          </div>
        </div>
      </div>

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
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Název média a adresa</th>
                <th className="py-2.5 px-3">Vrstva</th>
                <th className="py-2.5 px-3">Typ média</th>
                <th className="py-2.5 px-3">GPS / Navigace</th>
                <th className="py-2.5 px-3 text-center">Stav</th>
                <th className="py-2.5 px-3 text-right">Čas demontáže</th>
                <th className="py-2.5 px-3 text-right">Akce</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPoints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    Žádné body neodpovídají zvolenému filtru.
                  </td>
                </tr>
              ) : (
                filteredPoints.map((pt, idx) => {
                  const meta = parsePointMetadata(pt.description);
                  const cleanLayer = cleanLayerName(pt.layerName);

                  return (
                    <tr key={pt.id} className="hover:bg-slate-50/60 transition-colors">
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
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                          {ELECTION_REMOVAL_MEDIA_LABELS[pt.mediaType] || pt.mediaType}
                        </span>
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
