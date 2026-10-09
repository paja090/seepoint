'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Send,
  Eye,
  Edit3,
  Columns,
  LoaderCircle,
  FileText,
  Paperclip,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export interface BrandedEmailComposerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  recipientEmail: string;
  onRecipientEmailChange?: (email: string) => void;
  canEditRecipient?: boolean;
  subject: string;
  onSubjectChange: (subject: string) => void;
  greeting?: string;
  onGreetingChange?: (greeting: string) => void;
  message: string;
  onMessageChange: (message: string) => void;
  closingNote?: string;
  onClosingNoteChange?: (note: string) => void;
  attachmentBadge?: {
    name: string;
    sizeLabel?: string;
    description?: string;
  };
  extraPreviewContent?: React.ReactNode;
  children?: React.ReactNode;
  submitLabel?: string;
  sendingLabel?: string;
  onSubmit: () => Promise<void> | void;
  busy?: boolean;
  badgeLabel?: string;
  senderName?: string;
  senderRole?: string;
  senderEmail?: string;
}

export function BrandedEmailComposerModal({
  open,
  onClose,
  title,
  subtitle = 'Před odesláním můžete upravit text a zkontrolovat reálný vzhled zprávy pro klienta.',
  recipientEmail,
  onRecipientEmailChange,
  canEditRecipient = true,
  subject,
  onSubjectChange,
  greeting = 'Dobrý den,',
  onGreetingChange,
  message,
  onMessageChange,
  closingNote = 'V případě jakýchkoliv dotazů nebo nejasností jsme vám plně k dispozici.',
  onClosingNoteChange,
  attachmentBadge,
  extraPreviewContent,
  children,
  submitLabel = 'Odeslat e-mail',
  sendingLabel = 'Odesílám…',
  onSubmit,
  busy = false,
  badgeLabel = 'SeePOINT',
  senderName = 'Tým SeePOINT',
  senderRole = 'Klientská péče & podpora',
  senderEmail = 'info@seepoint.cz',
}: BrandedEmailComposerModalProps) {
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, busy]);

  if (!open) return null;

  async function handleSend() {
    if (!recipientEmail.trim()) {
      setFeedback({ ok: false, message: 'Zadejte prosím platnou e-mailovou adresu příjemce.' });
      return;
    }
    if (!subject.trim()) {
      setFeedback({ ok: false, message: 'Zadejte předmět e-mailu.' });
      return;
    }
    if (!message.trim()) {
      setFeedback({ ok: false, message: 'Text e-mailu nesmí být prázdný.' });
      return;
    }

    setFeedback(null);
    try {
      await onSubmit();
    } catch (err) {
      setFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'Při odesílání e-mailu došlo k chybě.',
      });
    }
  }

  const cleanPreviewMessage = message
    .replace(/^Dobrý den,\s*[^,\n]+,\s*/i, '')
    .replace(/^Dobrý den,\s*/i, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs">
      <div
        aria-labelledby="branded-email-composer-title"
        aria-modal="true"
        role="dialog"
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950" id="branded-email-composer-title">
                {title}
              </h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === 'split' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Columns size={14} /> Vedle sebe
              </button>
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === 'edit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 size={14} /> Formulář
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye size={14} /> Náhled e-mailu
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="grid size-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
              aria-label="Zavřít"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`flex items-center gap-2 px-6 py-2.5 text-xs font-semibold ${
              feedback.ok ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-rose-50 text-rose-800 border-b border-rose-200'
            }`}
          >
            {feedback.ok ? <CheckCircle2 size={15} className="text-emerald-600 shrink-0" /> : <AlertCircle size={15} className="text-rose-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Scrollable Center Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          <div
            className={`grid gap-6 ${
              viewMode === 'split' ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-1 max-w-3xl mx-auto'
            }`}
          >
            {/* LEFT / FORM COLUMN */}
            {(viewMode === 'split' || viewMode === 'edit') && (
              <div className="space-y-4 rounded-2xl bg-white p-5 border border-slate-200 shadow-xs">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Edit3 size={14} className="text-sky-600" /> Parametry a text zprávy
                  </h3>
                </div>

                {/* Recipient */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    E-mail příjemce (klienta) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => onRecipientEmailChange?.(e.target.value)}
                    readOnly={!canEditRecipient || !onRecipientEmailChange}
                    className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none ${
                      !canEditRecipient || !onRecipientEmailChange ? 'bg-slate-50 text-slate-600 cursor-not-allowed' : 'bg-white'
                    }`}
                    placeholder="klient@firma.cz"
                  />
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Předmět e-mailu <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => onSubjectChange(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none"
                    placeholder="Předmět zprávy"
                  />
                </div>

                {/* Greeting */}
                {onGreetingChange && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Oslovení klienta</label>
                    <input
                      type="text"
                      value={greeting}
                      onChange={(e) => onGreetingChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none"
                      placeholder="Dobrý den,"
                    />
                  </div>
                )}

                {/* Main Message */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hlavní text zprávy <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={8}
                    value={message}
                    onChange={(e) => onMessageChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 leading-relaxed placeholder-slate-400 focus:border-sky-500 focus:outline-none font-sans"
                    placeholder="Sem napište text e-mailu pro klienta..."
                  />
                </div>

                {/* Closing note */}
                {onClosingNoteChange && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Závěrečná poznámka</label>
                    <input
                      type="text"
                      value={closingNote}
                      onChange={(e) => onClosingNoteChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none"
                      placeholder="V případě dotazů nás kontaktujte..."
                    />
                  </div>
                )}

                {/* Extra children */}
                {children}

                {/* Attachment note */}
                {attachmentBadge && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3 text-xs">
                    <Paperclip size={16} className="text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-800 truncate">{attachmentBadge.name}</div>
                      {attachmentBadge.description && (
                        <div className="text-[11px] text-slate-500">{attachmentBadge.description}</div>
                      )}
                    </div>
                    {attachmentBadge.sizeLabel && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                        {attachmentBadge.sizeLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* RIGHT / PREVIEW COLUMN */}
            {(viewMode === 'split' || viewMode === 'preview') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Eye size={14} className="text-emerald-600" /> Živý vizuální náhled e-mailu
                  </h3>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Skutečný vzhled pro klienta
                  </span>
                </div>

                {/* Email Envelope Container */}
                <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-4 shadow-sm">
                  {/* Email Envelope Header */}
                  <div className="mb-3 rounded-xl bg-white p-3 text-xs border border-slate-200 space-y-1 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">
                        Od: <strong className="text-slate-800">SeePOINT &lt;info@seepoint.cz&gt;</strong>
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date().toLocaleDateString('cs-CZ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Komu: </span>
                      <span className="font-semibold text-slate-900">{recipientEmail || 'klient@firma.cz'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Předmět: </span>
                      <span className="font-semibold text-sky-900">{subject || 'Bez předmětu'}</span>
                    </div>
                  </div>

                  {/* HTML Email Body Container */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 text-slate-800 font-sans">
                    {/* Brand Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="SeePOINT" className="h-8 w-auto" src="/seepoint-logo.svg" />
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                          {badgeLabel}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">Oficiální sdělení</span>
                    </div>

                    {/* Email Text */}
                    <div className="space-y-3 text-xs leading-relaxed text-slate-700">
                      {greeting && <p className="font-bold text-slate-900 text-sm">{greeting}</p>}
                      <div className="whitespace-pre-line text-slate-700">
                        {cleanPreviewMessage || 'Zde bude zobrazen text vaší zprávy pro klienta.'}
                      </div>
                    </div>

                    {/* Extra preview content (e.g. payment box, CTA button, etc.) */}
                    {extraPreviewContent}

                    {/* Attachment Badge Preview in Email */}
                    {attachmentBadge && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={18} className="text-rose-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{attachmentBadge.name}</p>
                            <p className="text-[11px] text-slate-500">Přiložený dokument</p>
                          </div>
                        </div>
                        <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase tracking-wider shrink-0 ml-2">
                          PDF Příloha
                        </span>
                      </div>
                    )}

                    {/* Footer Note & Signature */}
                    <div className="border-t border-slate-100 pt-4 space-y-2 text-xs text-slate-600">
                      {closingNote && <p>{closingNote}</p>}
                      <div className="pt-2 text-slate-500 text-[11px] space-y-0.5">
                        <p className="font-bold text-slate-800">{senderName}</p>
                        <p>{senderRole}</p>
                        <p>E-mail: {senderEmail} | Web: www.seepoint.cz</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-200 bg-slate-50/90 px-6 py-4 gap-3">
          <div className="text-xs text-slate-500">
            E-mail bude odeslán na: <strong className="text-slate-800">{recipientEmail || 'Nezadáno'}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              Zrušit
            </button>

            <button
              type="button"
              disabled={busy || !recipientEmail.trim() || !subject.trim() || !message.trim()}
              onClick={() => void handleSend()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />}
              <span>{busy ? sendingLabel : submitLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
