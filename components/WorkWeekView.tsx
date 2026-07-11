'use client';

import type { WorkOrderStatus, WorkPriority, WorkType } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatWorkPrice, workPriorityLabels, workStatusLabels, workTypeLabels } from '@/lib/work';

type WeekOrder = {
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
};

type WorkWeekViewProps = { initialOrders: WeekOrder[] };
type OrderPatch = Partial<Pick<WeekOrder, 'status' | 'ftdSent' | 'invoiced'>>;
type FocusMode = 'TODAY' | 'WEEK';

const workerStatusActions: Array<{ label: string; status: WorkOrderStatus; activeClass: string }> = [
  { label: 'Převzato', status: 'HANDED_OVER', activeClass: 'bg-violet-600 text-white' },
  { label: 'Probíhá', status: 'IN_PROGRESS', activeClass: 'bg-amber-500 text-white' },
  { label: 'Hotovo', status: 'DONE', activeClass: 'bg-emerald-600 text-white' },
];

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(offset: number) {
  const date = startOfDay();
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday) + offset * 7);
  return date;
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
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
  const [focusMode, setFocusMode] = useState<FocusMode>('TODAY');
  const [workerFilter, setWorkerFilter] = useState('ALL');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [savingId, setSavingId] = useState<string>();
  const [error, setError] = useState('');

  const workers = useMemo(() => [...new Set(orders.flatMap((order) => order.workers))].sort((a, b) => a.localeCompare(b, 'cs')), [orders]);
  const clients = useMemo(() => [...new Set(orders.map((order) => order.clientName))].sort((a, b) => a.localeCompare(b, 'cs')), [orders]);
  const weekStart = useMemo(() => startOfWeek(weekOffset), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const day = new Date(weekStart); day.setDate(day.getDate() + index); return day; }), [weekStart]);
  const visibleOrders = useMemo(() => orders.filter((order) =>
    (workerFilter === 'ALL' || order.workers.includes(workerFilter))
    && (clientFilter === 'ALL' || order.clientName === clientFilter)
    && (statusFilter === 'ALL' || order.status === statusFilter)
    && (priorityFilter === 'ALL' || order.priority === priorityFilter),
  ), [clientFilter, orders, priorityFilter, statusFilter, workerFilter]);
  const focusedOrders = useMemo(() => {
    const today = startOfDay();
    const end = new Date(today);
    end.setDate(end.getDate() + (focusMode === 'TODAY' ? 1 : 7));
    return visibleOrders
      .filter((order) => {
        const scheduledAt = new Date(order.scheduledAt);
        return isOrderOverdue(order) || (scheduledAt >= today && scheduledAt < end);
      })
      .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime());
  }, [focusMode, visibleOrders]);

  async function updateOrder(order: WeekOrder, patch: OrderPatch) {
    setSavingId(order.id);
    setError('');
    const next = { ...order, ...patch };
    const response = await fetch(`/api/work-orders/${order.id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next.status, ftdSent: next.ftdSent, invoiced: next.invoiced }),
    });
    const result = await response.json().catch(() => null) as { error?: string } | null;
    setSavingId(undefined);
    if (!response.ok) { setError(result?.error || 'Změnu se nepodařilo uložit.'); return; }
    setOrders((current) => current.map((item) => item.id === order.id ? next : item));
  }

  const weekEnd = days[6];
  const weekLabel = `${weekStart.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })} – ${weekEnd.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' })}`;

  return (
    <section className="space-y-5" aria-labelledby="worker-view-heading">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-labelledby="worker-view-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Rychlý přehled pracovníka</p><h2 className="text-2xl font-bold text-slate-950" id="worker-view-heading">Co je potřeba udělat</h2><p className="mt-1 text-sm text-slate-600">Vyberte pracovníka a stav úkolu změňte jedním tlačítkem.</p></div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Období rychlého přehledu">
            <button aria-pressed={focusMode === 'TODAY'} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${focusMode === 'TODAY' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`} onClick={() => setFocusMode('TODAY')} type="button">Dnes</button>
            <button aria-pressed={focusMode === 'WEEK'} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${focusMode === 'WEEK' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`} onClick={() => setFocusMode('WEEK')} type="button">Příštích 7 dní</button>
          </div>
        </div>
        <label className="mt-4 block max-w-sm text-sm font-medium">Pracovník<select className="input mt-1" value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)}><option value="ALL">Všichni pracovníci</option>{workers.map((worker) => <option key={worker} value={worker}>{worker}</option>)}</select></label>
        {focusedOrders.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center"><p className="font-semibold text-slate-950">Pro zvolený pohled nejsou žádné úkoly.</p><p className="mt-1 text-sm text-slate-500">Zkuste příštích 7 dní nebo jiného pracovníka.</p></div> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{focusedOrders.map((order) => {
          const overdue = isOrderOverdue(order);
          const urgent = order.priority === 'URGENT' && isOpen(order);
          return <article className={`rounded-xl border bg-white p-4 shadow-sm ${overdue ? 'border-red-500 ring-2 ring-red-100' : urgent ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} key={order.id}>
            <div className="flex flex-wrap items-center gap-2"><StatusBadge value={order.status} /><StatusBadge value={order.priority} />{overdue && <span className="rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Po termínu</span>}<span className="ml-auto text-sm font-semibold text-slate-700">{new Date(order.scheduledAt).toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' })} · {new Date(order.scheduledAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span></div>
            <Link className="mt-3 block text-lg font-bold text-slate-950 hover:text-slate-700" href={`/work/${order.id}`}>{order.title}</Link>
            <p className="mt-1 text-sm text-slate-600">{order.clientName} · {order.workers.join(', ') || 'nepřiřazený pracovník'}</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{workerStatusActions.map((action) => <button aria-pressed={order.status === action.status} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${order.status === action.status ? action.activeClass : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} disabled={savingId === order.id} key={action.status} onClick={() => void updateOrder(order, { status: action.status })} type="button">{action.label}</button>)}<button aria-pressed={order.ftdSent} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${order.ftdSent ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} disabled={savingId === order.id} onClick={() => void updateOrder(order, { ftdSent: !order.ftdSent })} type="button">Foto {order.ftdSent ? 'nahrána ✓' : 'nahrána'}</button></div>
          </article>;
        })}</div>}
      </section>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Týdenní rozpis</p><h2 className="text-2xl font-bold text-slate-950">{weekLabel}</h2></div>
        <div className="flex flex-wrap gap-2"><button className="rounded-xl border bg-white px-3 py-2 text-sm font-medium" onClick={() => setWeekOffset((value) => value - 1)} type="button">← Předchozí</button><button className="rounded-xl border bg-white px-3 py-2 text-sm font-medium" onClick={() => setWeekOffset(0)} type="button">Tento týden</button><button className="rounded-xl border bg-white px-3 py-2 text-sm font-medium" onClick={() => setWeekOffset((value) => value + 1)} type="button">Další →</button></div>
      </div>
      <div className="card grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label>Pracovník<select className="input mt-1" value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)}><option value="ALL">Všichni pracovníci</option>{workers.map((worker) => <option key={worker} value={worker}>{worker}</option>)}</select></label>
        <label>Klient<select className="input mt-1" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="ALL">Všichni klienti</option>{clients.map((client) => <option key={client} value={client}>{client}</option>)}</select></label>
        <label>Stav<select className="input mt-1" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Všechny stavy</option>{Object.entries(workStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Priorita<select className="input mt-1" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="ALL">Všechny priority</option>{Object.entries(workPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1260px] grid-cols-7 gap-3">
          {days.map((day) => {
            const dayOrders = visibleOrders.filter((order) => sameDay(new Date(order.scheduledAt), day));
            const isToday = sameDay(day, new Date());
            return <section className={`min-h-64 rounded-2xl border p-3 ${isToday ? 'border-slate-400 bg-white ring-1 ring-slate-200' : 'border-slate-200 bg-slate-50'}`} key={day.toISOString()} aria-label={day.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' })}>
              <header className="mb-3"><p className="text-xs font-semibold uppercase text-slate-500">{day.toLocaleDateString('cs-CZ', { weekday: 'long' })}</p><strong>{day.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}</strong></header>
              <div className="space-y-3">{dayOrders.length === 0 ? <p className="text-xs text-slate-400">Bez práce</p> : dayOrders.map((order) => {
                const overdue = isOrderOverdue(order);
                return <article className={`rounded-xl border bg-white p-3 shadow-sm ${overdue ? 'border-red-400 ring-2 ring-red-100' : order.priority === 'URGENT' ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} key={order.id}>
                  <div className="flex flex-wrap items-center gap-1"><StatusBadge value={order.status} /><StatusBadge value={order.priority} />{overdue && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">Po termínu</span>}<span className="ml-auto text-[11px] text-slate-500">{new Date(order.scheduledAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span></div>
                  <Link className="mt-2 block text-sm font-bold text-slate-950 hover:text-slate-700" href={`/work/${order.id}`}>{order.title}</Link>
                  <p className="mt-1 text-xs text-slate-600">{order.clientName}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">{formatWorkPrice(order.price)}</p>
                  <p className="mt-1 text-xs text-slate-500">Zadal/a: {order.requestedBy || 'Neuvedeno'}</p>
                  <p className="mt-1 text-xs text-slate-500">Pracovník: {order.workers.join(', ') || 'nepřiřazen'}{order.carrierCode ? ` · ${order.carrierCode}` : ''}</p>
                  <label className="mt-3 block text-xs">Stav<select className="input mt-1 !py-1 text-xs" disabled={savingId === order.id} value={order.status} onChange={(event) => void updateOrder(order, { status: event.target.value as WorkOrderStatus })}>{Object.entries(workStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <div className="mt-2 grid grid-cols-2 gap-2"><button className={`rounded-lg px-2 py-1 text-xs font-medium ${order.status === 'IN_PROGRESS' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`} disabled={savingId === order.id} onClick={() => void updateOrder(order, { status: 'IN_PROGRESS' })} type="button">Probíhá</button><button className={`rounded-lg px-2 py-1 text-xs font-medium ${order.status === 'DONE' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`} disabled={savingId === order.id} onClick={() => void updateOrder(order, { status: 'DONE' })} type="button">Hotovo</button><button aria-pressed={order.ftdSent} className={`rounded-lg px-2 py-1 text-xs font-medium ${order.ftdSent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`} disabled={savingId === order.id} onClick={() => void updateOrder(order, { ftdSent: !order.ftdSent })} type="button">Foto {order.ftdSent ? '✓' : '—'}</button><button aria-pressed={order.invoiced} className={`rounded-lg px-2 py-1 text-xs font-medium ${order.invoiced ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`} disabled={savingId === order.id} onClick={() => void updateOrder(order, { invoiced: !order.invoiced })} type="button">Faktura {order.invoiced ? '✓' : '—'}</button></div>
                  <p className="mt-2 text-[11px] text-slate-400">{workTypeLabels[order.workType]}</p>
                </article>;
              })}</div>
            </section>;
          })}
        </div>
      </div>
    </section>
  );
}
