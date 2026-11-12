'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Hand,
  MessageSquare,
  Send,
  XCircle,
} from 'lucide-react';
import { primaryButton, secondaryButton } from './styles';
import { plannerRequest } from './api';
import type { PlannerReadModel } from '@/lib/planner/read-model';
import {
  APPROVAL_CATEGORY_LABELS,
  type ApprovalCategory,
} from '@/lib/planner/owner-constants';
import type { ApprovalRequestRecord } from '@/lib/planner/owner-reports';

function approvalStatusBadge(status: ApprovalRequestRecord['status']) {
  if (status === 'APPROVED') {
    return {
      label: 'Schváleno',
      cls: 'bg-emerald-100 text-emerald-800',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    };
  }
  if (status === 'REJECTED') {
    return {
      label: 'Zamítnuto',
      cls: 'bg-rose-100 text-rose-800',
      icon: <XCircle className="h-3.5 w-3.5" />,
    };
  }
  if (status === 'INFO_REQUESTED') {
    return {
      label: 'Dotaz vedení',
      cls: 'bg-amber-100 text-amber-800',
      icon: <MessageSquare className="h-3.5 w-3.5" />,
    };
  }
  return {
    label: 'Čeká na schválení',
    cls: 'bg-sky-100 text-sky-800',
    icon: <Clock className="h-3.5 w-3.5" />,
  };
}

export function DayCheckoutCard({
  data,
  onSaved,
}: {
  data: PlannerReadModel;
  onSaved: () => void;
}) {
  const checkout = data.myDayCheckout;
  const submitted = checkout?.submitted ?? null;

  const [manualSummary, setManualSummary] = useState(submitted?.manualSummary || '');
  const [blockers, setBlockers] = useState(submitted?.blockers || '');
  const [includeApproval, setIncludeApproval] = useState(false);
  const [apprCategory, setApprCategory] = useState<ApprovalCategory>('DISCOUNT');
  const [apprTitle, setApprTitle] = useState('');
  const [apprAmount, setApprAmount] = useState('');
  const [apprDetail, setApprDetail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!checkout) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload: Record<string, unknown> = {
        action: 'submit_checkout',
        date: data.date,
        manualSummary,
        blockers,
      };
      if (includeApproval && apprTitle.trim()) {
        payload.approvalRequest = {
          category: apprCategory,
          title: apprTitle.trim(),
          amountLabel: apprAmount.trim() || null,
          detail: apprDetail.trim() || blockers || manualSummary,
        };
      }
      await plannerRequest<{ ok: boolean }>('/checkouts', payload);
      setNotice('Váš report dne byl uložen' + (includeApproval && apprTitle.trim() ? ' a žádost odeslána vedení.' : '.'));
      setIncludeApproval(false);
      setApprTitle('');
      setApprAmount('');
      setApprDetail('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${
              submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900">Můj report dne</h2>
            <p className="text-[11px] font-medium text-slate-500">
              30sekundový souhrn pro majitele
            </p>
          </div>
        </div>
        {submitted ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">
            Odevzdáno
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            Neodevzdáno
          </span>
        )}
      </div>

      <div className="mb-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3.5 py-2.5 text-xs">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
          Systém za vás dnes automaticky eviduje:
        </p>
        <p className="mt-1 font-semibold text-slate-800">{checkout.autoSummary}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-xs font-bold text-slate-700">
          <span>Co dalšího jste dnes posunul / vyřešil?</span>
          <textarea
            rows={2}
            placeholder="Např. Jednal jsem s klientem XY o smlouvě, připravil podklady pro výrobu..."
            value={manualSummary}
            onChange={(e) => setManualSummary(e.target.value)}
            className="mt-1 block w-full rounded-2xl border border-slate-300 bg-white p-2.5 text-xs font-medium text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="block text-xs font-bold text-slate-700">
          <span>Zásek nebo zdržení (volitelné)</span>
          <input
            type="text"
            placeholder="Např. Čekáme na podklady z grafiky..."
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-amber-500"
          />
        </label>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIncludeApproval((v) => !v)}
            className={`${secondaryButton} w-full justify-center text-xs ${
              includeApproval ? 'border-amber-300 bg-amber-50 text-amber-900' : ''
            }`}
          >
            <Hand className="h-3.5 w-3.5 text-amber-600" />
            <span>
              {includeApproval
                ? 'Skrýt žádost o schválení'
                : 'Potřebuji schválení / rozhodnutí majitele'}
            </span>
          </button>
        </div>

        {includeApproval && (
          <div className="space-y-2.5 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-900">
              Žádost pro vedení (přijde majiteli ke schválení na 1 klik)
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block font-semibold text-slate-700">
                <span>Kategorie</span>
                <select
                  value={apprCategory}
                  onChange={(e) => setApprCategory(e.target.value as ApprovalCategory)}
                  className="mt-0.5 block w-full rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-bold text-slate-900"
                >
                  {(Object.keys(APPROVAL_CATEGORY_LABELS) as ApprovalCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {APPROVAL_CATEGORY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block font-semibold text-slate-700">
                <span>Dopad / Částka (volitelné)</span>
                <input
                  type="text"
                  placeholder="např. -15 000 Kč / 10 %"
                  value={apprAmount}
                  onChange={(e) => setApprAmount(e.target.value)}
                  className="mt-0.5 block w-full rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-bold text-slate-900"
                />
              </label>
            </div>

            <label className="block font-semibold text-slate-700">
              <span>Předmět rozhodnutí</span>
              <input
                type="text"
                placeholder="Např. Výjimečná sleva pro klienta ABC"
                value={apprTitle}
                onChange={(e) => setApprTitle(e.target.value)}
                className="mt-0.5 block w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-900"
              />
            </label>

            <label className="block font-semibold text-slate-700">
              <span>Kontext / Proč to navrhujete</span>
              <textarea
                rows={2}
                placeholder="Krátký argument pro majitele..."
                value={apprDetail}
                onChange={(e) => setApprDetail(e.target.value)}
                className="mt-0.5 block w-full rounded-lg border border-amber-300 bg-white p-2 text-xs text-slate-900"
              />
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || (!manualSummary.trim() && !blockers.trim())}
          className={`${primaryButton} w-full justify-center text-xs`}
        >
          <Send className="h-3.5 w-3.5" />
          <span>{saving ? 'Ukládám…' : submitted ? 'Aktualizovat report dne' : 'Odeslat report dne'}</span>
        </button>
      </form>

      {checkout.myApprovals.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Moje žádosti o rozhodnutí ({checkout.myApprovals.length})
          </p>
          <div className="mt-2 space-y-2">
            {checkout.myApprovals.slice(0, 4).map((req) => {
              const badge = approvalStatusBadge(req.status);
              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-slate-900">{req.title}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${badge.cls}`}>
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                  </div>
                  {req.decisionNote && (
                    <p className="mt-1 rounded-lg bg-white px-2 py-1 text-[11px] italic text-slate-700">
                      {req.decidedByName || 'Vedení'}: „{req.decisionNote}“
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
