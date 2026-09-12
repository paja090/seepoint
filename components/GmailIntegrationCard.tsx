'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, RefreshCw, Trash2, Plus, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';

export type GmailConnectionItem = {
  id: string;
  accountEmail: string | null;
  status: string;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  error: string | null;
  settings?: {
    ingestMode?: 'INBOX_ONLY' | 'LABEL_ONLY' | 'ALL';
    labelName?: string;
    lastSyncAt?: string;
  } | null;
};

export function GmailIntegrationCard({
  connections,
  configured,
}: {
  connections: GmailConnectionItem[];
  configured: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleDisconnect(connectionId: string, email: string | null) {
    if (!window.confirm(`Opravdu chcete odpojit schránku ${email || 'tento účet'} od SeePoint AI Inboxu?`)) {
      return;
    }
    setBusyId(connectionId);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/integrations/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'GMAIL', connectionId }),
      });
      const data = await res.json();
      if (res.ok) {
        window.location.reload();
      } else {
        setErrorMsg(data.error || 'Odpojení se nezdařilo.');
      }
    } catch {
      setErrorMsg('Chyba při komunikaci se serverem.');
    } finally {
      setBusyId(null);
    }
  }

  function formatDate(isoString: string | null) {
    if (!isoString) return null;
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('cs-CZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Prague',
    }).format(d);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <Mail size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Gmail – AI Inbox</h2>
            <p className="text-sm text-slate-500">
              Automatické načítání poptávek a e-mailů klientů pro SeePoint AI Inbox s read-only přístupem.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              connections.length > 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {connections.length > 0
              ? `${connections.length} ${connections.length === 1 ? 'schránka připojena' : 'schránky připojeny'}`
              : 'Nepřipojeno'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800 border border-rose-200">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Connected mailboxes list */}
      {connections.length > 0 && (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
          {connections.map((c) => {
            const isConnBusy = busyId === c.id;
            const isError = c.status === 'ERROR';
            return (
              <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm truncate">{c.accountEmail || 'Bez adresy'}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isError ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isError ? 'Chyba ověření' : 'Aktivní'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    {c.connectedAt && <span>Připojeno: {formatDate(c.connectedAt)}</span>}
                    {c.settings?.lastSyncAt && <span>Poslední sync: {formatDate(c.settings.lastSyncAt)}</span>}
                    {c.settings?.ingestMode && (
                      <span className="text-slate-400">
                        Režim: {c.settings.ingestMode === 'LABEL_ONLY' ? 'Štítek SeePoint AI' : 'Všechny příchozí'}
                      </span>
                    )}
                  </div>
                  {c.error && <p className="text-xs text-rose-600 mt-1">{c.error}</p>}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isConnBusy}
                    onClick={() => handleDisconnect(c.id, c.accountEmail)}
                    className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 active:scale-95 transition disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>{isConnBusy ? 'Odpojuji…' : 'Odpojit'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Security & Scope info */}
      <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span>
            Bezpečnost: Používá se minimální oprávnění <code className="bg-slate-200/80 px-1 py-0.5 rounded text-slate-700">gmail.readonly</code>.
            SeePoint nemá přístup k mazání e-mailů ani jejich odesílání bez vědomí uživatele.
          </span>
        </div>
      </div>

      {/* Actions toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          {configured ? (
            <a
              href="/api/integrations/google/connect?provider=GMAIL"
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow hover:bg-slate-800 active:scale-95 transition"
            >
              <Plus size={15} />
              <span>{connections.length > 0 ? 'Připojit další Gmail' : 'Připojit Gmail schránku'}</span>
            </a>
          ) : (
            <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
              Google OAuth není v prostředí nakonfigurován.
            </span>
          )}
        </div>

        <Link
          href="/ai-inbox"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
        >
          <span>Otevřít AI Inbox</span>
          <ExternalLink size={14} />
        </Link>
      </div>
    </section>
  );
}
