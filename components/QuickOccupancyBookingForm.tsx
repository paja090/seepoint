'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarPlus,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  MapPin,
  User,
  Tag,
  DollarSign,
} from 'lucide-react';

type SurfaceOption = {
  id: string;
  name: string;
  mediaType: string;
  carrierCode: string;
  carrierCity: string;
  carrierName: string;
};

type ClientOption = {
  id: string;
  name: string;
};

export function QuickOccupancyBookingForm({
  surfaces,
  clients,
  currentUserName,
}: {
  surfaces: SurfaceOption[];
  clients: ClientOption[];
  currentUserName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [surfaceId, setSurfaceId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState<'RESERVED' | 'NEGOTIATION' | 'OCCUPIED'>('RESERVED');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [allowNegotiationConflict, setAllowNegotiationConflict] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setWarning('');
    setSuccess('');

    if (!surfaceId) {
      setError('Vyberte nosič a reklamní plochu.');
      setSubmitting(false);
      return;
    }

    if (!campaignName.trim()) {
      setError('Zadejte název kampaně.');
      setSubmitting(false);
      return;
    }

    const selectedClient = clients.find((c) => c.id === clientId);
    const finalClientName = selectedClient?.name || clientNameInput || 'Neuvedený klient';

    try {
      const res = await fetch('/api/occupancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surfaceId,
          clientId: clientId || null,
          clientName: finalClientName,
          campaignName,
          dateFrom,
          dateTo,
          status,
          price: price ? parseFloat(price) : null,
          note,
          createdBy: currentUserName || 'Obchodník',
          allowNegotiationConflict,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.warning) {
          setWarning(data.warning);
          setSubmitting(false);
          return;
        }
        throw new Error(data.error || 'Chyba při ukládání obsazenosti.');
      }

      setSuccess(`Kampaň "${campaignName}" byla úspěšně zaregistrována.`);
      setSubmitting(false);
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Uložení selhalo.');
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-sky-950 px-5 py-3 text-xs font-black text-white shadow-md hover:from-slate-800 hover:to-sky-900 active:scale-98 transition"
        >
          <CalendarPlus size={18} className="text-emerald-400" />
          <span>➕ Rychlá rezervace kampaně / Zadat obsazenost</span>
        </button>
      ) : (
        <div className="rounded-3xl border-2 border-sky-400/40 bg-white p-6 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <CalendarPlus size={20} className="text-sky-600" />
              <h3 className="text-lg font-black text-slate-900">Nová rezervace kampaně / Obsazenost</h3>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 text-xs font-bold"
            >
              Zrušit ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
            {/* Select Carrier / Surface */}
            <div className="lg:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin size={15} className="text-sky-600" />
                Vyberte nosič a reklamní plochu *
              </label>
              <select
                className="input w-full font-bold text-xs"
                value={surfaceId}
                onChange={(e) => setSurfaceId(e.target.value)}
                required
              >
                <option value="">-- Vyberte nosič ze seznamu --</option>
                {surfaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.carrierCode} · {s.carrierCity} — {s.carrierName} ({s.name} - {s.mediaType})
                  </option>
                ))}
              </select>
            </div>

            {/* Campaign Name */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Tag size={15} className="text-sky-600" />
                Název kampaně *
              </label>
              <input
                className="input w-full text-xs font-bold"
                placeholder="Např. Kampaň Jaro 2026 - Koupelny Ostrava"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                required
              />
            </div>

            {/* Select Client */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <User size={15} className="text-sky-600" />
                Klient (ze seznamu CRM nebo nový)
              </label>
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
                  placeholder="Nebo zadejte nový název klienta..."
                  value={clientNameInput}
                  onChange={(e) => setClientNameInput(e.target.value)}
                />
              )}
            </div>

            {/* Date From & Date To */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">Termín od (Začátek kampaně) *</label>
              <input
                type="date"
                className="input w-full text-xs font-bold"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">Termín do (Konec kampaně) *</label>
              <input
                type="date"
                className="input w-full text-xs font-bold"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                required
              />
            </div>

            {/* Status Selection */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800">Stav rezervace *</label>
              <select
                className="input w-full text-xs font-bold"
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="RESERVED">🟧 Rezervace (Předběžná blokace)</option>
                <option value="NEGOTIATION">🟦 V jednání (Nabídka odeslána)</option>
                <option value="OCCUPIED">🟥 Obsazeno / Schváleno (Smlouva podepsána)</option>
              </select>
            </div>

            {/* Price */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <DollarSign size={15} className="text-emerald-600" />
                Cena kampaně v Kč (bez DPH)
              </label>
              <input
                type="number"
                step="0.01"
                className="input w-full text-xs font-bold"
                placeholder="Např. 15000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>

            {/* Note */}
            <div className="lg:col-span-2 space-y-1">
              <label className="block text-xs font-bold text-slate-800">Poznámka k rezervaci</label>
              <textarea
                className="input w-full text-xs min-h-16"
                placeholder="Případné poznámky pro kolegyně a kolegy..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Error or Warning Alerts */}
            {error && (
              <div className="lg:col-span-2 rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800 flex items-center gap-2">
                <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {warning && (
              <div className="lg:col-span-2 rounded-2xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                  <span>{warning}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAllowNegotiationConflict(true);
                    setWarning('');
                  }}
                  className="rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-black text-white hover:bg-amber-500"
                >
                  Pokračovat a uložit i přes konflikt V jednání
                </button>
              </div>
            )}

            <div className="lg:col-span-2 flex gap-2 pt-2">
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
                {submitting ? 'Ukládám kampaně...' : ' Potvrdit rezervaci kampaně'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
