'use client';

import { useState, useMemo } from 'react';
import {
  Camera,
  Calendar,
  Download,
  Filter,
  CheckCircle2,
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  Sparkles,
  MapPin,
  Clock,
  Layers,
} from 'lucide-react';

export interface PublicPhotoItem {
  id: string;
  url: string;
  type: string;
  fileName: string | null;
  createdAt: string;
  capturedLatitude?: number | null;
  capturedLongitude?: number | null;
  capturedByWorkerName?: string | null;
}

export interface PublicPointItem {
  id: string;
  label: string;
  description?: string | null;
  mediaType: string;
  objectType?: string | null;
  quantity: number;
  latitude: number;
  longitude: number;
  operationType?: string | null;
  photos: PublicPhotoItem[];
}

export interface PublicCampaignAlbumViewProps {
  token: string;
  campaign: {
    id: string;
    name: string;
    clientName?: string | null;
    description?: string | null;
    targetDate?: string | null;
    totalPoints: number;
    completedPoints: number;
  };
  points: PublicPointItem[];
  availablePeriods: string[]; // ["2026-10", "2026-09"]
  initialPeriod?: string;
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

function formatCzechDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function PublicCampaignAlbumView({
  token,
  campaign,
  points,
  availablePeriods,
  initialPeriod,
}: PublicCampaignAlbumViewProps) {
  // If no initialPeriod specified, default to the latest available period or "ALL"
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    initialPeriod || (availablePeriods.length > 0 ? availablePeriods[0] : 'ALL')
  );
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INSTALL' | 'DEINSTALL' | 'CONTROL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Flatten all photos matching current period and filters
  const flatPhotosWithPoint = useMemo(() => {
    const list: Array<{ photo: PublicPhotoItem; point: PublicPointItem }> = [];

    for (const point of points) {
      if (
        searchQuery.trim() &&
        !point.label.toLocaleLowerCase('cs').includes(searchQuery.toLocaleLowerCase('cs')) &&
        !point.description?.toLocaleLowerCase('cs').includes(searchQuery.toLocaleLowerCase('cs'))
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
        const isControl = photo.type === 'CONTROL';

        if (typeFilter === 'INSTALL' && !isInstall) continue;
        if (typeFilter === 'DEINSTALL' && !isDeinstall) continue;
        if (typeFilter === 'CONTROL' && !isControl) continue;

        list.push({ photo, point });
      }
    }

    return list;
  }, [points, selectedPeriod, typeFilter, searchQuery]);

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

  const downloadZipUrl = `/api/client/fotodokumentace/${encodeURIComponent(token)}/download-zip${
    selectedPeriod !== 'ALL' ? `?month=${encodeURIComponent(selectedPeriod)}` : ''
  }`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans print:bg-white print:text-black">
      {/* Top Client Header */}
      <header className="border-b border-slate-200 bg-white shadow-sm sticky top-0 z-20 print:static">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/seepoint-logo.svg" alt="SeePoint" className="h-8 w-auto" />
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                  Fotodokumentace zakázky
                </span>
                {campaign.clientName && (
                  <span className="text-xs text-slate-500 font-medium">
                    pro {campaign.clientName}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                {campaign.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
              title="Vytisknout přehled nebo uložit do PDF"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Tisk / PDF</span>
            </button>

            <a
              href={downloadZipUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Stáhnout fotografie (ZIP)</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* KPI Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Zobrazené fotografie
            </p>
            <p className="text-2xl font-bold text-sky-600 mt-1">
              {flatPhotosWithPoint.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Celkem lokalit
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {campaign.totalPoints}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Termín realizace
            </p>
            <p className="text-base sm:text-lg font-bold text-slate-900 mt-1 truncate">
              {campaign.targetDate ? new Date(campaign.targetDate).toLocaleDateString('cs-CZ') : 'Dle plánu'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Stav realizace
            </p>
            <p className="text-base sm:text-lg font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Ověřeno v terénu</span>
            </p>
          </div>
        </div>

        {/* Period & Filter Navigation Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 print:hidden">
          {/* Period selector */}
          {availablePeriods.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                <Calendar className="w-4 h-4 text-sky-600" />
                <span>Období / Měsíc:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {availablePeriods.map((period) => {
                  const isActive = selectedPeriod === period;
                  return (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setSelectedPeriod(period)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        isActive
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {formatPeriodLabel(period)}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('ALL')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    selectedPeriod === 'ALL'
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Všechna období
                </button>
              </div>
            </div>
          )}

          {/* Operation & Search Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                Filtr prací:
              </span>
              {(
                [
                  ['ALL', 'Všechny fotografie'],
                  ['INSTALL', '🛠️ Pouze Instalace'],
                  ['DEINSTALL', '🗑️ Pouze Deinstalace'],
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
                placeholder="Hledat lokalitu / ulici…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Photo Gallery Grid */}
        {flatPhotosWithPoint.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Pro vybrané období a filtr nejsou k dispozici žádné fotografie
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Zkuste zvolit jiné období v časové liště nebo přepnout filtr typu prací.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {flatPhotosWithPoint.map(({ photo, point }, index) => {
              const isInstall = ['AFTER_INSTALLATION', 'INSTALLATION', 'BEFORE_INSTALLATION'].includes(photo.type);
              const isDeinstall = photo.type === 'AFTER_DEINSTALLATION';

              return (
                <div
                  key={photo.id}
                  onClick={() => setLightboxIndex(index)}
                  className="group rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer flex flex-col"
                >
                  {/* Image Aspect Box with lazy loading */}
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={point.label}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm text-white ${
                          isInstall
                            ? 'bg-emerald-600'
                            : isDeinstall
                            ? 'bg-amber-600'
                            : 'bg-sky-600'
                        }`}
                      >
                        {isInstall ? 'Instalace' : isDeinstall ? 'Deinstalace' : 'Kontrola'}
                      </span>
                    </div>

                    <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] backdrop-blur-sm">
                      {formatCzechDate(photo.createdAt)}
                    </div>
                  </div>

                  {/* Metadata Card Footer */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 group-hover:text-sky-600 transition flex items-start gap-1.5">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{point.label}</span>
                      </h4>
                      {point.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 pl-5.5">
                          {point.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Množství: {point.quantity} ks</span>
                      <span className="text-sky-600 font-semibold group-hover:underline">
                        Zvětšit foto →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Lightbox Modal */}
      {activeLightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col justify-between p-4 sm:p-6 print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxIndex(null);
          }}
        >
          {/* Lightbox Topbar */}
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
                href={activeLightboxItem.photo.url}
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
                title="Zavřít"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Image Viewport */}
          <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6 select-none">
            {/* Prev Button */}
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 sm:left-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 transition"
              title="Předchozí fotografie"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeLightboxItem.photo.url}
              alt={activeLightboxItem.point.label}
              className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
            />

            {/* Next Button */}
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 sm:right-4 z-10 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 transition"
              title="Další fotografie"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Lightbox Footer Details */}
          <div className="bg-white/10 rounded-xl p-3 sm:p-4 text-white text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-4xl mx-auto w-full">
            <div className="space-y-0.5">
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

            <div className="flex items-center gap-3 text-slate-300 text-[11px]">
              {activeLightboxItem.point.latitude && activeLightboxItem.point.longitude && (
                <span>
                  GPS: {activeLightboxItem.point.latitude.toFixed(5)}, {activeLightboxItem.point.longitude.toFixed(5)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
