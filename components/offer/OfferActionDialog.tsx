'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, HelpCircle, Loader2, PencilLine, X, XCircle } from 'lucide-react';

export type OfferActionType = 'approve' | 'reject' | 'revision' | 'question';

const config = {
  approve: { title: 'Schválit nabídku', description: 'Potvrďte zájem o realizaci. Obchodník vás bude kontaktovat s dalšími kroky.', submitLabel: 'Odeslat schválení', Icon: CheckCircle2, accent: 'bg-emerald-600 hover:bg-emerald-700', placeholder: 'Volitelná poznámka ke schválení…' },
  reject: { title: 'Odmítnout nabídku', description: 'Potvrďte odmítnutí nabídky. Důvod nám pomůže připravit vhodnější návrh.', submitLabel: 'Odmítnout nabídku', Icon: XCircle, accent: 'bg-red-600 hover:bg-red-700', placeholder: 'Volitelný důvod odmítnutí…' },
  revision: { title: 'Požádat o úpravu', description: 'Popište, co chcete v nabídce upravit – lokality, termín nebo rozsah.', submitLabel: 'Odeslat požadavek', Icon: PencilLine, accent: 'bg-sky-600 hover:bg-sky-700', placeholder: 'Popište požadovanou úpravu…' },
  question: { title: 'Mám dotaz', description: 'Napište svůj dotaz, obchodník se vám ozve co nejdříve.', submitLabel: 'Odeslat dotaz', Icon: HelpCircle, accent: 'bg-sky-600 hover:bg-sky-700', placeholder: 'Váš dotaz k nabídce…' },
} as const;

export function OfferActionDialog({ action, offerStatus, onClose, onReject, token }: { action: OfferActionType | null; offerStatus: string; onClose: () => void; onReject: () => void; token?: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (action) {
      setMessage('');
      setConsent(false);
      setResult(null);
    }
  }, [action]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    if (action) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [action, onClose]);

  if (!action) return null;
  const { title, description, submitLabel, Icon, accent, placeholder } = config[action];
  const requiresConsent = action === 'approve' || action === 'reject';
  const isAlreadyClosed = (action === 'approve' || action === 'reject') && offerStatus !== 'SENT';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setResult({ ok: true, message: 'Ukázka v náhledu: Odpověď byla úspěšně odeslána. V reálném odkazu pro klienta bude požadavek ihned doručen obchodníkovi.' });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(token)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'approve' ? 'accept' : action === 'reject' ? 'reject' : 'question',
          name,
          email,
          message: action === 'revision' ? `Požadavek na úpravu: ${message}` : message,
          consent,
        }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string; error?: string };
      setResult({ ok: response.ok, message: response.ok ? body.message || 'Odpověď byla uložena.' : body.error || 'Odpověď se nepodařilo odeslat.' });
    } catch {
      setResult({ ok: false, message: 'Odpověď se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div aria-labelledby="offer-dialog-title" aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="dialog">
      <button aria-label="Zavřít dialog" className="absolute inset-0" onClick={onClose} type="button" />
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
        <button aria-label="Zavřít" className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} type="button"><X aria-hidden size={18} /></button>
        {result?.ok ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 aria-hidden size={28} /></div>
            <h2 className="text-lg font-semibold text-slate-900" id="offer-dialog-title">Odesláno</h2>
            <p className="text-sm leading-6 text-slate-600">{result.message}</p>
            <button className="mt-2 min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white" onClick={onClose} type="button">Zavřít</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="mb-4 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-200"><Icon aria-hidden size={20} /></div><h2 className="text-lg font-semibold text-slate-900" id="offer-dialog-title">{title}</h2></div>
            <p className="text-sm leading-6 text-slate-600">{description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">Jméno<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base" onChange={(event) => setName(event.target.value)} required value={name} /></label>
              <label className="text-sm font-medium text-slate-700">E-mail<input className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
            </div>
            <label className="mt-3 block text-sm font-medium text-slate-700">Zpráva<textarea className="mt-1 min-h-28 w-full resize-y rounded-xl border border-slate-200 p-3 text-base" onChange={(event) => setMessage(event.target.value)} placeholder={placeholder} required={action === 'revision' || action === 'question'} value={message} /></label>
            {requiresConsent && <label className="mt-3 flex items-start gap-2 text-sm text-slate-600"><input checked={consent} className="mt-1" onChange={(event) => setConsent(event.target.checked)} required type="checkbox" />{action === 'reject' ? 'Potvrzuji odmítnutí této nabídky.' : 'Potvrzuji souhlas s přijetím této nabídky.'}</label>}
            {isAlreadyClosed && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Tato nabídka už není ve stavu, ve kterém ji lze přijmout.</p>}
            {result && !result.ok && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{result.message}</p>}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-50 ${accent}`} disabled={pending || isAlreadyClosed} type="submit">{pending ? <Loader2 aria-hidden className="animate-spin" size={16} /> : <Icon aria-hidden size={16} />}{submitLabel}</button>
              <button className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700" onClick={onClose} type="button">Zrušit</button>
            </div>
            {action === 'approve' && <button className="mt-3 w-full text-center text-sm font-medium text-red-700 hover:text-red-800" onClick={onReject} type="button">Nabídku odmítnout</button>}
          </form>
        )}
      </div>
    </div>
  );
}
