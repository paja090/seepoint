'use client';

import React from 'react';
import Link from 'next/link';
import {
  Route,
  Car,
  Clock,
  Calendar,
  MapPin,
  ChevronRight,
  User,
  Navigation,
} from 'lucide-react';
import { formatWorkDate } from '@/lib/work';
import type { WorkOrderRouteInfo } from '@/lib/field-planning/order-route-mapper';

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
}: WorkOrderDispatchCardProps) {
  const dateObj = new Date(scheduledAt);
  const dateIso = !Number.isNaN(dateObj.getTime())
    ? dateObj.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const formattedDate = formatWorkDate(scheduledAt);

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
    );
  }

  // Case 2: Workshop or Office Task (Internal, no field route needed by default)
  if (isWorkshop) {
    return (
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
            Pokud budete potřebovat zajistit odvoz nebo montáž u klienta, můžete zakázku zařadit do dispečinku:
          </span>
          <Link
            href={`/work/dispatch?date=${dateIso}&planner=work&jobs=${orderId}#planner`}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs shrink-0"
          >
            <Route size={13} className="text-sky-600" />
            <span>Naplánovat výjezd v dispečinku ↗</span>
          </Link>
        </div>
      </section>
    );
  }

  // Case 3: Field Task waiting for route planning in Dispatch
  const locationText =
    locationNote ||
    (carrierCode ? `${carrierCode}${carrierCity ? ` (${carrierCity})` : ''}` : null) ||
    'Lokalita dle zadání zakázky';

  return (
    <section className="rounded-3xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/70 via-white to-sky-50/30 p-5 sm:p-6 shadow-sm space-y-4">
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
            <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              ⏱️ Připraveno k naplánování
            </span>
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

      {/* Details Overview */}
      <div className="grid gap-3 sm:grid-cols-3 text-xs">
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
            Lokalita pro výjezd
          </span>
          <strong className="text-sm font-black text-slate-900 flex items-center gap-1.5 truncate" title={locationText}>
            <MapPin size={14} className="text-amber-600 shrink-0" />
            <span className="truncate">{locationText}</span>
          </strong>
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
        <p className="text-xs text-slate-600 font-medium">
          Tato zakázka zatím není přiřazena v konkrétním výjezdu posádky.
        </p>

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
  );
}
