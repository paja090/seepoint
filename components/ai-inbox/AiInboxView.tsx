'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Inbox,
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Mail,
  Building2,
  Calendar,
  FolderKanban,
} from 'lucide-react';
import { AiInboxMessageCard, type AiInboxListItem } from './AiInboxMessageCard';
import { AiInboxDetailModal, type AiInboxMessageDetailData } from './AiInboxDetailModal';
import { CLASSIFICATION_LABELS } from '@/lib/ai-inbox/classifier';

export function AiInboxView({
  initialItems,
  mailboxes,
}: {
  initialItems: AiInboxListItem[];
  mailboxes: Array<{ id: string; accountEmail: string | null; provider: string }>;
}) {
  const [items, setItems] = useState<AiInboxListItem[]>(initialItems);
  const [activeTab, setActiveTab] = useState<'ATTENTION' | 'NEW' | 'PROCESSED' | 'ALL'>('ATTENTION');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('ALL');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [selectedMessage, setSelectedMessage] = useState<AiInboxMessageDetailData | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Tab counts
  const attentionCount = items.filter((i) => i.requiresReview && i.processingStatus !== 'PROCESSED').length;
  const newCount = items.filter((i) => i.processingStatus === 'INGESTED' || i.processingStatus === 'READY').length;
  const processedCount = items.filter((i) => i.processingStatus === 'PROCESSED').length;
  const totalCount = items.length;

  // Fetch updated list from server
  async function refreshList() {
    try {
      const res = await fetch('/api/ai-inbox');
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.warn('Refresh failed:', err);
    }
  }

  // Open detail modal
  async function handleOpenDetail(item: AiInboxListItem) {
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/ai-inbox/${item.id}`);
      if (res.ok) {
        const detail = await res.json();
        setSelectedMessage(detail);
      }
    } catch (err) {
      console.warn('Failed to load message detail:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  }

  // Manual mailbox sync
  async function triggerSync(preset: 'INBOX' | 'ORDERS_ONLY' | 'ALL' = 'INBOX', customQuery?: string) {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetch('/api/ai-inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedMailboxId !== 'ALL' ? selectedMailboxId : undefined,
          preset,
          query: customQuery || undefined,
          maxResults: preset === 'ORDERS_ONLY' || customQuery ? 50 : 25,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Synchronizace selhala.');
      setSyncFeedback(
        preset === 'ORDERS_ONLY'
          ? 'Hledání zakázek v Gmailu dokončeno. Zprávy byly zařazeny a analyzovány.'
          : customQuery
            ? `Vyhledávání v Gmailu na dotaz "${customQuery}" dokončeno.`
            : 'Schránky byly úspěšně zkontrolovány a nové zprávy zpracovány.'
      );
      await refreshList();
    } catch (err) {
      setSyncFeedback(err instanceof Error ? err.message : 'Chyba při synchronizaci');
    } finally {
      setIsSyncing(false);
    }
  }

  // Filtered items logic
  const filteredItems = items.filter((item) => {
    // 1. Tab filter
    if (activeTab === 'ATTENTION' && (!item.requiresReview || item.processingStatus === 'PROCESSED')) return false;
    if (activeTab === 'NEW' && !(item.processingStatus === 'INGESTED' || item.processingStatus === 'READY')) return false;
    if (activeTab === 'PROCESSED' && item.processingStatus !== 'PROCESSED') return false;

    // 2. Mailbox filter
    if (selectedMailboxId !== 'ALL' && item.integrationConnection?.accountEmail) {
      const mb = mailboxes.find((m) => m.id === selectedMailboxId);
      if (mb && item.integrationConnection.accountEmail !== mb.accountEmail) return false;
    }

    // 3. Classification filter
    if (selectedClassification !== 'ALL' && item.classification !== selectedClassification) return false;

    // 4. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubject = item.subject?.toLowerCase().includes(q);
      const matchSender = item.fromEmail?.toLowerCase().includes(q) || item.fromName?.toLowerCase().includes(q);
      const matchSummary = item.aiSummary?.toLowerCase().includes(q);
      const matchClient = item.client?.name?.toLowerCase().includes(q);
      const matchOrder = item.crmOrder?.orderNumber?.toLowerCase().includes(q) || item.crmOrder?.title?.toLowerCase().includes(q);
      const matchOffer = item.offer?.title?.toLowerCase().includes(q);
      if (!matchSubject && !matchSender && !matchSummary && !matchClient && !matchOrder && !matchOffer) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* TOP BAR: TITLE & ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-fuchsia-600 to-indigo-600 text-white shadow-md">
              <Sparkles size={20} />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              AI Inbox
            </h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Pracovní AI fronta příchozích obchodních e-mailů. AI navrhuje kroky do CRM, nabídek a navigace – člověk rozhoduje.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mailboxes.length === 0 ? (
            <a
              href="/settings/integrations"
              className="inline-flex items-center gap-1.5 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3.5 py-2 text-xs font-bold text-fuchsia-800 hover:bg-fuchsia-100 transition"
            >
              <Mail size={14} />
              <span>Připojit Gmail schránku</span>
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={() => triggerSync('ORDERS_ONLY')}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 active:scale-95 disabled:opacity-50 transition shadow-sm"
                title="Prohledá celou Gmail schránku na e-maily související se zakázkami, poptávkami a nabídkami"
              >
                <FolderKanban size={14} className="text-blue-600" />
                <span>Hledat zakázky v Gmailu</span>
              </button>

              <button
                type="button"
                onClick={() => triggerSync('INBOX')}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 disabled:opacity-50 transition"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Synchronizuji…' : 'Synchronizovat'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* SYNC NOTIFICATION BANNER */}
      {syncFeedback && (
        <div className="flex items-center justify-between rounded-xl bg-fuchsia-50 p-3 text-xs font-medium text-fuchsia-900 border border-fuchsia-200">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-fuchsia-600" />
            <span>{syncFeedback}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-fuchsia-700 hover:text-fuchsia-950 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ATTENTION')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs sm:text-sm font-bold transition ${
              activeTab === 'ATTENTION'
                ? 'border-fuchsia-600 text-fuchsia-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertCircle size={15} />
            <span>Vyžaduje pozornost</span>
            {attentionCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.2 text-[11px] font-black text-amber-800">
                {attentionCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('NEW')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs sm:text-sm font-bold transition ${
              activeTab === 'NEW'
                ? 'border-fuchsia-600 text-fuchsia-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Inbox size={15} />
            <span>Nové</span>
            {newCount > 0 && (
              <span className="rounded-full bg-fuchsia-100 px-2 py-0.2 text-[11px] font-black text-fuchsia-800">
                {newCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PROCESSED')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs sm:text-sm font-bold transition ${
              activeTab === 'PROCESSED'
                ? 'border-fuchsia-600 text-fuchsia-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 size={15} />
            <span>Zpracované</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[11px] text-slate-600">
              {processedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs sm:text-sm font-bold transition ${
              activeTab === 'ALL'
                ? 'border-fuchsia-600 text-fuchsia-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Vše</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[11px] text-slate-600">
              {totalCount}
            </span>
          </button>
        </div>
      </div>

      {/* SEARCH AND SECONDARY FILTERS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search input */}
        <div className="relative sm:col-span-6">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat firmu, zakázku (ZAK-...), e-mail, předmět…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Mailbox filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedMailboxId}
            onChange={(e) => setSelectedMailboxId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
          >
            <option value="ALL">Všechny schránky</option>
            {mailboxes.map((mb) => (
              <option key={mb.id} value={mb.id}>
                {mb.accountEmail || 'Gmail účet'}
              </option>
            ))}
          </select>
        </div>

        {/* Classification filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedClassification}
            onChange={(e) => setSelectedClassification(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-700 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
          >
            <option value="ALL">Všechny typy zpráv</option>
            {Object.entries(CLASSIFICATION_LABELS).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.icon} {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* MESSAGES LIST */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-600 mb-3">
            <Inbox size={24} />
          </div>
          <h3 className="font-bold text-slate-900 text-base">
            Žádné e-maily k zobrazení
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            {searchQuery
              ? 'Pro zadaný vyhledávací výraz nebyla nalezena žádná zpráva.'
              : activeTab === 'ATTENTION'
                ? 'Skvělé! Žádná zpráva momentálně nevyžaduje vaši okamžitou pozornost.'
                : 'V této záložce se momentálně nenachází žádné zprávy.'}
          </p>
          {mailboxes.length === 0 && (
            <a
              href="/settings/integrations"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-fuchsia-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-fuchsia-500 transition"
            >
              <Mail size={14} />
              <span>Připojit první firemní schránku</span>
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <AiInboxMessageCard
              key={item.id}
              item={item}
              onSelect={handleOpenDetail}
              isSelected={selectedMessage?.id === item.id}
            />
          ))}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedMessage && (
        <AiInboxDetailModal
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onActionComplete={async () => {
            await refreshList();
            // reload detail
            const res = await fetch(`/api/ai-inbox/${selectedMessage.id}`);
            if (res.ok) {
              const updated = await res.json();
              setSelectedMessage(updated);
            }
          }}
        />
      )}
    </div>
  );
}
