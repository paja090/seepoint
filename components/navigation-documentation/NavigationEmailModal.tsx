'use client';

import { useState } from 'react';
import { Copy, Check, Mail, Send, X, Eye, Edit3, ExternalLink } from 'lucide-react';

export function NavigationEmailModal({
  reportId,
  clientName,
  clientEmail: initialClientEmail,
  periodTitle,
  token,
  itemsCount,
  onClose,
  onSent,
}: {
  reportId: string;
  clientName: string;
  clientEmail?: string | null;
  periodTitle: string;
  token?: string;
  itemsCount: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const defaultLink = token
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/client/navigation-documentation/${token}`
    : 'https://seepoint.cz/client/navigation-documentation/example-token';

  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [recipientEmail, setRecipientEmail] = useState(initialClientEmail || '');
  const [subject, setSubject] = useState(`Fotodokumentace navigačních nosičů – ${clientName} – ${periodTitle}`);
  const [greeting, setGreeting] = useState(`Vážený kliente,`);
  const [message, setMessage] = useState(
    `zasíláme vám pravidelnou kontrolní fotodokumentaci vašich aktuálně využívaných navigačních nosičů za období ${periodTitle}.\n\nV klientském portálu naleznete detailní snímky jednotlivých navigačních bodů, přesné adresy a interaktivní mapu s jejich rozmístěním.`,
  );
  const [buttonText, setButtonText] = useState('Zobrazit fotodokumentaci');
  const [closingNote, setClosingNote] = useState(
    'V případě dotazů nebo požadavku na doplnění navigací nás prosím kontaktujte.',
  );

  const [copied, setCopied] = useState(false);
  const [sending, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  function copyLink() {
    if (token) {
      navigator.clipboard.writeText(defaultLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSend() {
    if (!recipientEmail) {
      setFeedback({ ok: false, message: 'Zadejte e-mail příjemce.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    const fullFormattedMessage = `${greeting}\n\n${message}\n\nOdkaz na fotodokumentaci:\n${defaultLink}\n\nPočet nosičů: ${itemsCount}\n\n${closingNote}\n\nS pozdravem\nTým SeePOINT`;

    try {
      const response = await fetch(`/api/navigation/documentation/${reportId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          subject,
          message: fullFormattedMessage,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setFeedback({ ok: false, message: data.error || 'E-mail se nepodařilo odeslat.' });
      } else {
        setFeedback({ ok: true, message: data.message || 'E-mail byl úspěšně odeslán.' });
        setTimeout(() => {
          onSent();
        }, 1500);
      }
    } catch {
      setFeedback({ ok: false, message: 'Chyba při komunikaci se serverem.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Fotodokumentace – E-mail pro klienta</h2>
              <p className="text-xs text-slate-500">{clientName} · {periodTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher Tabs */}
            <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  activeTab === 'edit'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Edit3 size={14} /> Úprava e-mailu
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  activeTab === 'preview'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye size={14} /> Vizuální náhled
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'edit' ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Form Controls */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Příjemce (E-mail klienta)</label>
                  <input
                    type="email"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="klient@firma.cz"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Předmět e-mailu</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Oslovení</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hlavní text zprávy</label>
                  <textarea
                    rows={6}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed text-slate-800 focus:border-sky-500 focus:outline-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Text tlačítka klientského odkazu</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Závěrečná poznámka</label>
                  <textarea
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed text-slate-800 focus:border-sky-500 focus:outline-none"
                    value={closingNote}
                    onChange={(e) => setClosingNote(e.target.value)}
                  />
                </div>

                {token && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Přístupový odkaz pro klienta</label>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs">
                      <span className="truncate font-mono text-slate-600 max-w-[280px]">{defaultLink}</span>
                      <button
                        type="button"
                        onClick={copyLink}
                        className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-800 ml-2"
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? 'Zkopírováno' : 'Kopírovat'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Live Visual Email Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2 text-xs text-slate-600">
                <span><strong>Komu:</strong> {recipientEmail || 'klient@firma.cz'}</span>
                <span><strong>Předmět:</strong> {subject}</span>
              </div>

              {/* Email Envelope Body */}
              <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-xs space-y-6 text-slate-800 font-sans">
                {/* Email Header / Logo */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black tracking-tight text-slate-900">See<span className="text-sky-600">POINT</span></span>
                    <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">Navigace</span>
                  </div>
                  <span className="text-xs text-slate-400">{new Date().toLocaleDateString('cs-CZ')}</span>
                </div>

                {/* Email Text */}
                <div className="space-y-3 text-xs leading-relaxed text-slate-700">
                  <p className="font-semibold text-slate-900 text-sm">{greeting}</p>
                  <div className="whitespace-pre-line">{message}</div>
                </div>

                {/* Stat Box */}
                <div className="rounded-xl border border-sky-100 bg-sky-50/80 p-4 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{clientName} · {periodTitle}</p>
                    <p className="text-slate-500 text-[11px]">Celkem zdokumentovaných nosičů: <strong>{itemsCount}</strong></p>
                  </div>
                  <span className="rounded-full bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white">
                    Garantováno
                  </span>
                </div>

                {/* Call to Action Button */}
                <div className="text-center py-2">
                  <a
                    href={defaultLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-sky-700 transition"
                  >
                    <span>{buttonText}</span>
                    <ExternalLink size={14} />
                  </a>
                  <p className="mt-2 text-[10px] text-slate-400">Bezpečný odkaz s unikátním tokenem bez nutnosti přihlášení</p>
                </div>

                {/* Footer Note & Signature */}
                <div className="border-t border-slate-200 pt-4 space-y-2 text-xs text-slate-600">
                  <p>{closingNote}</p>
                  <div className="pt-2 text-slate-500 text-[11px]">
                    <p className="font-semibold text-slate-800">Tým SeePOINT</p>
                    <p>E-mail: info@seepoint.cz | Web: www.seepoint.cz</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <div className="text-xs">
            {feedback && (
              <span className={`font-medium ${feedback.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {feedback.message}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Zrušit
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={handleSend}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 shadow-sm disabled:opacity-50"
            >
              <Send size={14} />
              {sending ? 'Odesílám…' : 'Odeslat e-mail klientovi'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
