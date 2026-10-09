'use client';

import React, { useState, useEffect } from 'react';
import { X, Building2, CreditCard, MapPin, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export interface CompanySettingsForm {
  name: string;
  companyId: string;
  vatId: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  bankAccount: string;
  iban: string;
  swift: string;
}

interface QuickCompanySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields?: string[];
  initialData?: Partial<CompanySettingsForm>;
  onSuccess?: () => Promise<void> | void;
  actionLabel?: string;
}

export function QuickCompanySettingsModal({
  isOpen,
  onClose,
  missingFields = [],
  initialData,
  onSuccess,
  actionLabel = 'Uložit údaje a vystavit fakturu',
}: QuickCompanySettingsModalProps) {
  const [form, setForm] = useState<CompanySettingsForm>({
    name: '',
    companyId: '',
    vatId: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'CZ',
    bankAccount: '',
    iban: '',
    swift: '',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing settings when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    if (initialData && Object.keys(initialData).length > 0) {
      setForm((prev) => ({
        ...prev,
        ...initialData,
      }));
    } else {
      setLoading(true);
      fetch('/api/settings/company')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setForm({
              name: data.name || '',
              companyId: data.companyId || '',
              vatId: data.vatId || '',
              street: data.street || '',
              city: data.city || '',
              postalCode: data.postalCode || '',
              country: data.country || 'CZ',
              bankAccount: data.bankAccount || '',
              iban: data.iban || '',
              swift: data.swift || '',
            });
          }
        })
        .catch(() => {
          // Ignore fetch error, keep empty form
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const isFieldMissing = (fieldKeyword: string) => {
    return missingFields.some((mf) => mf.toLowerCase().includes(fieldKeyword.toLowerCase()));
  };

  const isIcoMissing = isFieldMissing('IČO') || isFieldMissing('ico');
  const isAddressMissing = isFieldMissing('adresa') || isFieldMissing('ulice') || isFieldMissing('město');
  const isBankMissing = isFieldMissing('účet') || isFieldMissing('iban') || isFieldMissing('bankovní');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        companyId: form.companyId.trim(),
        vatId: form.vatId.trim() || null,
        street: form.street.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
        country: (form.country || 'CZ').trim().toUpperCase(),
        bankAccount: form.bankAccount.trim() || null,
        iban: form.iban.trim() || null,
        swift: form.swift.trim() || null,
      };

      if (!payload.name) throw new Error('Zadejte název dodavatele / firmy.');
      if (!payload.companyId) throw new Error('Zadejte IČO dodavatele.');
      if (!payload.street || !payload.city || !payload.postalCode) {
        throw new Error('Zadejte úplnou fakturační adresu (ulice, město, PSČ).');
      }
      if (!payload.bankAccount && !payload.iban) {
        throw new Error('Zadejte číslo bankovního účtu nebo IBAN.');
      }

      const res = await fetch('/api/settings/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Uložení firemních údajů selhalo.');
      }

      // If action callback provided, execute it (e.g. trigger invoice generation)
      if (onSuccess) {
        await onSuccess();
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání údajů.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Doplnit firemní údaje dodavatele</h2>
              <p className="text-xs text-slate-500">
                Nastavení údajů organizace pro faktury a oficiální doklady
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning badge if specific fields were reported missing */}
        {missingFields.length > 0 && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <span className="font-bold">Systém vyžaduje doplnění následujících položek: </span>
              <span className="font-medium">{missingFields.join(', ')}</span>
            </div>
          </div>
        )}

        {/* Form Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-sky-600 mb-2" />
            <span className="text-xs">Načítám firemní profil…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {/* Základní identifikace */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Obchodní název firmy *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="např. SeePOINT s.r.o."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>IČO *</span>
                  {isIcoMissing && !form.companyId && (
                    <span className="text-[10px] text-amber-600 font-bold">Chybí</span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  placeholder="12345678"
                  className={`w-full rounded-xl border px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-1 ${
                    isIcoMissing && !form.companyId
                      ? 'border-amber-400 bg-amber-50/30 focus:border-amber-500 focus:ring-amber-500'
                      : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  DIČ (pokud jste plátce)
                </label>
                <input
                  type="text"
                  value={form.vatId}
                  onChange={(e) => setForm({ ...form, vatId: e.target.value })}
                  placeholder="CZ12345678"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            {/* Sídlo / Adresa */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <MapPin className="h-4 w-4 text-slate-500" />
                <span>Sídlo a fakturační adresa</span>
                {isAddressMissing && (!form.street || !form.city || !form.postalCode) && (
                  <span className="text-[10px] text-amber-600 font-bold ml-auto">Vyžaduje doplnění</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Ulice a č.p. *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.street}
                    onChange={(e) => setForm({ ...form, street: e.target.value })}
                    placeholder="Vodičkova 123/4"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Město *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Praha"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    PSČ *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="110 00"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Bankovní spojení */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <CreditCard className="h-4 w-4 text-slate-500" />
                <span>Bankovní spojení pro úhrady</span>
                {isBankMissing && !form.bankAccount && !form.iban && (
                  <span className="text-[10px] text-amber-600 font-bold ml-auto">Vyžaduje doplnění</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Číslo účtu / kód banky *
                  </label>
                  <input
                    type="text"
                    value={form.bankAccount}
                    onChange={(e) => setForm({ ...form, bankAccount: e.target.value })}
                    placeholder="123456789/0800"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    IBAN (mezinárodní formát)
                  </label>
                  <input
                    type="text"
                    value={form.iban}
                    onChange={(e) => setForm({ ...form, iban: e.target.value })}
                    placeholder="CZ6508000000001234567890"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Ukládám a vystavuji…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{actionLabel}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
