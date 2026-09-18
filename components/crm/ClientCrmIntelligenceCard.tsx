'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Mail,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronDown,
} from 'lucide-react';
import type { Client360Data } from '@/lib/ai-crm/contracts/types';

const healthBadges = {
  HEALTHY: {
    bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    icon: CheckCircle2,
    label: 'Zdravý vztah',
  },
  ATTENTION: {
    bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    icon: AlertTriangle,
    label: 'Vyžaduje pozornost',
  },
  AT_RISK: {
    bg: 'bg-red-500/10 border-red-500/30 text-red-400',
    icon: XCircle,
    label: 'V ohrožení (At Risk)',
  },
  INACTIVE: {
    bg: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    icon: Clock,
    label: 'Dlouhodobě neaktivní',
  },
};

export function ClientCrmIntelligenceCard({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Client360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftData, setDraftData] = useState<{ subject: string; body: string } | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch(`/api/crm/intelligence/client/${clientId}`);
        if (res.ok) {
          const json = await res.json();
          setData(json.client360);
        }
      } catch (err) {
        console.error('Failed to load client 360:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [clientId]);

  async function openFollowUpDraft(offerId: string) {
    try {
      setDraftLoading(true);
      setShowDraftModal(true);
      const res = await fetch('/api/crm/intelligence/follow-up-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId }),
      });
      if (res.ok) {
        const json = await res.json();
        setDraftData(json.draft);
      }
    } catch (err) {
      console.error('Draft error:', err);
    } finally {
      setDraftLoading(false);
    }
  }

  function copyDraftToClipboard() {
    if (!draftData) return;
    navigator.clipboard.writeText(`Předmět: ${draftData.subject}\n\n${draftData.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5 animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-800" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-slate-800" />
            <div className="h-3 w-64 rounded bg-slate-800/60" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const rel = data.intelligence.relationship;
  const healthConfig = healthBadges[rel.status] || healthBadges.HEALTHY;
  const HealthIcon = healthConfig.icon;
  const topAction = data.intelligence.nextBestActions[0];

  return (
    <div className="ai-theme ai-panel rounded-2xl p-5 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-slate-950 shadow-md">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base tracking-tight text-white">AI CRM Intelligence</h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${healthConfig.bg}`}>
                <HealthIcon size={12} />
                {healthConfig.label} ({rel.healthScore} b.)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Inteligentní přehled obchodního stavu, rizik a doporučených kroků
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition"
        >
          <span>{showDetails ? 'Skrýt detaily' : 'Zobrazit faktory'}</span>
          <ChevronDown size={14} className={`transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Poslední kontakt</span>
          <p className="text-sm font-extrabold text-white mt-1">
            {rel.daysSinceLastContact !== null ? `${rel.daysSinceLastContact} dní` : 'Neuvedeno'}
          </p>
          <span className="text-[10px] text-slate-400">{rel.lastContactChannel || 'Bez záznamu'}</span>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Otevřené nabídky</span>
          <p className="text-sm font-extrabold text-white mt-1">
            {data.business.activeOffersCount}
          </p>
          <span className="text-[10px] text-emerald-400 font-semibold">
            {data.business.activeOffersValueCz.toLocaleString('cs-CZ')} Kč
          </span>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aktivní kampaně</span>
          <p className="text-sm font-extrabold text-white mt-1">
            {data.campaigns.activeCampaigns.length}
          </p>
          <span className="text-[10px] text-slate-400">
            {data.campaigns.expiringIn30DaysCount > 0 ? (
              <span className="text-amber-400 font-bold">{data.campaigns.expiringIn30DaysCount} končí brzy</span>
            ) : (
              'Běží v termínu'
            )}
          </span>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/5 p-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Faktury & Pohledávky</span>
          <p className="text-sm font-extrabold text-white mt-1">
            {data.finance.overdueInvoicesCount > 0 ? (
              <span className="text-red-400">{data.finance.overdueInvoicesCount} po splatnosti</span>
            ) : (
              <span className="text-emerald-400 font-semibold">V pořádku</span>
            )}
          </p>
          <span className="text-[10px] text-slate-400">
            {data.finance.overdueTotalCz > 0 ? `${data.finance.overdueTotalCz.toLocaleString('cs-CZ')} Kč` : '0 Kč po splatnosti'}
          </span>
        </div>
      </div>

      {/* AI Narrative Explanation */}
      {data.intelligence.aiExplanation && (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-950/40 p-3.5 text-xs text-sky-100 flex items-start gap-2.5">
          <Sparkles size={16} className="text-sky-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">{data.intelligence.aiExplanation}</p>
        </div>
      )}

      {/* Primary Next Best Action */}
      {topAction && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Doporučený další krok (Next Best Action)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Prioritní skóre: <strong className="text-emerald-300">{topAction.score}/100</strong>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-sm text-white">{topAction.title}</h4>
              <p className="text-xs text-slate-300 mt-0.5">{topAction.description}</p>
              <p className="text-[11px] text-slate-400 mt-1 italic">
                Zdůvodnění: {topAction.scoreBreakdown.explanation}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {topAction.actionType === 'FOLLOW_UP_CLIENT' && topAction.targetEntityId && (
                <button
                  type="button"
                  onClick={() => openFollowUpDraft(topAction.targetEntityId)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-sky-300 border border-slate-700 hover:bg-slate-700 text-xs font-bold transition active:scale-95"
                >
                  <Mail size={14} />
                  <span>Draft follow-upu</span>
                </button>
              )}

              <Link
                href={topAction.suggestedCta.href}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs shadow-md hover:bg-emerald-400 transition active:scale-95"
              >
                <span>{topAction.suggestedCta.label}</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Breakdown of Relationship Reasons */}
      {showDetails && rel.reasons.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5 space-y-2 text-xs animate-in fade-in duration-200">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            Faktory vyhodnocení vztahu:
          </p>
          <ul className="space-y-1 text-slate-300">
            {rel.reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-sky-400 font-bold">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow-Up Draft Modal (Human Review & Send) */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="text-sky-400" size={18} />
                <h3 className="font-extrabold text-base">Návrh follow-up e-mailu (Human Review)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {draftLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-sky-400" />
                <span>Generuji návrh follow-up e-mailu...</span>
              </div>
            ) : draftData ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Předmět</span>
                  <input
                    type="text"
                    readOnly
                    value={draftData.subject}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 font-semibold text-white outline-none"
                  />
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Text e-mailu</span>
                  <textarea
                    rows={8}
                    readOnly
                    value={draftData.body}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-slate-200 outline-none leading-relaxed font-sans"
                  />
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-200">
                  ⚠️ <strong>Pouze koncept ke kontrole:</strong> E-mail nebude automaticky odeslán. Před odesláním si jej zkontrolujte a odešlete z e-mailového klienta.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowDraftModal(false)}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold"
                  >
                    Zavřít
                  </button>

                  <button
                    type="button"
                    onClick={copyDraftToClipboard}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-black hover:bg-sky-400 transition"
                  >
                    <Copy size={14} />
                    <span>{copied ? 'Zkopírováno!' : 'Zkopírovat text'}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
