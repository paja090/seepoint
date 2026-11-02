'use client';

import React, { useState } from 'react';
import {
  FolderKanban,
  Compass,
  FileText,
  Mail,
  Building2,
  Inbox,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  ArrowRight,
  AlertCircle,
  Users,
} from 'lucide-react';
import type { OrderConversationGroup } from '@/lib/ai-inbox/types';
import type { AiInboxListItem } from './AiInboxMessageCard';
import { AiInboxMessageCard } from './AiInboxMessageCard';

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
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

export function AiInboxOrderGroupCard({
  group,
  onSelectMessage,
  onDeleteMessage,
  selectedMessageId,
}: {
  group: OrderConversationGroup;
  onSelectMessage: (item: AiInboxListItem) => void;
  onDeleteMessage?: (item: AiInboxListItem) => void;
  selectedMessageId?: string | null;
}) {
  // Automatically expand if there are messages requiring attention or new messages
  const [isExpanded, setIsExpanded] = useState(() => group.attentionCount > 0 || group.newCount > 0 || group.messageCount <= 2);

  const isCrmOrder = group.type === 'CRM_ORDER';
  const isNavOrder = group.type === 'NAVIGATION_ORDER';
  const isOffer = group.type === 'OFFER';
  const isThread = group.type === 'THREAD';
  const isClient = group.type === 'CLIENT';

  const hasSelectedChild = group.items.some((i) => i.id === selectedMessageId);

  return (
    <div
      className={`rounded-2xl border transition-all ${
        hasSelectedChild
          ? 'border-fuchsia-400 bg-white ring-2 ring-fuchsia-300/40 shadow-md'
          : group.attentionCount > 0
            ? 'border-amber-300 bg-white shadow-xs'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      {/* Header bar */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            {/* Group icon */}
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                isCrmOrder
                  ? 'bg-blue-600 text-white'
                  : isNavOrder
                    ? 'bg-indigo-600 text-white'
                    : isOffer
                      ? 'bg-amber-600 text-white'
                      : isClient
                        ? 'bg-emerald-600 text-white'
                        : isThread
                          ? 'bg-fuchsia-600 text-white'
                          : 'bg-slate-700 text-white'
              }`}
            >
              {isCrmOrder ? (
                <FolderKanban size={20} />
              ) : isNavOrder ? (
                <Compass size={20} />
              ) : isOffer ? (
                <FileText size={20} />
              ) : isClient ? (
                <Building2 size={20} />
              ) : isThread ? (
                <Mail size={20} />
              ) : (
                <Inbox size={20} />
              )}
            </span>

            {/* Title & metadata */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {group.orderNumber && (
                  <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200">
                    {group.orderNumber}
                  </span>
                )}
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                  {group.title}
                </h3>
                {group.status && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {group.status}
                  </span>
                )}
              </div>

              {group.client && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-600">
                  <Building2 size={13} className="text-slate-400" />
                  <span className="font-medium text-slate-800">{group.client.name}</span>
                  {group.client.companyId && (
                    <span className="text-slate-400 text-[11px] font-mono">
                      (IČO: {group.client.companyId})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right badges & time */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            {/* Total count badge */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200">
              <Mail size={12} className="text-slate-500" />
              <span>
                {group.messageCount} {group.messageCount === 1 ? 'zpráva' : group.messageCount < 5 ? 'zprávy' : 'zpráv'}
              </span>
            </span>

            {/* New incoming indicator */}
            {group.newCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-100 px-2.5 py-1 text-xs font-black text-fuchsia-900 border border-fuchsia-200 animate-pulse">
                <span>⚡</span>
                <span>{group.newCount} nová</span>
              </span>
            )}

            {/* Attention indicator */}
            {group.attentionCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900 border border-amber-300">
                <AlertCircle size={12} className="text-amber-700" />
                <span>{group.attentionCount} vyžaduje pozornost</span>
              </span>
            )}

            <div className="hidden md:flex items-center gap-1 text-xs text-slate-400 pl-1">
              <Clock size={12} />
              <span>{formatRelativeTime(group.latestReceivedAt)}</span>
            </div>
          </div>
        </div>

        {/* AI Conversation Summary */}
        {group.latestAiSummary && (
          <div className="mt-3 rounded-xl bg-gradient-to-r from-fuchsia-50/80 via-indigo-50/70 to-blue-50/70 p-3 border border-fuchsia-100/70 text-xs text-slate-800">
            <div className="flex items-start gap-2">
              <Sparkles size={15} className="text-fuchsia-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-fuchsia-950 uppercase text-[10px] tracking-wider block">
                  Aktuální stav / AI shrnutí komunikace zakázky:
                </span>
                <p className="line-clamp-2 leading-relaxed text-slate-700">
                  {group.latestAiSummary}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Participants & Toggle Row */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-slate-500">
          <div className="flex items-center gap-2 min-w-0">
            <Users size={13} className="text-slate-400 shrink-0" />
            <span className="truncate">
              Účastníci: <strong className="text-slate-700">{group.participants.map((p) => p.name).join(', ')}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-fuchsia-700 p-1 transition"
            >
              <span>{isExpanded ? 'Skrýt e-maily' : `Zobrazit e-maily (${group.messageCount})`}</span>
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {group.items.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectMessage(group.items[0])}
                className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-fuchsia-500 active:scale-95 transition"
              >
                <span>Otevřít zakázku</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded messages list */}
      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-3 sm:p-4 rounded-b-2xl space-y-2.5">
          <div className="flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>E-maily ve vlákně zakázky ({group.items.length})</span>
            <span className="text-slate-400 font-normal">Kliknutím na zprávu otevřete detail a týmovou komunikaci</span>
          </div>

          <div className="space-y-2">
            {group.items.map((item) => (
              <AiInboxMessageCard
                key={item.id}
                item={item}
                onSelect={onSelectMessage}
                onDelete={onDeleteMessage}
                isSelected={selectedMessageId === item.id}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
