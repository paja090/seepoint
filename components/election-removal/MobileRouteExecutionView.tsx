'use client';

import { useState, useTransition, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  ExternalLink,
  Camera,
  Navigation,
  RotateCcw,
  Play,
  Layers,
  Image as ImageIcon,
  X,
  Upload,
  Map as MapIcon,
} from 'lucide-react';
import type { ElectionRemovalPoint, Photo } from '@prisma/client';
import { ELECTION_REMOVAL_MEDIA_LABELS } from '@/lib/election-removal/constants';
import { ElectionRemovalMap } from './ElectionRemovalMap';
import {
  parsePointMetadata,
  cleanLayerName,
  buildGoogleMapsRouteUrl,
} from '@/lib/election-removal/point-metadata';

interface PointWithPhotos extends ElectionRemovalPoint {
  photos?: Photo[];
}

interface MobileRouteExecutionViewProps {
  campaign: {
    id: string;
    name: string;
    targetDate: Date | null;
  };
  points: PointWithPhotos[];
}

export function MobileRouteExecutionView({
  campaign,
  points: initialPoints,
}: MobileRouteExecutionViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [points, setPoints] = useState<PointWithPhotos[]>(initialPoints);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'TODO' | 'DONE' | 'ISSUE'>('ALL');
  const [activeCrewFilter, setActiveCrewFilter] = useState<string>('ALL');
  const [showMap, setShowMap] = useState<boolean>(true);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // Issue reporting modal state
  const [reportingIssuePointId, setReportingIssuePointId] = useState<string | null>(null);
  const [issueType, setIssueType] = useState<string>('NOT_FOUND');
  const [issueNote, setIssueNote] = useState<string>('');
  const [isSubmittingIssue, setIsSubmittingIssue] = useState<boolean>(false);

  // Photo uploading state
  const [uploadingPhotoPointId, setUploadingPhotoPointId] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Distinct crews
  const crews = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => {
      if (p.assignedCrewId) set.add(p.assignedCrewId);
    });
    return Array.from(set).sort();
  }, [points]);

  // Filter points
  const displayedPoints = useMemo(() => {
    return points.filter((p) => {
      const matchCrew = activeCrewFilter === 'ALL' || p.assignedCrewId === activeCrewFilter;

      let matchStatus = true;
      if (filterStatus === 'TODO') {
        matchStatus = ['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(p.status);
      } else if (filterStatus === 'DONE') {
        matchStatus = p.status === 'COMPLETED';
      } else if (filterStatus === 'ISSUE') {
        matchStatus = p.status === 'ISSUE';
      }

      return matchCrew && matchStatus;
    });
  }, [points, filterStatus, activeCrewFilter]);

  // Aggregate progress
  const totalCount = points.length;
  const completedCount = points.filter((p) => p.status === 'COMPLETED').length;
  const inProgressCount = points.filter((p) => p.status === 'IN_PROGRESS').length;
  const issueCount = points.filter((p) => p.status === 'ISSUE').length;
  const percentDone = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const googleRouteUrl = useMemo(() => {
    const uncompleted = displayedPoints.filter((p) => p.status !== 'COMPLETED');
    const targetPoints = uncompleted.length > 0 ? uncompleted : displayedPoints;
    return buildGoogleMapsRouteUrl(targetPoints);
  }, [displayedPoints]);

  // Handle Point status update
  const handleUpdateStatus = async (
    pointId: string,
    action: 'START' | 'COMPLETE' | 'RESET'
  ) => {
    try {
      const res = await fetch(`/api/election-removal/points/${pointId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se změnit stav bodu.');
      }

      setPoints((prev) =>
        prev.map((pt) => (pt.id === pointId ? { ...pt, ...data.point } : pt))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při ukládání stavu.');
    }
  };

  // Submit Issue
  const handleSubmitIssue = async () => {
    if (!reportingIssuePointId) return;
    setIsSubmittingIssue(true);

    try {
      const res = await fetch(
        `/api/election-removal/points/${reportingIssuePointId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'REPORT_ISSUE',
            issueType,
            issueNote,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se nahlásit problém.');
      }

      setPoints((prev) =>
        prev.map((pt) =>
          pt.id === reportingIssuePointId ? { ...pt, ...data.point } : pt
        )
      );

      setReportingIssuePointId(null);
      setIssueNote('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při hlášení problému.');
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  // Trigger photo capture
  const handleTriggerPhoto = (pointId: string) => {
    setUploadingPhotoPointId(pointId);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
      photoInputRef.current.click();
    }
  };

  // Upload photo file
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingPhotoPointId) return;

    setIsUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Attempt to capture GPS if browser geolocation is available
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 4000,
            });
          });
          formData.append('latitude', String(pos.coords.latitude));
          formData.append('longitude', String(pos.coords.longitude));
        } catch {
          // GPS geolocation not mandatory
        }
      }

      const res = await fetch(
        `/api/election-removal/points/${uploadingPhotoPointId}/photos`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Nepodařilo se nahrát fotografii.');
      }

      // Append photo to point
      setPoints((prev) =>
        prev.map((pt) => {
          if (pt.id !== uploadingPhotoPointId) return pt;
          return {
            ...pt,
            photos: [...(pt.photos || []), data.photo],
          };
        })
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Chyba při nahrávání fotografie.');
    } finally {
      setIsUploadingPhoto(false);
      setUploadingPhotoPointId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-12">
      {/* Hidden photo file input with camera capture support */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoFileChange}
        className="hidden"
      />

      {/* Mobile Sticky Header Card */}
      <div className="card p-4 space-y-3 sticky top-2 z-20 shadow-md bg-white/95 backdrop-blur-sm border-sky-100">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">
              Trasa posádky v terénu
            </span>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              {campaign.name}
            </h1>
          </div>
          <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-lg text-slate-700">
            {completedCount} / {totalCount} ks
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-semibold text-slate-500">
            <span>Postup demontáže trasy</span>
            <span>{percentDone} %</span>
          </div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${percentDone}%` }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {crews.length > 1 && (
            <select
              value={activeCrewFilter}
              onChange={(e) => setActiveCrewFilter(e.target.value)}
              className="px-2 py-1 text-xs font-semibold border border-slate-200 rounded-lg bg-white"
            >
              <option value="ALL">Všechny posádky</option>
              {crews.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1 overflow-x-auto text-xs ml-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterStatus === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Vše ({points.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('TODO')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterStatus === 'TODO'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              K řešení ({totalCount - completedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('DONE')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                filterStatus === 'DONE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hotovo ({completedCount})
            </button>
            {issueCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus('ISSUE')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  filterStatus === 'ISSUE'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Problém ({issueCount})
              </button>
            )}
          </div>
        </div>

        {/* Map Toggle & Quick Info */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMap(!showMap)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                showMap
                  ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5 text-sky-600" />
              <span>{showMap ? 'Skrýt mapu' : '🗺️ Zobrazit mapu'}</span>
            </button>

            {displayedPoints.length > 0 && (
              <a
                href={googleRouteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 shadow-sm"
                title="Spustit zbývající trasu přímo v navigaci Google Maps"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Maps trasa ↗</span>
              </a>
            )}
          </div>

          <span className="text-[11px] text-slate-500 font-medium ml-auto">
            {completedCount} z {totalCount} hotovo ({percentDone} %)
          </span>
        </div>
      </div>

      {/* Interactive Route Map */}
      {showMap && (
        <div className="card p-3 space-y-2 bg-white shadow-sm border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
            <span className="flex items-center gap-1.5">
              <MapIcon className="w-4 h-4 text-sky-600" />
              <span>Interaktivní mapa trasy ({displayedPoints.length} bodů)</span>
            </span>
            <span className="text-[11px] font-normal text-slate-500 hidden sm:inline">
              Kliknutím na bod na mapě vycentrujete kartu
            </span>
          </div>

          <ElectionRemovalMap
            points={displayedPoints}
            selectedPointId={selectedPointId}
            onSelectPoint={(id) => {
              setSelectedPointId(id);
              const el = document.getElementById(`point-card-${id}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
            height="300px"
          />
        </div>
      )}

      {/* Point Cards List */}
      <div className="space-y-3">
        {displayedPoints.length === 0 ? (
          <div className="card text-center py-12 px-4 space-y-2 border-dashed border-2 border-slate-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="font-bold text-slate-800 text-base">
              Žádná média v tomto výběru
            </p>
            <p className="text-xs text-slate-500">
              Všechna média v tomto filtru jsou hotova, nebo filtr neodpovídá.
            </p>
          </div>
        ) : (
          displayedPoints.map((point, index) => {
            const isCompleted = point.status === 'COMPLETED';
            const isInProgress = point.status === 'IN_PROGRESS';
            const isIssue = point.status === 'ISSUE';
            const isSelected = selectedPointId === point.id;
            const meta = parsePointMetadata(point.description);
            const cleanLayer = cleanLayerName(point.layerName);

            return (
              <div
                key={point.id}
                id={`point-card-${point.id}`}
                onClick={() => setSelectedPointId(point.id)}
                className={`card p-4 space-y-3 transition border-2 ${
                  isSelected ? 'ring-2 ring-sky-500 shadow-md ' : ''
                }${
                  isCompleted
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isInProgress
                    ? 'border-amber-300 bg-amber-50/30 ring-2 ring-amber-200'
                    : isIssue
                    ? 'border-rose-300 bg-rose-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Top header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-mono font-bold shadow-sm">
                      #{point.plannedOrder || index + 1}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800">
                        {ELECTION_REMOVAL_MEDIA_LABELS[point.mediaType] || point.mediaType}
                      </span>
                      {cleanLayer && (
                        <span
                          className="text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md"
                          title={point.layerName || undefined}
                        >
                          {cleanLayer}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hotovo
                      </span>
                    )}
                    {isInProgress && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse border border-amber-300">
                        <Clock className="w-3.5 h-3.5" /> Na místě
                      </span>
                    )}
                    {isIssue && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <AlertTriangle className="w-3.5 h-3.5" /> Problém
                      </span>
                    )}
                    {!isCompleted && !isInProgress && !isIssue && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                        Čeká
                      </span>
                    )}
                  </div>
                </div>

                {/* Medium Label */}
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug">
                    {point.label}
                  </h3>
                </div>

                {/* Structured Location & Address info */}
                {(meta.locality || meta.fullAddress || meta.otherNotes) && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 space-y-1 text-xs text-slate-700">
                    {meta.locality && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-slate-400 font-semibold min-w-[55px]">Lokalita:</span>
                        <span className="text-slate-900 font-bold">{meta.locality}</span>
                      </div>
                    )}
                    {meta.fullAddress && (
                      <div className="flex items-start gap-1.5">
                        <span className="text-slate-400 font-semibold min-w-[55px]">Adresa:</span>
                        <span className="text-slate-800 font-medium">{meta.fullAddress}</span>
                      </div>
                    )}
                    {meta.otherNotes && (
                      <div className="flex items-start gap-1.5 text-slate-600 pt-1 border-t border-slate-200/50">
                        <span className="text-slate-400 font-semibold min-w-[55px]">Poznámka:</span>
                        <span>{meta.otherNotes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Issue Details Box if reported */}
                {isIssue && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5 text-xs text-rose-800 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Důvod: {point.issueType}
                    </p>
                    {point.issueNote && <p>{point.issueNote}</p>}
                  </div>
                )}

                {/* Navigation and Location Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[90px] py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                  >
                    <Navigation className="w-3.5 h-3.5 text-sky-600" />
                    <span>Google Maps</span>
                  </a>

                  <a
                    href={`https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-[80px] py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                  >
                    <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Waze</span>
                  </a>

                  {meta.photoUrl && (
                    <a
                      href={meta.photoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[130px] py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Fotodokumentace ↗</span>
                    </a>
                  )}
                </div>

                {/* Photos List / Thumbnails if any */}
                {point.photos && point.photos.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                      Fotodokumentace ({point.photos.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {point.photos.map((ph) => (
                        <a
                          key={ph.id}
                          href={ph.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 relative group block"
                        >
                          <img
                            src={ph.url}
                            alt="Demontáž"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons for Mobile Worker */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  {!isCompleted && !isInProgress && !isIssue && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(point.id, 'START')}
                      className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow transition active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Zahájit na místě</span>
                    </button>
                  )}

                  {isInProgress && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(point.id, 'COMPLETE')}
                      className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Demontováno (Hotovo)</span>
                    </button>
                  )}

                  {isCompleted && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(point.id, 'RESET')}
                      className="py-1.5 px-3 text-slate-400 hover:text-slate-600 text-xs font-semibold flex items-center gap-1"
                      title="Vrátit stav zpět"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Vrátit</span>
                    </button>
                  )}

                  {isIssue && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(point.id, 'COMPLETE')}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Vyřešeno / Hotovo</span>
                    </button>
                  )}

                  {/* Photo Button */}
                  <button
                    type="button"
                    onClick={() => handleTriggerPhoto(point.id)}
                    disabled={isUploadingPhoto && uploadingPhotoPointId === point.id}
                    className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95"
                    title="Vyfotit médium"
                  >
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>{isUploadingPhoto && uploadingPhotoPointId === point.id ? 'Nahrávám...' : 'Vyfotit'}</span>
                  </button>

                  {/* Report Issue Button */}
                  {!isIssue && (
                    <button
                      type="button"
                      onClick={() => setReportingIssuePointId(point.id)}
                      className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition active:scale-95"
                      title="Nahlásit problém"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Problém</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Issue Report Modal */}
      {reportingIssuePointId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Nahlásit problém s demontáží
              </h3>
              <button
                type="button"
                onClick={() => setReportingIssuePointId(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Důvod problému *
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="NOT_FOUND">Nosič nenalezen na místě</option>
                  <option value="DAMAGED">Nosič poškozen / zničen</option>
                  <option value="INACCESSIBLE">Místo nepřístupné (zamčeno / soukromý pozemek)</option>
                  <option value="OTHER">Jiný problém</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Poznámka z terénu
                </label>
                <textarea
                  value={issueNote}
                  onChange={(e) => setIssueNote(e.target.value)}
                  placeholder="Popište situaci, kontakt na správce, důvod proč nelze demontovat..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReportingIssuePointId(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Zrušit
              </button>

              <button
                type="button"
                onClick={handleSubmitIssue}
                disabled={isSubmittingIssue}
                className="flex-1 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow transition"
              >
                {isSubmittingIssue ? 'Ukládám...' : 'Potvrdit problém'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
