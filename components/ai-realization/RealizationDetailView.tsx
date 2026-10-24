'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  MapPin,
  Camera,
  Printer,
  ShieldAlert,
  Calendar,
  User,
  Wrench,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  Layers,
  Sparkles,
  Check,
  AlertCircle,
  Copy,
  Edit3,
} from 'lucide-react';
import type { RealizationContext, RealizationPhase } from '@/lib/ai-realization/contracts/realization-context';
import { RealizationChangeSetCard, type PendingChangeSetItem } from './RealizationChangeSetCard';
import { RealizationStatusSyncCard } from './RealizationStatusSyncCard';

type TabKey = 'overview' | 'contract' | 'production' | 'installation' | 'billing';

const PHASES: Array<{
  id: number;
  label: string;
  sublabel: string;
  tabTarget: TabKey;
  phaseKey: RealizationPhase;
}> = [
  { id: 1, label: '1. Obchod', sublabel: 'Poptávka & Výběr ploch', tabTarget: 'overview', phaseKey: 'PREPARATION' },
  { id: 2, label: '2. Smlouva a termíny', sublabel: 'Objednávka & Harmonogram', tabTarget: 'contract', phaseKey: 'PREPARATION' },
  { id: 3, label: '3. Výroba & Tisk', sublabel: 'Data, korektury & tisk', tabTarget: 'production', phaseKey: 'PRODUCTION' },
  { id: 4, label: '4. Realizace v terénu', sublabel: 'Výlep, montáž & foto', tabTarget: 'installation', phaseKey: 'INSTALLATION' },
  { id: 5, label: '5. Finance & Uzavření', sublabel: 'Předávací protokol & fa', tabTarget: 'billing', phaseKey: 'READY_FOR_BILLING' },
];

export function RealizationDetailView({
  context: initialContext,
  pendingChangeSets = [],
  nextBestActions = [],
}: {
  context: RealizationContext;
  pendingChangeSets?: PendingChangeSetItem[];
  nextBestActions?: Array<{ title: string; description: string; priority: string; targetUrl?: string }>;
}) {
  const router = useRouter();
  const [context, setContext] = useState<RealizationContext>(initialContext);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (initialContext.overallPhase === 'READY_FOR_BILLING' || initialContext.overallPhase === 'INVOICED' || initialContext.overallPhase === 'COMPLETED') return 'billing';
    if (initialContext.overallPhase === 'INSTALLATION' || initialContext.overallPhase === 'PHOTO_DOCUMENTATION') return 'installation';
    if (initialContext.overallPhase === 'PRODUCTION' || initialContext.overallPhase === 'GRAPHICS') return 'production';
    return 'contract';
  });

  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [contractCodeInput, setContractCodeInput] = useState(context.clientOrderCode || '');
  const [dateFromInput, setDateFromInput] = useState(context.campaign.dateFrom ? new Date(context.campaign.dateFrom).toISOString().split('T')[0] : '');
  const [dateToInput, setDateToInput] = useState(context.campaign.dateTo ? new Date(context.campaign.dateTo).toISOString().split('T')[0] : '');
  const [noteInput, setNoteInput] = useState(context.note || '');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const totalItems = context.items.length;
  const installedItems = context.items.filter((i) => i.isInstalled).length;
  const photographedItems = context.items.filter((i) => i.isPhotographed).length;
  const isAllInstalled = totalItems > 0 && installedItems === totalItems;
  const isAllPhotographed = totalItems > 0 && photographedItems === totalItems;

  const currentPhaseIndex = PHASES.findIndex((p) => {
    if (context.overallPhase === 'COMPLETED' || context.overallPhase === 'INVOICED' || context.overallPhase === 'READY_FOR_BILLING') return p.id === 5;
    if (context.overallPhase === 'PHOTO_DOCUMENTATION' || context.overallPhase === 'INSTALLATION') return p.id === 4;
    if (context.overallPhase === 'PRODUCTION' || context.overallPhase === 'GRAPHICS') return p.id === 3;
    if (context.clientOrderCode) return p.id === 2;
    return p.id === 1;
  });

  async function handleUpdateContract(e: React.FormEvent) {
    e.preventDefault();
    setIsUpdating(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/realization/${context.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientOrderCode: contractCodeInput,
          dateFrom: dateFromInput ? new Date(dateFromInput).toISOString() : null,
          dateTo: dateToInput ? new Date(dateToInput).toISOString() : null,
          note: noteInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uložení selhalo.');
      if (data.context) setContext(data.context);
      setFeedback({ type: 'success', message: 'Smlouva a termíny byly úspěšně uloženy.' });
      setIsContractModalOpen(false);
      router.refresh();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba při ukládání.' });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleQuickPhaseJump(targetPhase: string) {
    setIsUpdating(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/realization/${context.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPhase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Změna stavu selhala.');
      if (data.context) setContext(data.context);
      setFeedback({ type: 'success', message: `Fáze zakázky byla posunuta do ${targetPhase}.` });
      router.refresh();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba při změně fáze.' });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleToggleItemStatus(itemId: string, currentStatus: string) {
    setIsUpdating(true);
    try {
      const newStatus = currentStatus === 'INSTALLED' || currentStatus === 'PHOTOGRAPHED' || currentStatus === 'COMPLETED' ? 'SCHEDULED' : 'INSTALLED';
      const res = await fetch(`/api/realization/${context.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          realizationItemId: itemId,
          itemStatus: newStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chyba při změně položky.');
      if (data.context) setContext(data.context);
      router.refresh();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba položky.' });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20">
      {/* Top Breadcrumb & Quick Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <Link
            href="/realization"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zpět na přehled realizací
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {context.orderNumber}
            </h1>
            <span className="rounded-xl bg-slate-900 px-3 py-1 text-xs font-black text-white shadow-xs">
              {context.clientName}
            </span>
            <span className="rounded-xl bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800 border border-sky-200">
              {context.projectType === 'COMBINED' ? 'Kombinovaný mix nosičů' : context.projectType}
            </span>
          </div>
          {context.offerTitle && (
            <p className="text-xs text-slate-500 mt-1">
              Vazba na nabídku: <strong>{context.offerTitle}</strong>
              {context.offerId && (
                <Link href={`/offers/${context.offerId}`} className="ml-2 text-sky-600 hover:underline inline-flex items-center gap-0.5">
                  Zobrazit nabídku <ExternalLink size={10} />
                </Link>
              )}
            </p>
          )}
        </div>

        {/* Quick Phase Jump & Sync */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Jump Selector */}
          <div className="relative inline-block text-left">
            <select
              disabled={isUpdating}
              onChange={(e) => {
                if (e.target.value) handleQuickPhaseJump(e.target.value);
                e.target.value = '';
              }}
              className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs hover:border-slate-400 focus:outline-hidden"
              defaultValue=""
              aria-label="Rychlý skok do stavu realizace"
            >
              <option value="" disabled>⚡ Přejít přímo do fáze... ▾</option>
              <option value="PREPARATION">1. Příprava smlouvy & podkladů</option>
              <option value="PRODUCTION">2. Výroba & Tisk plakátů/fólií</option>
              <option value="INSTALLATION">3. Montáž / Výlep v terénu</option>
              <option value="READY_FOR_BILLING">4. Fotodokumentace k fakturaci</option>
              <option value="COMPLETED">5. Dokončeno & Vyfakturováno</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            Obnovit
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-xs font-medium transition ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="flex-1">{feedback.message}</div>
          <button onClick={() => setFeedback(null)} className="text-xs opacity-60 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Interactive 5-Phase Clickable Stepper */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Workflow zakázky (5 klíčových fází)
          </span>
          <span className="text-xs text-slate-400">
            Kliknutím na fázi přepnete přímo na příslušnou agendu
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PHASES.map((p, idx) => {
            const isCompleted = idx < currentPhaseIndex;
            const isCurrent = idx === currentPhaseIndex;
            const isTabActive = activeTab === p.tabTarget;

            let badgeStyle = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300';
            if (isTabActive) {
              badgeStyle = 'border-sky-500 bg-sky-50/70 text-sky-950 ring-2 ring-sky-400/40 shadow-sm';
            } else if (isCurrent) {
              badgeStyle = 'border-amber-400 bg-amber-50/50 text-amber-950 font-bold';
            } else if (isCompleted) {
              badgeStyle = 'border-emerald-200 bg-emerald-50/40 text-emerald-900';
            }

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveTab(p.tabTarget)}
                className={`flex flex-col text-left p-3 rounded-xl border-2 transition cursor-pointer ${badgeStyle}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-tight">{p.label}</span>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : isCurrent ? (
                    <span className="rounded bg-amber-200 px-1 py-0.2 text-[9px] font-black text-amber-900">
                      BĚŽÍ
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 truncate">{p.sublabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs font-black'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Layers size={14} />
          <span>Přehled & Nosiče ({totalItems})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('contract')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'contract'
              ? 'bg-slate-900 text-white shadow-xs font-black'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <FileText size={14} />
          <span>Smlouva & Termíny</span>
          {context.clientOrderCode ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800 font-mono">
              {context.clientOrderCode}
            </span>
          ) : (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 font-bold">
              Chybí kód
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('production')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'production'
              ? 'bg-slate-900 text-white shadow-xs font-black'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Printer size={14} />
          <span>Výroba & Tisk ({context.printJobs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('installation')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'installation'
              ? 'bg-slate-900 text-white shadow-xs font-black'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Camera size={14} />
          <span>Montáž v terénu & Foto ({photographedItems}/{totalItems})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'billing'
              ? 'bg-slate-900 text-white shadow-xs font-black'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <FileCheck size={14} />
          <span>Fakturace & Uzavření</span>
          {context.billingReadiness.isReady && (
            <span className="rounded bg-emerald-500 text-white px-1.5 py-0.5 text-[10px] font-black">
              PŘIPRAVENO
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <span className="text-xs font-bold text-slate-500 uppercase">Klient</span>
              <div className="text-lg font-black text-slate-900 mt-1">{context.clientName}</div>
              <p className="text-xs text-slate-500">{context.clientContactPerson || context.clientContactEmail || 'Bez kontaktu'}</p>
            </div>

            <div className="card p-4">
              <span className="text-xs font-bold text-slate-500 uppercase">Termín kampaně</span>
              <div className="text-lg font-black text-slate-900 mt-1">
                {context.campaign.dateFrom ? new Date(context.campaign.dateFrom).toLocaleDateString('cs-CZ') : '–'}
                {' až '}
                {context.campaign.dateTo ? new Date(context.campaign.dateTo).toLocaleDateString('cs-CZ') : '–'}
              </div>
              <p className="text-xs text-slate-500">
                {context.campaign.daysUntilStart !== undefined ? `Začátek za ${context.campaign.daysUntilStart} dní` : 'Termín nezadán'}
              </p>
            </div>

            <div className="card p-4">
              <span className="text-xs font-bold text-slate-500 uppercase">Postup realizace</span>
              <div className="text-lg font-black text-slate-900 mt-1">
                {installedItems} / {totalItems} hotovo
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${totalItems > 0 ? (installedItems / totalItems) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="card p-4">
              <span className="text-xs font-bold text-slate-500 uppercase">Fotodokumentace</span>
              <div className="text-lg font-black text-slate-900 mt-1">
                {photographedItems} / {totalItems} vyfoceno
              </div>
              <p className="text-xs text-slate-500">
                {isAllPhotographed ? '✓ Všechny fotky nahrány' : `Chybí ${totalItems - photographedItems} fotografií`}
              </p>
            </div>
          </div>

          {/* Realization Status Card */}
          <RealizationStatusSyncCard
            orderId={context.orderId}
            orderNumber={context.orderNumber}
            overallPhase={context.overallPhase}
            projectType={String(context.projectType)}
            navigationOrderId={context.navigationOrderId}
            totalItems={totalItems}
            photographedItems={photographedItems}
            installedItems={installedItems}
            isReadyForBilling={context.billingReadiness.isReady}
          />

          {/* Carrier List in Mix */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Nosiče a plochy v zakázce ({totalItems})
              </h2>
              <button
                type="button"
                onClick={() => setActiveTab('installation')}
                className="text-xs font-bold text-sky-700 hover:underline"
              >
                Přejít do terénní montáže ➔
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {context.items.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.surfaceName || item.carrierCode}</span>
                      {item.carrierCode && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                          {item.carrierCode}
                        </span>
                      )}
                      {item.mediaType && (
                        <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                          {item.mediaType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>📍 {item.carrierCity} {item.carrierAddress ? `(${item.carrierAddress})` : ''}</span>
                      {item.plannedDate && (
                        <span>📅 Plán: {new Date(item.plannedDate).toLocaleDateString('cs-CZ')}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        item.isInstalled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.isInstalled ? '✓ Vylepeno / Namontováno' : 'Čeká na montáž'}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        item.isPhotographed ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <Camera size={12} />
                      {item.isPhotographed ? 'Foto OK' : 'Chybí foto'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTRACT & TERMS */}
      {activeTab === 'contract' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">Klientská smlouva & Objednávka</span>
                <h2 className="text-xl font-black text-slate-900 mt-1">Smlouva a harmonogram kampaně</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Číslo klientské smlouvy nebo objednávky se propisuje do předávacích protokolů a podkladů k fakturaci.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsContractModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 cursor-pointer"
              >
                <Edit3 size={14} />
                Upravit smlouvu a harmonogram
              </button>
            </div>

            {/* Display Values */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <span className="text-xs font-bold text-slate-500 uppercase">Číslo smlouvy / Kód objednávky</span>
                <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                  {context.clientOrderCode || <span className="text-amber-600 font-sans text-sm font-bold">Nezadáno</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">Interní kód klientského PO/smlouvy</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <span className="text-xs font-bold text-slate-500 uppercase">Doba trvání kampaně</span>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {context.campaign.dateFrom ? new Date(context.campaign.dateFrom).toLocaleDateString('cs-CZ') : '–'}
                  {' až '}
                  {context.campaign.dateTo ? new Date(context.campaign.dateTo).toLocaleDateString('cs-CZ') : '–'}
                </div>
                <p className="text-xs text-slate-500 mt-1">Termín pro výlep / nájem ploch</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <span className="text-xs font-bold text-slate-500 uppercase">Poznámka ke smlouvě</span>
                <div className="text-sm font-medium text-slate-800 mt-1">
                  {context.note || 'Bez poznámky'}
                </div>
              </div>
            </div>

            {/* Forward Action Callout */}
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="text-xs font-black text-sky-950 uppercase">Máte smlouvu a termíny odsouhlaseny?</h4>
                <p className="text-xs text-sky-800 mt-0.5">
                  Pokračujte do fáze Výroba & Tisk pro kontrolu tiskových dat a materiálů pro nosiče.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('production')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700 cursor-pointer"
              >
                Přejít do Výroby & Tisku ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCTION & PRINT */}
      {activeTab === 'production' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">Výroba a tisková data</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Přehled výrobních úloh rozdělených podle formátů nosičů (fólie, bannery, plakáty).
                </p>
              </div>
              <Link
                href="/production"
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Otevřít velín výroby ↗
              </Link>
            </div>

            {context.printJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-xs">
                K této zakázce zatím nejsou evidovány tiskové úlohy (tisk dodává klient nebo se čeká na zadání).
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {context.printJobs.map((pj) => (
                  <div key={pj.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{pj.title}</span>
                      <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                        {pj.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>Materiál: <strong>{pj.materialType || 'Standard'}</strong></div>
                      <div>Počet kusů: <strong>{pj.quantity} ks</strong></div>
                      {pj.deliveryDeadline && (
                        <div>Termín dodání: <strong>{new Date(pj.deliveryDeadline).toLocaleDateString('cs-CZ')}</strong></div>
                      )}
                      <div>Korektura: <strong>{pj.isApproved ? '✓ Schválena' : 'Čeká na schválení'}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: INSTALLATION & PHOTOS */}
      {activeTab === 'installation' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  Montáž a fotodokumentace v terénu ({installedItems}/{totalItems} hotovo)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  U každého nosiče z mixu můžete potvrdit montáž / vylepení a zkontrolovat pořízenou fotodokumentaci.
                </p>
              </div>

              {context.offerId && (
                <Link
                  href={`/campaign/${context.offerId}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-800 cursor-pointer"
                >
                  <ExternalLink size={13} />
                  🌟 Klientský Live Portál s fotkami
                </Link>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {context.items.map((item) => (
                <div key={item.id} className="py-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{item.surfaceName || item.carrierCode}</span>
                        {item.carrierCode && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                            {item.carrierCode}
                          </span>
                        )}
                        {item.mediaType && (
                          <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                            {item.mediaType}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        📍 {item.carrierCity} {item.carrierAddress ? `(${item.carrierAddress})` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleToggleItemStatus(item.id, item.status)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer ${
                          item.isInstalled
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Check size={13} />
                        {item.isInstalled ? '✓ Vylepeno' : 'Označit jako vylepeno'}
                      </button>
                    </div>
                  </div>

                  {/* Photos Grid if any */}
                  {item.photos.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {item.photos.map((photo) => (
                        <a
                          key={photo.id}
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative block size-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 hover:opacity-90"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img alt="Foto z montáže" src={photo.url} className="h-full w-full object-cover" />
                          <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5 truncate">
                            {photo.type}
                          </span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 w-fit">
                      <Camera size={13} />
                      <span>Zatím nebyla nahrána fotografie z terénu.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BILLING & CLOSE */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-5">
            <div className="border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Fakturace & Uzavření</span>
              <h2 className="text-xl font-black text-slate-900 mt-1">Podklad k fakturaci zakázky</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Kontrola připravenosti</span>
                <div className="flex items-center gap-2">
                  {context.billingReadiness.isReady ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                      <CheckCircle2 size={14} />
                      Zakázka je připravena k fakturaci
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      <Clock size={14} />
                      Probíhá realizace nebo chybí fotodokumentace
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600">{context.billingReadiness.explanation}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Cena a kód klientské smlouvy</span>
                <div className="text-2xl font-black text-slate-900">
                  {context.billingReadiness.totalPrice !== undefined
                    ? `${context.billingReadiness.totalPrice.toLocaleString('cs-CZ')} ${context.billingReadiness.currency}`
                    : 'Dle nabídky'}
                </div>
                <div className="text-xs text-slate-600">
                  Kód smlouvy na faktuře: <strong>{context.clientOrderCode || 'Bez kódu'}</strong>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleQuickPhaseJump('COMPLETED')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 size={16} />
                Schválit realizaci & Uzavřít zakázku
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract & Schedule Modal */}
      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                Upravit smlouvu a harmonogram zakázky
              </h3>
              <button
                type="button"
                onClick={() => setIsContractModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateContract} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Kód klientské objednávky / číslo smlouvy
                </label>
                <input
                  type="text"
                  value={contractCodeInput}
                  onChange={(e) => setContractCodeInput(e.target.value)}
                  placeholder="např. PO-2026-LIDL-01"
                  className="input w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Začátek kampaně (výlep)
                  </label>
                  <input
                    type="date"
                    value={dateFromInput}
                    onChange={(e) => setDateFromInput(e.target.value)}
                    className="input w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Konec kampaně (svoz)
                  </label>
                  <input
                    type="date"
                    value={dateToInput}
                    onChange={(e) => setDateToInput(e.target.value)}
                    className="input w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Poznámka ke smlouvě / realizaci
                </label>
                <textarea
                  rows={2}
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="např. montáž provést o víkendu"
                  className="input w-full text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isUpdating ? 'Ukládám...' : 'Uložit změny'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
