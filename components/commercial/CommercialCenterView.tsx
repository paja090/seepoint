'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Bell,
  Mail,
  Radar,
  FileText,
  Wrench,
  Lightbulb,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Send,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Layers,
  ExternalLink,
  Play,
} from 'lucide-react';
import type {
  CommercialCenterData,
  AttentionPriority,
  AttentionCategory,
  AttentionSource,
} from '@/lib/ai-orchestrator/contracts/types';

// ---------------------------------------------------------------------------
// Human-readable Czech labels & styling maps
// ---------------------------------------------------------------------------

const PRIORITY_STYLES: Record<
  AttentionPriority,
  { badge: string; dot: string; border: string; label: string }
> = {
  CRITICAL: {
    badge: 'bg-red-100 text-red-800 border-red-300',
    dot: 'bg-red-500',
    border: 'border-l-4 border-l-red-500',
    label: 'Kritická',
  },
  URGENT: {
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    dot: 'bg-orange-500',
    border: 'border-l-4 border-l-orange-500',
    label: 'Urgentní',
  },
  HIGH: {
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
    border: 'border-l-4 border-l-amber-500',
    label: 'Vysoká',
  },
  MEDIUM: {
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    dot: 'bg-sky-500',
    border: 'border-l-4 border-l-sky-500',
    label: 'Střední',
  },
  LOW: {
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    border: 'border-l-4 border-l-slate-300',
    label: 'Nízká',
  },
};

const CATEGORY_CONFIG: Record<
  AttentionCategory,
  { label: string; icon: string; badgeClass: string; group: 'OFFERS' | 'LEADS' | 'REALIZATION' }
> = {
  MISSING_INFO: {
    label: 'Chybí informace v poptávce',
    icon: '❓',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
    group: 'LEADS',
  },
  DRAFT_REVIEW: {
    label: 'Koncept nabídky ke schválení',
    icon: '📝',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    group: 'OFFERS',
  },
  AVAILABILITY_CHANGED: {
    label: 'Změna dostupnosti ploch',
    icon: '🔄',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    group: 'OFFERS',
  },
  REALIZATION_BLOCKED: {
    label: 'Blokovaná realizace',
    icon: '🚫',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    group: 'REALIZATION',
  },
  DEADLINE_RISK: {
    label: 'Riziko prodlení termínu',
    icon: '⏰',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    group: 'REALIZATION',
  },
  FOLLOW_UP: {
    label: 'Follow-up odeslané nabídky',
    icon: '📞',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    group: 'OFFERS',
  },
  RENEWAL: {
    label: 'Prodloužení kampaně (Renewal)',
    icon: '🔁',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    group: 'OFFERS',
  },
  NEW_OPPORTUNITY: {
    label: 'Nová obchodní příležitost',
    icon: '✨',
    badgeClass: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200',
    group: 'LEADS',
  },
};

const SOURCE_LABELS: Record<AttentionSource, string> = {
  CRM: 'AI CRM',
  MAILBOX: 'AI Mailbox',
  OFFER: 'Nabídky',
  OCCUPANCY: 'Obsazenost',
  REALIZATION: 'Realizace',
  RADAR: 'Sales Radar',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  REQUEST_MISSING_INFO: 'Vyžádat chybějící údaje',
  CHECK_AVAILABILITY: 'Ověřit dostupnost nosičů',
  CREATE_OFFER_DRAFT: 'Připravit koncept nabídky',
  REVIEW_OFFER_DRAFT: 'Zkontrolovat a odeslat nabídku',
  REVIEW_AND_SEND_OFFER: 'Zkontrolovat a odeslat nabídku',
  SEND_OFFER: 'Odeslat nabídku klientovi',
  FOLLOW_UP_OFFER: 'Připomenout nabídku klientovi',
  FOLLOW_UP_CLIENT: 'Kontaktovat klienta (Follow-up)',
  CREATE_ORDER: 'Vytvořit objednávku',
  CREATE_REALIZATION: 'Předat do realizace',
  RESOLVE_BLOCKED_REALIZATION: 'Odblokovat realizaci',
  RESOLVE_REALIZATION_BLOCKER: 'Vyřešit překážku realizace',
  PREPARE_RENEWAL: 'Připravit prodloužení kampaně',
  PROPOSE_CAMPAIGN_RENEWAL: 'Navrhnout prodloužení kampaně',
  REVIEW_OPPORTUNITY: 'Vyhodnotit příležitost z Radaru',
  REVIEW_UPSELL_OPPORTUNITY: 'Nabídnout rozšíření kampaně',
  MARK_READY_FOR_BILLING: 'Předat k fakturaci',
  READY_FOR_BILLING: 'Vystavit fakturu',
  RESOLVE_OVERDUE_TASK: 'Dokončit úkol po termínu',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  INBOX_MESSAGE: 'E-mailová poptávka',
  OFFER: 'Nabídka',
  CRM_ORDER: 'Zakázka',
  REALIZATION: 'Realizace',
  SALES_OPPORTUNITY: 'Příležitost z Radaru',
  OCCUPANCY: 'Pronájem plochy',
  CLIENT: 'Klient',
  TASK: 'Obchodní úkol',
};

const CLASSIFICATION_LABELS: Record<string, { label: string; cls: string }> = {
  INQUIRY: { label: 'Poptávka', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
  OFFER_REQUEST: { label: 'Žádost o nabídku', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  NEGOTIATION: { label: 'Vyjednávání', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  ORDER_CONFIRMATION: { label: 'Potvrzení objednávky', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

const RADAR_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  NEW: { label: 'Nová příležitost', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  REVIEWED: { label: 'Zkontrolováno', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  CONTACTED: { label: 'Kontaktováno', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  CONVERTED: { label: 'Vytvořena nabídka', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
};

function formatPrice(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date?: Date | string | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

type ActiveTab = 'overview' | 'leads' | 'offers' | 'realizations';
type AttentionFilter = 'ALL' | 'URGENT' | 'OFFERS' | 'LEADS' | 'REALIZATION';

export function CommercialCenterView({ data }: { data: CommercialCenterData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [runningEntityId, setRunningEntityId] = useState<string | null>(null);
  const [orchestratorFeedback, setOrchestratorFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Derived metrics
  const metrics = useMemo(() => {
    const draftsValue = data.offers.drafts.reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);
    const sentValue = data.offers.sent.reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);
    const acceptedValue = data.offers.accepted.reduce((sum, o) => sum + (o.totalPrice ?? 0), 0);
    const criticalCount = data.attentionItems.filter(
      (i) => i.priority === 'CRITICAL' || i.priority === 'URGENT'
    ).length;
    const unlinkedInboxCount = data.inboxRequests.filter((r) => !r.offerId).length;
    const unhandedAcceptedCount = data.offers.accepted.filter((o) => !o.hasCrmOrder).length;
    const realizationIssues = data.realizations.risk + data.realizations.blocked;

    return {
      draftsValue,
      sentValue,
      acceptedValue,
      totalOpenPipelineValue: draftsValue + sentValue,
      criticalCount,
      unlinkedInboxCount,
      unhandedAcceptedCount,
      realizationIssues,
    };
  }, [data]);

  // Filtered attention items
  const filteredAttentionItems = useMemo(() => {
    return data.attentionItems.filter((item) => {
      if (attentionFilter === 'URGENT') {
        if (item.priority !== 'CRITICAL' && item.priority !== 'URGENT') return false;
      } else if (attentionFilter !== 'ALL') {
        const cfg = CATEGORY_CONFIG[item.category];
        if (!cfg || cfg.group !== attentionFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchReason = (item.whyReason || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchReason) return false;
      }

      return true;
    });
  }, [data.attentionItems, attentionFilter, searchQuery]);

  // Deduplicate nextBestActions that are NOT already shown as attentionItems
  const standaloneNextBestActions = useMemo(() => {
    const attentionKeys = new Set(
      data.attentionItems.map((i) => `${i.entityType}:${i.entityId}`)
    );
    return data.nextBestActions
      .filter((nba) => !attentionKeys.has(`${nba.targetEntityType}:${nba.targetEntityId}`))
      .slice(0, 6);
  }, [data.attentionItems, data.nextBestActions]);

  // Run AI Orchestrator on a mailbox message or accepted offer
  async function handleRunOrchestrator(
    triggerType: 'MAILBOX' | 'OFFER_ACCEPTED',
    entityId: string
  ) {
    setRunningEntityId(entityId);
    setOrchestratorFeedback(null);
    try {
      const res = await fetch('/api/ai-orchestrator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerType, entityId }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Spuštění AI orchestrátoru selhalo.');
      }

      if (result.status === 'NEEDS_INFORMATION') {
        setOrchestratorFeedback({
          type: 'error',
          message:
            'Poptávka neobsahuje dostatek údajů pro automatický návrh nabídky. Doplňte prosím chybějící parametry u zprávy.',
        });
      } else {
        setOrchestratorFeedback({
          type: 'success',
          message:
            triggerType === 'MAILBOX'
              ? 'AI orchestrátor analyzoval poptávku, ověřil dostupnost nosičů a připravil návrh nabídky.'
              : 'AI orchestrátor připravil podklady pro zakázku a realizaci z přijaté nabídky.',
        });
      }
      router.refresh();
    } catch (err) {
      setOrchestratorFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Chyba při komunikaci s AI orchestrátorem.',
      });
    } finally {
      setRunningEntityId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* =====================================================================
          HERO HEADER BANNER (High-contrast dark gradient matching AI Workspace)
      ===================================================================== */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 sm:p-7 text-white shadow-xl">
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-800/90 pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300 border border-indigo-500/30">
                <Sparkles size={13} className="text-emerald-400" />
                <span>SeePoint AI Orchestrátor</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                <ShieldCheck size={12} />
                <span>Poloautomatický režim · Člověk schvaluje</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              AI Obchodní centrum
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Jednotné řídicí centrum celého obchodního toku: od příchozích poptávek a Sales Radaru přes návrhy a schvalování nabídek až po realizaci a fakturaci.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/offers/new"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-md hover:bg-emerald-400 active:scale-95 transition"
            >
              <Plus size={15} />
              <span>Nová nabídka</span>
            </Link>
            <Link
              href="/ai-inbox"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
            >
              <Mail size={14} className="text-purple-400" />
              <span>AI Mailbox</span>
            </Link>
            <Link
              href="/sales/opportunities"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
            >
              <Radar size={14} className="text-sky-400" />
              <span>Sales Radar</span>
            </Link>
            <Link
              href="/crm/intelligence"
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
            >
              <TrendingUp size={14} className="text-amber-400" />
              <span>CRM Intelligence</span>
            </Link>
          </div>
        </div>

        {/* Interactive Commercial Pipeline Funnel KPI Cards */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Urgentní pozornost */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('overview');
              setAttentionFilter('ALL');
            }}
            className={`text-left rounded-2xl p-3.5 border transition ${
              activeTab === 'overview'
                ? 'bg-indigo-950/90 border-indigo-400/60 ring-1 ring-indigo-400/40'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                1. K vyřešení dnes
              </span>
              <Bell size={14} className="text-amber-400" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-white">
              {data.attentionItems.length}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {metrics.criticalCount > 0 ? (
                <span className="font-semibold text-rose-400">
                  {metrics.criticalCount} kritických / urgentních
                </span>
              ) : (
                <span>Prioritní kroky AI</span>
              )}
            </p>
          </button>

          {/* 2. Poptávky & Radar */}
          <button
            type="button"
            onClick={() => setActiveTab('leads')}
            className={`text-left rounded-2xl p-3.5 border transition ${
              activeTab === 'leads'
                ? 'bg-indigo-950/90 border-indigo-400/60 ring-1 ring-indigo-400/40'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                2. Poptávky & Radar
              </span>
              <Mail size={14} className="text-purple-400" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-purple-300">
              {data.inboxRequests.length + data.radarOpportunities.length}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {data.inboxRequests.length} e-mailů · {data.radarOpportunities.length} z radaru
            </p>
          </button>

          {/* 3. Koncepty nabídek */}
          <button
            type="button"
            onClick={() => setActiveTab('offers')}
            className={`text-left rounded-2xl p-3.5 border transition ${
              activeTab === 'offers'
                ? 'bg-indigo-950/90 border-indigo-400/60 ring-1 ring-indigo-400/40'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                3. Koncepty nabídek
              </span>
              <FileText size={14} className="text-amber-400" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-amber-300">
              {data.offers.drafts.length}
            </p>
            <p className="mt-1 text-[11px] text-slate-400 truncate">
              {metrics.draftsValue > 0
                ? `Hodnota ${formatPrice(metrics.draftsValue)}`
                : 'Čekají na kontrolu'}
            </p>
          </button>

          {/* 4. Odeslané & Přijaté nabídky */}
          <button
            type="button"
            onClick={() => setActiveTab('offers')}
            className="text-left rounded-2xl bg-slate-900/80 p-3.5 border border-slate-800 hover:border-slate-700 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                4. Aktivní nabídky
              </span>
              <Send size={14} className="text-sky-400" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-emerald-400">
              {data.offers.sent.length}{' '}
              <span className="text-xs font-bold text-slate-400">
                ({data.offers.accepted.length} přijato)
              </span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400 truncate">
              Odesláno za {formatPrice(metrics.sentValue)}
            </p>
          </button>

          {/* 5. Realizace & Fakturace */}
          <button
            type="button"
            onClick={() => setActiveTab('realizations')}
            className={`col-span-2 sm:col-span-1 text-left rounded-2xl p-3.5 border transition ${
              activeTab === 'realizations'
                ? 'bg-indigo-950/90 border-indigo-400/60 ring-1 ring-indigo-400/40'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                5. Realizace & Faktury
              </span>
              <Wrench size={14} className="text-emerald-400" />
            </div>
            <p className="mt-1.5 text-2xl font-black text-white">
              {data.realizations.active}{' '}
              <span className="text-xs font-bold text-emerald-400">
                ({data.realizations.readyForBilling} k fakturaci)
              </span>
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {metrics.realizationIssues > 0 ? (
                <span className="font-semibold text-amber-400">
                  ⚠️ {metrics.realizationIssues} vyžaduje zásah
                </span>
              ) : (
                <span>Všechny realizace v normě</span>
              )}
            </p>
          </button>
        </div>
      </div>

      {/* =====================================================================
          ORCHESTRATOR FEEDBACK BANNER
      ===================================================================== */}
      {orchestratorFeedback && (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 text-xs font-semibold shadow-sm ${
            orchestratorFeedback.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
              : 'border-rose-300 bg-rose-50 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles
              size={16}
              className={
                orchestratorFeedback.type === 'success' ? 'text-emerald-600' : 'text-rose-600'
              }
            />
            <span>{orchestratorFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setOrchestratorFeedback(null)}
            className="rounded-lg px-2 py-1 text-xs font-bold hover:bg-black/5"
          >
            Zavřít
          </button>
        </div>
      )}

      {/* =====================================================================
          MAIN WORKSPACE NAVIGATION TABS
      ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              id: 'overview' as const,
              label: 'Prioritní akce & Přehled',
              icon: Bell,
              count: data.attentionItems.length,
              badgeColor: 'bg-amber-500 text-slate-950',
            },
            {
              id: 'leads' as const,
              label: 'Poptávky & Sales Radar',
              icon: Mail,
              count: data.inboxRequests.length + data.radarOpportunities.length,
              badgeColor: 'bg-purple-500 text-white',
            },
            {
              id: 'offers' as const,
              label: 'Pipeline nabídek',
              icon: FileText,
              count:
                data.offers.drafts.length +
                data.offers.sent.length +
                data.offers.accepted.length,
              badgeColor: 'bg-sky-500 text-slate-950',
            },
            {
              id: 'realizations' as const,
              label: 'Realizace & Fakturace',
              icon: Wrench,
              count:
                data.realizations.active +
                data.realizations.risk +
                data.realizations.blocked +
                data.realizations.readyForBilling,
              badgeColor: 'bg-emerald-500 text-slate-950',
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50 border border-indigo-400/40'
                    : 'bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isActive ? 'bg-white text-indigo-950' : tab.badgeColor
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: PRIORITNÍ AKCE & PŘEHLED (OVERVIEW)
      ===================================================================== */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (8 cols): Co potřebuje moji pozornost */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                    <Bell size={18} className="text-amber-500" />
                    <span>Co dnes potřebuje moji pozornost</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                      {filteredAttentionItems.length}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Sjednocená fronta nejdůležitějších obchodních kroků seřazená podle priority a dopadu na tržby.
                  </p>
                </div>

                {/* Search input */}
                <div className="relative w-full sm:w-60">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Hledat klienta nebo akci…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Category quick filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL' as const, label: 'Všechny kroky', count: data.attentionItems.length },
                  {
                    id: 'URGENT' as const,
                    label: '🚨 Kritické & Urgentní',
                    count: metrics.criticalCount,
                  },
                  {
                    id: 'OFFERS' as const,
                    label: '📄 Nabídky & Follow-up',
                    count: data.attentionItems.filter(
                      (i) => CATEGORY_CONFIG[i.category]?.group === 'OFFERS'
                    ).length,
                  },
                  {
                    id: 'LEADS' as const,
                    label: '📨 Poptávky & Radar',
                    count: data.attentionItems.filter(
                      (i) => CATEGORY_CONFIG[i.category]?.group === 'LEADS'
                    ).length,
                  },
                  {
                    id: 'REALIZATION' as const,
                    label: '🔧 Realizace',
                    count: data.attentionItems.filter(
                      (i) => CATEGORY_CONFIG[i.category]?.group === 'REALIZATION'
                    ).length,
                  },
                ].map((f) => {
                  const active = attentionFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAttentionFilter(f.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${
                          active ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
                        }`}
                      >
                        {f.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Attention Items List */}
              {filteredAttentionItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center space-y-2">
                  <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
                  <p className="text-sm font-bold text-slate-800">
                    Žádné položky ve zvoleném filtru nevyžadují okamžitou pozornost
                  </p>
                  <p className="text-xs text-slate-500">
                    Zkuste přepnout filtr nebo zkontrolujte záložku Pipeline nabídek.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAttentionItems.map((item) => {
                    const pStyle = PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.MEDIUM;
                    const catCfg = CATEGORY_CONFIG[item.category] ?? {
                      label: item.category,
                      icon: '📌',
                      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                    };
                    const canAutoDraftFromMailbox =
                      item.entityType === 'INBOX_MESSAGE' && item.category !== 'MISSING_INFO';

                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 hover:shadow-sm transition ${pStyle.border}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-lg shrink-0">
                              {catCfg.icon}
                            </div>
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${pStyle.badge}`}
                                >
                                  <span className={`h-1.5 w-1.5 rounded-full ${pStyle.dot}`} />
                                  {pStyle.label}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${catCfg.badgeClass}`}
                                >
                                  {catCfg.label}
                                </span>
                                {item.source && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                    {SOURCE_LABELS[item.source] ?? item.source}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-sm font-extrabold text-slate-950 leading-snug">
                                {item.title}
                              </h3>
                              <p className="text-xs text-slate-600 leading-relaxed">
                                {item.description}
                              </p>

                              {item.whyReason && (
                                <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-indigo-950">
                                  <span className="font-black text-[10px] uppercase tracking-wider text-indigo-700 mr-1.5">
                                    Proč teď:
                                  </span>
                                  <span className="font-medium">{item.whyReason}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            {canAutoDraftFromMailbox && (
                              <button
                                type="button"
                                disabled={runningEntityId === item.entityId}
                                onClick={() =>
                                  handleRunOrchestrator('MAILBOX', item.entityId)
                                }
                                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition"
                              >
                                <Sparkles size={13} />
                                <span>
                                  {runningEntityId === item.entityId
                                    ? 'Zpracovávám…'
                                    : 'AI návrh nabídky'}
                                </span>
                              </button>
                            )}
                            <Link
                              href={item.link}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-600 transition shadow-2xs"
                            >
                              <span>
                                {item.unifiedNextBestAction?.title
                                  ? ACTION_TYPE_LABELS[item.unifiedNextBestAction.actionType] ||
                                    'Otevřít a vyřešit'
                                  : 'Otevřít detail'}
                              </span>
                              <ArrowRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (4 cols): Rychlý přehled pipeline & Další doporučené akce */}
          <div className="lg:col-span-4 space-y-5">
            {/* Card 1: Koncepty nabídek ke schválení */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
                  <FileText size={16} className="text-amber-500" />
                  <span>Koncepty nabídek ke kontrole</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('offers')}
                  className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <span>Pipeline</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              {data.offers.drafts.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">
                  Žádné rozpracované koncepty nabídek.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.offers.drafts.slice(0, 4).map((draft) => (
                    <Link
                      key={draft.id}
                      href={`/offers/${draft.id}`}
                      className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-xs font-bold text-slate-900">
                          {draft.title}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {draft.clientName ?? 'Neznámý klient'} · {formatDate(draft.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-slate-950">
                          {formatPrice(draft.totalPrice)}
                        </p>
                        <span className="text-[10px] font-bold text-amber-700">
                          Ke schválení →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Card 2: Přijaté nabídky čekající na předání do realizace */}
            {metrics.unhandedAcceptedCount > 0 && (
              <div className="rounded-3xl border border-emerald-300 bg-emerald-50/90 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Přijaté nabídky k realizaci</span>
                  </h3>
                  <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[11px] font-black text-emerald-900">
                    {metrics.unhandedAcceptedCount}
                  </span>
                </div>
                <p className="text-xs text-emerald-800">
                  Tyto nabídky klient schválil, ale zatím k nim nebyla založena zakázka / realizace:
                </p>
                <div className="space-y-2">
                  {data.offers.accepted
                    .filter((o) => !o.hasCrmOrder)
                    .slice(0, 3)
                    .map((acc) => (
                      <div
                        key={acc.id}
                        className="rounded-2xl border border-emerald-200 bg-white p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            href={`/offers/${acc.id}`}
                            className="text-xs font-bold text-slate-900 hover:underline truncate"
                          >
                            {acc.title}
                          </Link>
                          <span className="text-xs font-black text-emerald-700 shrink-0">
                            {formatPrice(acc.totalPrice)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500 truncate">
                            {acc.clientName ?? 'Klient'}
                          </span>
                          <button
                            type="button"
                            disabled={runningEntityId === acc.id}
                            onClick={() =>
                              handleRunOrchestrator('OFFER_ACCEPTED', acc.id)
                            }
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                          >
                            <Play size={11} />
                            <span>
                              {runningEntityId === acc.id
                                ? 'Zakládám…'
                                : 'Předat do realizace'}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Card 3: Další doporučené kroky AI (deduplikované) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
                  <Lightbulb size={16} className="text-indigo-600" />
                  <span>Další doporučení AI</span>
                </h3>
                <span className="text-[11px] font-semibold text-slate-400">
                  Next Best Actions
                </span>
              </div>

              {standaloneNextBestActions.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">
                  Všechna aktivní doporučení jsou již zahrnuta v hlavní frontě pozornosti vlevo.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {standaloneNextBestActions.map((nba) => {
                    const pStyle = PRIORITY_STYLES[nba.priority] ?? PRIORITY_STYLES.MEDIUM;
                    const humanAction =
                      ACTION_TYPE_LABELS[nba.actionType] ?? nba.actionType;
                    const humanEntity =
                      ENTITY_TYPE_LABELS[nba.targetEntityType] ?? nba.targetEntityType;

                    return (
                      <div
                        key={nba.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${pStyle.badge}`}
                          >
                            {pStyle.label}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500">
                            {humanEntity} · {SOURCE_LABELS[nba.source] ?? nba.source}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900">{nba.title}</p>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {nba.description}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] font-semibold text-indigo-700">
                            Krok: {humanAction}
                          </span>
                          {nba.link && (
                            <Link
                              href={nba.link}
                              className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 hover:text-indigo-600"
                            >
                              <span>Otevřít</span>
                              <ArrowRight size={12} />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: POPTÁVKY (AI MAILBOX) & PŘÍLEŽITOSTI (SALES RADAR)
      ===================================================================== */}
      {activeTab === 'leads' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Column 1: Nové poptávky z AI Mailboxu */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <Mail size={18} className="text-purple-600" />
                  <span>Příchozí poptávky (AI Mailbox)</span>
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                    {data.inboxRequests.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  E-maily klasifikované AI jako poptávky nebo obchodní jednání.
                </p>
              </div>
              <Link
                href="/ai-inbox"
                className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:underline shrink-0"
              >
                <span>Otevřít AI Mailbox</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {data.inboxRequests.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Mail size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">
                  Žádné nové poptávky v AI Mailboxu.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.inboxRequests.map((req) => {
                  const clsCfg = CLASSIFICATION_LABELS[req.classification] ?? {
                    label: req.classification,
                    cls: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <div
                      key={req.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 hover:bg-white hover:shadow-2xs transition space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${clsCfg.cls}`}
                          >
                            {clsCfg.label}
                          </span>
                          {req.offerId ? (
                            <Link
                              href={`/offers/${req.offerId}`}
                              className="rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 hover:bg-emerald-200 transition"
                            >
                              ✓ Nabídka připravena →
                            </Link>
                          ) : req.requiresReview ? (
                            <span className="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                              Čeká na kontrolu
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              Přijato
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">
                          {formatDate(req.receivedAt)}
                        </span>
                      </div>

                      <div>
                        <Link
                          href="/ai-inbox"
                          className="text-sm font-extrabold text-slate-950 hover:text-purple-700 transition"
                        >
                          {req.subject || '(Bez předmětu)'}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Klient / Odesílatel:{' '}
                          <strong className="text-slate-700">
                            {req.clientName ?? req.fromName ?? req.fromEmail}
                          </strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {!req.offerId && (
                          <button
                            type="button"
                            disabled={runningEntityId === req.id}
                            onClick={() => handleRunOrchestrator('MAILBOX', req.id)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-100 disabled:opacity-50 transition"
                          >
                            <Sparkles size={13} />
                            <span>
                              {runningEntityId === req.id
                                ? 'AI připravuje nabídku…'
                                : 'AI: Připravit návrh nabídky'}
                            </span>
                          </button>
                        )}
                        <Link
                          href={req.offerId ? `/offers/${req.offerId}` : '/ai-inbox'}
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                        >
                          <span>{req.offerId ? 'Detail nabídky' : 'Otevřít e-mail'}</span>
                          <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Column 2: Příležitosti ze Sales Radaru */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-950 flex items-center gap-2">
                  <Radar size={18} className="text-sky-600" />
                  <span>Příležitosti v okolí ploch (Sales Radar)</span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">
                    {data.radarOpportunities.length}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Firmy a kampaně detekované AI radarem s vysokou shodou pro vaše volné nosiče.
                </p>
              </div>
              <Link
                href="/sales/opportunities"
                className="inline-flex items-center gap-1 text-xs font-bold text-sky-700 hover:underline shrink-0"
              >
                <span>Otevřít Sales Radar</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            {data.radarOpportunities.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Radar size={32} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">
                  Žádné aktivní příležitosti v Sales Radaru.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.radarOpportunities.map((opp) => {
                  const stCfg = RADAR_STATUS_LABELS[opp.status] ?? {
                    label: opp.status,
                    cls: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  return (
                    <div
                      key={opp.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 hover:bg-white hover:shadow-2xs transition space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${stCfg.cls}`}
                          >
                            {stCfg.label}
                          </span>
                          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-black text-indigo-700">
                            Skóre shody: {opp.score} %
                          </span>
                        </div>
                        {opp.city && (
                          <span className="text-[11px] font-semibold text-slate-500">
                            📍 {opp.city}
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-extrabold text-slate-950">
                          {opp.companyName}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">{opp.title}</p>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-400">
                          Detekováno {formatDate(opp.detectedAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          {opp.createdOfferId && (
                            <Link
                              href={`/offers/${opp.createdOfferId}`}
                              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                            >
                              <span>Nabídka</span>
                              <ExternalLink size={11} />
                            </Link>
                          )}
                          <Link
                            href="/sales/opportunities"
                            className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 transition"
                          >
                            <span>Zobrazit v Radaru</span>
                            <ArrowRight size={12} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: PIPELINE NABÍDEK (3-COLUMN KANBAN BOARD)
      ===================================================================== */}
      {activeTab === 'offers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 px-5 py-3.5 text-white">
            <div className="flex items-center gap-3">
              <Layers size={18} className="text-indigo-400" />
              <div>
                <h2 className="text-sm font-bold">Obchodní pipeline nabídek</h2>
                <p className="text-xs text-slate-400">
                  Celková hodnota otevřených nabídek (koncepty + odeslané):{' '}
                  <strong className="text-emerald-400">
                    {formatPrice(metrics.totalOpenPipelineValue)}
                  </strong>
                </p>
              </div>
            </div>
            <Link
              href="/offers"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 transition self-start sm:self-auto"
            >
              <span>Všechny nabídky v tabulce</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* Column 1: Koncepty ke schválení */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900">
                    1. Koncepty ({data.offers.drafts.length})
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Připraveno AI nebo obchodníkem ke kontrole
                  </p>
                </div>
                <span className="text-xs font-black text-slate-900">
                  {formatPrice(metrics.draftsValue)}
                </span>
              </div>

              {data.offers.drafts.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Žádné koncepty nabídek
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.offers.drafts.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 hover:border-amber-300 hover:bg-amber-50/30 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/offers/${o.id}`}
                          className="text-xs font-extrabold text-slate-950 hover:text-amber-700"
                        >
                          {o.title}
                        </Link>
                        <span className="text-xs font-black text-slate-900 shrink-0">
                          {formatPrice(o.totalPrice)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate font-medium text-slate-700">
                          {o.clientName ?? 'Neznámý klient'}
                        </span>
                        <span>{formatDate(o.createdAt)}</span>
                      </div>
                      <div className="pt-1 flex justify-end">
                        <Link
                          href={`/offers/${o.id}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-amber-500/90 px-3 py-1.5 text-[11px] font-black text-slate-950 hover:bg-amber-400 transition"
                        >
                          <span>Zkontrolovat a odeslat</span>
                          <ArrowRight size={11} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Odeslané klientům */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-black text-sky-900">
                    2. Odeslané ({data.offers.sent.length})
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Čekají na vyjádření klienta / follow-up
                  </p>
                </div>
                <span className="text-xs font-black text-slate-900">
                  {formatPrice(metrics.sentValue)}
                </span>
              </div>

              {data.offers.sent.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Žádné odeslané nabídky
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.offers.sent.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 hover:border-sky-300 hover:bg-sky-50/30 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/offers/${o.id}`}
                          className="text-xs font-extrabold text-slate-950 hover:text-sky-700"
                        >
                          {o.title}
                        </Link>
                        <span className="text-xs font-black text-slate-900 shrink-0">
                          {formatPrice(o.totalPrice)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate font-medium text-slate-700">
                          {o.clientName ?? 'Neznámý klient'}
                        </span>
                        {o.validUntil ? (
                          <span className="text-amber-700 font-semibold">
                            Platnost do {formatDate(o.validUntil)}
                          </span>
                        ) : (
                          <span>Odesláno {formatDate(o.sentAt)}</span>
                        )}
                      </div>
                      <div className="pt-1 flex justify-end">
                        <Link
                          href={`/offers/${o.id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-slate-100 transition"
                        >
                          <span>Detail nabídky</span>
                          <ArrowRight size={11} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 3: Přijaté nabídky */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-900">
                    3. Přijaté ({data.offers.accepted.length})
                  </span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Schválené klientem k realizaci
                  </p>
                </div>
                <span className="text-xs font-black text-emerald-700">
                  {formatPrice(metrics.acceptedValue)}
                </span>
              </div>

              {data.offers.accepted.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  Žádné přijaté nabídky
                </p>
              ) : (
                <div className="space-y-2.5">
                  {data.offers.accepted.map((o) => (
                    <div
                      key={o.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 hover:border-emerald-300 hover:bg-emerald-50/30 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/offers/${o.id}`}
                          className="text-xs font-extrabold text-slate-950 hover:text-emerald-700"
                        >
                          {o.title}
                        </Link>
                        <span className="text-xs font-black text-emerald-700 shrink-0">
                          {formatPrice(o.totalPrice)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate font-medium text-slate-700">
                          {o.clientName ?? 'Neznámý klient'}
                        </span>
                        {o.hasCrmOrder ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            ✓ Zakázka vytvořena
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            Čeká na zakázku
                          </span>
                        )}
                      </div>
                      <div className="pt-1 flex justify-end gap-2">
                        {!o.hasCrmOrder && (
                          <button
                            type="button"
                            disabled={runningEntityId === o.id}
                            onClick={() =>
                              handleRunOrchestrator('OFFER_ACCEPTED', o.id)
                            }
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                          >
                            <Play size={11} />
                            <span>
                              {runningEntityId === o.id
                                ? 'Zakládám…'
                                : 'Předat do realizace'}
                            </span>
                          </button>
                        )}
                        <Link
                          href={`/offers/${o.id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-slate-100 transition"
                        >
                          <span>Detail</span>
                          <ArrowRight size={11} />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: REALIZACE & FAKTURACE
      ===================================================================== */}
      {activeTab === 'realizations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/realizations"
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:border-sky-300 hover:shadow-md transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Aktivní realizace
                </span>
                <Wrench size={18} className="text-sky-600" />
              </div>
              <p className="text-3xl font-black text-slate-950">
                {data.realizations.active}
              </p>
              <p className="text-xs font-semibold text-sky-700 flex items-center gap-1">
                <span>Přejít na přehled realizací</span>
                <ArrowRight size={12} />
              </p>
            </Link>

            <Link
              href="/realizations"
              className="rounded-3xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm hover:border-amber-300 hover:shadow-md transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                  V riziku termínu
                </span>
                <Clock size={18} className="text-amber-600" />
              </div>
              <p className="text-3xl font-black text-amber-900">
                {data.realizations.risk}
              </p>
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                <span>Zkontrolovat termíny</span>
                <ArrowRight size={12} />
              </p>
            </Link>

            <Link
              href="/realizations"
              className="rounded-3xl border border-rose-200 bg-rose-50/80 p-5 shadow-sm hover:border-rose-300 hover:shadow-md transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                  Blokované realizace
                </span>
                <AlertTriangle size={18} className="text-rose-600" />
              </div>
              <p className="text-3xl font-black text-rose-900">
                {data.realizations.blocked}
              </p>
              <p className="text-xs font-semibold text-rose-800 flex items-center gap-1">
                <span>Vyřešit blokace</span>
                <ArrowRight size={12} />
              </p>
            </Link>

            <Link
              href="/invoices"
              className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm hover:border-emerald-300 hover:shadow-md transition space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Připraveno k fakturaci
                </span>
                <Receipt size={18} className="text-emerald-600" />
              </div>
              <p className="text-3xl font-black text-emerald-900">
                {data.realizations.readyForBilling}
              </p>
              <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
                <span>Přejít do fakturace</span>
                <ArrowRight size={12} />
              </p>
            </Link>
          </div>

          {/* Realization-specific alerts from Attention Items */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-950">
                  Upozornění k realizacím a fakturaci
                </h3>
                <p className="text-xs text-slate-500">
                  Položky vyžadující zásah produkce, instalatérů nebo fakturace.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/work"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Produkce & Práce
                </Link>
                <Link
                  href="/occupancy"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                >
                  Obsazenost
                </Link>
              </div>
            </div>

            {data.attentionItems.filter(
              (i) =>
                i.category === 'REALIZATION_BLOCKED' ||
                i.category === 'DEADLINE_RISK' ||
                i.entityType === 'REALIZATION' ||
                i.entityType === 'CRM_ORDER'
            ).length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                <p className="text-xs font-bold text-slate-700">
                  Žádné blokované realizace ani kritická rizika prodlení.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.attentionItems
                  .filter(
                    (i) =>
                      i.category === 'REALIZATION_BLOCKED' ||
                      i.category === 'DEADLINE_RISK' ||
                      i.entityType === 'REALIZATION' ||
                      i.entityType === 'CRM_ORDER'
                  )
                  .map((item) => {
                    const pStyle = PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.MEDIUM;
                    return (
                      <div
                        key={item.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 ${pStyle.border}`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${pStyle.badge}`}
                            >
                              {pStyle.label}
                            </span>
                            <span className="text-sm font-extrabold text-slate-950">
                              {item.title}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{item.description}</p>
                        </div>
                        <Link
                          href={item.link}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-600 transition shrink-0 self-start sm:self-center"
                        >
                          <span>Vyřešit</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
