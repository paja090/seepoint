'use client';

import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Eye, LoaderCircle, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OfferEmailPreviewDialog, type OfferEmailPreviewData } from './OfferEmailPreviewDialog';

export function OfferSendControl({ offerId, canSend, emailPreview, initialMessage, missingCount, status }: { offerId: string; canSend: boolean; emailPreview: OfferEmailPreviewData; initialMessage: string; missingCount: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [emailSubject, setEmailSubject] = useState(`Nabídka SeePOINT – ${emailPreview.campaignName}`);
  const [emailMessage, setEmailMessage] = useState(initialMessage);
  const [previewOpen, setPreviewOpen] = useState(false);
  const alreadySent = status === 'SENT';
  const canDeliver = status === 'DRAFT' || status === 'SENT';

  async function send() {
    setBusy(true);
    setMessage('');
    let sent = false;
    try {
      const response = await fetch(`/api/offers/${offerId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: emailSubject, clientMessage: emailMessage }),
      });
      const data = await response.json() as { error?: string; path?: string };
      if (!response.ok) throw new Error(data.error || 'Nabídku se nepodařilo odeslat.');
      if (!data.path) throw new Error('Klientský odkaz se nepodařilo vytvořit.');
      sent = true;
      setPublicUrl(`${window.location.origin}${data.path}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nabídku se nepodařilo odeslat.');
    } finally {
      if (sent) router.refresh();
      setBusy(false);
    }
  }

  async function createPublicLink() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/offers/${offerId}/publish`, { method: 'POST' });
      const data = await response.json() as { error?: string; path?: string };
      if (!response.ok || !data.path) throw new Error(data.error || 'Klientský odkaz se nepodařilo vytvořit.');
      setPublicUrl(`${window.location.origin}${data.path}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Klientský odkaz se nepodařilo vytvořit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="text-base font-semibold text-slate-950">Rozhodnutí</h2>
      <p className="mt-1 text-sm text-slate-500">Nabídku lze odeslat klientovi až po doplnění všech povinných podkladů.</p>
      <div className={`mt-4 rounded-xl p-4 ring-1 ${canSend || alreadySent ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
        <p className={`flex items-center gap-2 text-sm font-semibold ${canSend || alreadySent ? 'text-emerald-700' : 'text-amber-700'}`}>
          {canSend || alreadySent ? <CheckCircle2 aria-hidden="true" size={16} /> : <AlertTriangle aria-hidden="true" size={16} />}
          {alreadySent ? 'Nabídka již byla odeslána' : canSend ? 'Připraveno k odeslání' : `Zbývá vyřešit ${missingCount} bodů`}
        </p>
      </div>
      {canDeliver ? (
        <div className="mt-4 grid gap-2">
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-800 hover:bg-sky-100" onClick={() => setPreviewOpen(true)} type="button"><Eye aria-hidden="true" size={16} />Náhled a úprava e-mailu</button>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400" disabled={!canSend || busy} onClick={() => void send()} type="button">
            {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <Send aria-hidden="true" size={16} />}
            {busy ? 'Odesílám…' : alreadySent ? 'Znovu odeslat aktualizovanou nabídku' : 'Odeslat nabídku klientovi'}
          </button>
          {alreadySent ? <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50" disabled={busy} onClick={() => void createPublicLink()} type="button"><ExternalLink aria-hidden="true" size={16} />Vytvořit pouze nový klientský odkaz</button> : null}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-600">Tuto nabídku už nelze znovu odeslat, protože byla uzavřena.</p>
      )}
      {publicUrl && <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Veřejný klientský odkaz</p><a className="mt-1 block break-all text-sm text-sky-800 underline" href={publicUrl} rel="noreferrer" target="_blank">{publicUrl}</a><button className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-800" onClick={() => void navigator.clipboard.writeText(publicUrl)} type="button"><Copy aria-hidden="true" size={15} />Kopírovat odkaz</button></div>}
      <p className="mt-3 text-center text-xs text-slate-400">Odkaz obsahuje bezpečný token a lze jej kdykoli vygenerovat znovu.</p>
      {message && <p className="mt-3 text-sm text-red-700" role="alert">{message}</p>}
      {previewOpen ? <OfferEmailPreviewDialog data={emailPreview} message={emailMessage} onClose={() => setPreviewOpen(false)} onMessageChange={setEmailMessage} onSubjectChange={setEmailSubject} subject={emailSubject} /> : null}
    </section>
  );
}
