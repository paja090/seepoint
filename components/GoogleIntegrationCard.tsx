'use client';

import { useState } from 'react';

type Connection = {
  status: string;
  accountEmail: string | null;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  error: string | null;
  scopes?: string[];
} | null;

function formatCheckedAt(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('cs-CZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Prague',
  }).format(date);
}

export function GoogleIntegrationCard({ connection, configured }: { connection: Connection; configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const connected = connection?.status === 'CONNECTED';
  const needsAttention = connection?.status === 'ERROR';
  const hasSheetsScope = Boolean(connection?.scopes?.includes('https://www.googleapis.com/auth/spreadsheets'));
  const lastCheckedAt = formatCheckedAt(connection?.lastCheckedAt ?? null);

  async function disconnect() {
    if (!window.confirm('Opravdu chcete odpojit Google Drive od této organizace?')) return;
    setBusy(true);
    setMessage(null);
    const response = await fetch('/api/integrations/google/disconnect', { method: 'POST' });
    const data = await response.json() as { error?: string };
    if (response.ok) window.location.reload();
    else setMessage(data.error || 'Odpojení se nezdařilo.');
    setBusy(false);
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Google Drive & Google Tabulky</h2>
          <p className="mt-1 text-sm text-slate-600">Úložiště fotografií a obousměrný zápis do sdílené Google Tabulky Plán.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? 'bg-emerald-100 text-emerald-800' : needsAttention ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
          {connected ? 'Připojeno' : needsAttention ? 'Vyžaduje ověření' : 'Nepřipojeno'}
        </span>
      </div>
      {connected ? (
        <div className="space-y-3">
          <p className="text-sm">Účet: <strong>{connection.accountEmail}</strong></p>
          <p className="text-xs font-semibold text-slate-600">
            Zápis do Google Tabulek:{' '}
            {hasSheetsScope ? (
              <span className="text-emerald-700">✓ Aktivní (obousměrná synchronizace Plánu)</span>
            ) : (
              <span className="text-amber-700">Vyžaduje potvrzení oprávnění pro Google Tabulky</span>
            )}
          </p>
          {lastCheckedAt && <p className="text-xs text-slate-500">Naposledy ověřeno: {lastCheckedAt}</p>}
          <div className="flex flex-wrap gap-2">
            {!hasSheetsScope && (
              <a className="btn-primary inline-flex" href="/api/integrations/google/connect?provider=GOOGLE_DRIVE">
                Povolit zápis do Google Tabulek
              </a>
            )}
            <button className="btn-secondary" disabled={busy} onClick={disconnect} type="button">{busy ? 'Odpojuji…' : 'Odpojit Google Drive'}</button>
          </div>
        </div>
      ) : configured ? (
        <div className="space-y-3">
          {needsAttention && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{connection?.error || 'Google Drive připojení je potřeba znovu ověřit.'}</p>}
          <a className="btn-primary inline-flex" href="/api/integrations/google/connect">{needsAttention ? 'Znovu připojit Google Drive' : 'Připojit Google Drive'}</a>
        </div>
      ) : (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">OAuth aplikace SeePoint zatím není nakonfigurovaná. Připojení se zpřístupní po doplnění produkčních Google credentials.</p>
      )}
      {message && <p className="text-sm font-semibold text-red-700">{message}</p>}
    </section>
  );
}
