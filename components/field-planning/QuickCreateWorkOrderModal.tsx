'use client';

import React, { useState } from 'react';
import { Plus, X, MapPin, Calendar, Clock, AlertTriangle, Briefcase, CheckCircle2 } from 'lucide-react';
import { workTypeLabels } from '@/lib/work';

type QuickCreateWorkOrderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (orderId: string) => void;
  defaultDate: string;
};

export function QuickCreateWorkOrderModal({
  isOpen,
  onClose,
  onCreated,
  defaultDate,
}: QuickCreateWorkOrderModalProps) {
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  const [workType, setWorkType] = useState('OTHER');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [serviceMinutes, setServiceMinutes] = useState('45');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Vyplňte název úkolu.');
      return;
    }
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setError('Vyplňte adresu nebo lokaci, kde se má práce provést.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const minutesNum = Number.parseInt(serviceMinutes, 10) || 45;
      const hoursDecimal = (minutesNum / 60).toFixed(2);

      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || `Terénní úkol z plánovače výjezdů (${defaultDate})`,
          scheduledAt: `${defaultDate}T08:00:00`,
          deadlineAt: `${defaultDate}T18:00:00`,
          clientName: clientName.trim() || 'Interní / běžná zakázka',
          locationNote: trimmedAddress,
          workType,
          priority,
          estimatedHours: hoursDecimal,
          requestedBy: 'Dispečink výjezdů',
          scope: 'FIELD',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Vytvoření úkolu selhalo.');
      }

      // Reset form
      setTitle('');
      setClientName('');
      setAddress('');
      setDescription('');
      onCreated(data.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání úkolu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-600 text-white shadow-sm">
              <Briefcase size={18} />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-900">
                Přidat úkol do Plánu práce a výjezdu
              </h3>
              <p className="text-[11px] font-semibold text-slate-500">
                Úkol se okamžitě uloží do Plánu práce a zařadí mezi zastávky
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 border border-red-200">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Název úkolu / činnosti <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="např. Výměna lamely lavičky, Lepení billboardu, Servis"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input mt-1 w-full text-xs font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Klient / zadavatel
              </label>
              <input
                type="text"
                placeholder="např. Město, Dopravní podnik, Klient"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="input mt-1 w-full text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Typ práce
              </label>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                className="input mt-1 w-full text-xs font-medium"
              >
                {Object.entries(workTypeLabels).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              Adresa / Místo realizace <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                placeholder="např. Náměstí Míru 5, Zlín nebo GPS"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input w-full pl-8 text-xs font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                Den realizace
              </label>
              <div className="relative mt-1">
                <input
                  type="date"
                  disabled
                  value={defaultDate}
                  className="input w-full bg-slate-50 text-xs font-medium text-slate-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Čas na místě
              </label>
              <select
                value={serviceMinutes}
                onChange={(e) => setServiceMinutes(e.target.value)}
                className="input mt-1 w-full text-xs font-medium"
              >
                <option value="15">15 min (kontrola)</option>
                <option value="30">30 min (rychlý výlep)</option>
                <option value="45">45 min (standard)</option>
                <option value="60">60 min (1 hodina)</option>
                <option value="90">90 min (1,5 hodiny)</option>
                <option value="120">120 min (montáž)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Priorita
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT')}
                className="input mt-1 w-full text-xs font-medium"
              >
                <option value="LOW">Nízká</option>
                <option value="NORMAL">Normální</option>
                <option value="HIGH">Vysoká</option>
                <option value="URGENT">Urgentní ⚡</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">
              Poznámka / instrukce pro montéra
            </label>
            <textarea
              rows={2}
              placeholder="Upřesnění nosiče, montážní instrukce nebo kontakt na místě…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input mt-1 w-full text-xs font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-2 text-xs font-black text-white shadow-md hover:from-sky-500 hover:to-emerald-500 transition disabled:opacity-50"
            >
              {busy ? (
                <span>Ukládám…</span>
              ) : (
                <>
                  <Plus size={16} strokeWidth={2.5} />
                  <span>Uložit a zařadit do výjezdu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
