'use client';

import {
  CheckCircle2,
  AlertCircle,
  Camera,
  MapPin,
  Building,
  Eye,
  Send,
  ExternalLink,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import type { ClientOption, DraftPoint, DraftTarget, PresentationSettings } from './types';
import { NavigationOfferPresentationSettings } from './NavigationOfferPresentationSettings';
import { getPointPinVisual } from '@/lib/offers/navigation-carrier-types';

interface NavigationOfferReviewStepProps {
  selectedClient?: ClientOption;
  campaignName: string;
  city: string;
  validUntil: string;
  dateFrom: string;
  dateTo: string;
  targets: DraftTarget[];
  points: DraftPoint[];
  presentationSettings: PresentationSettings;
  onPresentationSettingsChange: (settings: PresentationSettings) => void;
  graphicArtworkUrl: string;
  onGraphicArtworkUrlChange: (url: string) => void;
  includeGraphicProof: boolean;
  onIncludeGraphicProofChange: (value: boolean) => void;
  internalNote: string;
  onInternalNoteChange: (note: string) => void;
  clientMessage: string;
  onClientMessageChange: (msg: string) => void;
  savedOfferId?: string;
  portalToken?: string;
}

export function NavigationOfferReviewStep({
  selectedClient,
  campaignName,
  city,
  validUntil,
  dateFrom,
  dateTo,
  targets,
  points,
  presentationSettings,
  onPresentationSettingsChange,
  graphicArtworkUrl,
  onGraphicArtworkUrlChange,
  includeGraphicProof,
  onIncludeGraphicProofChange,
  internalNote,
  onInternalNoteChange,
  clientMessage,
  onClientMessageChange,
  savedOfferId,
  portalToken,
}: NavigationOfferReviewStepProps) {
  const pointsWithPhotos = points.filter((p) => Boolean(p.sitePhotoUrl || p.sitePhotoId)).length;
  const pointsWithVisuals = points.filter((p) => Boolean(p.visualizedPhotoUrl)).length;

  const publicUrl = portalToken && typeof window !== 'undefined'
    ? `${window.location.origin}/offer/${portalToken}`
    : null;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-sky-600" size={18} />
            <span>Kontrola lokačního návrhu před odesláním (Fáze 1)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Zkontrolujte souhrn bodů trasy a cílových provozoven. V této fázi klient obdrží lokační výběr bez cen.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Klient</span>
            <span className="text-sm font-extrabold text-slate-900 block truncate">
              {selectedClient?.name || 'Nevybrán'}
            </span>
            <span className="text-[11px] text-slate-500 truncate block">
              {selectedClient?.email || 'Bez e-mailu'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Kampaň & Město</span>
            <span className="text-sm font-extrabold text-slate-900 block truncate">
              {campaignName || 'Bez názvu'}
            </span>
            <span className="text-[11px] text-slate-500 truncate block">
              📍 {city || 'Neuvedeno'}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Provozovny</span>
            <span className="text-sm font-extrabold text-slate-900 block">
              {targets.length} {targets.length === 1 ? 'prodejna' : targets.length < 5 ? 'prodejny' : 'prodejen'}
            </span>
            <span className="text-[11px] text-slate-500 truncate block">
              Hlavní: {targets[0]?.name}
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Navigační body</span>
            <span className="text-sm font-extrabold text-slate-900 block">
              {points.length} {points.length === 1 ? 'bod' : points.length < 5 ? 'body' : 'bodů'}
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold block">
              📸 {pointsWithPhotos} fotek sloupu · {pointsWithVisuals} vizualizací
            </span>
          </div>
        </div>

        {/* Breakdown of Points */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
            Přehled vytipovaných bodů ({points.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {points.map((pt, idx) => {
              const vis = getPointPinVisual(pt);
              return (
                <div
                  key={pt.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-xs flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-black text-xs text-white"
                      style={{ backgroundColor: vis.color }}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="font-extrabold text-slate-900 block truncate">{pt.label}</span>
                      <span className="text-[10px] text-slate-500 truncate block">
                        {vis.icon} {vis.category.shortLabel} {pt.pillarNumber ? `· VO #${pt.pillarNumber}` : ''}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {pt.latitude?.toFixed(4)}, {pt.longitude?.toFixed(4)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Public Link Card if saved */}
        {publicUrl && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-sky-950">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Klientský odkaz na nabídku je aktivní:</span>
              </span>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 font-bold underline"
              >
                <span>Otevřít náhled klienta</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <p className="font-mono text-xs text-sky-900 bg-white/80 p-2 rounded-lg border border-sky-100 break-all select-all">
              {publicUrl}
            </p>
          </div>
        )}
      </div>

      {/* Collapsible Presentation Settings */}
      <NavigationOfferPresentationSettings
        presentationSettings={presentationSettings}
        onPresentationSettingsChange={onPresentationSettingsChange}
        graphicArtworkUrl={graphicArtworkUrl}
        onGraphicArtworkUrlChange={onGraphicArtworkUrlChange}
        includeGraphicProof={includeGraphicProof}
        onIncludeGraphicProofChange={onIncludeGraphicProofChange}
        internalNote={internalNote}
        onInternalNoteChange={onInternalNoteChange}
        clientMessage={clientMessage}
        onClientMessageChange={onClientMessageChange}
      />
    </div>
  );
}
