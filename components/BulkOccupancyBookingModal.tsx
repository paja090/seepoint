'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, CheckCircle2, ShieldAlert, X, Calendar, User, Tag, MapPin } from 'lucide-react';

type SurfaceInfo = {
  id: string;
  name: string;
  carrierCode: string;
  carrierCity: string;
  carrierName: string;
};

type ClientOption = {
  id: string;
  name: string;
};

export function BulkOccupancyBookingModal({
  selectedSurfaces,
  clients,
  onClearSelection,
}: {
  selectedSurfaces: SurfaceInfo[];
  clients: ClientOption[];
  onClearSelection: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [clientId, setClientId] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState<'RESERVED' | 'OCCUPIED' | 'NEGOTIATION'>('RESERVED');
  const [totalPrice, setTotalPrice] = useState('');
  const [note, setNote] = useState('');

  if (selectedSurfaces.length === 0) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!campaignName.trim()) {
      setError('Vyplňte název kampaně.');
      setSubmitting(false);
      return;
    }

    const selectedClient = clients.find((c) => c.id === clientId);
    const finalClientName = selectedClient?.name || clientNameInput || 'Neuvedený klient';

    try {
      const res = await fetch('/api/occupancy/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surfaceIds: selectedSurfaces.map((s) => s.id),
          clientId: clientId || null,
          clientName: finalClientName,
          campaignName,
          dateFrom,
          dateTo,
          status,
          price: totalPrice ? parseFloat(totalPrice) : null,
          note,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Hromadné obsazení selhalo.');

      setSuccess(`Úspěšně obsazeno ${selectedSurfaces.length} ploch pro kampaň "${campaignName}".`);
      setSubmitting(false);
      setOpen(false);
      onClearSelection();
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Uložení selhalo.');
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Sticky Bottom Action Bar for Salespeople */}
      <div className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-4xl rounded-3xl bg-slate-950 px-6 py-4 text-white shadow-2xl border border-slate-800 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-slate-950 font-black">
            <Zap size={22} />
          </div>
          <div>
            <p className="text-sm font-black">
              Vybráno {selectedSurfaces.length} reklamních ploch pro kampaň
            </p>
            <p className="text-xs text-slate-400 font-medium">
              Excel-style hromadné osazení jedním kliknutím
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClearSelection}
            className="rounded-xl px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900"
          >
            Zrušit výprodej
          </button>
          <a
            href={`/work?carrierCode=${encodeURIComponent(selectedSurfaces.map((s) => s.carrierCode).join(', '))}&quantity=${selectedSurfaces.length}&title=${encodeURIComponent(`Hromadná montáž kampaně (${selectedSurfaces.length} ks nosičů)`)}`}
            className="flex items-center gap-1.5 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-500 active:scale-95 transition"
            title="Naplánovat 1 celistvou zakázku pro celou kampaň v Plánu práce"
          >
            <span>🚗 Hromadná montáž ({selectedSurfaces.length} ks)</span>
          </a>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-2.5 text-xs font-black text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition"
          >
            <Zap size={16} />
            <span>⚡ Hromadně obsadit ({selectedSurfaces.length} ks)</span>
          </button>
        </div>
      </div>

      {/* Modal Popup */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Zap size={22} className="text-emerald-600" />
                <h3 className="text-lg font-black text-slate-950">
                  Hromadné obsazení kampaně ({selectedSurfaces.length} vybraných ploch)
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 p-1"
              >
                ✕
              </button>
            </div>

            {/* List of Selected Surfaces */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-1.5 max-h-36 overflow-y-auto">
              <p className="text-xs font-bold text-slate-700">Vybrané nosiče a plochy:</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedSurfaces.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-900"
                  >
                    <MapPin size={12} className="text-sky-600" />
                    {s.carrierCode} ({s.carrierCity}) — {s.name}
                  </span>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              {/* Campaign Name */}
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-slate-800">Název kampaně *</label>
                <input
                  className="input w-full text-xs font-bold"
                  placeholder="Např. Celostátní kampaň Jaro 2026 - Kaufland"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  required
                />
              </div>

              {/* Client Selection */}
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-slate-800">Klient</label>
                <select
                  className="input w-full text-xs font-semibold"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">-- Vyberte klienta z CRM --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {!clientId && (
                  <input
                    className="input mt-1 w-full text-xs"
                    placeholder="Nebo vepište jméno klienta..."
                    value={clientNameInput}
                    onChange={(e) => setClientNameInput(e.target.value)}
                  />
                )}
              </div>

              {/* Dates */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">Začátek kampaně (Od) *</label>
                <input
                  type="date"
                  className="input w-full text-xs font-bold"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">Konec kampaně (Do) *</label>
                <input
                  type="date"
                  className="input w-full text-xs font-bold"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  required
                />
              </div>

              {/* Status */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">Stav kampaně *</label>
                <select
                  className="input w-full text-xs font-bold"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="RESERVED">🟧 Rezervace (Předběžná blokace)</option>
                  <option value="OCCUPIED">🟥 Obsazeno / Schváleno (Smlouva podepsána)</option>
                  <option value="NEGOTIATION">🟦 V jednání (Nabídka odeslána)</option>
                </select>
              </div>

              {/* Total Price */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800">Celková cena za všechny plochy (Kč)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input w-full text-xs font-bold"
                  placeholder="Např. 120000"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                />
              </div>

              {/* Note */}
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-slate-800">Poznámka</label>
                <textarea
                  className="input w-full text-xs min-h-16"
                  placeholder="Poznámky k hromadné rezervaci..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {error && (
                <div className="sm:col-span-2 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-2xl bg-slate-100 py-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-2 rounded-2xl bg-emerald-600 py-3 text-xs font-black text-white shadow-lg hover:bg-emerald-500 active:scale-98 transition disabled:opacity-50"
                >
                  {submitting ? 'Ukládám kampaně...' : `⚡ Obsadit všech ${selectedSurfaces.length} ploch`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
