'use client';

import { useState } from 'react';
import { ExternalLink, MapPin, Calendar, Building2, Sparkles, UserCheck, Ban, ChevronDown, Check } from 'lucide-react';
import type { OpportunityEventType, OpportunityStatus } from '@prisma/client';
import type { OpportunityScoreReason } from '@/lib/opportunities/types';

export type OpportunityItem = {
  id: string;
  companyName: string;
  companyId?: string | null;
  website?: string | null;
  eventType: OpportunityEventType;
  title: string;
  summary: string;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  eventDate?: string | Date | null;
  detectedAt: string | Date;
  sourceUrl: string;
  sourceTitle: string;
  sourcePublishedAt?: string | Date | null;
  opportunityScore: number;
  scoreReasons?: OpportunityScoreReason[] | unknown;
  scoreTrigger?: number | null;
  scoreCustomerFit?: number | null;
  scoreTiming?: number | null;
  scoreGeo?: number | null;
  scoreMediaFit?: number | null;
  scoreEvidence?: number | null;
  suggestedMediaTypes?: string[] | unknown;
  status: OpportunityStatus;
  clientId?: string | null;
  client?: { id: string; name: string; companyId?: string | null; status?: string } | null;
  createdOfferId?: string | null;
  createdOffer?: { id: string; title: string; status: string; isNoPriceConcept?: boolean } | null;
  assignedToUserId?: string | null;
  assignedTo?: { id: string; name: string; email: string } | null;
  dismissedReason?: string | null;
};

function getScoreBadge(score: number) {
  if (score >= 90) {
    return {
      label: `${score} / 100`,
      className: 'bg-gradient-to-r from-amber-500 to-rose-600 text-white font-black border-amber-400 shadow-md',
      tag: '🔥 Mimořádně silná příležitost',
    };
  }
  if (score >= 75) {
    return {
      label: `${score} / 100`,
      className: 'bg-purple-950/90 text-purple-300 border-purple-700/80 font-black',
      tag: '⚡ Vysoký potenciál',
    };
  }
  if (score >= 60) {
    return {
      label: `${score} / 100`,
      className: 'bg-sky-950/90 text-sky-300 border-sky-700/80 font-extrabold',
      tag: '📍 Střední potenciál',
    };
  }
  return {
    label: `${score} / 100`,
    className: 'bg-slate-900 text-slate-400 border-slate-700 font-bold',
    tag: 'Základní signál',
  };
}

const eventTypeLabels: Record<OpportunityEventType, { label: string; badge: string }> = {
  NEW_BRANCH: { label: 'Nová pobočka', badge: '🏬 Pobočka' },
  NEW_ESTABLISHMENT: { label: 'Nová provozovna', badge: '🏬 Provozovna' },
  STORE_OPENING: { label: 'Otevření prodejny', badge: '🛒 Prodejna' },
  RESTAURANT_OPENING: { label: 'Nová restaurace / Gastro', badge: '🍔 Gastro' },
  CAR_DEALERSHIP: { label: 'Nový autosalon', badge: '🚗 Autosalon' },
  RETAIL_PARK: { label: 'Nový retail park', badge: '🏛️ Retail Park' },
  RETAIL_PARK_TENANT: { label: 'Nájemce v retail parku', badge: '🏬 Nájemce' },
  EXPANSION: { label: 'Expanze firmy', badge: '📈 Expanze' },
  RELOCATION: { label: 'Stěhování provozovny', badge: '🚚 Stěhování' },
  REOPENING: { label: 'Znovuotevření', badge: '🛠️ Rekonstrukce' },
  MARKETING_EVENT: { label: 'Marketingová akce', badge: '📣 Akce' },
  SEASONAL_CAMPAIGN: { label: 'Sezónní kampaň', badge: '❄️ Sezóna' },
  NEW_PRODUCT_SERVICE: { label: 'Nový produkt / služba', badge: '✨ Novinka' },
  EVENT_EXHIBITION: { label: 'Výstava / Event', badge: '🎪 Event' },
  MASS_RECRUITMENT: { label: 'Nábor zaměstnanců', badge: '👷 Nábor' },
  OTHER: { label: 'Obchodní příležitost', badge: '📍 Signál' },
};

const mediaLabels: Record<string, string> = {
  CITY_POSTER: '🖼️ City Poster (CLP)',
  PROMO_BENCH: '🪑 Reklamní lavičky',
  NAVIGATION_SIGN: '🧭 Navigace VO',
  CITYLIGHT: '💡 Citylight (CLV)',
  BILLBOARD: '📐 Billboardy',
  BIGBOARD: '🏢 Bigboardy',
  LED_SCREEN: '📺 LED Obrazovky',
  BANNER: '🖨️ Plachty & Bannery',
};

export function OpportunityCard({
  item,
  onPrepareProposal,
  onLinkCrm,
  onUpdateStatus,
}: {
  item: OpportunityItem;
  onPrepareProposal: (item: OpportunityItem) => void;
  onLinkCrm: (item: OpportunityItem) => void;
  onUpdateStatus: (id: string, status: OpportunityStatus, dismissedReason?: string) => void;
}) {
  const [showReasons, setShowReasons] = useState(false);

  const scoreBadge = getScoreBadge(item.opportunityScore);
  const eventMeta = eventTypeLabels[item.eventType] || eventTypeLabels.OTHER;
  const reasonsList = Array.isArray(item.scoreReasons) ? (item.scoreReasons as OpportunityScoreReason[]) : [];
  const mediaTypesList = Array.isArray(item.suggestedMediaTypes) ? (item.suggestedMediaTypes as string[]) : ['CITY_POSTER', 'PROMO_BENCH', 'NAVIGATION_SIGN'];

  const eventDateFormatted = item.eventDate
    ? new Date(item.eventDate).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Datum nepotvrzeno';

  return (
    <article className="group rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 shadow-xl hover:border-purple-800/60 transition">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Score Badge */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs border ${scoreBadge.className}`}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>Score {scoreBadge.label}</span>
          </span>

          {/* Event Type Badge */}
          <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-slate-950 text-slate-300 border border-slate-800">
            {eventMeta.badge}
          </span>

          {/* CRM Status */}
          {item.client ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              <Check className="w-3.5 h-3.5" />
              <span>V CRM: {item.client.name}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-slate-400 bg-slate-950 border border-slate-800">
              <span>Mimo CRM</span>
            </span>
          )}

          {item.status === 'NEW' ? (
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-800/60 bg-amber-950/70 px-2 py-0.5 text-[11px] font-bold text-amber-200">
              AI návrh – před použitím ověřit
            </span>
          ) : null}
        </div>

        <span className="text-[11px] font-semibold text-slate-400">
          Detekováno: {new Date(item.detectedAt).toLocaleDateString('cs-CZ')}
        </span>
      </div>

      {/* Main Content */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white tracking-tight leading-snug">
              {item.companyName} — <span className="text-purple-300 font-bold">{item.title}</span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 font-medium leading-relaxed">
              {item.summary}
            </p>
          </div>
        </div>

        {/* Location & Date Strip */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300 pt-1">
          <div className="flex items-center gap-1.5 text-sky-300">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>
              {item.city
                ? `${item.city}${item.address ? `, ${item.address}` : ''}${item.region ? ` (${item.region})` : ''}`
                : (item.region ? `Kraj: ${item.region}` : 'Lokalita neznámá / celorepubliková')}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-amber-300">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Termín události: {eventDateFormatted}</span>
          </div>
        </div>
      </div>

      {/* Recommended Media Pills */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] font-bold text-slate-400 mr-1">Doporučená média:</span>
        {mediaTypesList.map((mediaType) => (
          <span
            key={mediaType}
            className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-purple-950/60 text-purple-200 border border-purple-800/40"
          >
            {mediaLabels[mediaType] || mediaType}
          </span>
        ))}
      </div>

      {/* Score Factor Breakdown */}
      {reasonsList.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowReasons(!showReasons)}
            className="flex items-center justify-between w-full text-xs font-extrabold text-slate-300 hover:text-white"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Zdůvodnění skóre ({reasonsList.length} faktorů)</span>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showReasons ? 'rotate-180' : ''}`} />
          </button>

          {showReasons && (
            <ul className="space-y-1.5 pt-1 text-xs text-slate-300 border-t border-slate-800/80">
              {reasonsList.map((r, idx) => (
                <li key={idx} className="flex items-start justify-between gap-2">
                  <span>• {r.reason}</span>
                  <span className="font-mono text-purple-400 font-bold shrink-0">+{r.points}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Source Citation */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
        <div className="flex items-center gap-1.5 truncate max-w-md">
          <span>Zdroj:</span>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:underline font-bold truncate flex items-center gap-1"
          >
            <span>{item.sourceTitle}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        </div>

        {item.createdOffer && (
          <span className="text-emerald-400 font-bold">
            📄 Koncept vytvořen
          </span>
        )}
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Action: Prepare Campaign Concept */}
          <button
            type="button"
            onClick={() => onPrepareProposal(item)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Připravit návrh kampaně</span>
          </button>

          {/* CRM Link Action */}
          {!item.client && (
            <button
              type="button"
              onClick={() => onLinkCrm(item)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Přidat / propojit s CRM</span>
            </button>
          )}

          {/* Mark as Contacted */}
          {['NEW', 'REVIEWED', 'CONTACT_PLANNED'].includes(item.status) ? (
            <button
              type="button"
              onClick={() => onUpdateStatus(item.id, 'CONTACTED')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition"
            >
              <UserCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>Označit jako kontaktováno</span>
            </button>
          ) : null}
        </div>

        {/* Ignore / Dismiss Action */}
        {!['DISMISSED', 'CONVERTED'].includes(item.status) ? (
          <button
            type="button"
            onClick={() => onUpdateStatus(item.id, 'DISMISSED', 'Není v současné době relevantní')}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-400 text-xs font-medium px-2 py-1 transition"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Ignorovat</span>
          </button>
        ) : null}
      </div>
    </article>
  );
}
