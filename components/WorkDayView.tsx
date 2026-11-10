'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Plus,
  Route,
  ArrowRight,
  Phone,
} from 'lucide-react';
import type { WorkOrderData } from './WorkPlanListView';
import type { TodayCrewRouteSummary } from '@/lib/field-planning/order-route-mapper';
import {
  formatWorkDate,
  formatWorkPrice,
  workPriorityLabels,
  workPriorityStyles,
  workStatusLabels,
  workStatusStyles,
  workTypeLabels,
} from '@/lib/work';

export type WorkDayViewProps = {
  orders: WorkOrderData[];
  todayRoutes?: TodayCrewRouteSummary[];
  onOpenReschedule: (order: WorkOrderData) => void;
  onOpenCreateModal: (targetDateStr: string) => void;
  onOrderUpdated?: (orderId: string, patch: Partial<WorkOrderData>) => void;
};

function formatDateToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function WorkDayView({
  orders: initialOrders,
  todayRoutes = [],
  onOpenReschedule,
  onOpenCreateModal,
  onOrderUpdated,
}: WorkDayViewProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => formatDateToIso(new Date()));
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [quickReschedulingId, setQuickReschedulingId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'FIELD' | 'WORKSHOP' | 'COMPLETED'>('ALL');

  // Keep in sync with parent updates
  React.useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDateStr]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const selectedDayStart = useMemo(() => {
    return new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  }, [selectedDate]);

  const selectedDayEnd = useMemo(() => {
    const end = new Date(selectedDayStart);
    end.setDate(end.getDate() + 1);
    return end;
  }, [selectedDayStart]);

  const isToday = selectedDayStart.getTime() === todayStart.getTime();

  const isYesterday =
    selectedDayStart.getTime() === todayStart.getTime() - 86400000;

  const isTomorrow =
    selectedDayStart.getTime() === todayStart.getTime() + 86400000;

  // Day navigation helpers
  const handlePrevDay = () => {
    const prev = new Date(selectedDayStart);
    prev.setDate(prev.getDate() - 1);
    setSelectedDateStr(formatDateToIso(prev));
  };

  const handleNextDay = () => {
    const next = new Date(selectedDayStart);
    next.setDate(next.getDate() + 1);
    setSelectedDateStr(formatDateToIso(next));
  };

  const handleToday = () => {
    setSelectedDateStr(formatDateToIso(new Date()));
  };

  // Find overdue uncompleted tasks scheduled strictly before the selected day
  const overdueOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (['DONE', 'CANCELLED'].includes(o.status)) return false;
        const d = new Date(o.scheduledAt);
        return d < selectedDayStart;
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [orders, selectedDayStart]);

  // Tasks scheduled for the selected day
  const dayOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const d = new Date(o.scheduledAt);
        return d >= selectedDayStart && d < selectedDayEnd;
      })
      .sort((a, b) => {
        // 1. In progress first
        if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
        if (a.status !== 'IN_PROGRESS' && b.status === 'IN_PROGRESS') return 1;

        // 2. Urgent / High priority
        const aUrgent = a.priority === 'URGENT' || a.priority === 'HIGH' ? 1 : 0;
        const bUrgent = b.priority === 'URGENT' || b.priority === 'HIGH' ? 1 : 0;
        if (aUrgent !== bUrgent) return bUrgent - aUrgent;

        // 3. Route order if in route
        if (a.routeInfo?.routeOrder && b.routeInfo?.routeOrder) {
          return a.routeInfo.routeOrder - b.routeInfo.routeOrder;
        }
        if (a.routeInfo?.routeOrder) return -1;
        if (b.routeInfo?.routeOrder) return 1;

        // 4. Time
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      });
  }, [orders, selectedDayStart, selectedDayEnd]);

  const isWorkshopOrder = (o: WorkOrderData) => {
    return Boolean(
      o.locationNote?.toLowerCase().includes('dílna') ||
      o.mediaLabel?.toLowerCase().includes('dílna') ||
      o.mediaLabel?.toLowerCase().includes('tisk') ||
      o.mediaLabel?.toLowerCase().includes('grafika') ||
      (!o.carrierCode && !o.locationNote)
    );
  };

  const isFieldOrder = (o: WorkOrderData) => !isWorkshopOrder(o);

  const fieldOrders = dayOrders.filter(isFieldOrder);
  const workshopOrders = dayOrders.filter(isWorkshopOrder);
  const openDayOrders = dayOrders.filter((o) => !['DONE', 'CANCELLED'].includes(o.status));
  const completedDayOrders = dayOrders.filter((o) => ['DONE', 'CANCELLED'].includes(o.status));

  const filteredDayOrders = useMemo(() => {
    if (scopeFilter === 'FIELD') return fieldOrders;
    if (scopeFilter === 'WORKSHOP') return workshopOrders;
    if (scopeFilter === 'COMPLETED') return completedDayOrders;
    return dayOrders;
  }, [scopeFilter, dayOrders, fieldOrders, workshopOrders, completedDayOrders]);

  // Quick 1-click complete
  const handleCompleteOrder = async (e: React.MouseEvent, orderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCompletingId(orderId);
    try {
      const res = await fetch(`/api/work-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DONE' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Uložení stavu selhalo');

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'DONE' } : o))
      );
      if (onOrderUpdated) onOrderUpdated(orderId, { status: 'DONE' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při označení zakázky jako hotové');
    } finally {
      setCompletingId(null);
    }
  };

  // Quick 1-click reschedule to selected date
  const handleQuickRescheduleToCurrentDay = async (e: React.MouseEvent, orderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setQuickReschedulingId(orderId);
    try {
      const res = await fetch(`/api/work-orders/${orderId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate: selectedDateStr,
          reason: 'Přeplánováno z přehledu nestihnutých zakázek',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Přeplánování selhalo');

      const updatedDate = data.workOrder.scheduledAt;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, scheduledAt: updatedDate, status: 'PLANNED' } : o))
      );
      if (onOrderUpdated) onOrderUpdated(orderId, { scheduledAt: updatedDate, status: 'PLANNED' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při přeplánování zakázky');
    } finally {
      setQuickReschedulingId(null);
    }
  };

  const dayRoutesForDate = todayRoutes.filter((r) => r.planDate === selectedDateStr);

  return (
    <section className="space-y-6">
      {/* 1. DATE NAVIGATION TOOLBAR */}
      <div className="rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Date Display & Shift Arrows */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevDay}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              title="Předchozí den"
              aria-label="Předchozí den"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className={`rounded-xl px-3.5 py-2 text-xs font-black transition shadow-2xs ${
                isToday
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Dnes
            </button>

            <button
              type="button"
              onClick={handleNextDay}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              title="Následující den"
              aria-label="Následující den"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight capitalize">
                {selectedDate.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h2>
              {isToday && (
                <span className="rounded-full bg-emerald-500 text-slate-950 px-2.5 py-0.5 text-xs font-black animate-pulse">
                  📌 Dnes
                </span>
              )}
              {isTomorrow && (
                <span className="rounded-full bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-0.5 text-xs font-bold">
                  Zítra
                </span>
              )}
              {isYesterday && (
                <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 text-xs font-bold">
                  Včera
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-500">
              Přehled všech montáží, prací v dílně a výjezdů na tento den.
            </p>
          </div>
        </div>

        {/* Right: Date Picker & Quick Add Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 shadow-2xs">
            <Calendar size={15} className="text-slate-500" />
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => {
                if (e.target.value) setSelectedDateStr(e.target.value);
              }}
              className="bg-transparent text-xs font-extrabold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={() => onOpenCreateModal(selectedDateStr)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-3.5 py-2 text-xs font-black text-white hover:from-sky-500 hover:to-emerald-500 shadow-sm transition transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Přidat úkol na tento den</span>
          </button>
        </div>
      </div>

      {/* 2. OVERDUE TASKS BANNER IF ANY UNFINISHED TASKS FROM PAST DAYS */}
      {overdueOrders.length > 0 && (
        <div className="rounded-3xl border-2 border-amber-300 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/90 p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-950 flex items-center gap-2">
                  <span>⚠️ Nestihnuté zakázky z minulých dnů</span>
                  <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs">
                    {overdueOrders.length} {overdueOrders.length === 1 ? 'úkol' : 'úkoly'} k dořešení
                  </span>
                </h3>
                <p className="text-[11px] font-semibold text-amber-800">
                  Tyto zakázky nebyly dokončeny v původním termínu. Můžete je jedním kliknutím přesunout na vybraný den nebo přeplánovat.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {overdueOrders.map((order) => {
              const isReschedulingThis = quickReschedulingId === order.id;
              const isCompletingThis = completingId === order.id;

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-amber-200 bg-white p-3.5 shadow-2xs space-y-2 hover:border-amber-400 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 text-[10px] font-black">
                      Původně: {formatWorkDate(new Date(order.scheduledAt))}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${workPriorityStyles[order.priority as keyof typeof workPriorityStyles] || 'bg-slate-100 text-slate-800'}`}>
                      {workPriorityLabels[order.priority as keyof typeof workPriorityLabels] || order.priority}
                    </span>
                  </div>

                  <Link href={`/work/${order.id}`} className="block group">
                    <h4 className="font-extrabold text-xs text-slate-950 leading-snug group-hover:text-sky-600 transition truncate">
                      {order.title}
                    </h4>
                    <p className="text-[11px] font-semibold text-slate-600 truncate mt-0.5">
                      👤 {order.clientName}
                      {order.assignments.length > 0 && ` · 🚗 ${order.assignments.map((a) => a.workerName).join(', ')}`}
                    </p>
                  </Link>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => handleQuickRescheduleToCurrentDay(e, order.id)}
                      disabled={isReschedulingThis || isCompletingThis}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-amber-500 px-2.5 py-1.5 text-[11px] font-black text-slate-950 hover:bg-amber-400 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                      title={`Přesunout zakázku na vybraný den (${selectedDate.toLocaleDateString('cs-CZ')})`}
                    >
                      <RotateCw size={12} className={isReschedulingThis ? 'animate-spin' : ''} />
                      <span>{isReschedulingThis ? 'Přesouvám…' : '⚡ Přesunout na dnes'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenReschedule(order)}
                      disabled={isReschedulingThis || isCompletingThis}
                      className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
                      title="Zvolit jiné datum přeplánování"
                    >
                      <Calendar size={12} />
                      <span>Jiné datum…</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleCompleteOrder(e, order.id)}
                      disabled={isCompletingThis}
                      className="flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-[11px] font-black text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                      title="Označit jako hotové"
                    >
                      <CheckCircle2 size={13} className="text-emerald-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. DAY KPI CARDS */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Celkem na den</span>
          <p className="mt-1 text-2xl font-black text-slate-900">{dayOrders.length}</p>
          <span className="text-[10px] font-semibold text-slate-500">naplánovaných úkolů</span>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">K realizaci</span>
          <p className="mt-1 text-2xl font-black text-emerald-950">{openDayOrders.length}</p>
          <span className="text-[10px] font-semibold text-emerald-800">aktivních zakázek</span>
        </div>

        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Výjezdy v terénu</span>
          <p className="mt-1 text-2xl font-black text-teal-950">{fieldOrders.length}</p>
          <span className="text-[10px] font-semibold text-teal-800">montáží a zastávek</span>
        </div>

        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Dílna & tisk</span>
          <p className="mt-1 text-2xl font-black text-sky-950">{workshopOrders.length}</p>
          <span className="text-[10px] font-semibold text-sky-800">příprav a výroby</span>
        </div>
      </div>

      {/* 4. FIELD CREWS ON THIS DAY */}
      {dayRoutesForDate.length > 0 && (
        <div className="rounded-3xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
              <Route size={18} />
            </div>
            <div>
              <p className="text-xs font-black text-slate-900">
                Posádky v terénu pro tento den: {dayRoutesForDate.map((r) => r.crewName).join(', ')}
              </p>
              <p className="text-[11px] font-medium text-slate-600">
                {dayRoutesForDate.reduce((sum, r) => sum + r.totalStops, 0)} naplánovaných zastávek výjezdu.
              </p>
            </div>
          </div>
          <Link
            href={`/work/route?date=${selectedDateStr}`}
            className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition"
          >
            <span>🗺️ Plánovač trasy</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* 5. FILTER TABS & TASKS LIST */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setScopeFilter('ALL')}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition shadow-2xs ${
                scopeFilter === 'ALL'
                  ? 'bg-slate-950 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Vše na den ({dayOrders.length})
            </button>

            <button
              type="button"
              onClick={() => setScopeFilter('FIELD')}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition shadow-2xs ${
                scopeFilter === 'FIELD'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              🚗 Výjezdy ({fieldOrders.length})
            </button>

            <button
              type="button"
              onClick={() => setScopeFilter('WORKSHOP')}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition shadow-2xs ${
                scopeFilter === 'WORKSHOP'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              🏭 Dílna ({workshopOrders.length})
            </button>

            <button
              type="button"
              onClick={() => setScopeFilter('COMPLETED')}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition shadow-2xs ${
                scopeFilter === 'COMPLETED'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              ✓ Hotovo ({completedDayOrders.length})
            </button>
          </div>

          <span className="text-xs font-bold text-slate-500">
            {filteredDayOrders.length} {filteredDayOrders.length === 1 ? 'záznam' : 'záznamů'}
          </span>
        </div>

        {/* Day Orders Container */}
        {filteredDayOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Calendar size={24} />
            </div>
            <div>
              <p className="font-black text-slate-800 text-base">
                Na tento den nejsou žádné zakázky
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-1 max-w-sm mx-auto">
                {scopeFilter !== 'ALL'
                  ? 'V této kategorii není pro vybraný den žádný úkol. Zkuste přepnout filtr.'
                  : 'Můžete přidat nový úkol nebo přeplánovat úkol z jiného dne.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenCreateModal(selectedDateStr)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-black text-white hover:bg-sky-500 shadow-sm transition"
            >
              <Plus size={14} />
              <span>Přidat úkol na tento den</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDayOrders.map((order) => {
              const isDone = ['DONE', 'CANCELLED'].includes(order.status);
              const isCompletingThis = completingId === order.id;
              const isWorkshop = isWorkshopOrder(order);

              return (
                <div
                  key={order.id}
                  className={`card relative block transition hover:-translate-y-0.5 hover:shadow-md ${
                    isDone
                      ? 'border-purple-200 bg-purple-50/20 opacity-80'
                      : isWorkshop
                      ? 'border-sky-200 hover:border-sky-300'
                      : 'border-emerald-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    {/* Left: Info */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Status badge */}
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${workStatusStyles[order.status as keyof typeof workStatusStyles] || 'bg-slate-100 text-slate-800'}`}>
                          {workStatusLabels[order.status as keyof typeof workStatusLabels] || order.status}
                        </span>

                        {/* Priority badge */}
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ring-1 ${workPriorityStyles[order.priority as keyof typeof workPriorityStyles] || 'bg-slate-100 text-slate-800'}`}>
                          {workPriorityLabels[order.priority as keyof typeof workPriorityLabels] || order.priority}
                        </span>

                        {/* Route stop badge */}
                        {order.routeInfo ? (
                          <Link
                            href={`/work/route?date=${order.routeInfo.planDate}&id=${order.routeInfo.planId}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-black text-white border border-emerald-700 hover:bg-emerald-700 shadow-2xs transition"
                            title={`Zastávka #${order.routeInfo.routeOrder} v trase ${order.routeInfo.crewName}`}
                          >
                            <span>🚗 Zastávka #{order.routeInfo.routeOrder}</span>
                            {order.routeInfo.arrivalAt && (
                              <span className="font-mono text-[10px] opacity-90">
                                ({new Date(order.routeInfo.arrivalAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            )}
                          </Link>
                        ) : isWorkshop ? (
                          <span className="rounded-full bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-0.5 text-xs font-bold">
                            🏭 Dílna / Tisk
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[11px] font-bold">
                            ⏱️ Čeká na výjezd
                          </span>
                        )}

                        <span className="text-xs font-extrabold text-slate-500">
                          {workTypeLabels[order.workType as keyof typeof workTypeLabels] || order.workType}
                        </span>
                      </div>

                      {/* Title & Link */}
                      <Link href={`/work/${order.id}`} className="block group">
                        <h3 className="text-base md:text-lg font-black text-slate-950 group-hover:text-sky-600 transition leading-snug">
                          {order.title}
                        </h3>
                      </Link>

                      {/* Client, Carrier, Phone info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
                        <span className="text-slate-900 font-extrabold">👤 {order.clientName}</span>
                        {order.contactPhone && (
                          <a
                            href={`tel:${order.contactPhone}`}
                            className="text-emerald-700 hover:underline flex items-center gap-1 font-bold"
                          >
                            <Phone size={12} />
                            {order.contactPhone}
                          </a>
                        )}
                        {order.carrierCode && (
                          <span className="text-slate-700">
                            🏷️ Nosič: {order.carrierCode} {order.carrierCity ? `(${order.carrierCity})` : ''}
                          </span>
                        )}
                        {order.quantity && (
                          <span className="text-sky-800 font-extrabold">
                            📦 {order.quantity} ks {order.mediaLabel || ''}
                          </span>
                        )}
                      </div>

                      {order.locationNote && (
                        <p className="text-xs font-medium text-slate-500 line-clamp-2">
                          📍 {order.locationNote}
                        </p>
                      )}
                    </div>

                    {/* Right: Workers, Price & Action Buttons */}
                    <div className="flex flex-col md:items-end justify-between gap-3 shrink-0 pt-2 md:pt-0">
                      <div className="text-xs md:text-right space-y-1">
                        {order.price && (
                          <p className="font-black text-sm text-slate-950">
                            {formatWorkPrice(order.price)}
                          </p>
                        )}
                        <p className="font-extrabold text-slate-700">
                          👥 {order.assignments.map((a) => a.workerName).join(', ') || 'Nepřiřazeno'}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          Zadal/a: {order.requestedBy || 'Neuvedeno'}
                        </p>
                      </div>

                      {/* Actions: Complete, Reschedule, Detail */}
                      <div className="flex flex-wrap items-center gap-2">
                        {!isDone && (
                          <button
                            type="button"
                            onClick={(e) => handleCompleteOrder(e, order.id)}
                            disabled={isCompletingThis}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-900 hover:bg-emerald-100 shadow-2xs transition disabled:opacity-50"
                            title="Označit zakázku jako hotovou"
                          >
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span>{isCompletingThis ? 'Ukládám…' : '✓ Hotovo'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenReschedule(order)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-black text-sky-900 hover:bg-sky-100 shadow-2xs transition"
                          title="Přeplánovat zakázku na jiný den"
                        >
                          <Calendar size={13} className="text-sky-700" />
                          <span>Přeplánovat</span>
                        </button>

                        <Link
                          href={`/work/${order.id}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                        >
                          <span>Detail</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
