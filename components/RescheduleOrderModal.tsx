'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, X, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { formatWorkDate } from '@/lib/work';

export type RescheduleTargetOrder = {
  id: string;
  title: string;
  clientName: string;
  scheduledAt: string;
};

export type RescheduleOrderModalProps = {
  order: RescheduleTargetOrder | null;
  onClose: () => void;
  onSuccess: (orderId: string, newDateIso: string, message?: string) => void;
};

function formatDateToIsoString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? 1 : 8 - day);
  d.setDate(d.getDate() + diff);
  return formatDateToIsoString(d);
}

export function RescheduleOrderModal({ order, onClose, onSuccess }: RescheduleOrderModalProps) {
  const [targetDate, setTargetDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const todayIso = formatDateToIsoString(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = formatDateToIsoString(tomorrow);

  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterIso = formatDateToIsoString(dayAfter);

  const inOneWeek = new Date(now);
  inOneWeek.setDate(inOneWeek.getDate() + 7);
  const inOneWeekIso = formatDateToIsoString(inOneWeek);

  const nextMondayIso = getNextMonday();

  useEffect(() => {
    if (order) {
      const current = new Date(order.scheduledAt);
      const nowDate = new Date();
      if (current < nowDate) {
        setTargetDate(formatDateToIsoString(nowDate));
      } else {
        const nextDay = new Date(nowDate);
        nextDay.setDate(nextDay.getDate() + 1);
        setTargetDate(formatDateToIsoString(nextDay));
      }
      setReason('');
      setError(null);
    }
  }, [order]);

  if (!order) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!targetDate) {
      setError('Vyberte cílové datum přeplánování.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/work-orders/${order.id}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Přeplánování zakázky selhalo.');
      }

      onSuccess(order.id, data.workOrder.scheduledAt, data.message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při přeplánování');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-800 shadow-sm border border-sky-200">
              <Calendar size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950 tracking-tight">
                Přeplánovat zakázku
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Přesuňte termín realizace na jiný pracovní den.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Zavřít"
          >
            <X size={18} />
          </button>
        </div>

        {/* Order Details Preview */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Vybraná zakázka
          </p>
          <p className="text-sm font-extrabold text-slate-900 leading-snug">
            {order.title}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600 pt-0.5">
            <span>👤 {order.clientName}</span>
            <span>·</span>
            <span className="flex items-center gap-1 text-amber-700 font-bold">
              <Clock size={12} />
              Původní termín: {formatWorkDate(new Date(order.scheduledAt))}
            </span>
          </div>
        </div>

        {/* Quick Date Shortcuts */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-700">
            Rychlá volba termínu
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTargetDate(todayIso)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-extrabold transition shadow-2xs ${
                targetDate === todayIso
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>⚡ Dnes</span>
              {targetDate === todayIso && <Check size={14} className="text-emerald-600" />}
            </button>

            <button
              type="button"
              onClick={() => setTargetDate(tomorrowIso)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-extrabold transition shadow-2xs ${
                targetDate === tomorrowIso
                  ? 'border-sky-500 bg-sky-50 text-sky-950 ring-2 ring-sky-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>➡️ Zítra</span>
              {targetDate === tomorrowIso && <Check size={14} className="text-sky-600" />}
            </button>

            <button
              type="button"
              onClick={() => setTargetDate(dayAfterIso)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-extrabold transition shadow-2xs ${
                targetDate === dayAfterIso
                  ? 'border-sky-500 bg-sky-50 text-sky-950 ring-2 ring-sky-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Pozítří (+2 dny)</span>
              {targetDate === dayAfterIso && <Check size={14} className="text-sky-600" />}
            </button>

            <button
              type="button"
              onClick={() => setTargetDate(nextMondayIso)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-extrabold transition shadow-2xs ${
                targetDate === nextMondayIso
                  ? 'border-sky-500 bg-sky-50 text-sky-950 ring-2 ring-sky-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Pondělí</span>
              {targetDate === nextMondayIso && <Check size={14} className="text-sky-600" />}
            </button>

            <button
              type="button"
              onClick={() => setTargetDate(inOneWeekIso)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-extrabold transition shadow-2xs col-span-2 sm:col-span-2 ${
                targetDate === inOneWeekIso
                  ? 'border-sky-500 bg-sky-50 text-sky-950 ring-2 ring-sky-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Za týden ({new Date(inOneWeekIso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })})</span>
              {targetDate === inOneWeekIso && <Check size={14} className="text-sky-600" />}
            </button>
          </div>
        </div>

        {/* Custom Date Input */}
        <div className="space-y-1.5">
          <label htmlFor="customRescheduleDate" className="text-xs font-black uppercase tracking-wider text-slate-700">
            Nebo přesné datum:
          </label>
          <input
            id="customRescheduleDate"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 shadow-2xs focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        {/* Reschedule Reason */}
        <div className="space-y-1.5">
          <label htmlFor="rescheduleReason" className="text-xs font-black uppercase tracking-wider text-slate-700">
            Důvod přeplánování <span className="font-normal text-slate-400 lowercase">(volitelné)</span>
          </label>
          <input
            id="rescheduleReason"
            type="text"
            placeholder="např. Špatné počasí / Zpoždění tisku / Požadavek klienta"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 shadow-2xs focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-black text-white hover:bg-sky-500 shadow-md transition disabled:opacity-50"
          >
            {submitting ? (
              <span>Ukládám…</span>
            ) : (
              <>
                <span>Přeplánovat zakázku</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
