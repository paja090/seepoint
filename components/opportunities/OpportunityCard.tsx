'use client';

import { useState } from 'react';
import { ExternalLink, MapPin, Calendar, Building2, Sparkles, UserCheck, Ban, ChevronDown, Check, ShieldCheck, BrainCircuit, Compass, Layers } from 'lucide-react';
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
  const rawMeta = item.scoreReasons && typeof item.scoreReasons === 'object' && !Array.isArray(item.scoreReasons)
    ? (item.scoreReasons as {
        reasons?: OpportunityScoreReason[];
        components?: {
          relevance: number;
          freshness: number;
          locationFit: number;
          companyFit: number;
          confidence: number;
        };
        evidenceFact?: string | null;
        aiInterpretation?: string | null;
        aiRecommendation?: string | null;
      })
    : null;

  const reasonsList = rawMeta?.reasons || (Array.isArray(item.scoreReasons) ? (item.scoreReasons as OpportunityScoreReason[]) : []);
  const components = rawMeta?.components;
  const evidenceFact = rawMeta?.evidenceFact;
  const aiInterpretation = rawMeta?.aiInterpretation;
  const aiRecommendation = rawMeta?.aiRecommendation;

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

          {/* CRM / Opportunity Type Status */}
          {item.client ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              <Check className="w-3.5 h-3.5" />
              <span>Expanze / Upsell: {item.client.name}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-sky-400 bg-sky-950/50 border border-sky-800/40">
              <span>Nová akvizice (Prospekt)</span>
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

      {/* Main Title & Subtitle */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white tracking-tight leading-snug">
              {item.companyName} — <span className="text-purple-300 font-bold">{item.title}</span>
            </h3>
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

      {/* Segregated Cards: Fact vs AI Interpretation vs Next Best Action */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {/* 1. Co se stalo (Ověřený fakt) */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Co se stalo (Ověřený fakt):</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            {evidenceFact || item.summary}
          </p>
        </div>

        {/* 2. Proč je to relevantní (AI interpretace) */}
        <div className="rounded-xl border border-slate-800 bg-purple-950/30 p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
            <BrainCircuit className="w-4 h-4 text-purple-400" />
            <span>Proč je to relevantní (AI interpretace OOH):</span>
          </div>
          <p className="text-xs text-purple-200/90 leading-relaxed font-medium">
            {aiInterpretation || 'Významný impuls pro venkovní reklamu. Doporučeno oslovit firmu s lokální nabídkou v dojezdové vzdálenosti provozovny.'}
          </p>
        </div>
      </div>

      {/* 3. Doporučený postup (Next Best Action) */}
      <div className="rounded-xl border border-sky-800/40 bg-sky-950/30 p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>Next Best Action:</span>
          </div>
          <span className="text-[11px] font-semibold text-sky-400/80">
            {item.client ? 'Priorita: Stávající klient' : 'Priorita: Akvizice nového klienta'}
          </span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed font-medium">
          {aiRecommendation || (item.client
            ? `Navázat na stávající spolupráci s ${item.client.name} a předložit nabídku na podporu ${item.city || 'lokality'}.`
            : `Prověřit volné kapacity nosičů v lokalitě ${item.city || 'ČR'} a oslovit firmu s konkrétním návrhem.`)}
        </p>
      </div>

      {/* 5-Component Score Breakdown */}
      {components && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-[11px]">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-center">
            <div className="text-slate-400 font-semibold">Relevance</div>
            <div className="text-purple-300 font-black text-sm">{components.relevance} / 25</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-center">
            <div className="text-slate-400 font-semibold">Čerstvost</div>
            <div className="text-emerald-300 font-black text-sm">{components.freshness} / 20</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-center">
            <div className="text-slate-400 font-semibold">Lokalita</div>
            <div className="text-sky-300 font-black text-sm">{components.locationFit} / 25</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-center">
            <div className="text-slate-400 font-semibold">Firma Fit</div>
            <div className="text-amber-300 font-black text-sm">{components.companyFit} / 20</div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-center col-span-2 sm:col-span-1">
            <div className="text-slate-400 font-semibold">Důvěryhodnost</div>
            <div className="text-indigo-300 font-black text-sm">{components.confidence} / 10</div>
          </div>
        </div>
      )}

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
              <span>Detailní zdůvodnění skóre ({reasonsList.length} faktorů)</span>
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showReasons ? 'rotate-180' : ''}`} />
          </button>

          {showReasons && (
            <ul className="space-y-1.5 pt-1 text-xs text-slate-300 border-t border-slate-800/80">
              {reasonsList.map((r, idx) => (
                <li key={idx} className="flex items-start justify-between gap-2">
                  <span>• {r.reason}</span>
                  <span className={`font-mono font-bold shrink-0 ${r.points >= 0 ? 'text-purple-400' : 'text-rose-400'}`}>
                    {r.points >= 0 ? `+${r.points}` : r.points}
                  </span>
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

          {/* Direct Link to Occupancy / Inventory check */}
          <a
            href={`/occupancy/ai?city=${encodeURIComponent(item.city || '')}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-sky-800/50 transition"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Prověřit inventář</span>
          </a>

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
