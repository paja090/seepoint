'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  MapPin,
  Calendar,
  Layers,
  Paperclip,
  Send,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FolderKanban,
  Compass,
  FileText,
  Link2,
  Unlink,
  Search,
} from 'lucide-react';
import { CLASSIFICATION_LABELS, getConfidenceBadge } from '@/lib/ai-inbox/classifier';
import type { AiInboxActionStatus, AiInboxActionType, AiInboxAnalysisResult } from '@/lib/ai-inbox/types';

export type AiInboxMessageDetailData = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  toEmails: string[];
  ccEmails: string[];
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  receivedAt: string | Date;
  processingStatus: string;
  classification: string;
  confidence: number;
  requiresReview: boolean;
  aiSummary: string | null;
  aiReasoningSummary: string | null;
  aiExtractedData: AiInboxAnalysisResult | null;
  suggestedReply: string | null;
  errorMessage: string | null;
  clientId: string | null;
  integrationConnection?: { id: string; accountEmail: string | null; provider: string } | null;
  client?: { id: string; name: string; companyId: string | null; email: string | null; phone: string | null } | null;
  contact?: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null;
  crmOrder?: { id: string; orderNumber: string; title: string; status: string; totalPrice: unknown } | null;
  offer?: { id: string; title: string; status: string; totalPrice: unknown } | null;
  navigationOrder?: { id: string; orderNumber: string; status: string } | null;
  activeClientOrders?: Array<{
    id: string;
    orderNumber: string;
    title: string;
    status: string;
    projectType?: string;
    isNavigation?: boolean;
  }>;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    classification: string;
    clientDocumentId: string | null;
    fileUrl: string | null;
  }>;
  actions: Array<{
    id: string;
    type: AiInboxActionType;
    status: AiInboxActionStatus;
    title: string;
    description: string;
    confidence: number;
    payload: Record<string, unknown>;
    errorMessage: string | null;
    executedAt: string | null;
    executedBy?: { id: string; name: string } | null;
  }>;
};

export function AiInboxDetailModal({
  message,
  onClose,
  onActionComplete,
}: {
  message: AiInboxMessageDetailData;
  onClose: () => void;
  onActionComplete: () => void;
}) {
  const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(
    () => new Set(message.actions.filter((a) => a.status === 'PROPOSED').map((a) => a.id))
  );
  const [isExecutingBatch, setIsExecutingBatch] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [replyText, setReplyText] = useState(message.suggestedReply || '');
  const [replyCopied, setReplyCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [viewHtml, setViewHtml] = useState(false);
  const [isLinkingOrder, setIsLinkingOrder] = useState(false);
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [isSearchingOrders, setIsSearchingOrders] = useState(false);
  const [searchedOrders, setSearchedOrders] = useState<Array<{
    id: string;
    orderNumber: string;
    title: string;
    status: string;
    client?: { name: string };
  }>>([]);

  async function handleLinkOrder(orderId: string | null) {
    setIsLinkingOrder(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crmOrderId: orderId }),
      });
      if (!res.ok) throw new Error('Nepodařilo se změnit propojení se zakázkou.');
      setFeedback({
        type: 'success',
        message: orderId ? 'Zpráva byla úspěšně spárována se zakázkou.' : 'Propojení se zakázkou bylo zrušeno.',
      });
      setShowOrderPicker(false);
      onActionComplete();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba při propojování' });
    } finally {
      setIsLinkingOrder(false);
    }
  }

  async function handleSearchOrders() {
    if (!orderSearchQuery.trim()) return;
    setIsSearchingOrders(true);
    try {
      const res = await fetch(`/api/ai-inbox/orders?q=${encodeURIComponent(orderSearchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchedOrders(data.orders || []);
      }
    } catch (err) {
      console.warn('Hledání zakázek selhalo:', err);
    } finally {
      setIsSearchingOrders(false);
    }
  }

  const classMeta = CLASSIFICATION_LABELS[message.classification as keyof typeof CLASSIFICATION_LABELS] || CLASSIFICATION_LABELS.UNKNOWN;
  const confBadge = getConfidenceBadge(message.confidence);
  const extracted = (message.aiExtractedData || {}) as Partial<AiInboxAnalysisResult>;

  const proposedActions = message.actions.filter((a) => a.status === 'PROPOSED');
  const completedActions = message.actions.filter((a) => a.status === 'EXECUTED');

  function toggleActionSelection(id: string) {
    setSelectedActionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function executeBatch() {
    if (selectedActionIds.size === 0) return;
    setIsExecutingBatch(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${message.id}/actions/execute-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionIds: Array.from(selectedActionIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Provedení akcí selhalo.');
      setFeedback({ type: 'success', message: 'Vybrané akce byly úspěšně provedeny a uloženy v systému.' });
      onActionComplete();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Neznámá chyba' });
    } finally {
      setIsExecutingBatch(false);
    }
  }

  async function executeSingle(actionId: string) {
    setFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${message.id}/actions/${actionId}/execute`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Akci se nepodařilo provést.');
      setFeedback({ type: 'success', message: 'Akce byla úspěšně provedena.' });
      onActionComplete();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba při provádění' });
    }
  }

  async function rejectSingle(actionId: string) {
    setFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${message.id}/actions/${actionId}/reject`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Akci se nepodařilo odmítnout.');
      setFeedback({ type: 'success', message: 'Akce byla zamítnuta.' });
      onActionComplete();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba' });
    }
  }

  async function reprocessAi() {
    setIsReprocessing(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${message.id}/reprocess`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Přegenerování AI selhalo.');
      setFeedback({ type: 'success', message: 'AI analýza byla úspěšně přegenerována.' });
      onActionComplete();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba AI' });
    } finally {
      setIsReprocessing(false);
    }
  }

  async function sendReply() {
    if (!replyText.trim()) return;
    setIsSendingReply(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${message.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: message.fromEmail,
          subject: `Re: ${message.subject}`,
          message: replyText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Odeslání odpovědi selhalo.');
      setFeedback({ type: 'success', message: 'Odpověď byla úspěšně odeslána a zapsána do komunikace klienta.' });
      onActionComplete();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba odeslání' });
    } finally {
      setIsSendingReply(false);
    }
  }

  function copyReplyToClipboard() {
    if (!replyText) return;
    navigator.clipboard.writeText(replyText);
    setReplyCopied(true);
    setTimeout(() => setReplyCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* HEADER */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
          <div className="min-w-0 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold border ${classMeta.badgeColor}`}>
                <span>{classMeta.icon}</span>
                <span>{classMeta.label}</span>
              </span>
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold border ${confBadge.colorClass}`}>
                Jistota {confBadge.percentage} %
              </span>
              {message.integrationConnection?.accountEmail && (
                <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  Schránka: {message.integrationConnection.accountEmail}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg sm:text-xl font-bold text-white line-clamp-2">
              {message.subject}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span>Od: <strong>{message.fromName ? `${message.fromName} <${message.fromEmail}>` : message.fromEmail}</strong></span>
              <span>•</span>
              <span>{new Date(message.receivedAt).toLocaleString('cs-CZ')}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Zavřít"
          >
            <X size={20} />
          </button>
        </div>

        {/* FEEDBACK BANNER */}
        {feedback && (
          <div
            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* BODY: SPLIT VIEW (LEFT: EMAIL, RIGHT: AI & ACTIONS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* LEFT PANE (5 cols): ORIGINAL MESSAGE */}
          <div className="lg:col-span-5 p-5 space-y-4 overflow-y-auto bg-slate-50/50">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Původní zpráva
              </h3>
              {message.htmlBody && (
                <button
                  type="button"
                  onClick={() => setViewHtml(!viewHtml)}
                  className="text-xs font-medium text-fuchsia-700 hover:underline"
                >
                  {viewHtml ? 'Zobrazit čistý text' : 'Zobrazit HTML formát'}
                </button>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-800 max-h-[420px] overflow-y-auto">
              {viewHtml && message.htmlBody ? (
                <div
                  className="prose prose-sm max-w-none break-words"
                  dangerouslySetInnerHTML={{ __html: message.htmlBody }}
                />
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">
                  {message.textBody || message.htmlBody || '(Zpráva nemá textové tělo)'}
                </p>
              )}
            </div>

            {/* ATTACHMENTS */}
            {message.attachments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Paperclip size={13} />
                  Přílohy ({message.attachments.length})
                </h4>
                <div className="space-y-1.5">
                  {message.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          {att.classification}
                        </span>
                        <span className="truncate font-medium text-slate-800">{att.filename}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                        {Math.round(att.size / 1024)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANE (7 cols): AI INTELLIGENCE & HUMAN ACTION PANEL */}
          <div className="lg:col-span-7 p-5 space-y-6 overflow-y-auto bg-white">
            {/* AI SUMMARY & PARAMETERS CARD */}
            <div className="rounded-xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50/50 via-white to-indigo-50/30 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-fuchsia-900 font-bold text-sm">
                  <Sparkles size={16} className="text-fuchsia-600" />
                  <span>AI Rozpoznání a analýza požadavku</span>
                </div>
                <button
                  type="button"
                  onClick={reprocessAi}
                  disabled={isReprocessing}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-fuchsia-700 disabled:opacity-50"
                  title="Znovu analyzovat zprávu přes AI"
                >
                  <RefreshCw size={12} className={isReprocessing ? 'animate-spin' : ''} />
                  {isReprocessing ? 'Analyzuji…' : 'Zpracovat AI znovu'}
                </button>
              </div>

              {/* Extracted parameters grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                {/* Company */}
                <div className="rounded-lg bg-white/90 border border-slate-200 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Building2 size={13} />
                    <span>Firma / Klient</span>
                  </div>
                  <div className="font-bold text-slate-900">
                    {extracted.company?.name || message.client?.name || 'Neznámá firma'}
                  </div>
                  {message.client ? (
                    <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      Existuje v CRM (#{message.client.name})
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-700 font-medium">
                      Není v CRM (bude navrženo založení)
                    </div>
                  )}
                  {extracted.company?.ico && (
                    <div className="text-[11px] text-slate-500">IČO: {extracted.company.ico}</div>
                  )}
                </div>

                {/* Contact */}
                <div className="rounded-lg bg-white/90 border border-slate-200 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <User size={13} />
                    <span>Kontaktní osoba</span>
                  </div>
                  <div className="font-bold text-slate-900">
                    {extracted.contact?.name || message.contact ? `${message.contact?.firstName} ${message.contact?.lastName}` : message.fromName || 'Neuvedeno'}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {extracted.contact?.email || message.fromEmail}
                  </div>
                  {extracted.contact?.phone && (
                    <div className="text-[11px] text-slate-500">Tel: {extracted.contact.phone}</div>
                  )}
                </div>

                {/* Project / Location */}
                <div className="rounded-lg bg-white/90 border border-slate-200 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <MapPin size={13} />
                    <span>Projekt a lokalita</span>
                  </div>
                  <div className="font-bold text-slate-900">
                    {extracted.request?.projectType === 'NAVIGATION'
                      ? 'Navigace'
                      : extracted.request?.projectType === 'STANDARD_MEDIA'
                        ? 'Venkovní reklama'
                        : 'Obchodní projekt'}{' '}
                    {extracted.request?.location ? `• ${extracted.request.location}` : ''}
                  </div>
                  {extracted.request?.requestedQuantity && (
                    <div className="text-[11px] text-slate-600">
                      Požadavek: {extracted.request.requestedQuantity.exact || `${extracted.request.requestedQuantity.min || 8}–${extracted.request.requestedQuantity.max || 12}`} tabulí/ploch
                    </div>
                  )}
                </div>

                {/* Timing */}
                <div className="rounded-lg bg-white/90 border border-slate-200 p-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Calendar size={13} />
                    <span>Termín otevření / realizace</span>
                  </div>
                  <div className="font-bold text-slate-900">
                    {extracted.request?.openingDate
                      ? new Date(extracted.request.openingDate).toLocaleDateString('cs-CZ')
                      : extracted.request?.deadline
                        ? new Date(extracted.request.deadline).toLocaleDateString('cs-CZ')
                        : 'Nespecifikováno'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {extracted.request?.openingDate ? 'Plánované otevření provozovny' : 'Dle dohody'}
                  </div>
                </div>
              </div>

              {/* Summary text */}
              {message.aiSummary && (
                <div className="rounded-lg bg-fuchsia-100/50 p-3 text-xs text-slate-800 border border-fuchsia-200/50">
                  <span className="font-bold text-fuchsia-950">Souhrn požadavku: </span>
                  {message.aiSummary}
                </div>
              )}
            </div>

            {/* LINKED ORDER & OFFER SECTION */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <FolderKanban size={16} className="text-blue-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Propojená zakázka a nabídka
                  </h3>
                </div>
                {message.crmOrder ? (
                  <button
                    type="button"
                    onClick={() => handleLinkOrder(null)}
                    disabled={isLinkingOrder}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50 transition"
                  >
                    <Unlink size={13} />
                    <span>Odpojit zakázku</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowOrderPicker(!showOrderPicker)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                  >
                    <Link2 size={13} />
                    <span>{showOrderPicker ? 'Zavřít výběr' : 'Vybrat zakázku ručně'}</span>
                  </button>
                )}
              </div>

              {message.crmOrder ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-blue-50/70 border border-blue-200 p-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-900 text-sm">
                        {message.crmOrder.orderNumber}
                      </span>
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        {message.crmOrder.status}
                      </span>
                      {message.navigationOrder && (
                        <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 flex items-center gap-1">
                          <Compass size={11} /> Navigace
                        </span>
                      )}
                    </div>
                    <div className="font-medium text-slate-700 truncate max-w-md">
                      {message.crmOrder.title}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={message.navigationOrder ? `/navigation` : `/crm`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200 shadow-sm hover:bg-blue-50 transition"
                    >
                      <ExternalLink size={12} />
                      <span>Otevřít</span>
                    </a>
                  </div>
                </div>
              ) : message.offer ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50/70 border border-amber-200 p-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-amber-700" />
                      <span className="font-bold text-amber-950 text-sm">
                        Nabídka: {message.offer.title}
                      </span>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        {message.offer.status}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOrderPicker(!showOrderPicker)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    <Link2 size={12} />
                    <span>Přiřadit k zakázce</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600">
                    Zpráva zatím není spárována s žádnou zakázkou v systému.
                  </div>

                  {/* Active client orders suggestions */}
                  {message.activeClientOrders && message.activeClientOrders.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-bold text-slate-700">
                        Aktivní zakázky tohoto klienta ({message.activeClientOrders.length}):
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {message.activeClientOrders.map((ord) => (
                          <div
                            key={ord.id}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-xs hover:border-blue-300 transition"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2 font-bold text-slate-900">
                                <span>{ord.orderNumber}</span>
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 font-medium">
                                  {ord.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">{ord.title}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLinkOrder(ord.id)}
                              disabled={isLinkingOrder}
                              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-500 disabled:opacity-50 shrink-0 transition"
                            >
                              <Link2 size={11} />
                              <span>Propojit</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Order picker search box */}
                  {showOrderPicker && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <span className="text-xs font-bold text-slate-700">
                        Hledat v zakázkách (číslo, název nebo klient):
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchOrders()}
                          placeholder="Např. ZAK-2026 nebo McDonald's…"
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={handleSearchOrders}
                          disabled={isSearchingOrders || !orderSearchQuery.trim()}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                        >
                          <Search size={12} />
                          <span>{isSearchingOrders ? 'Hledám…' : 'Hledat'}</span>
                        </button>
                      </div>

                      {searchedOrders.length > 0 && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pt-1">
                          {searchedOrders.map((so) => (
                            <div
                              key={so.id}
                              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-xs"
                            >
                              <div className="min-w-0 pr-2">
                                <span className="font-bold text-slate-900">{so.orderNumber}</span>{' '}
                                <span className="text-slate-600">({so.title})</span>
                                {so.client && <span className="text-slate-400"> • {so.client.name}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleLinkOrder(so.id)}
                                disabled={isLinkingOrder}
                                className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-blue-500 transition"
                              >
                                Propojit
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* HUMAN-IN-THE-LOOP PROPOSED ACTIONS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-slate-700" />
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Navrhované akce systému (Člověk schvaluje)
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {proposedActions.length} k vyřízení
                </span>
              </div>

              {proposedActions.length === 0 && completedActions.length > 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Všechny navržené akce pro tento e-mail již byly úspěšně provedeny.</span>
                </div>
              ) : null}

              {/* Action items checklist */}
              <div className="space-y-2.5">
                {proposedActions.map((act) => {
                  const isChecked = selectedActionIds.has(act.id);
                  return (
                    <div
                      key={act.id}
                      className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 transition ${
                        isChecked
                          ? 'border-fuchsia-300 bg-fuchsia-50/20'
                          : 'border-slate-200 bg-white opacity-70'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleActionSelection(act.id)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                        />
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">
                            {act.title}
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {act.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={() => executeSingle(act.id)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 transition"
                        >
                          Provést
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectSingle(act.id)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition"
                        >
                          Odmítnout
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* BATCH CTA */}
              {proposedActions.length > 0 && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={executeBatch}
                    disabled={isExecutingBatch || selectedActionIds.size === 0}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-md hover:from-fuchsia-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50 transition"
                  >
                    <CheckCircle2 size={16} />
                    <span>
                      {isExecutingBatch
                        ? 'Provádím vybrané akce…'
                        : `Provést vybrané akce (${selectedActionIds.size})`}
                    </span>
                  </button>

                  <span className="text-[11px] text-slate-400">
                    Systém bez vašeho potvrzení žádné změny v CRM ani zakázkách neprovede.
                  </span>
                </div>
              )}
            </div>

            {/* AI SUGGESTED REPLY BOX */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Sparkles size={14} className="text-fuchsia-600" />
                  <span>AI Návrh odpovědi klientovi</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyReplyToClipboard}
                    className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium"
                  >
                    {replyCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{replyCopied ? 'Zkopírováno' : 'Kopírovat'}</span>
                  </button>
                </div>
              </div>

              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                placeholder="Zde můžete upravit text odpovědi pro klienta..."
                className="w-full rounded-lg border border-slate-300 p-3 text-xs sm:text-sm text-slate-800 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 font-sans"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500">
                  Odpověď bude odeslána na: <strong>{message.fromEmail}</strong>
                </span>

                <button
                  type="button"
                  onClick={sendReply}
                  disabled={isSendingReply || !replyText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                >
                  <Send size={13} />
                  <span>{isSendingReply ? 'Odesílám…' : 'Odeslat odpověď'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
