'use client';
import { useState } from 'react';

export function GmailSendingPanel({ accountEmail, error }: { accountEmail: string | null; error: string | null }) {
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function sendTest() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/settings/email/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to }) });
      const result = await response.json();
      setMessage(response.ok ? result.message : result.error || 'Test se nezdařil.');
    } catch { setMessage('Výsledek odeslání se nepodařilo zjistit. Před opakováním zkontrolujte poštu.'); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
    <h2 className="text-xl font-bold">Odesílání přes Gmail</h2>
    <p className="text-sm text-slate-600">Nabídky a další firemní zprávy můžete odesílat přímo z jedné Google schránky této organizace. Po zapnutí se použije přednostně před firemní doménou. Odpovědi přijdou do stejné schránky.</p>
    {accountEmail ? <p className="font-semibold text-emerald-700">Odesílací schránka: {accountEmail}</p> : <p>Odesílání přes Gmail zatím není aktivní.</p>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    <a className="inline-block rounded-lg bg-slate-900 px-4 py-2 text-white" href="/api/integrations/google/connect?provider=GMAIL&send=true">{accountEmail ? 'Znovu ověřit odesílací Gmail' : 'Připojit Gmail pro čtení a odesílání'}</a>
    <p className="text-xs text-slate-500">Google požádá o souhlas s odesíláním. Připojení jen pro AI Inbox tuto možnost nezapíná. Připojte jednu odesílací schránku; další mohou zůstat pouze pro čtení. Odpojení je dostupné v Integracích.</p>
    {accountEmail && <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Příjemce testovacího e-mailu<input type="email" value={to} onChange={e => setTo(e.target.value)} className="block rounded-lg border p-2" /></label>
      <button type="button" onClick={sendTest} disabled={busy || !to.trim()} className="rounded-lg border px-4 py-2 disabled:opacity-50">{busy ? 'Odesílám…' : 'Odeslat test přes Gmail'}</button>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
