'use client';

import type { WorkOrderStatus, WorkPriority, WorkType } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  workPriorityLabels,
  workStatusLabels,
  workStatusStyles,
} from '@/lib/work';
import type { WorkOrderRouteInfo } from '@/lib/field-planning/order-route-mapper';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  Check,
  Route,
  RotateCcw,
} from 'lucide-react';

export type WeekOrder = {
  id: string;
  title: string;
  clientName: string;
  requestedBy?: string | null;
  scheduledAt: string;
  deadlineAt?: string;
  status: WorkOrderStatus;
  priority: WorkPriority;
  price?: string | null;
  workType: WorkType;
  ftdSent: boolean;
  invoiced: boolean;
  workers: string[];
  carrierCode?: string;
  routeInfo?: WorkOrderRouteInfo | null;
  quantity?: number | null;
  mediaLabel?: string | null;
  locationNote?: string | null;
};

type WorkWeekViewProps = { initialOrders: WeekOrder[] };
type OrderPatch = Partial<Pick<WeekOrder, 'status' | 'ftdSent' | 'invoiced'>>;

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(offset: number) {
  const date = startOfDay();
  const weekday = date.getDay();
  // Monday is start of week in CZ: if Sunday (0), go back 6 days, else (1 - weekday)
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday) + offset * 7);
  return date;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isOpen(order: WeekOrder) {
  return !['DONE', 'CANCELLED'].includes(order.status);
}

function isOrderOverdue(order: WeekOrder, now = new Date()) {
  return Boolean(order.deadlineAt && new Date(order.deadlineAt) < now && isOpen(order));
}

export function WorkWeekView({ initialOrders }: WorkWeekViewProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [weekOffset, setWeekOffset] = useState(0);
  const [workerFilter, setWorkerFilter] = useState('ALL');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'DONE'>('ALL');
  const [savingId, setSavingId] = useState<string>();
  const [error, setError] = useState('');

  const workers = useMemo(
    () => [...new Set(orders.flatMap((order) => order.workers))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'cs')),
    [orders]
  );
  const clients = useMemo(
    () => [...new Set(orders.map((order) => order.clientName))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'cs')),
    [orders]
  );

  const weekStart = useMemo(() => startOfWeek(weekOffset), [weekOffset]);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const day = new Date(weekStart);
        day.setDate(day.getDate() + index);
        return day;
      }),
    [weekStart]
  );

  const visibleOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          (workerFilter === 'ALL' || order.workers.includes(workerFilter)) &&
          (clientFilter === 'ALL' || order.clientName === clientFilter) &&
          (statusFilter === 'ALL' ||
            (statusFilter === 'OPEN' && !['DONE', 'CANCELLED'].includes(order.status)) ||
            (statusFilter === 'DONE' && ['DONE', 'CANCELLED'].includes(order.status)))
      ),
    [clientFilter, orders, statusFilter, workerFilter]
  );

  async function updateOrder(order: WeekOrder, patch: OrderPatch) {
    setSavingId(order.id);
    setError('');
    const next = { ...order, ...patch };
    const response = await fetch(`/api/work-orders/${order.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next.status, ftdSent: next.ftdSent, invoiced: next.invoiced }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setSavingId(undefined);
    if (!response.ok) {
      setError(result?.error || 'Změnu se nepodařilo uložit.');
      return;
    }
    setOrders((current) => current.map((item) => (item.id === order.id ? next : item)));
  }

  const weekEnd = days[6];
  const weekLabel = `${weekStart.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })} – ${weekEnd.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}`;
  const hasActiveFilters = workerFilter !== 'ALL' || clientFilter !== 'ALL' || statusFilter !== 'ALL';

  return (
    <section className="space-y-4" aria-labelledby="calendar-view-heading">
      {/* TOOLBAR: NAVIGATION & FILTERS IN A SINGLE CLEAN CONTAINER */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Week Interval & Date Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
              <Calendar size={18} />
            </div>
            <div>
              <h2 id="calendar-view-heading" className="text-base font-extrabold text-slate-900 leading-tight">
                Týden {weekLabel}
              </h2>
              <p className="text-[11px] font-semibold text-slate-500">
                {weekOffset === 0 ? 'Aktuální týden' : weekOffset < 0 ? `Před ${Math.abs(weekOffset)} týdny` : `Za ${weekOffset} týdnů`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
            <button
              type="button"
              onClick={() => setWeekOffset((v) => v - 1)}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              title="Předchozí týden"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">Předchozí</span>
            </button>

            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className={`rounded-xl px-3 py-1.5 text-xs font-black transition ${
                weekOffset === 0
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Dnes
            </button>

            <button
              type="button"
              onClick={() => setWeekOffset((v) => v + 1)}
              className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              title="Další týden"
            >
              <span className="hidden sm:inline">Další</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Right: Quick Compact Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Worker Filter */}
          <select
            value={workerFilter}
            onChange={(e) => setWorkerFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white focus:bg-white transition cursor-pointer"
          >
            <option value="ALL">👥 Všichni pracovníci ({workers.length})</option>
            {workers.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>

          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white focus:bg-white transition cursor-pointer max-w-[160px]"
          >
            <option value="ALL">🏢 Všichni klienti</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Quick Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-white focus:bg-white transition cursor-pointer"
          >
            <option value="ALL">Všechny stavy</option>
            <option value="OPEN">Pouze k řešení</option>
            <option value="DONE">Pouze hotové</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setWorkerFilter('ALL');
                setClientFilter('ALL');
                setStatusFilter('ALL');
              }}
              className="flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              title="Zrušit filtry"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 border border-red-200" role="alert">
          {error}
        </div>
      )}

      {/* 7-DAY CALENDAR COLUMNS */}
      <div className="overflow-x-auto pb-4">
        <div className="grid min-w-[1100px] grid-cols-7 gap-3">
          {days.map((day) => {
            const isToday = sameDay(day, new Date());
            const rawDayOrders = visibleOrders.filter((order) => sameDay(new Date(order.scheduledAt), day));

            // SORTING RULES FOR EACH DAY (AND ESPECIALLY TODAY):
            // 1. Not done first, completed (DONE, CANCELLED) at bottom
            // 2. Urgent / High priority first
            // 3. In progress first
            // 4. Route stop order (#1, #2, #3...)
            // 5. Time
            // 6. Client / Title
            const dayOrders = [...rawDayOrders].sort((a, b) => {
              const aDone = ['DONE', 'CANCELLED'].includes(a.status) ? 1 : 0;
              const bDone = ['DONE', 'CANCELLED'].includes(b.status) ? 1 : 0;
              if (aDone !== bDone) return aDone - bDone;

              const aUrgent = a.priority === 'URGENT' || a.priority === 'HIGH' ? 1 : 0;
              const bUrgent = b.priority === 'URGENT' || b.priority === 'HIGH' ? 1 : 0;
              if (aUrgent !== bUrgent) return bUrgent - aUrgent;

              if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
              if (a.status !== 'IN_PROGRESS' && b.status === 'IN_PROGRESS') return 1;

              if (a.routeInfo?.routeOrder && b.routeInfo?.routeOrder) {
                return a.routeInfo.routeOrder - b.routeInfo.routeOrder;
              }
              if (a.routeInfo?.routeOrder) return -1;
              if (b.routeInfo?.routeOrder) return 1;

              const aTime = new Date(a.scheduledAt).getTime();
              const bTime = new Date(b.scheduledAt).getTime();
              if (aTime !== bTime) return aTime - bTime;

              const cDiff = a.clientName.localeCompare(b.clientName, 'cs');
              if (cDiff !== 0) return cDiff;
              return a.title.localeCompare(b.title, 'cs');
            });

            const openCount = dayOrders.filter((o) => !['DONE', 'CANCELLED'].includes(o.status)).length;

            return (
              <section
                key={day.toISOString()}
                className={`min-h-[420px] rounded-2xl border p-2.5 transition flex flex-col ${
                  isToday
                    ? 'border-sky-400 bg-gradient-to-b from-sky-50/80 via-white to-sky-50/30 shadow-md ring-2 ring-sky-300/40'
                    : 'border-slate-200/90 bg-slate-50/60'
                }`}
                aria-label={day.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' })}
              >
                {/* Column Day Header */}
                <header
                  className={`mb-2.5 rounded-xl p-2 border ${
                    isToday
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-white border-slate-200/80 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black uppercase tracking-wider ${isToday ? 'text-sky-100' : 'text-slate-500'}`}>
                      {day.toLocaleDateString('cs-CZ', { weekday: 'short' })}
                    </span>
                    {isToday && (
                      <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider text-white">
                        Dnes
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <strong className="text-base font-black">
                      {day.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
                    </strong>
                    <span className={`text-[11px] font-extrabold ${isToday ? 'text-sky-100' : 'text-slate-500'}`}>
                      {openCount > 0 ? `${openCount} k řešení` : dayOrders.length > 0 ? `${dayOrders.length} hotovo` : 'volno'}
                    </span>
                  </div>
                </header>

                {/* Task Cards in Column */}
                <div className="space-y-2 flex-1">
                  {dayOrders.length === 0 ? (
                    <div className="h-28 flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/50 text-slate-400 text-xs font-semibold">
                      Bez úkolů
                    </div>
                  ) : (
                    dayOrders.map((order) => {
                      const isDone = ['DONE', 'CANCELLED'].includes(order.status);
                      const isUrgent = (order.priority === 'URGENT' || order.priority === 'HIGH') && !isDone;
                      const isInProgress = order.status === 'IN_PROGRESS';
                      const overdue = isOrderOverdue(order);

                      return (
                        <article
                          key={order.id}
                          className={`group rounded-xl border p-2.5 transition shadow-2xs hover:shadow-md ${
                            isDone
                              ? 'border-slate-200 bg-slate-50/60 opacity-65'
                              : isUrgent
                              ? 'border-rose-300 bg-rose-50/60 ring-1 ring-rose-200'
                              : isInProgress
                              ? 'border-amber-300 bg-amber-50/60 ring-1 ring-amber-200'
                              : overdue
                              ? 'border-red-300 bg-red-50/40 ring-1 ring-red-200'
                              : 'border-slate-200 bg-white hover:border-sky-300'
                          }`}
                        >
                          {/* Top Row: Status badge & Quick Action */}
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1 min-w-0">
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                  workStatusStyles[order.status] || 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {workStatusLabels[order.status] || order.status}
                              </span>

                              {isUrgent && (
                                <span className="rounded-md bg-rose-100 text-rose-800 px-1.5 py-0.5 text-[10px] font-black border border-rose-200">
                                  ⚡ {workPriorityLabels[order.priority] || 'Urgent'}
                                </span>
                              )}

                              {order.routeInfo && (
                                <Link
                                  href={`/work/route?date=${order.routeInfo.planDate}&id=${order.routeInfo.planId}`}
                                  className="inline-flex items-center gap-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-black hover:bg-emerald-200 transition shrink-0"
                                  title={`Výjezd: ${order.routeInfo.crewName} · Zastávka #${order.routeInfo.routeOrder}`}
                                >
                                  <Route size={10} />
                                  <span>#{order.routeInfo.routeOrder}</span>
                                </Link>
                              )}
                            </div>

                            {/* 1-click status toggle button (Done / Re-open) */}
                            <button
                              type="button"
                              disabled={savingId === order.id}
                              onClick={() =>
                                void updateOrder(order, {
                                  status: isDone ? 'PLANNED' : 'DONE',
                                  ftdSent: isDone ? false : order.ftdSent,
                                })
                              }
                              title={isDone ? 'Vrátit zpět k řešení' : 'Označit jako hotovo'}
                              className={`shrink-0 flex items-center justify-center size-6 rounded-md border text-xs font-black transition cursor-pointer ${
                                isDone
                                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                  : 'bg-white text-slate-400 border-slate-200 hover:text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50'
                              }`}
                            >
                              <Check size={13} strokeWidth={3} />
                            </button>
                          </div>

                          {/* Order Title (Clickable link) */}
                          <Link
                            href={`/work/${order.id}`}
                            className={`mt-1.5 block text-xs font-bold leading-snug hover:text-sky-700 transition line-clamp-2 ${
                              isDone ? 'line-through text-slate-500' : 'text-slate-900'
                            }`}
                            title={order.title}
                          >
                            {order.title}
                          </Link>

                          {/* Client & Worker info */}
                          <div className="mt-1 flex items-center justify-between text-[11px] gap-2 pt-1 border-t border-slate-100/80">
                            <span className="font-extrabold text-slate-700 truncate" title={order.clientName}>
                              {order.clientName}
                            </span>
                            {order.workers.length > 0 && (
                              <span
                                className="shrink-0 text-[10px] font-bold text-slate-500 truncate max-w-[90px] flex items-center gap-0.5"
                                title={`Pracovníci: ${order.workers.join(', ')}`}
                              >
                                <User size={10} className="text-slate-400" />
                                <span>{order.workers[0]}</span>
                                {order.workers.length > 1 && <span className="opacity-70">+{order.workers.length - 1}</span>}
                              </span>
                            )}
                          </div>

                          {/* Carrier Tag / Location Note (only if present) */}
                          {(order.mediaLabel || order.carrierCode || order.locationNote) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                              {(order.mediaLabel || order.carrierCode) && (
                                <span className="rounded bg-sky-50 text-sky-800 font-bold px-1 py-0.2 border border-sky-200/80">
                                  📦 {order.mediaLabel || order.carrierCode}
                                  {order.quantity ? ` (${order.quantity} ks)` : ''}
                                </span>
                              )}
                              {order.locationNote && (
                                <span className="text-slate-500 truncate max-w-[120px]" title={order.locationNote}>
                                  📍 {order.locationNote}
                                </span>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
