'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, Plus, Calendar, DollarSign, Gauge, Check, Loader2, FileText, AlertCircle } from 'lucide-react';

interface ServiceRecord {
  id: string;
  date: Date | string;
  title: string;
  description?: string | null;
  cost?: number | string | null;
  mileage?: number | null;
  nextServiceDate?: Date | string | null;
}

interface VehicleServiceManagerProps {
  vehicleId: string;
  serviceRecords: ServiceRecord[];
}

export function VehicleServiceManager({ vehicleId, serviceRecords }: VehicleServiceManagerProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [mileage, setMileage] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextServiceDate, setNextServiceDate] = useState('');

  // Presets for quick service logging
  const quickPresets = [
    '🛢️ Výměna oleje a filtrů',
    '🛞 Přezutí pneumatik (Zimní/Letní)',
    '🛑 Brzdy - kotouče a destičky',
    '🔍 Garanční / Pravidelná prohlídka',
    '❄️ Doplnění a dezinfekce klimatizace',
    '🔧 Oprava podvozku / čepy',
  ];

  const totalServiceCost = serviceRecords.reduce((sum, r) => sum + (r.cost ? Number(r.cost) : 0), 0);
  const maxMileage = serviceRecords.reduce((max, r) => (r.mileage && r.mileage > max ? r.mileage : max), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          cost: cost ? parseFloat(cost) : null,
          mileage: mileage ? parseInt(mileage, 10) : null,
          date,
          nextServiceDate: nextServiceDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Záznam se nepodařilo uložit.');
      }

      setIsOpen(false);
      setTitle('');
      setDescription('');
      setCost('');
      setMileage('');
      setNextServiceDate('');

      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Chyba při ukládání.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mt-6 border-slate-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-sky-600" />
            <span>Servisní knížka, Olej & Historie oprav</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Evidence výměn oleje, garančních prohlídek, přezouvání pneu a oprav závad.
          </p>
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-4 py-2 text-xs font-black text-white hover:bg-sky-800 transition shadow-sm"
        >
          <Plus size={14} />
          <span>🔧 + Zaznamenat servis / výměnu oleje</span>
        </button>
      </div>

      {/* Summary Stat Bar */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 mb-4">
        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-500">Celkové náklady na servis</span>
          <p className="text-base font-black text-slate-900">{totalServiceCost.toLocaleString('cs-CZ')} Kč</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
          <span className="text-[10px] font-bold uppercase text-slate-500">Zaznamenaný stav tachometru</span>
          <p className="text-base font-black text-slate-900">{maxMileage > 0 ? `${maxMileage.toLocaleString('cs-CZ')} km` : '—'}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 border border-slate-200 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase text-slate-500">Počet úkonů</span>
          <p className="text-base font-black text-sky-900">{serviceRecords.length} záznamů</p>
        </div>
      </div>

      {/* Timeline List */}
      {serviceRecords.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          Zatím nebyly k tomuto vozidlu zadané žádné servisní zásahy ani výměny oleje.
          <br />
          Klikněte nahoře na <strong>+ Zaznamenat servis</strong> a přidejte prvotní výměnu oleje nebo opravu.
        </div>
      ) : (
        <div className="relative border-l-2 border-slate-200 ml-3 pl-4 space-y-4 my-2">
          {serviceRecords.map((record) => {
            const recDate = new Date(record.date).toLocaleDateString('cs-CZ');
            const isOilChange = record.title.toLowerCase().includes('olej');
            return (
              <div key={record.id} className="relative group">
                {/* Bullet dot */}
                <div className={`absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-2xs ${
                  isOilChange ? 'bg-amber-500 ring-2 ring-amber-200' : 'bg-sky-600'
                }`} />

                <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs hover:shadow-md transition">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-black text-slate-900 text-sm block">
                        {record.title}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        🗓️ {recDate} {record.mileage && `· 🛣️ ${record.mileage.toLocaleString('cs-CZ')} km`}
                      </span>
                    </div>

                    {record.cost && (
                      <span className="font-extrabold text-xs text-slate-900 bg-emerald-50 text-emerald-950 border border-emerald-200 px-2.5 py-1 rounded-xl">
                        {Number(record.cost).toLocaleString('cs-CZ')} Kč
                      </span>
                    )}
                  </div>

                  {record.description && (
                    <p className="mt-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-xl font-medium">
                      {record.description}
                    </p>
                  )}

                  {record.nextServiceDate && (
                    <div className="mt-2 text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block">
                      ⚠️ Doporučený příští servis / olej: {new Date(record.nextServiceDate).toLocaleDateString('cs-CZ')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Service Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="card w-full max-w-lg bg-white shadow-2xl rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">🔧 Záznam o servisu / opravě</h3>
                <p className="text-xs text-slate-500">Přidat servisní úkon, výměnu oleje nebo opravu závady</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3">
                ⚠️ {error}
              </div>
            )}

            {/* Quick Presets */}
            <div className="mb-4">
              <span className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1.5">Rychlé šablony úkonu:</span>
              <div className="flex flex-wrap gap-1.5">
                {quickPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTitle(preset)}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-sky-100 hover:text-sky-900 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <label className="block font-bold text-slate-700">
                Název servisu / Úkon *
                <input
                  required
                  className="input mt-1 w-full text-xs font-normal"
                  placeholder="např. Výměna oleje a filtrů"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <div className="grid gap-3 grid-cols-2">
                <label className="font-bold text-slate-700">
                  Datum provedení *
                  <input
                    type="date"
                    required
                    className="input mt-1 w-full text-xs font-normal"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Cena v Kč (nepovinné)
                  <input
                    type="number"
                    step="0.01"
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="např. 3500"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-3 grid-cols-2">
                <label className="font-bold text-slate-700">
                  Stav tachometru (km)
                  <input
                    type="number"
                    className="input mt-1 w-full text-xs font-normal"
                    placeholder="např. 185000"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                  />
                </label>

                <label className="font-bold text-slate-700">
                  Příští servis / výměna oleje do
                  <input
                    type="date"
                    className="input mt-1 w-full text-xs font-normal"
                    value={nextServiceDate}
                    onChange={(e) => setNextServiceDate(e.target.value)}
                  />
                </label>
              </div>

              <label className="block font-bold text-slate-700">
                Detailní popis / Vyměněné díly / Značka oleje
                <textarea
                  rows={2}
                  className="input mt-1 w-full text-xs font-normal"
                  placeholder="např. Olej Castrol Edge 5W-30 (4.5l), vyměněn filtr olejový i kabinový."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={loading || isPending}
                  className="flex items-center gap-1.5 rounded-xl bg-sky-700 px-5 py-2 text-xs font-black text-white hover:bg-sky-800 transition shadow-md disabled:opacity-50"
                >
                  {loading || isPending ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
                  <span>Uložit servisní záznam</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
