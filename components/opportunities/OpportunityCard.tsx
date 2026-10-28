'use client';

import { useState } from 'react';
import { OpportunitySources } from './OpportunitySources';
import {
  ExternalLink,
  MapPin,
  Calendar,
  Building2,
  Sparkles,
  UserCheck,
  Ban,
  ChevronDown,
  Check,
  ShieldCheck,
  BrainCircuit,
  Compass,
  Layers,
  Phone,
  Mail,
  Send,
  Copy,
  Loader2,
  Bot,
  Hammer,
} from 'lucide-react';
import type { OpportunityEventType, OpportunityStatus } from '@prisma/client';
import type { OpportunityScoreReason } from '@/lib/opportunities/types';

type AiSalesPitchData = {
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  companyId: string;
  dic: string;
  website: string;
  salesAngle: string;
  recommendedProduction: string[];
  emailSubject: string;
  emailBody: string;
  callScript: string[];
  nearbyCarriers: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    city: string;
    distanceKm?: number;
    availabilityStatus?: 'AVAILABLE' | 'OCCUPIED';
    availabilityLabel?: string;
  }>;
  generatedAt?: string;
};

export type OpportunityItem = {
  id: string;
  updatedAt?: string | Date;
  _count?: { sources: number };
  sources?: { semanticConfidence: number | null }[];
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
      className: 'bg-emerald-950/80 text-emerald-300 font-bold border-emerald-800/60',
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
  isHighlighted = false,
  onPrepareProposal,
  onLinkCrm,
  onUpdateStatus,
  onChanged,
}: {
  item: OpportunityItem;
  isHighlighted?: boolean;
  onChanged: () => void;
  onPrepareProposal: (item: OpportunityItem) => void;
  onLinkCrm: (item: OpportunityItem) => void;
  onUpdateStatus: (id: string, status: OpportunityStatus, dismissedReason?: string) => void;
}) {
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
        aiSalesPitch?: AiSalesPitchData | null;
      })
    : null;

  const [showReasons, setShowReasons] = useState(false);
  const [salesPitch, setSalesPitch] = useState<AiSalesPitchData | null>(rawMeta?.aiSalesPitch || null);
  const [pitchOpen, setPitchOpen] = useState<boolean>(Boolean(isHighlighted && rawMeta?.aiSalesPitch));
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitchActionBusy, setPitchActionBusy] = useState(false);
  const [pitchFeedback, setPitchFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const handleGenerateSalesPitch = async () => {
    setPitchOpen(true);
    setPitchLoading(true);
    setPitchFeedback(null);
    try {
      const res = await fetch(`/api/sales/opportunities/${item.id}/ai-pitch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.pitch) {
        throw new Error(data.error || 'AI Obchodníkovi se nepodařilo dohledat podklady.');
      }
      setSalesPitch(data.pitch);
    } catch (err) {
      setPitchFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Chyba při přípravě oslovení.',
      });
    } finally {
      setPitchLoading(false);
    }
  };

  const handleExecutePitchAction = async (action: 'save_to_crm' | 'send_email' | 'log_call') => {
    if (!salesPitch) return;
    setPitchActionBusy(true);
    setPitchFeedback(null);
    try {
      const res = await fetch(`/api/sales/opportunities/${item.id}/ai-pitch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          contactName: salesPitch.contactName,
          contactRole: salesPitch.contactRole,
          contactEmail: salesPitch.contactEmail,
          contactPhone: salesPitch.contactPhone,
          companyId: salesPitch.companyId,
          dic: salesPitch.dic,
          website: salesPitch.website,
          emailSubject: salesPitch.emailSubject,
          emailBody: salesPitch.emailBody,
          callNotes: salesPitch.callScript.join('\n'),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Akce selhala.');

      const msg =
        action === 'send_email'
          ? `E-mail byl odeslán na ${salesPitch.contactEmail}, kontakt uložen do CRM a příležitost označena jako Kontaktováno.`
          : action === 'log_call'
          ? 'Telefonát byl zapsán do historie komunikace v CRM a příležitost označena jako Kontaktováno.'
          : 'Dohledaný kontakt, IČO a web byly uloženy do CRM.';

      setPitchFeedback({ ok: true, text: msg });
      onChanged();
    } catch (err) {
      setPitchFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Nepodařilo se provést akci.',
      });
    } finally {
      setPitchActionBusy(false);
    }
  };

  const scoreBadge = getScoreBadge(item.opportunityScore);
  const eventMeta = eventTypeLabels[item.eventType] || eventTypeLabels.OTHER;

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
    <article
      id={`opportunity-card-${item.id}`}
      className={`ai-radar-card group rounded-2xl border p-5 space-y-4 transition ${
        isHighlighted
          ? 'border-emerald-500/80 bg-slate-900 ring-2 ring-emerald-500/30 shadow-xl'
          : 'border-slate-800 bg-slate-900/90'
      }`}
    >
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

      <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{item.summary}</p>
      <details className="rounded-xl border border-slate-800 p-3">
        <summary className="text-sm font-semibold text-slate-300">Podklady a AI interpretace</summary>
      {/* Evidence remains accessible without overwhelming the opportunity overview. */}
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

      </details>
      {/* 3. Doporučený postup (Next Best Action) */}
      <div className="rounded-xl border border-sky-800/40 bg-sky-950/30 p-3 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-300">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>Doporučený další krok</span>
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
            aria-expanded={showReasons}
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

      <div className="flex flex-wrap gap-3 text-xs text-purple-300">
        <span className="rounded-lg border border-purple-800 bg-purple-950/50 px-2 py-1">{item._count?.sources || 1} {(item._count?.sources || 1) === 1 ? 'zdroj' : (item._count?.sources || 1) < 5 ? 'zdroje' : 'zdrojů'}</span>
        {item.sources?.[0]?.semanticConfidence != null && <span>Jistota posledního přiřazení: {Math.round(item.sources[0].semanticConfidence * 100)} %</span>}
        {item.updatedAt && <span>Poslední aktualizace: {new Date(item.updatedAt).toLocaleDateString('cs-CZ')}</span>}
      </div>
      <OpportunitySources key={`${item.id}:${item.updatedAt}`} opportunityId={item.id} count={item._count?.sources || 1} onChanged={onChanged} />
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
          {/* Primary AI Sales Rep Action */}
          <button
            type="button"
            onClick={() => {
              if (salesPitch) {
                setPitchOpen((prev) => !prev);
              } else {
                void handleGenerateSalesPitch();
              }
            }}
            disabled={pitchLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md transition disabled:opacity-60 cursor-pointer"
          >
            {pitchLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>AI Obchodník hledá kontakt & nosiče…</span>
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                <span>
                  {salesPitch
                    ? pitchOpen
                      ? 'Skrýt AI Obchodníka'
                      : 'Otevřít AI Obchodníka (kontakt & e-mail)'
                    : 'AI Obchodník: Dohledat kontakt & oslovit'}
                </span>
              </>
            )}
          </button>

          {/* Secondary Action: Prepare Campaign Concept */}
          <button
            type="button"
            onClick={() => onPrepareProposal(item)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer"
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition cursor-pointer"
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
            className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-400 text-xs font-medium px-2 py-1 transition cursor-pointer"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Ignorovat</span>
          </button>
        ) : null}
      </div>

      {/* AI OBCHODNÍK COCKPIT PANEL */}
      {pitchOpen && (
        <div className="rounded-2xl border border-emerald-700/60 bg-slate-950/95 p-4 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-emerald-300 font-black text-sm">
              <Bot className="w-5 h-5 text-emerald-400" />
              <span>AI Obchodník — Kompletní příprava oslovení ({item.companyName})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleGenerateSalesPitch}
                disabled={pitchLoading}
                className="text-xs font-bold text-slate-400 hover:text-emerald-300 underline cursor-pointer disabled:opacity-50"
              >
                {pitchLoading ? 'Obnovuji…' : '🔄 Znovu dohledat a přegenerovat'}
              </button>
              <button
                type="button"
                onClick={() => setPitchOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer"
              >
                Zavřít
              </button>
            </div>
          </div>

          {pitchLoading && !salesPitch && (
            <div className="py-8 text-center space-y-2 text-slate-300 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
              <p className="font-bold text-sm text-emerald-300">
                AI Obchodník prohledává web firmy, rejstřík ARES a vaše volné nosiče v okolí…
              </p>
              <p className="text-slate-400">
                Dohledávám kontaktní osobu, telefon, e-mail a sestavuji nabídku na míru.
              </p>
            </div>
          )}

          {pitchFeedback && (
            <div
              className={`rounded-xl p-3 text-xs font-semibold border ${
                pitchFeedback.ok
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-700 text-rose-200'
              }`}
            >
              {pitchFeedback.text}
            </div>
          )}

          {salesPitch && (
            <div className="space-y-4">
              {/* 1. Obchodní argument */}
              {salesPitch.salesAngle && (
                <div className="rounded-xl bg-emerald-950/40 border border-emerald-800/60 p-3 text-xs text-emerald-200">
                  <span className="font-extrabold text-emerald-300 block mb-0.5">
                    🎯 Proč teď nakoupí (hlavní obchodní argument):
                  </span>
                  <span>{salesPitch.salesAngle}</span>
                </div>
              )}

              {/* 2. Dohledané kontakty a IČO (editovatelné) */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-sky-300 uppercase tracking-wider">
                    👤 Dohledaný kontakt & údaje firmy (můžete upravit před uložením)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExecutePitchAction('save_to_crm')}
                    disabled={pitchActionBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-sky-300 transition cursor-pointer disabled:opacity-50"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>💾 Uložit kontakt a firmu do CRM</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Jméno kontaktu / oddělení
                    </label>
                    <input
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white font-semibold"
                      value={salesPitch.contactName}
                      onChange={(e) =>
                        setSalesPitch({ ...salesPitch, contactName: e.target.value })
                      }
                      placeholder="Např. Ing. Jan Novák"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Role / Pozice
                    </label>
                    <input
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white"
                      value={salesPitch.contactRole}
                      onChange={(e) =>
                        setSalesPitch({ ...salesPitch, contactRole: e.target.value })
                      }
                      placeholder="Jednatel / Marketing"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      IČO firmy
                    </label>
                    <input
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white font-mono"
                      value={salesPitch.companyId}
                      onChange={(e) =>
                        setSalesPitch({ ...salesPitch, companyId: e.target.value })
                      }
                      placeholder="8místné IČO"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      E-mail příjemce
                    </label>
                    <input
                      type="email"
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-emerald-300 font-semibold"
                      value={salesPitch.contactEmail}
                      onChange={(e) =>
                        setSalesPitch({ ...salesPitch, contactEmail: e.target.value })
                      }
                      placeholder="email@firma.cz"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Telefon
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-amber-300 font-semibold"
                        value={salesPitch.contactPhone}
                        onChange={(e) =>
                          setSalesPitch({ ...salesPitch, contactPhone: e.target.value })
                        }
                        placeholder="+420 ..."
                      />
                      {salesPitch.contactPhone && (
                        <a
                          href={`tel:${salesPitch.contactPhone}`}
                          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 text-xs font-bold transition"
                          title="Zavolat na toto číslo"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Volat</span>
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Web společnosti
                    </label>
                    <input
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-sky-300"
                      value={salesPitch.website}
                      onChange={(e) =>
                        setSalesPitch({ ...salesPitch, website: e.target.value })
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* 3. Nalezené nosiče v okolí + Doporučená výroba */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-purple-300">
                    <MapPin className="w-4 h-4 text-purple-400" />
                    <span>Naše nosiče v okolí ({salesPitch.nearbyCarriers.length}):</span>
                  </div>
                  {salesPitch.nearbyCarriers.length > 0 ? (
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {salesPitch.nearbyCarriers.map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span className="truncate">
                            <strong className="text-white">{c.code}</strong> · {c.name} ({c.city})
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
                                c.availabilityStatus === 'OCCUPIED'
                                  ? 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                                  : 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60'
                              }`}
                            >
                              {c.availabilityStatus === 'OCCUPIED' ? '🟡 ' : '🟢 '}
                              {c.availabilityLabel || 'Volný ihned'}
                            </span>
                            {c.distanceKm !== undefined && (
                              <span className="text-[11px] font-bold text-slate-400">
                                {c.distanceKm} km
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      V bezprostředním okolí nebyly nalezeny přesné GPS souřadnice nosičů – nabídněte regionální síť nebo navigační systém.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                    <Hammer className="w-4 h-4 text-amber-400" />
                    <span>Doporučená výroba a montáž na klíč:</span>
                  </div>
                  {salesPitch.recommendedProduction.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-200">
                      {salesPitch.recommendedProduction.map((prod, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{prod}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Polepy výloh, výroba světelné reklamy a tisk velkoformátových plachet.
                    </p>
                  )}
                </div>
              </div>

              {/* 4. Tahák do telefonu */}
              {salesPitch.callScript.length > 0 && (
                <div className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3.5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                      <Phone className="w-4 h-4 text-amber-400" />
                      <span>📞 Tahák na 30vteřinový telefonát:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExecutePitchAction('log_call')}
                      disabled={pitchActionBusy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 text-white px-3 py-1 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Zavoláno – zapsat hovor do CRM & označit Kontaktováno</span>
                    </button>
                  </div>
                  <ul className="space-y-1.5 text-xs text-amber-100/90">
                    {salesPitch.callScript.map((line, i) => (
                      <li key={i} className="leading-relaxed">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 5. Připravený e-mail k okamžitému odeslání */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    <span>✉️ Připravený osobní e-mail (můžete libovolně upravit):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const origin =
                          typeof window !== 'undefined' ? window.location.origin : 'https://os.seepoint.cz';
                        const catalogUrl = `${origin}/client/catalog${
                          item.city ? `?city=${encodeURIComponent(item.city)}` : ''
                        }`;
                        if (!salesPitch.emailBody.includes('/client/catalog')) {
                          setSalesPitch({
                            ...salesPitch,
                            emailBody: `${salesPitch.emailBody.trim()}\n\nPřehled našich volných reklamních ploch v lokalitě ${
                              item.city || 'ČR'
                            } včetně cen a možnosti online výběru najdete přímo zde:\n${catalogUrl}`,
                          });
                          setPitchFeedback({
                            ok: true,
                            text: 'Do textu e-mailu byl vložen přímý odkaz na Katalog volných ploch pro klienta.',
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/70 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition cursor-pointer"
                    >
                      <Layers className="w-3 h-3" />
                      <span>+ Vložit odkaz na Katalog ploch</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${salesPitch.emailSubject}\n\n${salesPitch.emailBody}`
                        );
                        setPitchFeedback({
                          ok: true,
                          text: 'Předmět i text e-mailu byly zkopírovány do schránky.',
                        });
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-200 transition cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Kopírovat text</span>
                    </button>
                    {salesPitch.contactEmail && (
                      <a
                        href={`mailto:${encodeURIComponent(
                          salesPitch.contactEmail
                        )}?subject=${encodeURIComponent(
                          salesPitch.emailSubject
                        )}&body=${encodeURIComponent(salesPitch.emailBody)}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-sky-300 transition"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Otevřít v poště</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Předmět e-mailu
                    </label>
                    <input
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs font-bold text-white"
                      value={salesPitch.emailSubject}
                      onChange={(e) =>
                        setSalesPitch({ ...salesPitch, emailSubject: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 block mb-1">
                      Text e-mailu
                    </label>
                    <textarea
                      rows={7}
                      className="w-full rounded-lg bg-slate-950 border border-slate-800 p-3 text-xs text-slate-100 leading-relaxed font-medium"
                      value={salesPitch.emailBody}
                      onChange={(e) =>
                        setSalesPitch({ ...salesPitch, emailBody: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleExecutePitchAction('send_email')}
                    disabled={pitchActionBusy || !salesPitch.contactEmail.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-extrabold shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    {pitchActionBusy ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Odesílám a ukládám do CRM…</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>
                          Odeslat e-mail ze SeePOINTu & uložit do CRM
                          {salesPitch.contactEmail ? ` (${salesPitch.contactEmail})` : ''}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onPrepareProposal(item)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/70 text-purple-200 px-3.5 py-2 text-xs font-bold transition cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Vytvořit k tomu vizuální nabídku s mapou</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
