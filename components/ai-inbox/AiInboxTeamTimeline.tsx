'use client';

import React, { useState } from 'react';
import {
  Mail,
  Send,
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Plus,
  Eye,
  FolderKanban,
} from 'lucide-react';
import type { UnifiedCommunicationItem } from '@/lib/ai-inbox/types';

function formatRelativeTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'právě teď';
  if (diffMinutes < 60) return `před ${diffMinutes} min`;
  if (diffHours < 24) return `před ${diffHours} hod`;
  if (diffDays === 1) return 'včera';
  if (diffDays < 7) return `před ${diffDays} dny`;
  return date.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFullDateTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  return date.toLocaleString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AiInboxTeamTimeline({
  messageId,
  orderNumber,
  orderTitle,
  clientName,
  conversationHistory,
  onSelectInboundMessage,
  onOpenReplyComposer,
  onNoteAdded,
}: {
  messageId: string;
  clientId?: string | null;
  crmOrderId?: string | null;
  orderNumber?: string | null;
  orderTitle?: string | null;
  clientName?: string | null;
  conversationHistory: UnifiedCommunicationItem[];
  onSelectInboundMessage?: (id: string) => void;
  onOpenReplyComposer?: () => void;
  onNoteAdded?: () => void;
}) {
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [noteFeedback, setNoteFeedback] = useState<string | null>(null);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(() => new Set([messageId]));

  const inboundCount = conversationHistory.filter((c) => c.source === 'AI_INBOX_INBOUND').length;
  const teamRepliesCount = conversationHistory.filter((c) => c.source === 'TEAM_REPLY').length;
  const teamNotesCount = conversationHistory.filter((c) => c.source === 'TEAM_COMMUNICATION').length;

  const latestItem = conversationHistory[conversationHistory.length - 1];
  const isLatestFromClient = latestItem?.source === 'AI_INBOX_INBOUND';

  const toggleExpand = (id: string) => {
    setExpandedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setIsSubmittingNote(true);
    setNoteFeedback(null);
    try {
      const res = await fetch(`/api/ai-inbox/${messageId}/communication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newNoteContent.trim(),
          isInternal: true,
          type: 'NOTE',
          subject: orderNumber ? `Interní poznámka k zakázce ${orderNumber}` : 'Interní týmová poznámka',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uložení poznámky selhalo.');

      setNewNoteContent('');
      setNoteFeedback('Týmová poznámka byla úspěšně uložena.');
      if (onNoteAdded) onNoteAdded();
    } catch (err) {
      setNoteFeedback(err instanceof Error ? err.message : 'Chyba při ukládání');
    } finally {
      setIsSubmittingNote(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Overview header */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <FolderKanban size={15} />
            </span>
            <div className="text-xs">
              <div className="font-bold text-slate-900">
                {orderNumber ? `${orderNumber} – ${orderTitle || 'Zakázka'}` : (clientName ? `Klient: ${clientName}` : 'Konverzační vlákno')}
              </div>
              {clientName && orderNumber && (
                <div className="text-[11px] text-slate-500">{clientName}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
              {conversationHistory.length} zpráv celkem
            </span>
          </div>
        </div>

        {/* Counter pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
            <Mail size={12} className="text-emerald-600" />
            <span>{inboundCount} od klienta</span>
          </span>

          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-800 border border-indigo-200">
            <Send size={12} className="text-indigo-600" />
            <span>{teamRepliesCount} odpovědí týmu</span>
          </span>

          {teamNotesCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
              <FileText size={12} className="text-amber-600" />
              <span>{teamNotesCount} interních poznámek</span>
            </span>
          )}

          {isLatestFromClient ? (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
              <AlertCircle size={12} />
              <span>Nová příchozí zpráva od klienta – čeká na reakci týmu</span>
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
              <CheckCircle2 size={12} />
              <span>Tým na zprávu reagoval</span>
            </span>
          )}
        </div>
      </div>

      {/* Chronological Stream */}
      <div className="space-y-3 relative before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-slate-200">
        {conversationHistory.map((item) => {
          const isInbound = item.source === 'AI_INBOX_INBOUND';
          const isTeamReply = item.source === 'TEAM_REPLY';
          const isInternalNote = item.source === 'TEAM_COMMUNICATION';
          const isCurrent = item.isCurrentMessage;
          const isExpanded = expandedMessageIds.has(item.id) || isCurrent;

          return (
            <div
              key={item.id}
              className={`relative pl-9 transition-all ${
                isCurrent ? 'scale-[1.01]' : ''
              }`}
            >
              {/* Timeline dot icon */}
              <div
                className={`absolute left-1.5 top-3 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-xs ${
                  isInbound
                    ? 'bg-emerald-600'
                    : isTeamReply
                      ? 'bg-indigo-600'
                      : 'bg-amber-600'
                }`}
              >
                {isInbound ? <Mail size={12} /> : isTeamReply ? <Send size={11} /> : <FileText size={11} />}
              </div>

              {/* Message card */}
              <div
                className={`rounded-xl border p-3.5 transition shadow-xs ${
                  isCurrent
                    ? 'border-fuchsia-400 bg-fuchsia-50/30 ring-2 ring-fuchsia-300/40'
                    : isInbound
                      ? 'border-emerald-200 bg-white hover:border-emerald-300'
                      : isTeamReply
                        ? 'border-indigo-200 bg-indigo-50/30 hover:border-indigo-300'
                        : 'border-amber-200 bg-amber-50/30 hover:border-amber-300'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {item.senderName}
                    </span>

                    {isInbound && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                        Klient
                      </span>
                    )}

                    {isTeamReply && (
                      <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-800">
                        Odpověď týmu
                      </span>
                    )}

                    {isInternalNote && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                        Interní poznámka
                      </span>
                    )}

                    {isCurrent && (
                      <span className="rounded bg-fuchsia-100 px-1.5 py-0.2 text-[10px] font-black text-fuchsia-900 border border-fuchsia-200">
                        👉 Prohlížená zpráva
                      </span>
                    )}

                    {item.isNewIncoming && !isCurrent && (
                      <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[10px] font-black text-purple-900 border border-purple-200 animate-pulse">
                        ⚡ Nová příchozí
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
                    <span title={formatFullDateTime(item.date)} className="flex items-center gap-1">
                      <Clock size={11} />
                      {formatRelativeTime(item.date)}
                    </span>
                  </div>
                </div>

                {/* Subject & Details */}
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                      {item.subject}
                    </div>
                    {item.recipient && (
                      <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        Pro: {item.recipient}
                      </span>
                    )}
                  </div>

                  {/* AI Summary snippet for inbound email */}
                  {item.aiSummary && (
                    <div className="rounded-lg bg-fuchsia-50/80 p-2 text-xs text-fuchsia-950 border border-fuchsia-100 flex items-start gap-1.5">
                      <Sparkles size={13} className="text-fuchsia-600 shrink-0 mt-0.5" />
                      <p className="line-clamp-2 leading-relaxed">
                        <span className="font-bold">AI Shrnutí: </span>
                        {item.aiSummary}
                      </p>
                    </div>
                  )}

                  {/* Content body (expandable) */}
                  <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap pt-1">
                    {isExpanded ? (
                      <div>{item.content || '(Bez textového těla)'}</div>
                    ) : (
                      <div className="line-clamp-2 text-slate-500">
                        {item.content || '(Bez textového těla)'}
                      </div>
                    )}
                  </div>

                  {/* Footer actions for this message */}
                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="font-medium text-slate-500 hover:text-slate-800 transition"
                    >
                      {isExpanded ? 'Zmenšit text' : 'Číst celé'}
                    </button>

                    {isInbound && !isCurrent && onSelectInboundMessage && (
                      <button
                        type="button"
                        onClick={() => onSelectInboundMessage(item.id)}
                        className="inline-flex items-center gap-1 font-bold text-fuchsia-700 hover:text-fuchsia-900 transition"
                      >
                        <Eye size={12} />
                        <span>Otevřít a zpracovat tento e-mail</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* BOTTOM ACTION BAR: Add team note & quick reply */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Plus size={14} className="text-fuchsia-600" />
            <span>Přidat interní týmovou poznámku k této zakázce</span>
          </div>

          {onOpenReplyComposer && (
            <button
              type="button"
              onClick={onOpenReplyComposer}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition shadow-xs"
            >
              <Send size={12} />
              <span>Odpovědět klientovi</span>
            </button>
          )}
        </div>

        <form onSubmit={handleAddNote} className="space-y-2">
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            rows={2}
            placeholder="Napište interní poznámku pro tým (např. 'Voláno klientovi, domluven termín montáže na příští středu' nebo 'Konzultováno s výrobou')..."
            className="w-full rounded-lg border border-slate-300 p-2 text-xs text-slate-800 placeholder-slate-400 focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
          />

          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-500">
              🔒 <strong>Interní pro tým:</strong> Tato poznámka se uloží do CRM a uvidí ji všichni kolegové v přehledu zakázky.
            </div>

            <button
              type="submit"
              disabled={isSubmittingNote || !newNoteContent.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition"
            >
              <span>{isSubmittingNote ? 'Ukládám…' : 'Zapsat do týmové komunikace'}</span>
            </button>
          </div>
        </form>

        {noteFeedback && (
          <div className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
            {noteFeedback}
          </div>
        )}
      </div>
    </div>
  );
}
