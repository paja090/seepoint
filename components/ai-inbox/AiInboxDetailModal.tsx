'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  MapPin,
  Calendar,
  Paperclip,
  Send,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FolderKanban,
  Compass,
  FileText,
  Link2,
  Unlink,
  Search,
  Trash2,
  Ban,
  Clock,
  Edit3,
  HelpCircle,
  Save,
  CheckCheck,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Phone,
  Mail,
} from 'lucide-react';
import { CLASSIFICATION_LABELS, getConfidenceBadge } from '@/lib/ai-inbox/classifier';
import type { AiInboxActionStatus, AiInboxActionType, AiInboxAnalysisResult } from '@/lib/ai-inbox/types';
import type { CommercialRequest, DatesClarity } from '@/lib/ai-commercial/contracts/commercial-request';
import type { CommercialNextBestAction } from '@/lib/ai-commercial/contracts/next-best-action';

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

  const replyBoxRef = useRef<HTMLDivElement>(null);
  const [commercialData, setCommercialData] = useState<{
    commercialRequest: CommercialRequest;
    nextBestAction: CommercialNextBestAction;
  } | null>(null);
  const [isEditingCommercial, setIsEditingCommercial] = useState(false);
  const [isSavingCommercial, setIsSavingCommercial] = useState(false);
  const [isConfirmingCommercial, setIsConfirmingCommercial] = useState(false);

  // Form for manual edits
  const [editForm, setEditForm] = useState({
    companyName: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    cities: '',
    mediaTypes: '',
    dateFrom: '',
    dateTo: '',
    datesClarity: 'UNSPECIFIED' as DatesClarity,
    quantityExact: '',
    budgetExact: '',
    notes: '',
  });

  useEffect(() => {
    let isMounted = true;
    async function fetchCommercial() {
      try {
        const res = await fetch(`/api/ai-inbox/${message.id}/commercial-request`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setCommercialData(data);
          if (data.commercialRequest) {
            const req = data.commercialRequest;
            setEditForm({
              companyName: req.companyName || '',
              contactName: req.contactName || '',
              contactEmail: req.contactEmail || '',
              contactPhone: req.contactPhone || '',
              cities: (req.cities || []).join(', '),
              mediaTypes: (req.mediaTypes || []).join(', '),
              dateFrom: req.dateFrom ? new Date(req.dateFrom).toISOString().slice(0, 10) : '',
              dateTo: req.dateTo ? new Date(req.dateTo).toISOString().slice(0, 10) : '',
              datesClarity: req.datesClarity || 'UNSPECIFIED',
              quantityExact: req.quantity?.exact != null ? String(req.quantity.exact) : '',
              budgetExact: req.budget?.exact != null ? String(req.budget.exact) : '',
              notes: req.notes || '',
            });
          }
        }
      } catch (err) {
        console.warn('Nepodařilo se načíst CommercialRequest:', err);
      }
    }
    fetchCommercial();
    return () => {
      isMounted = false;
    };
  }, [message.id]);

  async function handleSaveCommercial() {
    setIsSavingCommercial(true);
    setFeedback(null);
    try {
      const cities = editForm.cities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const mediaTypes = editForm.mediaTypes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const quantityExact = editForm.quantityExact.trim() ? parseInt(editForm.quantityExact.trim(), 10) : null;
      const budgetExact = editForm.budgetExact.trim() ? parseFloat(editForm.budgetExact.trim()) : null;

      const payload = {
        companyName: editForm.companyName.trim() || undefined,
        contactName: editForm.contactName.trim() || undefined,
        contactEmail: editForm.contactEmail.trim() || undefined,
        contactPhone: editForm.contactPhone.trim() || undefined,
        cities,
        mediaTypes,
        dateFrom: editForm.dateFrom ? new Date(editForm.dateFrom).toISOString() : null,
        dateTo: editForm.dateTo ? new Date(editForm.dateTo).toISOString() : null,
        datesClarity: editForm.datesClarity,
        quantity: quantityExact !== null ? { exact: quantityExact } : null,
        budget: budgetExact !== null ? { exact: budgetExact, currency: 'CZK' } : null,
        notes: editForm.notes.trim() || undefined,
      };

      const res = await fetch(`/api/ai-inbox/${message.id}/commercial-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Uložení změn selhalo.');
      }

      const updated = await res.json();
      setCommercialData({
        commercialRequest: updated.commercialRequest,
        nextBestAction: updated.nextBestAction,
      });
      setIsEditingCommercial(false);
      setFeedback({ type: 'success', message: 'Údaje poptávky byly úspěšně upraveny a uloženy.' });
      onActionComplete();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba při ukládání údajů.' });
    } finally {
      setIsSavingCommercial(false);
    }
  }

  async function handleConfirmCommercial() {
    setIsConfirmingCommercial(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${message.id}/commercial-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Potvrzení poptávky selhalo.');
      }

      const updated = await res.json();
      setCommercialData({
        commercialRequest: updated.commercialRequest,
        nextBestAction: updated.nextBestAction,
      });
      setFeedback({
        type: 'success',
        message: 'Poptávka byla úspěšně potvrzena člověkem a připravena pro obchodní zpracování.',
      });
      onActionComplete();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba při potvrzování poptávky.' });
    } finally {
      setIsConfirmingCommercial(false);
    }
  }

  function handleRequestClarification() {
    const missing = commercialData?.commercialRequest?.missingRequirements || [];
    const missingLabels: string[] = [];

    if (missing.includes('EXACT_CAMPAIGN_DATES')) {
      missingLabels.push('přesný termín kampaně (konkrétní datum od–do)');
    }
    if (missing.includes('EXACT_QUANTITY')) {
      missingLabels.push('požadovaný počet reklamních ploch');
    }
    if (missing.includes('TARGET_LOCATION')) {
      missingLabels.push('cílová města či lokality');
    }
    if (missingLabels.length === 0) {
      missingLabels.push('bližší specifikaci Vašeho požadavku');
    }

    const clientGreeting = commercialData?.commercialRequest?.contactName
      ? `Dobrý den, ${commercialData.commercialRequest.contactName},`
      : 'Dobrý den,';

    const clarificationDraft = `${clientGreeting}\n\nděkujeme za Vaši poptávku. Rádi pro Vás prověříme dostupnost reklamních ploch a připravíme konkrétní nabídku.\n\nPro přesné zpracování bychom Vás rádi požádali o upřesnění následujících informací:\n${missingLabels.map((item) => `• ${item}`).join('\n')}\n\nJakmile tyto údaje obdržíme, obratem Vám zašleme návrh volných ploch s kalkulací.\n\nS přátelským pozdravem,\nSeePoint tým`;

    setReplyText(clarificationDraft);
    setFeedback({
      type: 'success',
      message: 'Návrh žádosti o doplnění informací byl předvyplněn do okna odpovědi níže.',
    });

    setTimeout(() => {
      replyBoxRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

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

  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm('Opravdu chcete smazat tuto zprávu z AI Inboxu?')) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${message.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Smazání zprávy selhalo.');
      onActionComplete();
      onClose();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba při mazání' });
      setIsDeleting(false);
    }
  }

  async function handleDeleteAndIgnore() {
    if (
      !window.confirm(
        `Opravdu chcete smazat tuto zprávu a trvale ignorovat všechny budoucí e-maily od odesílatele "${message.fromEmail}"?`
      )
    ) {
      return;
    }
    setIsDeleting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${message.id}?ignoreSender=true`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Smazání a zablokování selhalo.');
      onActionComplete();
      onClose();
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Chyba při mazání' });
      setIsDeleting(false);
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

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-800/80 bg-rose-950/50 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-900/70 hover:text-white transition disabled:opacity-50"
              title="Smazat tuto zprávu z AI Inboxu"
            >
              <Trash2 size={13} />
              <span>{isDeleting ? 'Mažu…' : 'Smazat'}</span>
            </button>

            <button
              type="button"
              onClick={handleDeleteAndIgnore}
              disabled={isDeleting}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
              title={`Smazat tuto zprávu a trvale ignorovat všechny budoucí e-maily od ${message.fromEmail}`}
            >
              <Ban size={13} className="text-amber-400" />
              <span className="hidden sm:inline">Ignorovat odesílatele</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition ml-1"
              aria-label="Zavřít"
            >
              <X size={20} />
            </button>
          </div>
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

            <div className={`${viewHtml && message.htmlBody ? 'ai-original-email' : ''} rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-800 max-h-[420px] overflow-y-auto`}>
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
            {/* AI VYHODNOCENÍ / OBCHODNÍ POPTÁVKA SECTION (Commercial Engine Foundation) */}
            <div className="rounded-xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50/50 via-white to-indigo-50/30 p-5 shadow-sm space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fuchsia-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-600 text-white shadow-sm">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 text-sm sm:text-base">
                        AI VYHODNOCENÍ / OBCHODNÍ POPTÁVKA
                      </h3>
                      <span className="rounded bg-fuchsia-100 px-2 py-0.5 text-[10px] font-black text-fuchsia-800 uppercase tracking-wider">
                        Commercial Engine
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Strukturovaný požadavek klienta připravený pro ověření dostupnosti a kalkulaci
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={reprocessAi}
                    disabled={isReprocessing}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
                    title="Znovu analyzovat zprávu přes AI"
                  >
                    <RefreshCw size={12} className={isReprocessing ? 'animate-spin' : ''} />
                    <span>{isReprocessing ? 'Analyzuji…' : 'Zpracovat znovu'}</span>
                  </button>
                </div>
              </div>

              {/* Status / Intent & Clarity Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold border ${classMeta.badgeColor}`}>
                  <span>{classMeta.icon}</span>
                  <span>{classMeta.label}</span>
                </span>

                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold border ${confBadge.colorClass}`}>
                  Jistota AI: {confBadge.percentage} %
                </span>

                {/* Timing Clarity Badge */}
                {commercialData?.commercialRequest ? (
                  commercialData.commercialRequest.datesClarity === 'EXACT' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      PŘESNÝ TERMÍN
                    </span>
                  ) : commercialData.commercialRequest.datesClarity === 'APPROXIMATE' ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                      <Clock size={13} className="text-amber-600" />
                      PŘIBLIŽNÝ TERMÍN
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200">
                      <HelpCircle size={13} className="text-slate-500" />
                      TERMÍN NEUVEDEN
                    </span>
                  )
                ) : null}

                {/* Human Review Status Badge */}
                {commercialData?.commercialRequest?.status === 'READY_FOR_AVAILABILITY' ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    <CheckCheck size={13} /> PŘIPRAVENO K OVĚŘENÍ PLOCH
                  </span>
                ) : message.requiresReview ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                    <AlertTriangle size={13} /> VYŽADUJE KONTROLU ČLOVĚKEM
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">
                    <ShieldCheck size={13} /> SCHVÁLENO ČLOVĚKEM
                  </span>
                )}
              </div>

              {/* Missing Requirements Alert Box */}
              {commercialData?.commercialRequest && commercialData.commercialRequest.missingRequirements.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-sm space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <AlertCircle size={15} className="text-amber-600 shrink-0" />
                    <span>Chybějící informace bránící okamžitému vytvoření nabídky:</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-amber-900">
                    {commercialData.commercialRequest.missingRequirements.map((reqKey) => {
                      if (reqKey === 'EXACT_CAMPAIGN_DATES') {
                        return (
                          <li key={reqKey}>
                            <strong>Přesný termín kampaně</strong> — termín v e-mailu je přibližný či orientační ({commercialData.commercialRequest.rawDateDescription || 'neupřesněno'}). Bez konkrétních dnů (od–do) nelze prověřit dostupnost.
                          </li>
                        );
                      }
                      if (reqKey === 'EXACT_QUANTITY') {
                        return (
                          <li key={reqKey}>
                            <strong>Počet ploch</strong> — klient neuvedl přesný počet požadovaných reklamních nosičů.
                          </li>
                        );
                      }
                      if (reqKey === 'TARGET_LOCATION') {
                        return (
                          <li key={reqKey}>
                            <strong>Cílová lokalita</strong> — chybí specifikace měst nebo okresů.
                          </li>
                        );
                      }
                      return (
                        <li key={reqKey}>
                          <strong>{reqKey}</strong>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* VIEW MODE vs EDIT MODE */}
              {!isEditingCommercial ? (
                <>
                  {/* Extracted Parameters Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Company */}
                    <div className="rounded-xl bg-white/95 border border-slate-200 p-3 shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-slate-400" />
                          Klient / Společnost
                        </span>
                        {message.client && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 size={10} /> V CRM
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        {commercialData?.commercialRequest?.companyName || message.client?.name || 'Neznámá společnost'}
                      </div>
                      {extracted.company?.ico && (
                        <div className="text-[11px] text-slate-500">IČO: {extracted.company.ico}</div>
                      )}
                    </div>

                    {/* Contact */}
                    <div className="rounded-xl bg-white/95 border border-slate-200 p-3 shadow-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <User size={13} className="text-slate-400" />
                        Kontaktní osoba
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        {commercialData?.commercialRequest?.contactName || message.fromName || 'Neuvedeno'}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate flex items-center gap-1">
                        <Mail size={11} className="text-slate-400" />
                        <span>{commercialData?.commercialRequest?.contactEmail || message.fromEmail}</span>
                      </div>
                      {commercialData?.commercialRequest?.contactPhone && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1">
                          <Phone size={11} className="text-slate-400" />
                          <span>{commercialData.commercialRequest.contactPhone}</span>
                        </div>
                      )}
                    </div>

                    {/* Location & Media Types */}
                    <div className="rounded-xl bg-white/95 border border-slate-200 p-3 shadow-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <MapPin size={13} className="text-slate-400" />
                        Lokalita a formáty nosičů
                      </div>
                      <div className="font-bold text-slate-900">
                        {commercialData?.commercialRequest?.cities?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {commercialData.commercialRequest.cities.map((city) => (
                              <span key={city} className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                                {city}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">Nespecifikováno</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 pt-0.5">
                        Formáty:{' '}
                        {commercialData?.commercialRequest?.mediaTypes?.length
                          ? commercialData.commercialRequest.mediaTypes.join(', ')
                          : 'Dle doporučení'}
                      </div>
                      <div className="text-[11px] text-slate-700 font-medium">
                        Požadovaný počet:{' '}
                        {commercialData?.commercialRequest?.quantity?.exact
                          ? `${commercialData.commercialRequest.quantity.exact} ks`
                          : commercialData?.commercialRequest?.quantity?.min && commercialData.commercialRequest.quantity.max
                            ? `${commercialData.commercialRequest.quantity.min}–${commercialData.commercialRequest.quantity.max} ks`
                            : <span className="text-amber-700 font-bold">Nespecifikováno</span>}
                      </div>
                    </div>

                    {/* Dates & Budget */}
                    <div className="rounded-xl bg-white/95 border border-slate-200 p-3 shadow-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                        <Calendar size={13} className="text-slate-400" />
                        Termín realizace & Rozpočet
                      </div>
                      <div className="font-bold text-slate-900">
                        {commercialData?.commercialRequest?.dateFrom && commercialData?.commercialRequest?.dateTo ? (
                          <span>
                            {new Date(commercialData.commercialRequest.dateFrom).toLocaleDateString('cs-CZ')} –{' '}
                            {new Date(commercialData.commercialRequest.dateTo).toLocaleDateString('cs-CZ')}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            {commercialData?.commercialRequest?.rawDateDescription || 'Termín neuveden'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Přesnost:{' '}
                        <strong className="text-slate-800">
                          {commercialData?.commercialRequest?.datesClarity === 'EXACT'
                            ? 'Přesné datum'
                            : commercialData?.commercialRequest?.datesClarity === 'APPROXIMATE'
                              ? 'Orientační měsíc / období'
                              : 'Neuvedeno'}
                        </strong>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        Rozpočet:{' '}
                        <strong>
                          {commercialData?.commercialRequest?.budget?.exact
                            ? `${commercialData.commercialRequest.budget.exact.toLocaleString('cs-CZ')} Kč`
                            : 'Neuveden'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Summary & Evidence */}
                  {message.aiSummary && (
                    <div className="rounded-xl bg-fuchsia-100/40 p-3 text-xs text-slate-800 border border-fuchsia-200/60 leading-relaxed">
                      <span className="font-bold text-fuchsia-950">Souhrn poptávky: </span>
                      {message.aiSummary}
                    </div>
                  )}
                </>
              ) : (
                /* INLINE EDIT FORM */
                <div className="rounded-xl border border-indigo-200 bg-white p-4 shadow-sm space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-indigo-900 flex items-center gap-1.5 text-sm">
                      <Edit3 size={14} className="text-indigo-600" />
                      Úprava parametrů poptávky
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingCommercial(false)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                    >
                      Zavřít
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Společnost / Klient</label>
                      <input
                        type="text"
                        value={editForm.companyName}
                        onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Název firmy"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kontaktní osoba</label>
                      <input
                        type="text"
                        value={editForm.contactName}
                        onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Jméno a příjmení"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
                      <input
                        type="email"
                        value={editForm.contactEmail}
                        onChange={(e) => setEditForm({ ...editForm, contactEmail: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="email@klient.cz"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Telefon</label>
                      <input
                        type="text"
                        value={editForm.contactPhone}
                        onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="+420..."
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Města / Lokality (oddělená čárkou)</label>
                      <input
                        type="text"
                        value={editForm.cities}
                        onChange={(e) => setEditForm({ ...editForm, cities: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Např. Ostrava, Havířov"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Formáty ploch (např. CLV, BILLBOARD)</label>
                      <input
                        type="text"
                        value={editForm.mediaTypes}
                        onChange={(e) => setEditForm({ ...editForm, mediaTypes: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="CLV, BILLBOARD"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Termín od (YYYY-MM-DD)</label>
                      <input
                        type="date"
                        value={editForm.dateFrom}
                        onChange={(e) => setEditForm({ ...editForm, dateFrom: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Termín do (YYYY-MM-DD)</label>
                      <input
                        type="date"
                        value={editForm.dateTo}
                        onChange={(e) => setEditForm({ ...editForm, dateTo: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Přesnost termínu</label>
                      <select
                        value={editForm.datesClarity}
                        onChange={(e) => setEditForm({ ...editForm, datesClarity: e.target.value as DatesClarity })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="EXACT">EXACT (Přesné dny od–do)</option>
                        <option value="APPROXIMATE">APPROXIMATE (Přibližný termín)</option>
                        <option value="UNSPECIFIED">UNSPECIFIED (Nespecifikováno)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Počet ploch (přesný)</label>
                      <input
                        type="number"
                        value={editForm.quantityExact}
                        onChange={(e) => setEditForm({ ...editForm, quantityExact: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Např. 15"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rozpočet (Kč)</label>
                      <input
                        type="number"
                        value={editForm.budgetExact}
                        onChange={(e) => setEditForm({ ...editForm, budgetExact: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Např. 50000"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Poznámka k zadání</label>
                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Doplňující informace"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingCommercial(false)}
                      disabled={isSavingCommercial}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Zrušit
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCommercial}
                      disabled={isSavingCommercial}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition shadow-sm"
                    >
                      <Save size={13} />
                      <span>{isSavingCommercial ? 'Ukládám…' : 'Uložit změny'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* NEXT BEST ACTION CARD */}
              {commercialData?.nextBestAction && (
                <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/90 to-indigo-50/80 p-3.5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950 uppercase tracking-wider">
                      <ArrowRight size={13} className="text-blue-600" />
                      <span>Next Best Action (Doporučený další krok)</span>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        commercialData.nextBestAction.priority === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : commercialData.nextBestAction.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      Priorita: {commercialData.nextBestAction.priority}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 text-xs sm:text-sm">
                      {commercialData.nextBestAction.title}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {commercialData.nextBestAction.description}
                    </p>
                  </div>
                </div>
              )}

              {/* HUMAN ACTION BUTTONS BAR */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-fuchsia-100">
                {/* 1. Potvrdit poptávku */}
                <button
                  type="button"
                  onClick={handleConfirmCommercial}
                  disabled={isConfirmingCommercial}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 active:scale-95 disabled:opacity-50 transition"
                  title="Potvrdit správnost údajů a označit poptávku jako ověřenou člověkem"
                >
                  <CheckCheck size={14} />
                  <span>{isConfirmingCommercial ? 'Potvrzuji…' : 'Potvrdit poptávku'}</span>
                </button>

                {/* 2. Upravit údaje */}
                <button
                  type="button"
                  onClick={() => setIsEditingCommercial(!isEditingCommercial)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
                  title="Upravit parametry poptávky"
                >
                  <Edit3 size={14} className="text-slate-500" />
                  <span>{isEditingCommercial ? 'Zavřít úpravy' : 'Upravit údaje'}</span>
                </button>

                {/* 3. Vyžádat doplnění */}
                <button
                  type="button"
                  onClick={handleRequestClarification}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50/80 px-3.5 py-2 text-xs font-bold text-amber-900 shadow-sm hover:bg-amber-100 active:scale-95 transition"
                  title="Předvyplnit e-mailovou odpověď klientovi s žádostí o chybějící informace"
                >
                  <HelpCircle size={14} className="text-amber-700" />
                  <span>Vyžádat doplnění</span>
                </button>

                {/* 4. Prověřit dostupnost (Hook to Occupancy) */}
                {commercialData?.commercialRequest?.datesClarity === 'EXACT' &&
                commercialData?.commercialRequest?.cities?.length > 0 &&
                commercialData?.commercialRequest?.dateFrom &&
                commercialData?.commercialRequest?.dateTo ? (
                  <a
                    href={`/occupancy/ai?city=${encodeURIComponent(commercialData.commercialRequest.cities[0])}&from=${new Date(commercialData.commercialRequest.dateFrom).toISOString().slice(0, 10)}&to=${new Date(commercialData.commercialRequest.dateTo).toISOString().slice(0, 10)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:from-blue-500 hover:to-indigo-500 active:scale-95 transition ml-auto"
                    title="Otevřít modul Obsazenost a prověřit volné plochy v daném termínu"
                  >
                    <Compass size={14} />
                    <span>Prověřit dostupnost</span>
                    <ArrowUpRight size={12} />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setFeedback({
                        type: 'error',
                        message:
                          'Pro automatické prověření dostupnosti je nejprve nutné doplnit přesný termín (od–do) a město. Použijte tlačítko "Upravit údaje" nebo "Vyžádat doplnění".',
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-400 cursor-not-allowed ml-auto"
                    title="Dostupné po zadání přesného termínu a města"
                  >
                    <Compass size={14} />
                    <span>Prověřit dostupnost</span>
                  </button>
                )}
              </div>
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
            <div ref={replyBoxRef} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
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
