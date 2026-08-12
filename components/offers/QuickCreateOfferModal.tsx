'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Trash2, Calendar, User, DollarSign, Check, X, Sparkles } from 'lucide-react';
import { useOfferBasket } from '@/context/OfferBasketContext';

type QuickCreateOfferModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function QuickCreateOfferModal({ isOpen, onClose }: QuickCreateOfferModalProps) {
  const router = useRouter();
  const { selectedSurfaces, removeSurface, clearBasket, selectedCount } = useOfferBasket();

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMonthDate = new Date();
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonthStr = nextMonthDate.toISOString().slice(0, 10);

  const [campaignName, setCampaignName] = useState('Reklamní kampaň');
  const [clientName, setClientName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(nextMonthStr);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePriceChange = (surfaceId: string, value: number) => {
    setPrices((prev) => ({ ...prev, [surfaceId]: value }));
  };

  const calculateTotalMonthly = () => {
    return selectedSurfaces.reduce((sum, s) => {
      const p = prices[s.id] ?? s.price ?? 2000;
      return sum + p;
    }, 0);
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      setError('Zadejte prosím název klienta.');
      return;
    }
    if (selectedSurfaces.length === 0) {
      setError('Vyberte alespoň jednu reklamní plochu.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Create client if needed or find existing
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: campaignName || `Kampaň - ${clientName}`,
          clientName: clientName.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPerson: contactPerson.trim() || undefined,
          offerType: 'STANDARD_MEDIA',
          items: selectedSurfaces.map((s) => ({
            surfaceId: s.id,
            dateFrom,
            dateTo,
            price: prices[s.id] ?? s.price ?? 2000,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Vytvoření nabídky se nepodařilo.');
      }

      const createdOffer = await res.json();
      clearBasket();
      onClose();

      // Navigate to created offer detail
      router.push(`/offers/${createdOffer.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při vytváření nabídky.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-2xs">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Vytvořit Klientskou Nabídku</h2>
              <p className="text-xs text-slate-500 font-semibold">
                Vybráno {selectedCount} {selectedCount === 1 ? 'plocha' : 'ploch'} k sestavení nabízeného mediánu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 font-semibold flex items-center gap-2">
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleCreateOffer} className="space-y-5 text-xs">
          {/* Main Info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block mb-1 font-bold text-slate-700">
                Název klienta *
              </label>
              <input
                type="text"
                required
                placeholder="např. BauMax Ostrava"
                className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-900 focus:border-sky-500 focus:outline-hidden"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-700">
                Název kampaně
              </label>
              <input
                type="text"
                placeholder="např. Podzimní akce 2026"
                className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-900 focus:border-sky-500 focus:outline-hidden"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-700">
                E-mail kontaktní osoby
              </label>
              <input
                type="email"
                placeholder="marketing@baumax.cz"
                className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-900 focus:border-sky-500 focus:outline-hidden"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-1 font-bold text-slate-700">
                Jméno kontaktní osoby
              </label>
              <input
                type="text"
                placeholder="Jan Novák (vedoucí marketingu)"
                className="w-full rounded-xl border border-slate-300 p-2.5 font-semibold text-slate-900 focus:border-sky-500 focus:outline-hidden"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
          </div>

          {/* Campaign Dates */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
            <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <Calendar size={15} className="text-sky-600" />
              Plánovaný termín kampaně
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="block mb-1 text-[11px] font-semibold text-slate-500">Datum od</span>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-300 p-2 font-bold text-slate-900 bg-white"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <span className="block mb-1 text-[11px] font-semibold text-slate-500">Datum do</span>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-300 p-2 font-bold text-slate-900 bg-white"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Surface Items Breakdown Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-950">
                📋 Vybrané reklamní pozice ({selectedSurfaces.length})
              </span>
              <button
                type="button"
                onClick={clearBasket}
                className="text-[11px] font-bold text-rose-600 hover:underline"
              >
                Vyprázdnit seznam
              </button>
            </div>

            <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              {selectedSurfaces.map((s) => {
                const currentPrice = prices[s.id] ?? s.price ?? 2000;
                return (
                  <div key={s.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800 uppercase">
                          {s.carrierCode}
                        </span>
                        <strong className="truncate text-slate-950 font-bold">{s.name}</strong>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {s.carrierName} · {s.city}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold">Kč/měs:</span>
                        <input
                          type="number"
                          className="w-20 bg-transparent font-black text-slate-950 text-xs text-right outline-hidden"
                          value={currentPrice}
                          onChange={(e) => handlePriceChange(s.id, Number(e.target.value) || 0)}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSurface(s.id)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title="Odebrat z nabídky"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Total Summary */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-bold text-sky-800 uppercase">Celkový měsíční nájem</span>
              <p className="text-xl font-black text-sky-950">
                {calculateTotalMonthly().toLocaleString('cs-CZ')} Kč / měsíc
              </p>
            </div>
            <div className="text-right">
              <span className="block text-[11px] font-semibold text-sky-800">Počet ploch</span>
              <span className="font-extrabold text-sky-950">{selectedSurfaces.length} pozic</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 font-black text-white hover:bg-sky-700 transition shadow-md disabled:opacity-50"
            >
              <Sparkles size={16} />
              <span>{submitting ? 'Vytvářím nabídku...' : '🚀 Vygenerovat nabídku & Zobrazit PDF'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
