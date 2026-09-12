'use client';

import React from 'react';
import { Paperclip, Sparkles, AlertCircle, CheckCircle2, Clock, Building2, FolderKanban, Compass, FileText } from 'lucide-react';
import { CLASSIFICATION_LABELS, getConfidenceBadge } from '@/lib/ai-inbox/classifier';
import type { AiInboxClassification, AiInboxStatus } from '@/lib/ai-inbox/types';

export type AiInboxListItem = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  receivedAt: string | Date;
  processingStatus: AiInboxStatus;
  classification: AiInboxClassification;
  confidence: number;
  requiresReview: boolean;
  aiSummary: string | null;
  integrationConnection?: { accountEmail: string | null; provider: string } | null;
  client?: { id: string; name: string; companyId: string | null } | null;
  crmOrder?: { id: string; orderNumber: string; title: string; status: string } | null;
  offer?: { id: string; title: string; status: string } | null;
  navigationOrder?: { id: string; orderNumber: string; status: string } | null;
  _count?: { attachments: number; actions: number };
};

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

export function AiInboxMessageCard({
  item,
  onSelect,
  isSelected,
}: {
  item: AiInboxListItem;
  onSelect: (item: AiInboxListItem) => void;
  isSelected?: boolean;
}) {
  const classMeta = CLASSIFICATION_LABELS[item.classification] || CLASSIFICATION_LABELS.UNKNOWN;
  const confBadge = getConfidenceBadge(item.confidence);
  const attachmentCount = item._count?.attachments || 0;
  const pendingActionsCount = item._count?.actions || 0;

  const isProcessed = item.processingStatus === 'PROCESSED';
  const isAnalyzing = item.processingStatus === 'ANALYZING';
  const isError = item.processingStatus === 'ERROR';

  return (
    <div
      onClick={() => onSelect(item)}
      className={`group relative cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md ${
        isSelected
          ? 'border-fuchsia-500 bg-fuchsia-50/40 ring-2 ring-fuchsia-400/30'
          : isProcessed
            ? 'border-slate-200 bg-slate-50/60 opacity-80 hover:opacity-100'
            : item.requiresReview
              ? 'border-amber-300 bg-white hover:border-amber-400'
              : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {/* Top row: Sender, Mailbox, Time */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-bold text-slate-900 text-sm sm:text-base">
            {item.fromName || item.fromEmail}
          </span>
          {item.fromName && (
            <span className="hidden sm:inline truncate text-xs text-slate-400">
              &lt;{item.fromEmail}&gt;
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
          {item.integrationConnection?.accountEmail && (
            <span className="hidden md:inline rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {item.integrationConnection.accountEmail}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-slate-400" />
            {formatRelativeTime(item.receivedAt)}
          </span>
        </div>
      </div>

      {/* Middle row: Subject & Badges */}
      <div className="mt-2.5">
        <h4 className="font-semibold text-slate-900 text-sm line-clamp-1 group-hover:text-fuchsia-700 transition-colors">
          {item.subject}
        </h4>

        {/* AI Summary snippet */}
        {item.aiSummary ? (
          <div className="mt-2 rounded-lg bg-gradient-to-r from-fuchsia-50/70 to-indigo-50/70 p-2.5 text-xs text-slate-700 border border-fuchsia-100/60">
            <div className="flex items-start gap-1.5">
              <Sparkles size={14} className="text-fuchsia-600 shrink-0 mt-0.5" />
              <p className="line-clamp-2 leading-relaxed">
                <span className="font-semibold text-fuchsia-950">AI: </span>
                {item.aiSummary}
              </p>
            </div>
          </div>
        ) : isAnalyzing ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-fuchsia-700 animate-pulse">
            <Sparkles size={14} />
            <span>AI právě analyzuje obsah e-mailu…</span>
          </div>
        ) : null}
      </div>

      {/* Bottom tags & metrics */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Classification badge */}
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border ${classMeta.badgeColor}`}>
            <span>{classMeta.icon}</span>
            <span>{classMeta.label}</span>
          </span>

          {/* Confidence */}
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border ${confBadge.colorClass}`}>
            {confBadge.percentage} %
          </span>

          {/* Client match */}
          {item.client ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
              <Building2 size={12} />
              <span className="max-w-[120px] truncate">{item.client.name}</span>
            </span>
          ) : (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              Nová firma
            </span>
          )}

          {/* Linked CRM Order */}
          {item.crmOrder && (
            <span
              title={`Zakázka: ${item.crmOrder.orderNumber} – ${item.crmOrder.title}`}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200"
            >
              <FolderKanban size={11} />
              <span className="max-w-[120px] truncate">{item.crmOrder.orderNumber}</span>
            </span>
          )}

          {/* Linked Navigation Order */}
          {item.navigationOrder && (
            <span
              title="Navigační zakázka"
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200"
            >
              <Compass size={11} />
              <span>Navigace</span>
            </span>
          )}

          {/* Linked Offer (if no CRM order) */}
          {item.offer && !item.crmOrder && (
            <span
              title={`Nabídka: ${item.offer.title}`}
              className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200"
            >
              <FileText size={11} />
              <span className="max-w-[120px] truncate">{item.offer.title}</span>
            </span>
          )}

          {/* Attachments */}
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              <Paperclip size={11} />
              <span>{attachmentCount}</span>
            </span>
          )}
        </div>

        {/* Action / Review indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {isProcessed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <CheckCircle2 size={13} />
              Zpracováno
            </span>
          ) : isError ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
              <AlertCircle size={13} />
              Chyba
            </span>
          ) : item.requiresReview ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
              <AlertCircle size={13} />
              Vyžaduje pozornost
            </span>
          ) : null}

          <button
            type="button"
            className="rounded-lg bg-fuchsia-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-fuchsia-500 active:scale-95 transition"
          >
            {isProcessed ? 'Detail' : 'Zpracovat'}
          </button>
        </div>
      </div>
    </div>
  );
}
