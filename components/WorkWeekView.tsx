'use client';

import type { WorkOrderStatus, WorkType } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { workStatusLabels, workStatusStyles, workTypeLabels } from '@/lib/work';

type WeekOrder = {
  id: string;
  title: string;
  clientName: string;
  requestedBy?: string | null;
  scheduledAt: string;
  status: WorkOrderStatus;
  workType: WorkType;
  ftdSent: boolean;
  invoiced: boolean;
  workers: string[];
  carrierCode?: string;
};

type WorkWeekViewProps = { initialOrders: WeekOrder[] };
type OrderPatch = Partial<Pick<WeekOrder, 'status' | 'ftdSent' | 'invoiced'>>;

function startOfWeek(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday) + offset * 7);
  return date;
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

export function WorkWeekView({ initialOrders }: WorkWeekViewProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [weekOffset, setWeekOffset] = useState(0);
  const [workerFilter, setWorkerFilter] = useState('ALL');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [savingId, setSavingId] = useState<string>();
  const [error, setError] = useState('');

  const workers = useMemo(() => [...new Set(orders.flatMap((order) => order.workers))].sort((a, b) => a.localeCompare(b, 'cs')), [orders]);
  const clients = useMemo(() => [...new Set(orders.map((order) => order.clientName))].sort((a, b) => a.localeCompare(b, 'cs')), [orders]);
  const weekStart = useMemo(() => startOfWeek(weekOffset), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => { const day = new Date(weekStart); day.setDate(day.getDate() + index); return day; }), [weekStart]);
  const visibleOrders = useMemo(() => orders.filter((order) =>
    (workerFilter === 'ALL' || order.workers.includes(workerFilter))
    && (clientFilter === 'ALL' || order.clientName === clientFilter)
    && (statusFilter === 'ALL' || order.status === statusFilter),
  ), [clientFilter, orders, statusFilter, workerFilter]);

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
    <section className="space-y-4" aria-labelledby="week-heading">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Týdenní rozpis</p><h2 className="text-2xl font-bold" id="week-heading">{weekLabel}</h2></div>
        <div className="flex flex-wrap gap-2"><button className="rounded-xl border bg-white px-3 py-2 text-sm font-medium" onClick={() => setWeekOffset((value) => value - 1)} type="button">← Předchozí</button><button className="rounded-xl border bg-white px-3 py-2 text-sm font-medium" onClick={() => setWeekOffset(0)} type="button">Tento týden</button><button className="rounded-xl border bg-white px-3 py-2 text-sm font-medium" onClick={() => setWeekOffset((value) => value + 1)} type="button">Další →</button></div>
      </div>
      <div className="card grid gap-3 md:grid-cols-3">
        <label>Pracovník<select className="input mt-1" value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)}><option value="ALL">Všichni pracovníci</option>{workers.map((worker) => <option key={worker} value={worker}>{worker}</option>)}</select></label>
        <label>Klient<select className="input mt-1" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="ALL">Všichni klienti</option>{clients.map((client) => <option key={client} value={client}>{client}</option>)}</select></label>
        <label>Stav<select className="input mt-1" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Všechny stavy</option>{Object.entries(workStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1260px] grid-cols-7 gap-3">
          {days.map((day) => {
            const dayOrders = visibleOrders.filter((order) => sameDay(new Date(order.scheduledAt), day));
            const isToday = sameDay(day, new Date());
            return <section className={`min-h-64 rounded-2xl border p-3 ${isToday ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-slate-50'}`} key={day.toISOString()} aria-label={day.toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'numeric' })}>
              <header className="mb-3"><p className="text-xs font-semibold uppercase text-slate-500">{day.toLocaleDateString('cs-CZ', { weekday: 'long' })}</p><strong>{day.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}</strong></header>
              <div className="space-y-3">{dayOrders.length === 0 ? <p className="text-xs text-slate-400">Bez práce</p> : dayOrders.map((order) => <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" key={order.id}>
                <div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${workStatusStyles[order.status]}`}>{workStatusLabels[order.status]}</span><span className="text-[11px] text-slate-500">{new Date(order.scheduledAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span></div>
                <Link className="mt-2 block text-sm font-bold hover:text-sky-700" href={`/work/${order.id}`}>{order.title}</Link>
                <p className="mt-1 text-xs text-slate-600">{order.clientName}</p>
                <p className="mt-1 text-xs text-slate-500">Zadal/a: {order.requestedBy || 'Neuvedeno'}</p>
                <p className="mt-1 text-xs text-slate-500">Pracovník: {order.workers.join(', ') || 'nepřiřazen'}{order.carrierCode ? ` · ${order.carrierCode}` : ''}</p>
                <label className="mt-3 block text-xs">Stav<select className="input mt-1 !py-1 text-xs" disabled={savingId === order.id} value={order.status} onChange={(event) => void updateOrder(order, { status: event.target.value as WorkOrderStatus })}>{Object.entries(workStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div><p className="mb-1 text-[10px] font-semibold uppercase text-slate-400">Pracovník</p><button aria-pressed={order.ftdSent} className={`w-full rounded-lg px-2 py-1 text-xs font-medium ${order.ftdSent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`} disabled={savingId === order.id} onClick={() => void updateOrder(order, { ftdSent: !order.ftdSent })} type="button">Foto {order.ftdSent ? '✓' : '—'}</button></div>
                  <div><p className="mb-1 truncate text-[10px] font-semibold uppercase text-slate-400">{order.requestedBy || 'Zadavatel'}</p><button aria-pressed={order.invoiced} className={`w-full rounded-lg px-2 py-1 text-xs font-medium ${order.invoiced ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`} disabled={savingId === order.id} onClick={() => void updateOrder(order, { invoiced: !order.invoiced })} type="button">Faktura {order.invoiced ? '✓' : '—'}</button></div>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">{workTypeLabels[order.workType]}</p>
              </article>)}</div>
            </section>;
          })}
        </div>
      </div>
    </section>
  );
}
