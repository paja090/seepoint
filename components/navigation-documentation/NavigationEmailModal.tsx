'use client';

import { useState } from 'react';
import { Copy, Check, Mail, Send, X } from 'lucide-react';

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
  const [recipientEmail, setRecipientEmail] = useState(initialClientEmail || '');
  const [subject, setSubject] = useState(`Fotodokumentace navigačních nosičů – ${clientName} – ${periodTitle}`);
  const defaultLink = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/client/navigation-documentation/${token}` : '[ODKAZ NA REPORT]';
  const [message, setMessage] = useState(
    `Dobrý den,\n\nzasíláme vám aktuální fotodokumentaci navigačních nosičů za období ${periodTitle}.\n\nDokumentace obsahuje aktuální fotografie jednotlivých navigací, jejich umístění a přehlednou mapu.\n\nFotodokumentaci otevřete pomocí následujícího odkazu:\n${defaultLink}\n\nPočet zdokumentovaných navigací: ${itemsCount}\n\nV případě dotazů nebo požadavku na doplnění nás prosím kontaktujte.\n\nS pozdravem\nTým SeePOINT`,
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

    try {
      const response = await fetch(`/api/navigation/documentation/${reportId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail,
          subject,
          message,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Mail className="text-sky-600" size={20} />
            <h2 className="text-lg font-semibold text-slate-900">Odeslat fotodokumentaci klientovi</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" type="button">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Příjemce (E-mail klienta)</label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="klient@firma.cz"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Předmět e-mailu</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Text e-mailu</label>
            <textarea
              className="w-full min-h-[180px] rounded-xl border border-slate-200 p-3 text-xs leading-relaxed text-slate-800"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {token && (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
              <span className="truncate font-mono text-slate-600">{defaultLink}</span>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:text-sky-800 ml-2"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
              </button>
            </div>
          )}
        </div>

        {feedback && (
          <p className={`text-xs font-medium ${feedback.ok ? 'text-emerald-600' : 'text-red-600'}`}>
            {feedback.message}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Zrušit
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={handleSend}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <Send size={14} />
            {sending ? 'Odesílám…' : 'Odeslat e-mail'}
          </button>
        </div>
      </div>
    </div>
  );
}
