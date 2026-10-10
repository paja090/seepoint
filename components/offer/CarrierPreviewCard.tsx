'use client';

import { useState } from 'react';
import { MapPin, CheckCircle, Sparkles, Maximize2, Camera } from 'lucide-react';
import type { ProposalCarrier } from '@/lib/offers/presentation';
import { MEDIA_TYPE_META, TONE_CLASSES, formatCzk } from '@/lib/offers/presentation';

const statusMeta: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: 'Volný', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  RESERVED: { label: 'Rezervovaný', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  VERIFIED: { label: 'Ověřený', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
};

export function CarrierPreviewCard({
  carrier,
  isSelected = false,
  onOpen,
  onOpenPhoto,
}: {
  carrier: ProposalCarrier;
  isSelected?: boolean;
  onOpen: (carrier: ProposalCarrier) => void;
  onOpenPhoto?: (photoUrl: string, title: string) => void;
}) {
  const meta = MEDIA_TYPE_META[carrier.mediaType];
  const tone = TONE_CLASSES[meta.tone];
  const status = statusMeta[carrier.status] ?? { label: carrier.status, className: 'bg-slate-50 text-slate-700 ring-slate-200' };

  const photos = carrier.allPhotos && carrier.allPhotos.length > 0
    ? carrier.allPhotos
    : carrier.image ? [{ id: 'main', url: carrier.image, isPrimary: true }] : [];

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const currentPhoto = photos[activePhotoIdx] || { url: carrier.image || '/placeholder.svg' };

  const handlePhotoClick = () => {
    if (onOpenPhoto && currentPhoto.url) {
      onOpenPhoto(currentPhoto.url, `${carrier.code} – ${carrier.city}, ${carrier.locality}`);
    }
  };

  return (
    <article
      id={`carrier-card-${carrier.id}`}
      className={`flex w-[290px] shrink-0 flex-col overflow-hidden rounded-3xl border transition-all duration-300 sm:w-full ${
        isSelected
          ? 'border-amber-500 bg-amber-50/40 shadow-2xl ring-4 ring-amber-400/50 scale-[1.02]'
          : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:shadow-md'
      }`}
    >
      {/* Photo Header */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-900 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={carrier.imageAlt}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer"
          src={currentPhoto.url || '/placeholder.svg'}
          onClick={handlePhotoClick}
        />

        {/* Top Badges */}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5">
            {/* Numbering badge matching map pin */}
            <span className="inline-flex items-center justify-center size-7 rounded-xl bg-slate-950/90 text-white font-black text-xs border border-white/40 shadow-md">
              #{carrier.orderIndex}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold text-white truncate max-w-[140px] shadow-sm ${tone.bg}`}
            >
              {meta.label}
            </span>
          </div>

          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 shadow-sm ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        {/* Bottom overlays on image */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 pointer-events-none">
          {isSelected && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-1 text-[11px] font-black text-slate-950 shadow-md">
              <CheckCircle size={12} /> Vybráno na mapě
            </span>
          )}

          {photos.length > 1 && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-lg bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs border border-white/20">
              <Camera size={11} /> {activePhotoIdx + 1}/{photos.length}
            </span>
          )}
        </div>

        {/* Zoom button on hover */}
        {onOpenPhoto && currentPhoto.url && (
          <button
            type="button"
            onClick={handlePhotoClick}
            className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity size-8 rounded-xl bg-slate-950/80 text-white flex items-center justify-center hover:bg-slate-950 border border-white/20 cursor-pointer print:hidden"
            title="Zvětšit fotografii nosiče"
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>

      {/* Multiple Photos Thumbnail Strip */}
      {photos.length > 1 && (
        <div className="flex gap-1.5 px-4 pt-2.5 overflow-x-auto pb-1 bg-slate-50 border-b border-slate-100">
          {photos.map((p, idx) => (
            <button
              key={p.id || idx}
              type="button"
              onClick={() => setActivePhotoIdx(idx)}
              className={`relative size-9 shrink-0 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                activePhotoIdx === idx ? 'border-sky-600 ring-2 ring-sky-200' : 'border-slate-300 opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base font-extrabold text-slate-900 tracking-tight">
              #{carrier.orderIndex} · {carrier.code}
            </p>
            {carrier.unitPrice && Number(carrier.unitPrice) > 0 && (
              <span className="text-sm font-black text-slate-950">
                {formatCzk(Number(carrier.unitPrice))}
              </span>
            )}
          </div>
          {carrier.surfaceName && carrier.surfaceName !== carrier.code && (
            <p className="text-xs font-bold text-sky-800 line-clamp-1">{carrier.surfaceName}</p>
          )}
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 font-medium">
            <MapPin aria-hidden size={13} className="shrink-0 text-slate-400" />
            <span className="truncate">{carrier.city}, {carrier.locality}</span>
          </p>
        </div>

        {/* AI Selection Reasons */}
        {carrier.aiReasons && carrier.aiReasons.length > 0 && (
          <div className="space-y-1 rounded-xl bg-purple-50/70 p-2.5 border border-purple-100">
            <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-purple-700">
              <Sparkles size={11} className="text-purple-600" />
              <span>Důvody výběru AI:</span>
            </div>
            <ul className="space-y-1">
              {carrier.aiReasons.map((reason, rIdx) => (
                <li key={rIdx} className="flex items-start gap-1.5 text-xs text-slate-700 leading-tight">
                  <span className="text-purple-600 shrink-0 font-bold">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2 font-medium">
          <span>Rozměr: <strong className="text-slate-800">{carrier.dimensions}</strong></span>
          <span className="text-[11px] text-slate-400 font-mono">{carrier.mediaType}</span>
        </div>

        <button
          className={`mt-auto inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition cursor-pointer print:hidden ${
            isSelected
              ? 'border-amber-500 bg-amber-500 text-slate-950 font-black shadow-md hover:bg-amber-400'
              : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
          }`}
          onClick={() => onOpen(carrier)}
          type="button"
        >
          <MapPin aria-hidden size={14} />
          {isSelected ? 'Vycentrovat na mapě' : 'Zobrazit na mapě'}
        </button>
      </div>
    </article>
  );
}
