'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Route,
  Car,
  Clock,
  Calendar,
  MapPin,
  ChevronRight,
  User,
  Navigation,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { formatWorkDate } from '@/lib/work';
import type { WorkOrderRouteInfo } from '@/lib/field-planning/order-route-mapper';
import { WorkOrderLocationPickerModal } from './WorkOrderLocationPickerModal';

export type WorkOrderDispatchCardProps = {
  orderId: string;
  orderTitle: string;
  scheduledAt: string;
  locationNote?: string | null;
  clientName: string;
  carrierCode?: string | null;
  carrierCity?: string | null;
  isWorkshop?: boolean;
  routeInfo?: WorkOrderRouteInfo | null;
  canManageDispatch?: boolean;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialLocationAddress?: string | null;
};

export function WorkOrderDispatchCard({
  orderId,
  orderTitle,
  scheduledAt,
  locationNote,
  clientName,
  carrierCode,
  carrierCity,
  isWorkshop = false,
  routeInfo,
  canManageDispatch = true,
  initialLatitude,
  initialLongitude,
  initialLocationAddress,
}: WorkOrderDispatchCardProps) {
  const router = useRouter();
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [coords, setCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
    address?: string | null;
  }>({
    latitude: initialLatitude ?? null,
    longitude: initialLongitude ?? null,
    address: initialLocationAddress ?? null,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const dateObj = new Date(scheduledAt);
  const dateIso = !Number.isNaN(dateObj.getTime())
    ? dateObj.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const formattedDate = formatWorkDate(scheduledAt);

  const hasGps = coords.latitude !== null && coords.longitude !== null;

  const handleLocationSaved = (saved: {
    latitude: number | null;
    longitude: number | null;
    address?: string | null;
  }) => {
    setCoords(saved);
    if (saved.latitude && saved.longitude) {
      setToastMessage('GPS poloha byla úspěšně uložena a dispečink ji nyní může zařadit do trasy.');
    } else {
      setToastMessage('GPS poloha byla ze zakázky odstraněna.');
    }
    setTimeout(() => setToastMessage(null), 5000);
    router.refresh();
  };

  // Status labels for FieldPlan
  const planStatusLabels: Record<string, { label: string; style: string }> = {
    APPROVED: { label: 'Schválená trasa', style: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    ACTIVE: { label: 'Výjezd probíhá', style: 'bg-sky-100 text-sky-800 border-sky-300 animate-pulse' },
    COMPLETED: { label: 'Výjezd dokončen', style: 'bg-slate-100 text-slate-700 border-slate-300' },
    DRAFT: { label: 'Návrh trasy', style: 'bg-amber-100 text-amber-800 border-amber-300' },
  };

  // Case 1: Order is assigned to a field route plan
  if (routeInfo) {
    const statusMeta = planStatusLabels[routeInfo.planStatus] || {
      label: routeInfo.planStatus,
      style: 'bg-sky-100 text-sky-800 border-sky-300',
    };

    return (
      <>
        <section className="rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/70 via-white to-sky-50/40 p-5 sm:p-6 shadow-sm space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Route size={16} />
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                  Dispečink výjezdů & Plánovaná trasa
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 mt-1 flex flex-wrap items-center gap-2">
                <span>Zastávka #{routeInfo.routeOrder} v trase výjezdu</span>
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${statusMeta.style}`}>
                  {statusMeta.label}
                </span>
              </h2>
            </div>

            {/* Quick Route Link */}
            <Link
              href={`/work/route?date=${routeInfo.planDate}&id=${routeInfo.planId}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500 transition shadow-sm shrink-0"
            >
              <Navigation size={14} />
              <span>Spustit trasu výjezdu ↗</span>
            </Link>
          </div>

          {/* Route Details Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="rounded-2xl border border-emerald-200/80 bg-white p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Datum výjezdu
              </span>
              <strong className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Calendar size={14} className="text-emerald-600 shrink-0" />
                <span>{formatWorkDate(routeInfo.planDate)}</span>
              </strong>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-white p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Posádka / Technici
              </span>
              <strong className="text-sm font-black text-slate-900 flex items-center gap-1.5 truncate" title={routeInfo.crewName}>
                <User size={14} className="text-emerald-600 shrink-0" />
                <span className="truncate">{routeInfo.crewName}</span>
              </strong>
              {routeInfo.workerNames.length > 0 && (
                <p className="text-[11px] font-semibold text-slate-500 truncate">
                  {routeInfo.workerNames.join(', ')}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-white p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Vozidlo výjezdu
              </span>
              <strong className="text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
                <Car size={14} className="text-emerald-600 shrink-0" />
                <span className="truncate">{routeInfo.vehicleName || 'Neuvedeno'}</span>
              </strong>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-white p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Předpokládaný příjezd
              </span>
              <strong className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-600 shrink-0" />
                <span>{routeInfo.arrivalAt || 'Dle trasy'}</span>
              </strong>
            </div>
          </div>

          {/* GPS Coordinates Bar in Route View */}
          <div className="rounded-2xl border border-emerald-200/80 bg-white/90 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-emerald-600 shrink-0" />
              <span className="font-bold text-slate-700">GPS poloha místa:</span>
              {hasGps ? (
                <span className="font-mono font-bold text-emerald-950 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  {coords.latitude?.toFixed(5)}, {coords.longitude?.toFixed(5)}
                </span>
              ) : (
                <span className="text-amber-800 font-semibold italic">Není přesně zaměřeno</span>
              )}
              {coords.address && (
                <span className="text-slate-500 text-[11px] truncate max-w-xs">
                  · {coords.address}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasGps && (
                <>
                  <a
                    href={`https://mapy.cz/zakladni?q=${coords.latitude},${coords.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline"
                  >
                    <span>Mapy.cz</span>
                    <ExternalLink size={12} />
                  </a>
                  <a
                    href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline"
                  >
                    <span>Google</span>
                    <ExternalLink size={12} />
                  </a>
                </>
              )}
              {canManageDispatch && (
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                >
                  {hasGps ? 'Změnit GPS v mapě' : 'Nastavit GPS bod'}
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-200/60">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/work/route?date=${routeInfo.planDate}&id=${routeInfo.planId}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50 transition shadow-2xs"
              >
                <Navigation size={14} className="text-emerald-600" />
                <span>Detail trasy a zastávek ↗</span>
              </Link>

              <Link
                href={`/work/dispatch?date=${routeInfo.planDate}&plan=${routeInfo.planId}#planner`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                <Route size={14} className="text-sky-600" />
                <span>Správa v dispečinku ↗</span>
              </Link>
            </div>

            <Link
              href={`/work/dispatch?date=${routeInfo.planDate}`}
              className="text-xs font-bold text-sky-800 hover:underline flex items-center gap-1"
            >
              <span>Denní dispečink ({formatWorkDate(routeInfo.planDate)})</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </section>

        {/* Modal */}
        <WorkOrderLocationPickerModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          orderId={orderId}
          orderTitle={orderTitle}
          locationNote={locationNote}
          initialLatitude={coords.latitude}
          initialLongitude={coords.longitude}
          initialLocationAddress={coords.address}
          onLocationSaved={handleLocationSaved}
        />
      </>
    );
  }

  // Case 2: Workshop or Office Task (Internal, no field route needed by default)
  if (isWorkshop) {
    return (
      <>
        <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
                🛠️
              </span>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Dispečink prací
                </span>
                <h2 className="text-sm sm:text-base font-black text-slate-900">
                  Interní dílenská / kancelářská zakázka
                </h2>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 self-start sm:self-center">
              Bez terénního výjezdu
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Tato zakázka je označena jako dílenská práce, tisk, grafika nebo administrativa. Standardně se neplánuje do výjezdových tras v terénu.
          </p>

          <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500 font-medium">
              Pokud budete potřebovat zajistit odvoz nebo montáž u klienta, můžete nastavit GPS a zařadit do dispečinku:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
              >
                <MapPin size={13} className="text-slate-600" />
                <span>{hasGps ? 'Upravit GPS' : 'Nastavit GPS polohu'}</span>
              </button>
              <Link
                href={`/work/dispatch?date=${dateIso}&planner=work&jobs=${orderId}#planner`}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs shrink-0"
              >
                <Route size={13} className="text-sky-600" />
                <span>Dispečink ↗</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Modal */}
        <WorkOrderLocationPickerModal
          isOpen={isLocationModalOpen}
          onClose={() => setIsLocationModalOpen(false)}
          orderId={orderId}
          orderTitle={orderTitle}
          locationNote={locationNote}
          initialLatitude={coords.latitude}
          initialLongitude={coords.longitude}
          initialLocationAddress={coords.address}
          onLocationSaved={handleLocationSaved}
        />
      </>
    );
  }

  // Case 3: Field Task waiting for route planning in Dispatch
  const locationText =
    locationNote ||
    (carrierCode ? `${carrierCode}${carrierCity ? ` (${carrierCity})` : ''}` : null) ||
    'Lokalita dle zadání zakázky';

  return (
    <>
      <section className="rounded-3xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/70 via-white to-sky-50/30 p-5 sm:p-6 shadow-sm space-y-4">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
                <Route size={16} />
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                Dispečink výjezdů & Trasy
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 flex flex-wrap items-center gap-2">
              <span>Čeká na zařazení do trasy výjezdu</span>
              {hasGps ? (
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                  ✓ GPS zaměřena
                </span>
              ) : (
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                  ⚠️ Chybí GPS bod
                </span>
              )}
            </h2>
          </div>

          {/* Primary CTA: Plan Route in Dispatch */}
          {canManageDispatch && (
            <Link
              href={`/work/dispatch?date=${dateIso}&planner=work&jobs=${orderId}#planner`}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-500 transition shadow-sm transform hover:-translate-y-0.5 shrink-0"
            >
              <Route size={14} />
              <span>Naplánovat trasu v dispečinku ↗</span>
            </Link>
          )}
        </div>

        {/* Missing GPS Warning Banner */}
        {!hasGps && (
          <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-white to-amber-50/80 p-4 space-y-2.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>Zakázka nemá vybraný GPS bod v mapě</span>
                </span>
                <p className="text-xs text-amber-900/90 font-medium leading-relaxed max-w-xl">
                  Dispečink výjezdů potřebuje přesné GPS souřadnice, aby dokázal spočítat optimální trasu auta, čas příjezdu a předat navigaci technikům do terénu.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLocationModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-700 hover:bg-amber-800 px-4 py-2 text-xs font-black text-white transition shadow-sm"
                >
                  <MapPin size={15} />
                  <span>Vybrat GPS bod v mapě</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Overview */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-2xl border border-amber-200/70 bg-white p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Plánovaný termín práce
            </span>
            <strong className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <Calendar size={14} className="text-amber-600 shrink-0" />
              <span>{formattedDate}</span>
            </strong>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-white p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Lokalita ze zadání
            </span>
            <strong className="text-sm font-black text-slate-900 flex items-center gap-1.5 truncate" title={locationText}>
              <MapPin size={14} className="text-amber-600 shrink-0" />
              <span className="truncate">{locationText}</span>
            </strong>
          </div>

          {/* GPS Coordinates Box */}
          <div className="rounded-2xl border border-amber-200/70 bg-white p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                GPS pro dispečink
              </span>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(true)}
                className="text-[11px] font-bold text-sky-700 hover:text-sky-900 hover:underline"
              >
                {hasGps ? 'Změnit' : '+ Nastavit'}
              </button>
            </div>
            {hasGps ? (
              <div className="space-y-0.5">
                <strong className="text-xs font-mono font-black text-slate-900 flex items-center gap-1">
                  <span>{coords.latitude?.toFixed(5)}, {coords.longitude?.toFixed(5)}</span>
                </strong>
                <div className="flex items-center gap-2 pt-0.5">
                  <a
                    href={`https://mapy.cz/zakladni?q=${coords.latitude},${coords.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-sky-800 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Mapy.cz</span>
                    <ExternalLink size={10} />
                  </a>
                  <span className="text-slate-300">·</span>
                  <a
                    href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-sky-800 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Google</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-xs font-bold text-amber-800">
                ⚠️ Nenastaveno
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-white p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Klient & Zakázka
            </span>
            <strong className="text-sm font-black text-slate-900 truncate block" title={`${clientName} · ${orderTitle}`}>
              {clientName}
            </strong>
            <span className="text-[10px] text-slate-500 truncate block">
              {orderTitle}
            </span>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-amber-200/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
            >
              <MapPin size={13} className="text-sky-600" />
              <span>{hasGps ? 'Zobrazit / upravit GPS v mapě' : '🗺️ Vybrat GPS bod v mapě'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/work/dispatch?date=${dateIso}`}
              className="text-xs font-bold text-sky-800 hover:underline flex items-center gap-1"
            >
              <span>Otevřít denní dispečink ({formattedDate}) ↗</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Modal */}
      <WorkOrderLocationPickerModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        orderId={orderId}
        orderTitle={orderTitle}
        locationNote={locationNote}
        initialLatitude={coords.latitude}
        initialLongitude={coords.longitude}
        initialLocationAddress={coords.address}
        onLocationSaved={handleLocationSaved}
      />
    </>
  );
}
