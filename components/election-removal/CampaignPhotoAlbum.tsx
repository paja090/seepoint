'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Camera,
  Calendar,
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Clock,
  Upload,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { compressImageFile } from '@/lib/image-compress';
import { PhotoAlbumShareModal } from '@/components/fotodokumentace/PhotoAlbumShareModal';

export interface InternalPhotoItem {
  id: string;
  url: string;
  type: string;
  fileName: string | null;
  createdAt: string | Date;
  capturedLatitude?: number | null;
  capturedLongitude?: number | null;
  capturedByWorkerName?: string | null;
  fieldWorkStepId?: string | null;
}

export interface InternalPointWithPhotos {
  id: string;
  label: string;
  description?: string | null;
  layerName?: string | null;
  clientName?: string | null;
  quantity: number;
  operationType?: string | null;
  latitude: number;
  longitude: number;
  photos: InternalPhotoItem[];
}

export interface CampaignPhotoAlbumProps {
  campaignId: string;
  albumSlug: string;
  campaignName: string;
  clientName?: string | null;
  points: InternalPointWithPhotos[];
  publicShareUrl?: string;
  downloadZipUrl?: string;
  createdAt?: string | Date;
  onPhotosUpdated?: (campaignId: string, updatedPoints: InternalPointWithPhotos[]) => void;
}

const MONTH_NAMES_CS: Record<string, string> = {
  '01': 'Leden',
  '02': 'Únor',
  '03': 'Březen',
  '04': 'Duben',
  '05': 'Květen',
  '06': 'Červen',
  '07': 'Červenec',
  '08': 'Srpen',
  '09': 'Září',
  '10': 'Říjen',
  '11': 'Listopad',
  '12': 'Prosinec',
};

function formatPeriodLabel(periodKey: string): string {
  const [year, month] = periodKey.split('-');
  return `${MONTH_NAMES_CS[month] || month} ${year}`;
}

function formatCzechDate(dateVal?: string | Date | null): string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function CampaignPhotoAlbum({
  campaignId,
  albumSlug,
  clientName,
  points,
  publicShareUrl,
  downloadZipUrl,
  createdAt,
  onPhotosUpdated,
}: CampaignPhotoAlbumProps) {
  const [pointsState, setPointsState] = useState<InternalPointWithPhotos[]>(points);
  useEffect(() => {
    setPointsState(points);
  }, [points]);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadTargetPointId, setUploadTargetPointId] = useState<string>('');
  const [uploadCustomName, setUploadCustomName] = useState('');
  const [uploadType, setUploadType] = useState<'CONTROL' | 'INSTALLATION' | 'DEINSTALLATION' | 'DAMAGE'>('CONTROL');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Rename & Delete state
  const [isDeletingPhotoId, setIsDeletingPhotoId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Share Modal & Toast state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Extract all available periods across all photos
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    for (const p of pointsState) {
      for (const ph of p.photos) {
        const d = new Date(ph.createdAt);
        if (!Number.isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          set.add(`${y}-${m}`);
        }
      }
    }
    return Array.from(set).sort().reverse();
  }, [pointsState]);

  // Extract distinct clients across points
  const availableClients = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of pointsState) {
      const resolved = (p.clientName || p.layerName || clientName || '').trim();
      if (!resolved) continue;
      counts.set(resolved, (counts.get(resolved) || 0) + p.photos.length);
    }
    return Array.from(counts.entries())
      .map(([name, photoCount]) => ({ name, photoCount }))
      .sort((a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name, 'cs'));
  }, [pointsState, clientName]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INSTALL' | 'DEINSTALL' | 'CONTROL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Flatten photos with matching point
  const flatPhotosWithPoint = useMemo(() => {
    const list: Array<{ photo: InternalPhotoItem; point: InternalPointWithPhotos; pointClient: string | null }> = [];

    for (const point of pointsState) {
      const pointClient = (point.clientName || point.layerName || clientName || '').trim() || null;

      if (selectedClient !== 'ALL' && pointClient !== selectedClient) {
        continue;
      }

      if (
        searchQuery.trim() &&
        !point.label.toLocaleLowerCase('cs').includes(searchQuery.toLocaleLowerCase('cs')) &&
        !point.description?.toLocaleLowerCase('cs').includes(searchQuery.toLocaleLowerCase('cs')) &&
        !(pointClient && pointClient.toLocaleLowerCase('cs').includes(searchQuery.toLocaleLowerCase('cs')))
      ) {
        continue;
      }

      for (const photo of point.photos) {
        const d = new Date(photo.createdAt);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        if (selectedPeriod !== 'ALL' && ym !== selectedPeriod) {
          continue;
        }

        const isInstall = ['AFTER_INSTALLATION', 'INSTALLATION', 'BEFORE_INSTALLATION'].includes(photo.type);
        const isDeinstall = photo.type === 'AFTER_DEINSTALLATION';
        const isControl = photo.type === 'CONTROL' || photo.type === 'CHECK';

        if (typeFilter === 'INSTALL' && !isInstall) continue;
        if (typeFilter === 'DEINSTALL' && !isDeinstall) continue;
        if (typeFilter === 'CONTROL' && !isControl) continue;

        list.push({ photo, point, pointClient });
      }
    }

    list.sort((a, b) => new Date(b.photo.createdAt).getTime() - new Date(a.photo.createdAt).getTime());
    return list;
  }, [pointsState, clientName, selectedClient, selectedPeriod, typeFilter, searchQuery]);

  const slug = albumSlug;

  const querySuffix = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedPeriod !== 'ALL') params.set('month', selectedPeriod);
    if (selectedClient !== 'ALL') params.set('client', selectedClient);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [selectedPeriod, selectedClient]);

  const clientShareUrl = useMemo(() => {
    if (publicShareUrl) {
      if (typeof window === 'undefined') return publicShareUrl;
      const base = window.location.origin;
      return publicShareUrl.startsWith('http') ? publicShareUrl : `${base}${publicShareUrl}`;
    }
    if (typeof window === 'undefined') return `/client/fotodokumentace/${slug}${querySuffix}`;
    const base = window.location.origin;
    return `${base}/client/fotodokumentace/${slug}${querySuffix}`;
  }, [publicShareUrl, slug, querySuffix]);

  const handleCopyLink = async () => {
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(clientShareUrl);
        success = true;
      }
    } catch {
      // Fallback below
    }

    if (!success) {
      try {
        const input = document.createElement('textarea');
        input.value = clientShareUrl;
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.top = '-9999px';
        document.body.appendChild(input);
        input.focus();
        input.select();
        success = document.execCommand('copy');
        document.body.removeChild(input);
      } catch (e) {
        console.error('Fallback copy failed', e);
      }
    }

    if (success) {
      setCopiedLink(true);
      setShareToast('✅ Odkaz na fotoalbum byl zkopírován do schránky!');
      setTimeout(() => setCopiedLink(false), 3000);
      setTimeout(() => setShareToast(null), 3500);
    } else {
      window.prompt('Zkopírujte tento odkaz pro klienta:', clientShareUrl);
    }
  };

  const activeLightboxItem = lightboxIndex !== null && flatPhotosWithPoint[lightboxIndex]
    ? flatPhotosWithPoint[lightboxIndex]
    : null;

  useEffect(() => {
    setIsEditingName(false);
    if (activeLightboxItem) {
      setNameInput(activeLightboxItem.photo.fileName || '');
    }
  }, [lightboxIndex, activeLightboxItem]);

  const handlePrev = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    } else if (lightboxIndex === 0) {
      setLightboxIndex(flatPhotosWithPoint.length - 1);
    }
  };

  const handleNext = () => {
    if (lightboxIndex !== null && lightboxIndex < flatPhotosWithPoint.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    } else if (lightboxIndex !== null) {
      setLightboxIndex(0);
    }
  };

  const totalPhotosCount = pointsState.reduce((sum, p) => sum + p.photos.length, 0);

  const resolvedDownloadZipUrl = downloadZipUrl || `/api/client/fotodokumentace/${encodeURIComponent(slug)}/download-zip${querySuffix}`;

  // File selection for upload modal
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError(null);
    const preview = URL.createObjectURL(file);
    setUploadPreviewUrl(preview);
    if (!uploadCustomName.trim()) {
      setUploadCustomName(file.name.replace(/\.[^/.]+$/, ''));
    }
    if (!uploadTargetPointId && pointsState.length > 0) {
      setUploadTargetPointId(pointsState[0].id);
    }
  };

  // Submit new photo upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const compressed = await compressImageFile(uploadFile, 1920, 0.85);
      const form = new FormData();
      form.set('file', compressed);
      form.set('albumId', campaignId);
      const targetPoint = uploadTargetPointId || pointsState[0]?.id;
      if (targetPoint) {
        form.set('pointId', targetPoint);
      }
      if (uploadCustomName.trim()) {
        form.set('fileName', uploadCustomName.trim());
      }
      form.set('type', uploadType);

      const res = await fetch('/api/fotodokumentace/photos', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nahrání fotografie se nezdařilo.');
      }

      const newPhoto: InternalPhotoItem = {
        id: data.photo.id,
        url: data.photo.url,
        type: data.photo.type,
        fileName: data.photo.fileName,
        createdAt: data.photo.createdAt,
        capturedByWorkerName: data.photo.capturedByWorkerName,
      };

      const updatedPoints = pointsState.map((pt) => {
        if (pt.id === targetPoint) {
          return {
            ...pt,
            photos: [newPhoto, ...pt.photos],
          };
        }
        return pt;
      });

      setPointsState(updatedPoints);
      onPhotosUpdated?.(campaignId, updatedPoints);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadPreviewUrl(null);
      setUploadCustomName('');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Chyba při nahrávání fotografie.');
    } finally {
      setIsUploading(false);
    }
  };

  // Save renamed photo
  const savePhotoName = async (photoId: string, newName: string) => {
    setIsSavingName(true);
    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: newName }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Přejmenování se nezdařilo.');
        return false;
      }

      const updatedPoints = pointsState.map((pt) => ({
        ...pt,
        photos: pt.photos.map((ph) =>
          ph.id === photoId ? { ...ph, fileName: newName } : ph
        ),
      }));

      setPointsState(updatedPoints);
      onPhotosUpdated?.(campaignId, updatedPoints);
      return true;
    } catch {
      alert('Chyba při přejmenování fotografie.');
      return false;
    } finally {
      setIsSavingName(false);
    }
  };

  // Quick rename prompt from card
  const handleQuickRename = async (photo: InternalPhotoItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = photo.fileName || '';
    const newName = window.prompt('Zadejte nový název fotografie:', current);
    if (!newName || newName.trim() === '' || newName.trim() === current) return;
    await savePhotoName(photo.id, newName.trim());
  };

  // Save rename from lightbox inline input
  const handleSaveRenameInLightbox = async () => {
    if (!activeLightboxItem || !nameInput.trim()) return;
    const ok = await savePhotoName(activeLightboxItem.photo.id, nameInput.trim());
    if (ok) setIsEditingName(false);
  };

  // Delete photo
  const handleDeletePhoto = async (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Opravdu chcete tuto fotografii smazat z alba i disku?')) return;
    setIsDeletingPhotoId(photoId);

    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(photoId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Smazání fotografie se nezdařilo.');
        return;
      }

      const updatedPoints = pointsState.map((pt) => ({
        ...pt,
        photos: pt.photos.filter((ph) => ph.id !== photoId),
      }));

      setPointsState(updatedPoints);
      onPhotosUpdated?.(campaignId, updatedPoints);

      if (lightboxIndex !== null) {
        if (flatPhotosWithPoint.length <= 1) {
          setLightboxIndex(null);
        } else if (lightboxIndex >= flatPhotosWithPoint.length - 1) {
          setLightboxIndex(Math.max(0, flatPhotosWithPoint.length - 2));
        }
      }
    } catch {
      alert('Chyba při mazání fotografie.');
    } finally {
      setIsDeletingPhotoId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-6 shadow-sm">
      {/* Header and Sharing Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="p-1 rounded bg-sky-50 text-sky-700">
              <Camera className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              Album fotodokumentace zakázky
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
              {totalPhotosCount} fotografií celkem
            </span>
            {createdAt && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Vytvořeno: <strong className="text-slate-700">{formatCzechDate(createdAt)}</strong>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Fotografie jsou automaticky rozděleny podle klientů a typu operace (Kontrola, Instalace, Deinstalace).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowUploadModal(true);
              setUploadError(null);
              if (!uploadTargetPointId && pointsState.length > 0) {
                setUploadTargetPointId(pointsState[0].id);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition text-xs font-bold shadow-sm"
            title="Nahrát fotografii z telefonu nebo počítače"
          >
            <Plus className="w-4 h-4" />
            <span>Nahrát fotografii</span>
          </button>

          {totalPhotosCount > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition text-xs font-bold shadow-xs"
                title="Sdílet fotoalbum pro klienta (odkaz, WhatsApp, e-mail)"
              >
                <Share2 className="w-4 h-4 text-sky-600" />
                <span>Sdílet album</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition border shadow-sm ${
                  copiedLink
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Zkopíruje odkaz na klientské fotoalbum do schránky"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span>
                  {copiedLink
                    ? 'Zkopírováno!'
                    : selectedClient !== 'ALL'
                      ? `Kopírovat pro: ${selectedClient}`
                      : 'Kopírovat odkaz'}
                </span>
              </button>

              <Link
                href={clientShareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-xs font-semibold"
                title="Otevřít veřejné fotoalbum pro klienta v novém okně"
              >
                <ExternalLink className="w-4 h-4 text-slate-500" />
                <span>Náhled pro klienta</span>
              </Link>

              <a
                href={resolvedDownloadZipUrl}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                <span>
                  {selectedClient !== 'ALL' ? `Stáhnout ZIP (${selectedClient})` : 'Stáhnout ZIP'}
                </span>
              </a>
            </>
          )}
        </div>
      </div>

      {totalPhotosCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-3">
          <Camera className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">
            Zatím nebyly nahrány žádné fotografie z terénu
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Fotografie můžete nahrát přímo z vašeho telefonu nebo počítače, nebo se nahrají automaticky z mobilní aplikace techniků.
          </p>
          <button
            type="button"
            onClick={() => {
              setShowUploadModal(true);
              setUploadError(null);
              if (!uploadTargetPointId && pointsState.length > 0) {
                setUploadTargetPointId(pointsState[0].id);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition text-xs font-bold shadow-sm mx-auto"
          >
            <Upload className="w-4 h-4" />
            <span>Nahrát první fotografii</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Month / Period Filter Pills */}
          {availablePeriods.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Období (Rok a měsíc):
              </span>
              <div className="flex flex-wrap gap-2">
                {availablePeriods.map((period) => {
                  const countInPeriod = pointsState.reduce(
                    (sum, p) =>
                      sum +
                      p.photos.filter((ph) => {
                        const d = new Date(ph.createdAt);
                        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === period;
                      }).length,
                    0
                  );
                  const isActive = selectedPeriod === period;

                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        isActive
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {formatPeriodLabel(period)} ({countInPeriod})
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setSelectedPeriod('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    selectedPeriod === 'ALL'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Všechna období ({totalPhotosCount})
                </button>
              </div>
            </div>
          )}

          {/* Client Filter Pills (Rozdělení podle klientů) */}
          {availableClients.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Rozdělení podle klienta:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedClient('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    selectedClient === 'ALL'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Všichni klienti ({totalPhotosCount})
                </button>
                {availableClients.map((cl) => {
                  const isActive = selectedClient === cl.name;
                  return (
                    <button
                      key={cl.name}
                      type="button"
                      onClick={() => setSelectedClient(cl.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cl.name} ({cl.photoCount})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Operation & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  ['ALL', 'Všechny operace'],
                  ['INSTALL', '🛠️ Instalace'],
                  ['DEINSTALL', '🗑️ Deinstalace'],
                  ['CONTROL', '🔍 Kontroly'],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setTypeFilter(val)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                    typeFilter === val
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="sm:max-w-xs w-full">
              <input
                type="text"
                placeholder="Hledat klienta, místo nebo popis…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Photo Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pt-2">
            {flatPhotosWithPoint.map(({ photo, point, pointClient }, index) => {
              const isInstall = ['AFTER_INSTALLATION', 'INSTALLATION', 'BEFORE_INSTALLATION'].includes(photo.type);
              const isDeinstall = photo.type === 'AFTER_DEINSTALLATION';

              return (
                <div
                  key={photo.id}
                  onClick={() => setLightboxIndex(index)}
                  className="group rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer flex flex-col relative"
                >
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${encodeURIComponent(photo.id)}/thumbnail`}
                      alt={photo.fileName || point.label}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />

                    <span
                      className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm text-white ${
                        isInstall
                          ? 'bg-emerald-600'
                          : isDeinstall
                          ? 'bg-amber-600'
                          : photo.type === 'DAMAGE'
                          ? 'bg-rose-600'
                          : 'bg-sky-600'
                      }`}
                    >
                      {isInstall ? 'Instalace' : isDeinstall ? 'Deinstalace' : photo.type === 'DAMAGE' ? 'Závada' : 'Kontrola'}
                    </span>

                    {/* Quick action overlay buttons on photo card */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition z-10">
                      <button
                        type="button"
                        onClick={(e) => handleQuickRename(photo, e)}
                        className="p-1.5 rounded-full bg-black/60 text-white hover:bg-sky-600 transition shadow-sm"
                        title="Přejmenovat fotografii"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeletePhoto(photo.id, e)}
                        disabled={isDeletingPhotoId === photo.id}
                        className="p-1.5 rounded-full bg-black/60 text-white hover:bg-rose-600 transition shadow-sm"
                        title="Smazat fotografii"
                      >
                        {isDeletingPhotoId === photo.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-300" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1">
                    {pointClient && (
                      <span className="inline-block truncate text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 w-fit max-w-full">
                        {pointClient}
                      </span>
                    )}
                    <p className="text-xs font-bold text-slate-900 truncate" title={photo.fileName || point.label}>
                      {photo.fileName || point.label}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="truncate max-w-[100px]" title={point.label}>{point.label}</span>
                      <span>{formatCzechDate(photo.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxIndex(null);
          }}
        >
          <div className="flex items-center justify-between text-white border-b border-white/10 pb-3 gap-2">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Fotografie {lightboxIndex! + 1} z {flatPhotosWithPoint.length}
              </p>
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-lg">
                {activeLightboxItem.photo.fileName || activeLightboxItem.point.label}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-1 focus:ring-sky-400"
                    placeholder="Název fotografie…"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRenameInLightbox();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveRenameInLightbox}
                    disabled={isSavingName}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition text-xs font-bold"
                    title="Uložit název"
                  >
                    {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(false)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs"
                    title="Zrušit"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(true);
                    setNameInput(activeLightboxItem.photo.fileName || activeLightboxItem.point.label);
                  }}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs font-semibold flex items-center gap-1.5"
                  title="Přejmenovat fotografii"
                >
                  <Pencil className="w-4 h-4" />
                  <span className="hidden sm:inline">Přejmenovat</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDeletePhoto(activeLightboxItem.photo.id)}
                disabled={isDeletingPhotoId === activeLightboxItem.photo.id}
                className="p-2 rounded-lg bg-rose-500/30 hover:bg-rose-600 text-rose-200 hover:text-white transition text-xs font-semibold flex items-center gap-1.5"
                title="Smazat fotografii z alba i disku"
              >
                {isDeletingPhotoId === activeLightboxItem.photo.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Smazat</span>
              </button>

              <a
                href={`/api/photos/${encodeURIComponent(activeLightboxItem.photo.id)}/file`}
                target="_blank"
                rel="noreferrer"
                download
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition text-xs font-semibold flex items-center gap-1.5"
                title="Stáhnout fotografii v plném rozlišení"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Stáhnout</span>
              </a>

              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6 select-none">
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 sm:left-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${encodeURIComponent(activeLightboxItem.photo.id)}/file`}
              alt={activeLightboxItem.photo.fileName || activeLightboxItem.point.label}
              style={{
                backgroundImage: `url(/api/photos/${encodeURIComponent(activeLightboxItem.photo.id)}/thumbnail)`,
                backgroundSize: 'contain',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
            />

            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 sm:right-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 transition"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-white/10 rounded-xl p-3 sm:p-4 text-white text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-4xl mx-auto w-full">
            <div>
              <span className="font-semibold text-sky-400">
                {activeLightboxItem.point.label}
              </span>
              <p className="text-slate-300">
                Pořízeno: {formatCzechDate(activeLightboxItem.photo.createdAt)}
                {activeLightboxItem.photo.capturedByWorkerName && (
                  <span className="ml-2">· Realizoval: {activeLightboxItem.photo.capturedByWorkerName}</span>
                )}
              </p>
            </div>

            {activeLightboxItem.point.latitude && activeLightboxItem.point.longitude && (
              <span className="text-slate-400 text-[11px]">
                GPS: {activeLightboxItem.point.latitude.toFixed(5)}, {activeLightboxItem.point.longitude.toFixed(5)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal (Upload z telefonu nebo počítače) */}
      {showUploadModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isUploading) {
              setShowUploadModal(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Nahrát fotografii do alba</h3>
                  <p className="text-xs text-slate-500">Z mobilního telefonu nebo počítače</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* File Picker or Camera */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Vyberte fotografii
                </label>
                {uploadPreviewUrl ? (
                  <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center aspect-[16/9] max-h-48">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={uploadPreviewUrl}
                      alt="Náhled"
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => {
                        setUploadFile(null);
                        setUploadPreviewUrl(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-rose-600 transition"
                      title="Zvolit jiný soubor"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-white">
                      {uploadFile?.name} ({(uploadFile!.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 rounded-xl cursor-pointer transition text-center group">
                      <Camera className="w-6 h-6 text-slate-400 group-hover:text-sky-600 mb-1" />
                      <span className="text-xs font-bold text-slate-700 group-hover:text-sky-700">Vyfotit fotoaparátem</span>
                      <span className="text-[10px] text-slate-400">Přímé vyfocení z mobilu</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>

                    <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 rounded-xl cursor-pointer transition text-center group">
                      <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 mb-1" />
                      <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">Vybrat soubor / galerii</span>
                      <span className="text-[10px] text-slate-400">Z počítače nebo knihovny fotek</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Target Point Selector */}
              {pointsState.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Přiřadit k bodu / nosiči
                  </label>
                  <select
                    value={uploadTargetPointId}
                    onChange={(e) => setUploadTargetPointId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {pointsState.map((pt) => (
                      <option key={pt.id} value={pt.id}>
                        {pt.label} {pt.clientName ? `[${pt.clientName}]` : ''} {pt.description ? `— ${pt.description}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom File Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Název fotografie (volitelné)
                </label>
                <input
                  type="text"
                  placeholder="např. Celkový pohled, Detail instalace…"
                  value={uploadCustomName}
                  onChange={(e) => setUploadCustomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Operation Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Typ záznamu
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['CONTROL', '🔍 Kontrola'],
                      ['INSTALLATION', '🛠️ Instalace'],
                      ['DEINSTALLATION', '🗑️ Deinstalace'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setUploadType(val)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                        uploadType === val
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Nahrávám a ukládám na Disk…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Nahrát fotografii</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Album Modal */}
      <PhotoAlbumShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        album={{
          title: selectedClient !== 'ALL'
            ? `${selectedClient} — Fotoalbum`
            : (clientName ? `${clientName} — Fotoalbum` : 'Fotoalbum zakázky'),
          clientName: selectedClient !== 'ALL' ? selectedClient : clientName,
          photosCount: totalPhotosCount,
          publicShareUrl: clientShareUrl,
          sourceLabel: 'Fotoalbum zakázky',
        }}
      />

      {/* Floating toast notification */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl border border-slate-800 animate-in slide-in-from-bottom-3 duration-200">
          <span>{shareToast}</span>
        </div>
      )}
    </section>
  );
}
