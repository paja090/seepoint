'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, X, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import type { NavigationOrderDetail } from '@/lib/navigation/types';
import Link from 'next/link';

interface NavigationContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  clientId: string;
  clientName: string;
  initialContactPerson?: string | null;
  initialContactEmail?: string | null;
  initialContactPhone?: string | null;
  initialAssignedUserId?: string | null;
  salesUsers?: Array<{ id: string; name: string; email: string }>;
  onSuccess: (updatedOrder: NavigationOrderDetail) => void;
}

export function NavigationContactModal({
  isOpen,
  onClose,
  orderId,
  clientId,
  clientName,
  initialContactPerson,
  initialContactEmail,
  initialContactPhone,
  initialAssignedUserId,
  salesUsers = [],
  onSuccess,
}: NavigationContactModalProps) {
  const [contactPerson, setContactPerson] = useState(initialContactPerson || '');
  const [contactEmail, setContactEmail] = useState(initialContactEmail || '');
  const [contactPhone, setContactPhone] = useState(initialContactPhone || '');
  const [assignedUserId, setAssignedUserId] = useState(initialAssignedUserId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setContactPerson(initialContactPerson || '');
      setContactEmail(initialContactEmail || '');
      setContactPhone(initialContactPhone || '');
      setAssignedUserId(initialAssignedUserId || '');
      setError('');
    }
  }, [isOpen, initialContactPerson, initialContactEmail, initialContactPhone, initialAssignedUserId]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/navigation/orders/${orderId}/contact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactPerson: contactPerson.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim(),
          assignedUserId: assignedUserId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se uložit kontaktní údaje.');
      }

      onSuccess(data.order);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání do CRM.');
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
              <User className="h-5 w-5 text-sky-600" /> Upravit kontaktní údaje
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Klient:{' '}
              <Link
                href={`/clients/${clientId}`}
                target="_blank"
                className="font-bold text-sky-700 hover:underline inline-flex items-center gap-1"
                title="Otevřít kartu klienta v CRM v novém okně"
              >
                {clientName} <ExternalLink size={11} />
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Jméno a příjmení kontaktní osoby
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                className="input pl-9 w-full"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Např. Daniel Tinz"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              E-mail
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                className="input pl-9 w-full"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="info@formfactory.cz"
              />
            </div>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Na tento e-mail se odesílají nabídky, schvalování grafiky i faktury.
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Telefon
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="tel"
                className="input pl-9 w-full"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+420 226 226 200"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Odpovědný obchodník
            </label>
            <select
              className="input w-full"
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
            >
              <option value="">-- Nepřiřazen --</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-3 text-emerald-950 text-xs flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-emerald-900 block">Automatická synchronizace s CRM</span>
              <p className="text-emerald-800 text-[11px] leading-relaxed">
                Po uložení se údaje okamžitě zapíšou přímo do <b>CRM na kartu klienta</b> i do této zakázky. Budoucí faktury a klientské e-maily již budou automaticky používat tyto nové údaje.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-sky-600 px-5 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? 'Ukládám do CRM...' : '💾 Uložit do CRM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
