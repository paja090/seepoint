'use client';

import { AlertTriangle, CheckCircle2, Copy, ExternalLink, LoaderCircle, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function OfferSendControl({ offerId, canSend, missingCount, status }: { offerId: string; canSend: boolean; missingCount: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const alreadySent = status !== 'DRAFT';

  async function send() {
    setBusy(true);
    setMessage('');
    let sent = false;
    try {
      const response = await fetch(`/api/offers/${offerId}/send`, { method: 'POST' });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Nabídku se nepodařilo odeslat.');
      sent = true;
      const publishResponse = await fetch(`/api/offers/${offerId}/publish`, { method: 'POST' });
      const published = await publishResponse.json() as { error?: string; path?: string };
      if (!publishResponse.ok || !published.path) throw new Error(published.error || 'Klientský odkaz se nepodařilo vytvořit.');
      setPublicUrl(`${window.location.origin}${published.path}`);
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
      {alreadySent ? (
        <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy} onClick={() => void createPublicLink()} type="button"><ExternalLink aria-hidden="true" size={16} />{busy ? 'Vytvářím odkaz…' : 'Vytvořit klientský odkaz'}</button>
      ) : (
        <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400" disabled={!canSend || busy} onClick={() => void send()} type="button">
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" size={16} /> : <Send aria-hidden="true" size={16} />}
          {busy ? 'Odesílám…' : 'Odeslat nabídku klientovi'}
        </button>
      )}
      {publicUrl && <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Veřejný klientský odkaz</p><a className="mt-1 block break-all text-sm text-sky-800 underline" href={publicUrl} rel="noreferrer" target="_blank">{publicUrl}</a><button className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-800" onClick={() => void navigator.clipboard.writeText(publicUrl)} type="button"><Copy aria-hidden="true" size={15} />Kopírovat odkaz</button></div>}
      <p className="mt-3 text-center text-xs text-slate-400">Odkaz obsahuje bezpečný token a lze jej kdykoli vygenerovat znovu.</p>
      {message && <p className="mt-3 text-sm text-red-700" role="alert">{message}</p>}
    </section>
  );
}
