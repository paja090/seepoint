'use client';

import { useState, useMemo } from 'react';
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
  ExternalLink,
  Clock,
} from 'lucide-react';

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
  campaignId: _campaignId,
  albumSlug,
  campaignName: _campaignName,
  clientName,
  points,
  publicShareUrl,
  downloadZipUrl,
  createdAt,
}: CampaignPhotoAlbumProps) {
  // Extract all available periods across all photos
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    for (const p of points) {
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
  }, [points]);

  // Extract distinct clients across points
  const availableClients = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of points) {
      const resolved = (p.clientName || p.layerName || clientName || '').trim();
      if (!resolved) continue;
      counts.set(resolved, (counts.get(resolved) || 0) + p.photos.length);
    }
    return Array.from(counts.entries())
      .map(([name, photoCount]) => ({ name, photoCount }))
      .sort((a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name, 'cs'));
  }, [points, clientName]);

  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INSTALL' | 'DEINSTALL' | 'CONTROL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Flatten photos with matching point
  const flatPhotosWithPoint = useMemo(() => {
    const list: Array<{ photo: InternalPhotoItem; point: InternalPointWithPhotos; pointClient: string | null }> = [];

    for (const point of points) {
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

    return list;
  }, [points, clientName, selectedClient, selectedPeriod, typeFilter, searchQuery]);

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
    try {
      await navigator.clipboard.writeText(clientShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Fallback
    }
  };

  const activeLightboxItem = lightboxIndex !== null && flatPhotosWithPoint[lightboxIndex]
    ? flatPhotosWithPoint[lightboxIndex]
    : null;

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

  const totalPhotosCount = points.reduce((sum, p) => sum + p.photos.length, 0);

  const resolvedDownloadZipUrl = downloadZipUrl || `/api/client/fotodokumentace/${encodeURIComponent(slug)}/download-zip${querySuffix}`;

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

        {totalPhotosCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                  ? 'Odkaz zkopírován!'
                  : selectedClient !== 'ALL'
                    ? `Odkaz pro: ${selectedClient}`
                    : 'Kopírovat odkaz pro klienta'}
              </span>
            </button>

            <Link
              href={clientShareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition text-xs font-semibold"
              title="Otevřít veřejné fotoalbum pro klienta v novém okně"
            >
              <ExternalLink className="w-4 h-4" />
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
          </div>
        )}
      </div>

      {totalPhotosCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center space-y-2">
          <Camera className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">
            Zatím nebyly nahrány žádné fotografie z terénu
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Jakmile pracovníci v Moje trasa potvrdí dokončení montáže nebo demontáže pořízením fotografie, snímky se automaticky roztřídí sem do alba podle měsíců a typů prací.
          </p>
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
                  const countInPeriod = points.reduce(
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
                  className="group rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/photos/${encodeURIComponent(photo.id)}/thumbnail`}
                      alt={point.label}
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
                  </div>

                  <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1">
                    {pointClient && (
                      <span className="inline-block truncate text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 w-fit max-w-full">
                        {pointClient}
                      </span>
                    )}
                    <p className="text-xs font-bold text-slate-900 truncate" title={point.label}>
                      {point.label}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatCzechDate(photo.createdAt)}
                    </p>
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
          <div className="flex items-center justify-between text-white border-b border-white/10 pb-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                Fotografie {lightboxIndex! + 1} z {flatPhotosWithPoint.length}
              </p>
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-lg">
                {activeLightboxItem.point.label}
              </h3>
            </div>

            <div className="flex items-center gap-3">
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
              alt={activeLightboxItem.point.label}
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
    </section>
  );
}
