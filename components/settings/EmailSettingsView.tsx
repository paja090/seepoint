'use client';

import { useState } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  Send,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Info,
} from 'lucide-react';

type DnsRecord = {
  record: string;
  name: string;
  type: string;
  value: string;
  status: string;
  priority?: number;
  ttl?: string;
};

type EmailSettings = {
  id: string;
  domain: string;
  senderName: string;
  fromEmail: string;
  replyTo?: string | null;
  providerDomainId?: string | null;
  status: 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED';
  dnsRecords?: DnsRecord[] | null;
  lastVerifiedAt?: string | null;
  lastTestedAt?: string | null;
  createdAt: string;
};

type EmailLogItem = {
  id: string;
  recipient: string;
  from: string;
  subject: string;
  template: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'DELIVERY_DELAYED' | 'BOUNCED' | 'COMPLAINED' | 'FAILED';
  error?: string | null;
  sentAt: string;
  deliveredAt?: string | null;
};

export function EmailSettingsView({
  initialSettings,
  initialLogs,
  userEmail,
}: {
  initialSettings: EmailSettings | null;
  initialLogs: EmailLogItem[];
  userEmail: string;
}) {
  const [settings, setSettings] = useState<EmailSettings | null>(initialSettings);
  const [logs, setLogs] = useState<EmailLogItem[]>(initialLogs);

  const [domainInput, setDomainInput] = useState(initialSettings?.domain || '');
  const [senderNameInput, setSenderNameInput] = useState(initialSettings?.senderName || '');
  const [fromEmailInput, setFromEmailInput] = useState(initialSettings?.fromEmail || '');
  const [replyToInput, setReplyToInput] = useState(initialSettings?.replyTo || '');

  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setConnecting(true);

    try {
      const res = await fetch('/api/settings/email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: domainInput,
          senderName: senderNameInput,
          fromEmail: fromEmailInput,
          replyTo: replyToInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Připojení domény selhalo.');

      setSettings(data.settings);
      setFeedback({ kind: 'success', text: data.message });
    } catch (err) {
      setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Chyba při připojování domény.' });
    } finally {
      setConnecting(false);
    }
  };

  const handleVerify = async () => {
    setFeedback(null);
    setVerifying(true);

    try {
      const res = await fetch('/api/settings/email/verify', {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ověření domény selhalo.');

      setSettings(data.settings);
      setFeedback({
        kind: data.verified ? 'success' : 'info',
        text: data.message,
      });
    } catch (err) {
      setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Chyba při ověřování.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleTestEmail = async () => {
    setFeedback(null);
    setTesting(true);

    try {
      const res = await fetch('/api/settings/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: userEmail }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Odeslání testovacího e-mailu selhalo.');

      setFeedback({ kind: 'success', text: data.message });
      // Refresh logs
      fetch('/api/settings/email')
        .then((r) => r.json())
        .then((d) => {
          if (d.recentLogs) setLogs(d.recentLogs);
        })
        .catch(() => null);
    } catch (err) {
      setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Chyba při testu e-mailu.' });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Opravdu chcete odpojit tuto firemní doménu? Odesílání z této domény bude pozastaveno.')) return;

    setFeedback(null);
    setDisconnecting(true);

    try {
      const res = await fetch('/api/settings/email', {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Odpojení domény selhalo.');

      setSettings(null);
      setFeedback({ kind: 'info', text: 'Doména byla úspěšně odpojena.' });
    } catch (err) {
      setFeedback({ kind: 'error', text: err instanceof Error ? err.message : 'Chyba při odpojování domény.' });
    } finally {
      setDisconnecting(false);
    }
  };

  const isVerified = settings?.status === 'VERIFIED';
  const isPending = settings?.status === 'PENDING' || settings?.status === 'NOT_STARTED';

  return (
    <div className="space-y-8">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-2xl p-4 text-sm font-medium border flex items-start gap-3 ${
            feedback.kind === 'success'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
              : feedback.kind === 'error'
              ? 'bg-rose-950/40 border-rose-800 text-rose-200'
              : 'bg-sky-950/40 border-sky-800 text-sky-200'
          }`}
        >
          {feedback.kind === 'success' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
          ) : feedback.kind === 'error' ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
          ) : (
            <Info className="h-5 w-5 shrink-0 text-sky-400 mt-0.5" />
          )}
          <div className="flex-1">{feedback.text}</div>
        </div>
      )}

      {/* Domain Status Header Card */}
      {settings ? (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
                  isVerified
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                }`}
              >
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">{settings.domain}</h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      isVerified
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isVerified ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Doména ověřena ✓</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" />
                        <span>Čeká na ověření DNS</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Odesílatel: <span className="text-slate-200 font-semibold">{settings.senderName}</span> &lt;
                  {settings.fromEmail}&gt;
                  {settings.replyTo && (
                    <span>
                      {' '}
                      • Reply-To: <span className="text-slate-200">{settings.replyTo}</span>
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${verifying ? 'animate-spin' : ''}`} />
                <span>{verifying ? 'Ověřuji...' : 'Zkontrolovat DNS / Ověřit'}</span>
              </button>

              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testing || !isVerified}
                title={!isVerified ? 'Před odesláním testu nejprve ověřte doménu' : undefined}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5 text-sky-400" />
                <span>{testing ? 'Odesílám...' : 'Testovací e-mail'}</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition"
                title="Odpojit doménu"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Connect Domain Form */
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Připojit firemní doménu pro e-maily</h2>
              <p className="text-xs text-slate-400">
                Vaše nabídky a klientské zprávy budou odcházet přímo z vaší firemní domény s SPF a DKIM.
              </p>
            </div>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Firemní doména
                </label>
                <input
                  type="text"
                  required
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="např. seepoint.cz nebo outdoorabc.cz"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-400">Bez http:// a www, pouze doména.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Jméno odesílatele (From Name)
                </label>
                <input
                  type="text"
                  required
                  value={senderNameInput}
                  onChange={(e) => setSenderNameInput(e.target.value)}
                  placeholder="např. SeePoint nebo Outdoor ABC"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  E-mail odesílatele (From Email)
                </label>
                <input
                  type="email"
                  required
                  value={fromEmailInput}
                  onChange={(e) => setFromEmailInput(e.target.value)}
                  placeholder="např. nabidky@seepoint.cz"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-400">Musí patřit k výše uvedené doméně.</p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Odpovědět komu (Reply-To)
                </label>
                <input
                  type="email"
                  value={replyToInput}
                  onChange={(e) => setReplyToInput(e.target.value)}
                  placeholder="např. obchod@seepoint.cz (nepovinné)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
                />
                <p className="text-[11px] text-slate-400">Kam mají chodit odpovědi klientů na nabídky.</p>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={connecting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition disabled:opacity-50"
              >
                {connecting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                <span>Připojit doménu & vygenerovat DNS záznamy</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DNS Records Section */}
      {settings?.dnsRecords && settings.dnsRecords.length > 0 && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">Požadované DNS záznamy pro {settings.domain}</h3>
              <p className="text-xs text-slate-400">
                Vložte následující záznamy do správy DNS vaší domény (Cloudflare, WEDOS, Forpsi, Webglobe atd.).
              </p>
            </div>
            <span className="text-xs text-purple-400 font-semibold bg-purple-950/60 border border-purple-800/40 px-3 py-1 rounded-xl">
              DKIM & SPF autorizace
            </span>
          </div>

          {/* Warning: Preserve existing MX records */}
          <div className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-4 text-xs text-amber-200/90 space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <span>DŮLEŽITÉ: Pozor na stávající firemní e-maily</span>
            </div>
            <p>
              Pokud vaše firma již používá Google Workspace, Microsoft 365 nebo jiný poštovní server pro příchozí poštu,
              <strong> nemažte ani nepřepisujte vaše existující MX záznamy</strong>. Do DNS přidejte pouze níže uvedené
              záznamy pro autorizaci odesílání ze Seepoint OS.
            </p>
          </div>

          {/* DNS Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Typ</th>
                  <th className="py-3 px-3">Název / Hostitel</th>
                  <th className="py-3 px-3">Hodnota / Cíl</th>
                  <th className="py-3 px-3 text-center">Stav</th>
                  <th className="py-3 px-3 text-right">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {settings.dnsRecords.map((rec, idx) => {
                  const recordKey = `dns-${idx}`;
                  const isVerifiedRec = rec.status === 'verified';

                  return (
                    <tr key={idx} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-3 font-mono font-bold text-purple-400">{rec.type}</td>
                      <td className="py-3 px-3 font-mono text-slate-200 max-w-[200px] truncate" title={rec.name}>
                        {rec.name}
                      </td>
                      <td
                        className="py-3 px-3 font-mono text-slate-400 max-w-[320px] truncate select-all"
                        title={rec.value}
                      >
                        {rec.value}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            isVerifiedRec
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {isVerifiedRec ? 'Ověřeno' : 'Čeká'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(rec.value, recordKey)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition"
                          title="Kopírovat hodnotu"
                        >
                          {copiedKey === recordKey ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400">Zkopírováno</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 text-slate-400" />
                              <span>Kopírovat</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Sent Emails Log */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">Nedávno odeslané e-maily (EmailLog)</h3>
          </div>
          <span className="text-xs text-slate-500">Posledních 15 zpráv</span>
        </div>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">Zatím nebyly odeslány žádné e-maily.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Příjemce</th>
                  <th className="py-2.5 px-3">Předmět</th>
                  <th className="py-2.5 px-3">Typ</th>
                  <th className="py-2.5 px-3 text-center">Stav doručení</th>
                  <th className="py-2.5 px-3 text-right">Čas odeslání</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => {
                  const isDelivered = log.status === 'DELIVERED';
                  const isBounced = log.status === 'BOUNCED' || log.status === 'FAILED';

                  return (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{log.recipient}</td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-[240px] truncate">{log.subject}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{log.template}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDelivered
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              : isBounced
                              ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                              : 'bg-sky-950 text-sky-300 border border-sky-800/60'
                          }`}
                        >
                          {log.status === 'DELIVERED'
                            ? 'Doručeno ✓'
                            : log.status === 'SENT'
                            ? 'Odesláno'
                            : log.status === 'BOUNCED'
                            ? 'Nedoručeno (Bounce)'
                            : log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400 font-mono text-[11px]">
                        {new Date(log.sentAt).toLocaleString('cs-CZ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
