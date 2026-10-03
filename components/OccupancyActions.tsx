'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Occupancy, Surface } from '@/lib/types';
import { StatusBadge } from './StatusBadge';
import { CheckCircle2, Calendar, Clock, AlertCircle } from 'lucide-react';

export type SurfaceWithOccupancyInfo = {
  id: string;
  name: string;
  price?: number;
  status?: string;
  currentClient?: { id: string; name: string } | null;
  activeOccupancy?: Occupancy | null;
};

type ClientOption = { id: string; name: string };
type Conflict = {
  carrierCode: string;
  surfaceName: string;
  clientName: string;
  campaignName: string;
  dateFrom: string;
  dateTo: string;
  severity: 'block' | 'warning';
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(baseDateStr: string, days: number): string {
  const d = new Date(baseDateStr || today());
  if (Number.isNaN(d.getTime())) return today();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(baseDateStr: string, months: number): string {
  const d = new Date(baseDateStr || today());
  if (Number.isNaN(d.getTime())) return today();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function OccupancyActions({
  surfaces,
  clients,
  activeOccupancy: initialActiveOccupancy,
  selectedSurfaceId: externalSelectedSurfaceId,
  onSurfaceChange,
  isNavigation = false,
}: {
  surfaces: SurfaceWithOccupancyInfo[];
  clients: ClientOption[];
  activeOccupancy?: Occupancy;
  selectedSurfaceId?: string;
  onSurfaceChange?: (surfaceId: string) => void;
  isNavigation?: boolean;
}) {
  const router = useRouter();
  const [surfaceId, setSurfaceId] = useState(externalSelectedSurfaceId || surfaces[0]?.id || '');

  // Synchronize when external surface changes (e.g. from parent surface tab)
  useEffect(() => {
    if (externalSelectedSurfaceId && externalSelectedSurfaceId !== surfaceId) {
      setSurfaceId(externalSelectedSurfaceId);
    }
  }, [externalSelectedSurfaceId, surfaceId]);

  const currentSurface = surfaces.find((s) => s.id === surfaceId) || surfaces[0];
  const activeOccupancy = currentSurface?.activeOccupancy ?? (surfaceId === surfaces[0]?.id ? initialActiveOccupancy : undefined);

  const [bookingStatus, setBookingStatus] = useState<'OCCUPIED' | 'RESERVED' | 'NEGOTIATION'>('OCCUPIED');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [dateFrom, setDateFrom] = useState(today());
  // Standard OOH campaign duration is 1 month; navigation default is 1 year
  const [dateTo, setDateTo] = useState(isNavigation ? addMonths(today(), 12) : addMonths(today(), 1));
  const [price, setPrice] = useState(currentSurface?.price?.toString() ?? '');
  const [message, setMessage] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [saving, setSaving] = useState(false);

  // When selected surface changes, update default price and dates
  const handleSurfaceSelect = (nextSurfaceId: string) => {
    setSurfaceId(nextSurfaceId);
    onSurfaceChange?.(nextSurfaceId);
    const target = surfaces.find((s) => s.id === nextSurfaceId);
    setPrice(target?.price?.toString() ?? '');
    setMessage('');
    setConflicts([]);
    if (target?.activeOccupancy?.dateTo) {
      setDateTo(target.activeOccupancy.dateTo);
    } else {
      setDateTo(isNavigation ? addMonths(dateFrom, 12) : addMonths(dateFrom, 1));
    }
  };

  const isDateInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  async function parseResponse(response: Response) {
    const data = (await response.json()) as { error?: string; warning?: string; conflicts?: Conflict[] };
    setConflicts(data.conflicts ?? []);
    if (!response.ok) throw new Error(data.error || data.warning || 'Akci se nepodařilo uložit.');
    return data;
  }

  async function createReservation(allowNegotiationConflict = false) {
    if (isDateInvalid) {
      setMessage('⚠️ Datum konce (Do) musí být stejné nebo po datu začátku (Od).');
      return;
    }
    setSaving(true);
    setMessage('');
    setConflicts([]);
    try {
      const finalClientName = clientName.trim() || 'Klient';
      const finalCampaignName = campaignName.trim() || (bookingStatus === 'OCCUPIED' ? `Kampaň – ${finalClientName}` : `Rezervace – ${finalClientName}`);

      const response = await fetch('/api/occupancy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surfaceId,
          clientId: clientId ? clientId.trim() : undefined,
          clientName: finalClientName,
          campaignName: finalCampaignName,
          dateFrom,
          dateTo,
          status: bookingStatus,
          price: price ? Number(price) : undefined,
          createdBy: 'SALES',
          allowNegotiationConflict,
        }),
      });
      await parseResponse(response);
      setMessage(
        bookingStatus === 'OCCUPIED'
          ? '✓ Plocha byla úspěšně označena jako OBSAZENÁ.'
          : bookingStatus === 'RESERVED'
          ? '✓ Rezervace plochy byla úspěšně uložena.'
          : '✓ Jednání bylo úspěšně uloženo.'
      );
      router.refresh();
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rezervaci se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: 'extend' | 'finish' | 'free') {
    if (!activeOccupancy) return;
    setSaving(true);
    setMessage('');
    setConflicts([]);
    try {
      const response = await fetch('/api/occupancy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeOccupancy.id, action, dateTo, updatedBy: 'SALES' }),
      });
      await parseResponse(response);
      setMessage(
        action === 'extend'
          ? '✓ Kampaň byla úspěšně prodloužena.'
          : action === 'finish'
          ? '✓ Kampaň byla ukončena.'
          : '✓ Plocha byla úspěšně uvolněna (označena jako volná).'
      );
      router.refresh();
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Akci se nepodařilo uložit.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 shadow-xs space-y-4">
      {/* 🧭 Multi-surface header switcher if multiple surfaces exist */}
      {surfaces.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
              Zvolená plocha nosiče pro akci:
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {surfaces.map((s) => {
                const isSelected = s.id === surfaceId;
                const isOcc = s.activeOccupancy?.status === 'OCCUPIED' || s.status === 'OCCUPIED';
                const isRes = s.activeOccupancy?.status === 'RESERVED' || s.status === 'RESERVED';

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSurfaceSelect(s.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                    }`}
                  >
                    <span>{s.name}</span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        isOcc
                          ? isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : isRes
                          ? isSelected ? 'bg-amber-400 text-slate-950' : 'bg-amber-100 text-amber-900 border border-amber-300'
                          : isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isOcc ? 'Obsazeno' : isRes ? 'Rezervace' : 'Volná'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase block">Aktuální stav plochy</span>
            {activeOccupancy ? (
              <StatusBadge value={activeOccupancy.status} />
            ) : (
              <StatusBadge value="AVAILABLE" />
            )}
          </div>
        </div>
      )}

      {/* 📋 Active occupancy management actions if surface is currently occupied or reserved */}
      {activeOccupancy ? (
        <div className="rounded-2xl border border-emerald-300/80 bg-emerald-50/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                Aktivní nájem plochy {currentSurface?.name}: {activeOccupancy.clientName}
              </h4>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-900 bg-white/80 px-2.5 py-0.5 rounded-lg border border-emerald-200">
              {activeOccupancy.dateFrom} – {activeOccupancy.dateTo}
            </span>
          </div>

          <div className="grid gap-2 text-xs sm:grid-cols-2 text-slate-800">
            <p><b>Klient:</b> {activeOccupancy.clientName}</p>
            <p><b>Kampaň:</b> {activeOccupancy.campaignName}</p>
            {activeOccupancy.price && <p><b>Cena:</b> {activeOccupancy.price.toLocaleString('cs-CZ')} Kč/měs.</p>}
            {activeOccupancy.note && <p className="sm:col-span-2 text-slate-600 italic"><b>Poznámka:</b> {activeOccupancy.note}</p>}
          </div>

          {/* Quick extension / termination buttons */}
          <div className="pt-2 border-t border-emerald-200/80 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-bold text-slate-600 uppercase">Prodloužit do:</span>
              <input
                type="date"
                className="rounded-lg border border-slate-300 bg-white p-1 text-xs font-mono"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void runAction('extend')}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 text-xs shadow-xs transition cursor-pointer"
            >
              ✓ Prodloužit
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void runAction('finish')}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 text-xs shadow-xs transition cursor-pointer"
              title="Ukončí kampaň k dnešnímu dni"
            >
              Ukončit kampaň
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void runAction('free')}
              className="rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold px-3 py-1.5 text-xs transition cursor-pointer"
              title="Označí plochu ihned jako volnou k okamžité rezervaci"
            >
              🚪 Uvolnit plochu (Označit jako volné)
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>Plocha <strong>{currentSurface?.name}</strong> je volná k okamžité rezervaci nebo obsazení novým klientem.</span>
        </div>
      )}

      {/* 📝 Booking / Reservation Form */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
            {activeOccupancy ? 'Nová budoucí rezervace na tuto plochu' : 'Zadat obsazenost / rezervaci plochy'}
          </h4>

          {/* Status selector (OCCUPIED vs RESERVED vs NEGOTIATION) */}
          <div className="flex rounded-xl bg-slate-200/80 p-0.5 text-2xs font-extrabold">
            <button
              type="button"
              onClick={() => setBookingStatus('OCCUPIED')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                bookingStatus === 'OCCUPIED'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              🟢 Obsazeno
            </button>
            <button
              type="button"
              onClick={() => setBookingStatus('RESERVED')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                bookingStatus === 'RESERVED'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              🟡 Rezervace
            </button>
            <button
              type="button"
              onClick={() => setBookingStatus('NEGOTIATION')}
              className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                bookingStatus === 'NEGOTIATION'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-700 hover:text-slate-950'
              }`}
            >
              🔵 V jednání
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 text-xs">
          {surfaces.length > 1 && (
            <label>
              <span className="mb-1 block font-bold uppercase tracking-wide text-slate-600 text-[11px]">Reklamní plocha</span>
              <select
                className="input w-full"
                value={surfaceId}
                onChange={(event) => handleSurfaceSelect(event.target.value)}
              >
                {surfaces.map((surface) => (
                  <option key={surface.id} value={surface.id}>
                    {surface.name} {surface.activeOccupancy ? `(Obsazeno: ${surface.activeOccupancy.clientName})` : '(Volná)'}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={surfaces.length === 1 ? 'md:col-span-2' : ''}>
            <span className="mb-1 block font-bold uppercase tracking-wide text-slate-600 text-[11px]">Klient *</span>
            <input
              className="input w-full"
              list="occupancy-action-clients"
              placeholder="Začněte psát název klienta..."
              value={clientName}
              onChange={(event) => {
                const val = event.target.value;
                setClientName(val);
                const matched = clients.find((c) => c.name.toLowerCase() === val.trim().toLowerCase());
                setClientId(matched ? matched.id : '');
                if (!campaignName || campaignName.startsWith('Kampaň –') || campaignName.startsWith('Rezervace –')) {
                  setCampaignName(bookingStatus === 'OCCUPIED' ? `Kampaň – ${val}` : `Rezervace – ${val}`);
                }
              }}
            />
            <datalist id="occupancy-action-clients">
              {clients.map((client) => (
                <option key={client.id} value={client.name} />
              ))}
            </datalist>
          </label>

          <label className="md:col-span-2">
            <span className="mb-1 block font-bold uppercase tracking-wide text-slate-600 text-[11px]">Název kampaně / motiv</span>
            <input
              className="input w-full"
              value={campaignName}
              placeholder="např. Jarní kampaň 2026"
              onChange={(event) => setCampaignName(event.target.value)}
            />
          </label>

          {/* Dates & Quick Duration Presets */}
          <div className="space-y-1">
            <span className="block font-bold uppercase tracking-wide text-slate-600 text-[11px]">Termín od *</span>
            <input
              className="input w-full font-mono"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                const newFrom = event.target.value;
                setDateFrom(newFrom);
                if (newFrom && (!dateTo || dateTo < newFrom)) {
                  setDateTo(isNavigation ? addMonths(newFrom, 12) : addMonths(newFrom, 1));
                }
              }}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wide text-slate-600 text-[11px]">Termín do *</span>
              {/* Presets: 14 days, 1 month (standard OOH), 3 months, 1 year */}
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setDateTo(addDays(dateFrom, 14))}
                  className="rounded-md bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 font-bold text-slate-700 transition"
                  title="14 dní (čtrnáctideník)"
                >
                  +14 dní
                </button>
                <button
                  type="button"
                  onClick={() => setDateTo(addMonths(dateFrom, 1))}
                  className="rounded-md bg-sky-100 hover:bg-sky-200 px-1.5 py-0.5 font-extrabold text-sky-900 border border-sky-300 transition"
                  title="1 měsíc (standardní měsíční kampaň pro billboardy a lavičky)"
                >
                  +1 měsíc
                </button>
                <button
                  type="button"
                  onClick={() => setDateTo(addMonths(dateFrom, 3))}
                  className="rounded-md bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 font-bold text-slate-700 transition"
                  title="3 měsíce (čtvrtletí)"
                >
                  +3 měs.
                </button>
                <button
                  type="button"
                  onClick={() => setDateTo(addMonths(dateFrom, 12))}
                  className="rounded-md bg-slate-200 hover:bg-slate-300 px-1.5 py-0.5 font-bold text-slate-700 transition"
                  title="1 rok (dlouhodobý pronájem pro navigace a celoroční plochy)"
                >
                  +1 rok
                </button>
              </div>
            </div>
            <input
              className={`input w-full font-mono ${isDateInvalid ? 'border-rose-500 bg-rose-50 text-rose-900' : ''}`}
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>

          {isDateInvalid && (
            <p className="md:col-span-2 text-rose-600 font-bold text-xs flex items-center gap-1">
              <AlertCircle size={14} /> Datum konce (Do) musí být stejné nebo po datu začátku (Od).
            </p>
          )}

          <label className="md:col-span-2">
            <span className="mb-1 block font-bold uppercase tracking-wide text-slate-600 text-[11px]">Cena za měsíc bez DPH (Kč)</span>
            <input
              className="input w-full"
              inputMode="decimal"
              placeholder="např. 3500"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
          <button
            className={`flex items-center gap-1.5 font-black text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 ${
              bookingStatus === 'OCCUPIED'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : bookingStatus === 'RESERVED'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
            type="button"
            disabled={saving || !surfaceId || !clientName.trim() || !dateFrom || !dateTo || isDateInvalid}
            onClick={() => void createReservation()}
          >
            {saving ? (
              'Ukládám…'
            ) : bookingStatus === 'OCCUPIED' ? (
              <>
                <CheckCircle2 size={16} /> Zadat jako OBSAZENÉ (Obsadit plochu)
              </>
            ) : bookingStatus === 'RESERVED' ? (
              <>
                <Clock size={16} /> Vytvořit rezervaci plochy
              </>
            ) : (
              <>
                <Calendar size={16} /> Zapsat jednání o ploše
              </>
            )}
          </button>
        </div>

        {conflicts.some((conflict) => conflict.severity === 'warning') && (
          <button
            className="mt-2 text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-3.5 py-2 rounded-xl hover:bg-amber-200 transition cursor-pointer"
            type="button"
            disabled={saving}
            onClick={() => void createReservation(true)}
          >
            Pokračovat a potvrdit i přes probíhající jednání
          </button>
        )}

        {message && (
          <p
            className={`mt-3 text-xs font-bold p-3 rounded-xl border ${
              message.startsWith('✓')
                ? 'text-emerald-900 bg-emerald-50 border-emerald-300'
                : 'text-rose-900 bg-rose-50 border-rose-300'
            }`}
            aria-live="polite"
          >
            {message}
          </p>
        )}

        {conflicts.length > 0 && (
          <div className="mt-3 space-y-2">
            <span className="text-2xs font-black uppercase text-rose-700 tracking-wider">
              Zjištěné termínové kolize:
            </span>
            {conflicts.map((conflict) => (
              <div
                className="rounded-xl border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-900 font-medium"
                key={`${conflict.carrierCode}-${conflict.surfaceName}-${conflict.dateFrom}`}
              >
                <b>{conflict.carrierCode} – {conflict.surfaceName}</b>: Klient {conflict.clientName}, kampaň &quot;{conflict.campaignName}&quot; ({conflict.dateFrom} – {conflict.dateTo})
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
