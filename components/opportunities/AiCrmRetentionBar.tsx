'use client';

import { useEffect, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Clock,
  Mail,
  Phone,
  Send,
  Sparkles,
  Loader2,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import type { CrmRetentionTip } from '@/app/api/sales/crm-retention/route';

export function AiCrmRetentionBar({
  onPrepareOffer,
}: {
  onPrepareOffer: (tip: CrmRetentionTip) => void;
}) {
  const [tips, setTips] = useState<CrmRetentionTip[]>([]);
  const [open, setOpen] = useState(false);
  const [activeTipId, setActiveTipId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/sales/crm-retention')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.tips)) {
          setTips(data.tips);
        }
      })
      .catch(() => null);
  }, []);

  if (tips.length === 0) return null;

  const updateTipField = (
    id: string,
    field: 'contactEmail' | 'emailSubject' | 'emailBody',
    value: string
  ) => {
    setTips((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleSendRetentionEmail = async (tip: CrmRetentionTip) => {
    if (!tip.clientId || !tip.contactEmail.trim()) return;
    setSendingId(tip.id);
    try {
      const res = await fetch(`/api/crm/clients/${tip.clientId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: tip.contactEmail.trim(),
          subject: tip.emailSubject.trim(),
          message: tip.emailBody.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Odeslání selhalo.');
      setSentIds((prev) => ({
        ...prev,
        [tip.id]: `Odesláno na ${tip.contactEmail} a zapsáno do CRM.`,
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'E-mail se nepodařilo odeslat.');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-800/60 bg-slate-900/90 p-4 space-y-3 shadow-lg">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex flex-wrap items-center justify-between gap-3 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-700/70 text-emerald-400">
            <Bot className="w-4 h-4" />
          </span>
          <div>
            <div className="text-sm font-black text-white flex items-center gap-2">
              <span>AI Obchodník — Hlídač stávajících klientů v CRM</span>
              <span className="rounded-full bg-emerald-950 border border-emerald-700 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-300">
                {tips.length} doporučení k oslovení
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Končící pronájmy reklamních ploch a reaktivace stávajících klientů s předpřipraveným e-mailem na 1 kliknutí.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
          <span>{open ? 'Skrýt přehled' : 'Zobrazit klienty k oslovení'}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-800">
          {tips.map((tip) => {
            const isExpanded = activeTipId === tip.id;
            const sentMsg = sentIds[tip.id];
            return (
              <div
                key={tip.id}
                className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${
                          tip.kind === 'EXPIRING_OCCUPANCY'
                            ? 'bg-amber-950/80 text-amber-300 border-amber-700/70'
                            : 'bg-sky-950/80 text-sky-300 border-sky-700/70'
                        }`}
                      >
                        {tip.kind === 'EXPIRING_OCCUPANCY'
                          ? '⏳ Končící pronájem plochy'
                          : '🔄 Reaktivace klienta'}
                      </span>
                      <span className="text-sm font-black text-white">{tip.clientName}</span>
                      {tip.city && (
                        <span className="text-xs font-semibold text-slate-400">({tip.city})</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{tip.headline}</span>
                    </div>
                    <p className="text-xs text-slate-300">{tip.reason}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {tip.contactPhone && (
                      <a
                        href={`tel:${tip.contactPhone}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-bold text-amber-300 transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{tip.contactPhone}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveTipId(isExpanded ? null : tip.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-extrabold transition cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{isExpanded ? 'Skrýt e-mail' : 'Oslovit e-mailem'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPrepareOffer(tip)}
                      className="inline-flex items-center gap-1 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/70 text-purple-200 px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Nabídka</span>
                    </button>
                  </div>
                </div>

                {sentMsg && (
                  <div className="rounded-lg bg-emerald-950/80 border border-emerald-700 px-3 py-1.5 text-xs text-emerald-200 flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{sentMsg}</span>
                  </div>
                )}

                {isExpanded && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">
                          E-mail příjemce ({tip.contactName || tip.clientName})
                        </label>
                        <input
                          type="email"
                          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-emerald-300 font-semibold"
                          value={tip.contactEmail}
                          onChange={(e) =>
                            updateTipField(tip.id, 'contactEmail', e.target.value)
                          }
                          placeholder="Zadejte e-mail klienta..."
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 block mb-1">
                          Předmět e-mailu
                        </label>
                        <input
                          className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white font-bold"
                          value={tip.emailSubject}
                          onChange={(e) =>
                            updateTipField(tip.id, 'emailSubject', e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={5}
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 p-2.5 text-xs text-slate-100 leading-relaxed"
                        value={tip.emailBody}
                        onChange={(e) =>
                          updateTipField(tip.id, 'emailBody', e.target.value)
                        }
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendRetentionEmail(tip)}
                        disabled={sendingId === tip.id || !tip.contactEmail.trim() || !tip.clientId}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
                      >
                        {sendingId === tip.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Odesílám…</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            <span>Odeslat ze SeePOINTu & zapsat do CRM</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${tip.emailSubject}\n\n${tip.emailBody}`);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-300 transition cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Kopírovat text</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
