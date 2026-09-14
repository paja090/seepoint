'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  AlertTriangle,
  Mail,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Filter,
  DollarSign,
  Copy,
  Layers,
  AlertCircle,
} from 'lucide-react';
import type {
  CrmAttentionItem,
  CrmInsightType,
  CrmInsightPriority,
} from '@/lib/ai-crm/contracts/types';
import type { DuplicateProposal } from '@/lib/ai-crm/duplicate-detector';

const priorityColors: Record<CrmInsightPriority, { bg: string; text: string; border: string; label: string }> = {
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', label: 'Kritická' },
  URGENT: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Urgentní' },
  HIGH: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Vysoká' },
  MEDIUM: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30', label: 'Střední' },
  LOW: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', label: 'Nízká' },
};

const insightTypeLabels: Record<CrmInsightType, { label: string; icon: string }> = {
  REALIZATION_RISK: { label: 'Riziko realizace', icon: '⚠️' },
  FOLLOW_UP_DUE: { label: 'Čeká na follow-up', icon: '📬' },
  RENEWAL_OPPORTUNITY: { label: 'Předjednání (Renewal)', icon: '🔄' },
  UPSELL_OPPORTUNITY: { label: 'Upsell / Expanze', icon: '📈' },
  READY_FOR_BILLING: { label: 'K fakturaci', icon: '💶' },
  OFFER_WAITING_FOR_REVIEW: { label: 'Draft ke kontrole', icon: '📄' },
  OVERDUE_TASK: { label: 'Úkol po termínu', icon: '⏰' },
  STALLED_OPPORTUNITY: { label: 'Stagnující obchod', icon: '🛑' },
  MISSING_INFORMATION: { label: 'Chybějící údaje', icon: '❓' },
  OFFER_WAITING_FOR_CLIENT: { label: 'Čeká na klienta', icon: '⏳' },
  EXPANSION_OPPORTUNITY: { label: 'Expanze', icon: '🏬' },
  CLIENT_INACTIVE: { label: 'Neaktivní klient', icon: '💤' },
  DUPLICATE_OPPORTUNITY: { label: 'Duplicita', icon: '👥' },
};

export function CrmIntelligenceDashboardView({
  initialAttentionItems,
  duplicates = [],
  totalAttentionValueCz,
}: {
  initialAttentionItems: CrmAttentionItem[];
  duplicates?: DuplicateProposal[];
  totalAttentionValueCz: number;
}) {
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftData, setDraftData] = useState<{ subject: string; body: string } | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const filteredItems = initialAttentionItems.filter((item) => {
    if (selectedFilter === 'ALL') return true;
    if (selectedFilter === 'URGENT') return item.priority === 'CRITICAL' || item.priority === 'URGENT';
    if (selectedFilter === 'FOLLOW_UP') return item.insightType === 'FOLLOW_UP_DUE';
    if (selectedFilter === 'RENEWAL') return item.insightType === 'RENEWAL_OPPORTUNITY';
    if (selectedFilter === 'UPSELL') return item.insightType === 'UPSELL_OPPORTUNITY';
    if (selectedFilter === 'RISK') return item.insightType === 'REALIZATION_RISK';
    if (selectedFilter === 'BILLING') return item.insightType === 'READY_FOR_BILLING';
    return true;
  });

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

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Row */}
      <div className="relative overflow-hidden rounded-3xl border border-sky-900/50 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-6 md:p-8 text-white shadow-xl">
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-slate-950 shadow-md">
                <Sparkles size={18} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-sky-400">SeePoint OS</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">AI CRM Intelligence</h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl">
              Chytrá vrstva nad celým životním cyklem obchodu: říká obchodníkům každé ráno přesně to,
              čemu věnovat pozornost, které zakázky hoří a kde leží největší tržby.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Položky k řešení</span>
              <p className="text-2xl font-black text-white">{initialAttentionItems.length}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Obchodní hodnota</span>
              <p className="text-2xl font-black text-emerald-300">
                {totalAttentionValueCz.toLocaleString('cs-CZ')} Kč
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {[
          { id: 'ALL', label: 'Všechny úkoly', count: initialAttentionItems.length },
          { id: 'URGENT', label: '🚨 Kritické & Urgentní', count: initialAttentionItems.filter(i => i.priority === 'CRITICAL' || i.priority === 'URGENT').length },
          { id: 'FOLLOW_UP', label: '📬 Follow-up nabídek', count: initialAttentionItems.filter(i => i.insightType === 'FOLLOW_UP_DUE').length },
          { id: 'RENEWAL', label: '🔄 Prodloužení (Renewal)', count: initialAttentionItems.filter(i => i.insightType === 'RENEWAL_OPPORTUNITY').length },
          { id: 'UPSELL', label: '📈 Upsell & Expanze', count: initialAttentionItems.filter(i => i.insightType === 'UPSELL_OPPORTUNITY').length },
          { id: 'RISK', label: '⚠️ Rizika realizace', count: initialAttentionItems.filter(i => i.insightType === 'REALIZATION_RISK').length },
          { id: 'BILLING', label: '💶 K fakturaci', count: initialAttentionItems.filter(i => i.insightType === 'READY_FOR_BILLING').length },
        ].map((tab) => {
          const active = selectedFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedFilter(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-3.5 py-2 text-xs font-bold transition ${
                active
                  ? 'bg-slate-900 text-white shadow-sm border border-slate-700'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${active ? 'bg-sky-500 text-slate-950' : 'bg-slate-200 text-slate-700'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Attention Feed ("My Day") */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm space-y-3">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <h3 className="font-extrabold text-base text-slate-800">Všechny položky jsou vyřešené!</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Žádné položky ve zvolené kategorii nevyžadují urgentní pozornost.
            </p>
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const pConfig = priorityColors[item.priority] || priorityColors.MEDIUM;
            const tConfig = insightTypeLabels[item.insightType] || { label: item.insightType, icon: '📌' };

            return (
              <div
                key={item.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-lg shrink-0">
                      {tConfig.icon}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/clients/${item.clientId}`}
                          className="font-black text-base text-slate-950 hover:text-sky-600 transition"
                        >
                          {item.clientName}
                        </Link>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${pConfig.bg} ${pConfig.text} ${pConfig.border}`}>
                          {pConfig.label} priorita ({item.priorityScore} b.)
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {tConfig.label}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-800">{item.title}</h4>
                      <p className="text-xs text-slate-600">{item.detail}</p>
                    </div>
                  </div>

                  {item.associatedValueCz && item.associatedValueCz > 0 && (
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hodnota</span>
                      <p className="text-sm font-black text-emerald-700">
                        {item.associatedValueCz.toLocaleString('cs-CZ')} Kč
                      </p>
                    </div>
                  )}
                </div>

                {/* Explainable Why On Top Reason */}
                <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3 text-xs text-sky-950 flex items-start gap-2">
                  <span className="font-extrabold text-[11px] text-sky-700 uppercase tracking-wider shrink-0 mt-0.5">
                    Proč teď:
                  </span>
                  <p className="font-medium leading-relaxed">{item.whyOnTopReason}</p>
                </div>

                {/* Action CTA Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <Clock size={13} />
                    <span>Doporučený krok: <strong>{item.nextBestAction.title}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.nextBestAction.actionType === 'FOLLOW_UP_CLIENT' && (
                      <button
                        type="button"
                        onClick={() => openFollowUpDraft(item.nextBestAction.targetEntityId)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 text-xs font-bold transition active:scale-95"
                      >
                        <Mail size={14} />
                        <span>Draft e-mailu</span>
                      </button>
                    )}

                    <Link
                      href={item.nextBestAction.suggestedCta.href}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-950 text-white hover:bg-sky-700 text-xs font-black shadow-sm transition active:scale-95"
                    >
                      <span>{item.nextBestAction.suggestedCta.label}</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Duplicate & Conflict Detection Alerts */}
      {duplicates.length > 0 && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50/70 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <h3 className="font-extrabold text-sm">Detekované duplicity a souběžné příležitosti</h3>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            AI CRM Intelligence identifikovala potenciálně duplicitní příležitosti. Zkontrolujte je před zahájením komunikace, aby klienta neoslovovalo více obchodníků najednou.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {duplicates.map((dup) => (
              <div
                key={dup.id}
                className="rounded-2xl border border-amber-200 bg-white p-3.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">{dup.title}</h4>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
                    Jistota {Math.round(dup.confidence * 100)} %
                  </span>
                </div>
                <p className="text-slate-600">{dup.description}</p>
                <p className="text-[11px] font-semibold text-sky-800 italic">
                  Doporučení: {dup.recommendation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-Up Draft Modal */}
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
