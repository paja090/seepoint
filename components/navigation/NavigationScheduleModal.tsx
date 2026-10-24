'use client';

import { useState, useEffect } from 'react';
import { Calendar, X, CheckCircle2, Clock, FileText } from 'lucide-react';
import type { NavigationOrderDetail } from '@/lib/navigation/types';

interface NavigationScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  clientName: string;
  initialRentStart?: string | null;
  initialRentEnd?: string | null;
  initialInstallationDate?: string | null;
  initialDeinstallationDate?: string | null;
  initialClientOrderCode?: string | null;
  initialTargetNote?: string | null;
  onSuccess: (updatedOrder: NavigationOrderDetail) => void;
}

function toInputDateString(value?: string | null): string {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function NavigationScheduleModal({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  clientName,
  initialRentStart,
  initialRentEnd,
  initialInstallationDate,
  initialDeinstallationDate,
  initialClientOrderCode,
  initialTargetNote,
  onSuccess,
}: NavigationScheduleModalProps) {
  const [rentStart, setRentStart] = useState(toInputDateString(initialRentStart));
  const [rentEnd, setRentEnd] = useState(toInputDateString(initialRentEnd));
  const [installationDate, setInstallationDate] = useState(toInputDateString(initialInstallationDate));
  const [deinstallationDate, setDeinstallationDate] = useState(toInputDateString(initialDeinstallationDate));
  const [clientOrderCode, setClientOrderCode] = useState(initialClientOrderCode || '');
  const [targetNote, setTargetNote] = useState(initialTargetNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setRentStart(toInputDateString(initialRentStart));
      setRentEnd(toInputDateString(initialRentEnd));
      setInstallationDate(toInputDateString(initialInstallationDate));
      setDeinstallationDate(toInputDateString(initialDeinstallationDate));
      setClientOrderCode(initialClientOrderCode || '');
      setTargetNote(initialTargetNote || '');
      setError('');
    }
  }, [
    isOpen,
    initialRentStart,
    initialRentEnd,
    initialInstallationDate,
    initialDeinstallationDate,
    initialClientOrderCode,
    initialTargetNote,
  ]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/navigation/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rentStart: rentStart ? new Date(rentStart).toISOString() : null,
          rentEnd: rentEnd ? new Date(rentEnd).toISOString() : null,
          installationDate: installationDate ? new Date(installationDate).toISOString() : null,
          deinstallationDate: deinstallationDate ? new Date(deinstallationDate).toISOString() : null,
          clientOrderCode: clientOrderCode.trim() || null,
          targetNote: targetNote.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se uložit termíny zakázky.');
      }

      onSuccess(data.order);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání termínů.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="card w-full max-w-lg space-y-5 bg-white p-6 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-amber-600" /> Upravit termíny a harmonogram
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Zakázka: <b className="text-slate-800">{orderNumber}</b> | Klient: <b className="text-slate-800">{clientName}</b>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-500" /> Číslo objednávky klienta / Reference smlouvy
            </label>
            <input
              type="text"
              value={clientOrderCode}
              onChange={(e) => setClientOrderCode(e.target.value)}
              placeholder="např. OBJ-2026-004 nebo SML-4482"
              className="input text-xs"
            />
            <p className="text-[11px] text-slate-400">
              Interní kód objednávky nebo smlouvy, kterou zaslal klient.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-600" /> Začátek pronájmu
              </label>
              <input
                type="date"
                value={rentStart}
                onChange={(e) => setRentStart(e.target.value)}
                className="input text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-600" /> Konec pronájmu
              </label>
              <input
                type="date"
                value={rentEnd}
                onChange={(e) => setRentEnd(e.target.value)}
                className="input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar size={13} className="text-orange-600" /> Plánovaná montáž
              </label>
              <input
                type="date"
                value={installationDate}
                onChange={(e) => setInstallationDate(e.target.value)}
                className="input text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-500" /> Plánovaná demontáž
              </label>
              <input
                type="date"
                value={deinstallationDate}
                onChange={(e) => setDeinstallationDate(e.target.value)}
                className="input text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Poznámka k termínům a realizaci</label>
            <textarea
              rows={2}
              value={targetNote}
              onChange={(e) => setTargetNote(e.target.value)}
              placeholder="Zvláštní požadavky na čas montáže, otevírací dobu nebo klíče..."
              className="input text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {saving ? 'Ukládám...' : (
                <>
                  <CheckCircle2 size={14} /> Uložit harmonogram
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
