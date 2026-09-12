'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Loader2,
  HelpCircle,
  Compass,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui';

export type InsightItem = {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'OPEN' | 'RESOLVED' | 'IGNORED';
  title: string;
  deterministicReason?: string;
  description?: string;
  actionRecommendation?: string | null;
  aiRecommendation?: string | null;
  aiExplanation?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  differenceInDays?: number | null;
  opportunityValue?: number | null;
  technicalFacts?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  surfaceId?: string | null;
  surface?: {
    id: string;
    name: string;
    mediaType: string;
    status: string;
    carrier?: {
      id: string;
      code: string;
      name: string;
      city?: string | null;
      address?: string | null;
    } | null;
  } | null;
  carrier?: {
    id: string;
    code: string;
    name: string;
    city?: string | null;
    address?: string | null;
  } | null;
  client?: {
    id: string;
    name: string;
  } | null;
  offer?: {
    id: string;
    title?: string | null;
    campaignName?: string | null;
  } | null;
  createdAt: string;
  resolvedAt?: string | null;
};

type AlternativeCandidate = {
  surfaceId: string;
  carrierCode: string;
  surfaceName: string;
  city: string;
  mediaType: string;
  suitabilityScore: number;
  similarity: string;
  reason: string;
  pitch: string;
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  insight: InsightItem | null;
  onExecuteAction: (insightId: string, actionType: string) => Promise<void>;
}

const severityConfig: Record<string, { label: string; badge: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { label: 'Kritická kolize', badge: 'bg-rose-100 text-rose-800 border-rose-300', icon: AlertTriangle },
  HIGH: { label: 'Vysoká priorita', badge: 'bg-orange-100 text-orange-800 border-orange-300', icon: ShieldAlert },
  MEDIUM: { label: 'Střední priorita', badge: 'bg-amber-100 text-amber-800 border-amber-300', icon: Clock },
  LOW: { label: 'Nízká / Doporučení', badge: 'bg-slate-100 text-slate-800 border-slate-300', icon: HelpCircle },
};

const statusConfig: Record<string, { label: string; badge: string }> = {
  OPEN: { label: 'Otevřeno', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
  RESOLVED: { label: 'Vyřešeno', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  IGNORED: { label: 'Ignorováno', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export function OccupancyInsightDetailModal({ isOpen, onClose, insight, onExecuteAction }: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<AlternativeCandidate[] | null>(null);
  const [altError, setAltError] = useState<string | null>(null);

  if (!isOpen || !insight) return null;

  const meta = ((insight.metadata || {}) as Record<string, any>);
  const periodStart = insight.periodStart || (meta.periodStart ? String(meta.periodStart) : null);
  const periodEnd = insight.periodEnd || (meta.periodEnd ? String(meta.periodEnd) : null);
  const differenceInDays = insight.differenceInDays ?? (typeof meta.differenceInDays === 'number' ? meta.differenceInDays : null);
  const technicalFacts = insight.technicalFacts || (meta.technicalFacts as Record<string, unknown> | undefined) || meta;
  const description = insight.deterministicReason || insight.description || '';
  const recommendation = insight.aiRecommendation || insight.actionRecommendation || null;
  const carrier = insight.carrier || insight.surface?.carrier;

  const severity = severityConfig[insight.severity] || severityConfig.LOW;
  const status = statusConfig[insight.status] || statusConfig.OPEN;
  const SeverityIcon = severity.icon;

  const handleAction = async (actionType: string) => {
    try {
      setLoadingAction(actionType);
      await onExecuteAction(insight.id, actionType);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFetchAlternatives = async () => {
    if (!insight.surfaceId) return;
    setLoadingAlternatives(true);
    setAltError(null);
    try {
      const res = await fetch('/api/occupancy/intelligence/alternatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surfaceId: insight.surfaceId,
          dateFrom: periodStart,
          dateTo: periodEnd,
          maxResults: 4,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nepodařilo se najít alternativy.');
      setAlternatives(data.alternatives || []);
    } catch (err) {
      setAltError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingAlternatives(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl transition-all border border-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${severity.badge}`}>
                <SeverityIcon size={13} />
                {severity.label}
              </span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.badge}`}>
                {status.label}
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: {insight.id.slice(0, 8)}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-2">{insight.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: DATABASE FACTS */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                📌 Fakta z databáze (Deterministický stav)
              </span>
              {carrier?.id && (
                <a
                  href={`/carriers/${carrier.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  Otevřít nosič <ExternalLink size={12} />
                </a>
              )}
            </div>

            <p className="text-sm font-medium text-slate-800 leading-relaxed">
              {description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="rounded-lg bg-white p-3 border border-slate-200">
                <span className="text-slate-500 block">Plocha / Nosič</span>
                <span className="font-semibold text-slate-900 block truncate" title={insight.surface?.name}>
                  {insight.surface?.name || 'Neurčeno'}
                </span>
                <span className="text-slate-400 block font-mono text-[11px]">
                  {carrier?.code || ''}
                </span>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200">
                <span className="text-slate-500 block">Lokalita & Město</span>
                <span className="font-semibold text-slate-900 block truncate">
                  {carrier?.city || 'Neurčeno'}
                </span>
                <span className="text-slate-400 block truncate text-[11px]">
                  {carrier?.address || '—'}
                </span>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200">
                <span className="text-slate-500 block">Termín / Dny</span>
                <span className="font-semibold text-slate-900 block">
                  {periodStart ? new Date(periodStart).toLocaleDateString('cs-CZ') : '—'}
                  {periodEnd ? ` do ${new Date(periodEnd).toLocaleDateString('cs-CZ')}` : ''}
                </span>
                <span className="text-slate-400 block text-[11px]">
                  {differenceInDays ? `${differenceInDays} dní` : '—'}
                </span>
              </div>

              <div className="rounded-lg bg-white p-3 border border-slate-200">
                <span className="text-slate-500 block">Klient / Nabídka</span>
                <span className="font-semibold text-slate-900 block truncate" title={insight.client?.name}>
                  {insight.client?.name || 'Bez klienta'}
                </span>
                <span className="text-slate-400 block text-[11px] truncate">
                  {insight.offer?.title ? `Nabídka: ${insight.offer.title}` : '—'}
                </span>
              </div>
            </div>

            {technicalFacts && Object.keys(technicalFacts).length > 0 && (
              <div className="rounded-lg bg-white p-3 border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                  Technické parametry detekce
                </span>
                <pre className="text-[11px] font-mono text-slate-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(technicalFacts, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* SECTION 2: AI RECOMMENDATION */}
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/40 p-5 space-y-3">
            <div className="flex items-center gap-2 text-indigo-900">
              <Sparkles size={16} className="text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider">
                AI Analýza & Doporučení pro obchod
              </span>
            </div>

            <div className="text-sm text-slate-800 space-y-2">
              <div className="p-3 bg-white/80 rounded-lg border border-indigo-100 shadow-xs">
                <span className="text-xs font-semibold text-indigo-950 block mb-1">💡 Analýza situace:</span>
                <p className="leading-relaxed">
                  {insight.aiExplanation || 'AI analýza je připravena na vyžádání nebo na základě parametrů nálezu.'}
                </p>
              </div>

              {recommendation && (
                <div className="p-3 bg-white/80 rounded-lg border border-indigo-100 shadow-xs">
                  <span className="text-xs font-semibold text-indigo-950 block mb-1">🎯 Doporučený postup:</span>
                  <p className="leading-relaxed text-indigo-950 font-medium">
                    {recommendation}
                  </p>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 italic pt-1">
              ⚠️ Poznámka: AI v SeePoint OS funguje výhradně jako analytický a doporučující asistent. Žádné změny termínů ani zrušení rezervací se neprovádí automaticky bez schválení uživatele.
            </p>
          </div>

          {/* SECTION 3: ALTERNATIVES SEARCH */}
          {insight.surfaceId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  🔄 Návrh alternativních ploch v okolí
                </span>
                {!alternatives && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleFetchAlternatives}
                    disabled={loadingAlternatives}
                  >
                    {loadingAlternatives ? (
                      <>
                        <Loader2 size={14} className="animate-spin mr-1.5" />
                        Vyhledávám volné plochy...
                      </>
                    ) : (
                      <>
                        <Compass size={14} className="mr-1.5" />
                        Hledat alternativy
                      </>
                    )}
                  </Button>
                )}
              </div>

              {altError && (
                <div className="p-3 text-xs bg-rose-50 text-rose-700 rounded-lg border border-rose-200">
                  {altError}
                </div>
              )}

              {alternatives && alternatives.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                  Pro zadané období a lokalitu nebyly nalezeny žádné další volné plochy.
                </div>
              )}

              {alternatives && alternatives.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {alternatives.map((alt) => (
                    <div
                      key={alt.surfaceId}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-indigo-300 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-semibold text-slate-900 text-xs block">
                            {alt.surfaceName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {alt.carrierCode} • {alt.city}
                          </span>
                        </div>
                        <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                          {alt.suitabilityScore} % shoda
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                        {alt.reason}
                      </p>
                      {alt.pitch && (
                        <div className="mt-2 text-[11px] text-indigo-700 bg-indigo-50/60 rounded p-2 border border-indigo-100">
                          <strong>Argument pro klienta:</strong> {alt.pitch}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 p-6 rounded-b-2xl">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Zavřít
            </Button>
            <a
              href={`/occupancy?q=${encodeURIComponent(insight.surface?.name || '')}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium px-3 py-2"
            >
              Zobrazit v kalendáři <ArrowRight size={13} />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {insight.status === 'OPEN' && (
              <>
                {insight.type === 'STATUS_MISMATCH' && (
                  <Button
                    variant="primary"
                    disabled={Boolean(loadingAction)}
                    onClick={() => handleAction('SYNC_STATUS')}
                  >
                    {loadingAction === 'SYNC_STATUS' ? (
                      <Loader2 size={14} className="animate-spin mr-1.5" />
                    ) : (
                      <CheckCircle2 size={14} className="mr-1.5" />
                    )}
                    Sjednotit stav plochy
                  </Button>
                )}

                {insight.type === 'EXPIRED_OCCUPANCY' && (
                  <Button
                    variant="primary"
                    disabled={Boolean(loadingAction)}
                    onClick={() => handleAction('FINISH_EXPIRED_OCCUPANCY')}
                  >
                    {loadingAction === 'FINISH_EXPIRED_OCCUPANCY' ? (
                      <Loader2 size={14} className="animate-spin mr-1.5" />
                    ) : (
                      <CheckCircle2 size={14} className="mr-1.5" />
                    )}
                    Označit kampaň za ukončenou
                  </Button>
                )}

                <Button
                  variant="secondary"
                  disabled={Boolean(loadingAction)}
                  onClick={() => handleAction('IGNORE')}
                >
                  {loadingAction === 'IGNORE' ? (
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                  ) : (
                    <XCircle size={14} className="mr-1.5" />
                  )}
                  Ignorovat nález
                </Button>
              </>
            )}

            {insight.status !== 'OPEN' && (
              <Button
                variant="secondary"
                disabled={Boolean(loadingAction)}
                onClick={() => handleAction('REOPEN')}
              >
                {loadingAction === 'REOPEN' ? (
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 size={14} className="mr-1.5" />
                )}
                Znovu otevřít nález
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
