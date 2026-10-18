'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CheckCircle2,
  Clock,
  History,
  AlertTriangle,
  Trash2,
  Zap,
  User,
  MapPin,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  formatWorkDate,
  formatWorkPrice,
  workPriorityLabels,
  workPriorityStyles,
  workStatusLabels,
  workStatusStyles,
  workTypeLabels,
} from '@/lib/work';
import type { WorkOrderRouteInfo } from '@/lib/field-planning/order-route-mapper';

export type { WorkOrderRouteInfo };

export type WorkOrderData = {
  id: string;
  title: string;
  clientName: string;
  requestedBy?: string | null;
  scheduledAt: string;
  deadlineAt?: string | null;
  status: string;
  priority: string;
  price?: string | null;
  workType: string;
  ftdSent?: boolean;
  invoiced?: boolean;
  quantity?: number | null;
  mediaLabel?: string | null;
  contactPhone?: string | null;
  locationNote?: string | null;
  assignments: Array<{ workerName: string }>;
  workTasksCount: number;
  carrierCode?: string;
  carrierCity?: string;
  routeInfo?: WorkOrderRouteInfo | null;
};

export function WorkPlanListView({
  orders: initialOrders,
  canCleanup = true,
}: {
  orders: WorkOrderData[];
  canCleanup?: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [orders, setOrders] = useState(initialOrders);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [planTargetDate, setPlanTargetDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const now = new Date();

  // Split into active and completed
  const activeOrders = orders
    .filter((order) => !['DONE', 'CANCELLED'].includes(order.status))
    .sort((a, b) => {
      // Urgent priority comes first
      if (a.priority === 'URGENT' && b.priority !== 'URGENT') return -1;
      if (a.priority !== 'URGENT' && b.priority === 'URGENT') return 1;
      // Nearest scheduledAt ASC
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });

  const completedOrders = orders
    .filter((order) => ['DONE', 'CANCELLED'].includes(order.status))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const handleCleanup = async () => {
    if (!confirm('Opravdu chcete vyčistit staré dokončené úkoly z databáze?')) return;
    setCleaning(true);
    setCleanupMessage('');
    try {
      const res = await fetch('/api/work-orders/cleanup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Vyčištění selhalo');

      setCleanupMessage(data.message);
      // Remove cleaned orders from state
      const cutoffDate = new Date();
      cutoffDate.setHours(0, 0, 0, 0);

      setOrders((prev) =>
        prev.filter(
          (o) =>
            !['DONE', 'CANCELLED'].includes(o.status) ||
            new Date(o.scheduledAt) >= cutoffDate
        )
      );
      router.refresh();
    } catch (err: unknown) {
      setCleanupMessage(err instanceof Error ? err.message : 'Vyčištění selhalo');
    } finally {
      setCleaning(false);
    }
  };

  const handleDeleteOrder = async (e: React.MouseEvent, orderId: string, orderTitle: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Opravdu chcete odebrat zakázku "${orderTitle}"?`)) return;

    try {
      const res = await fetch(`/api/work-orders/${orderId}`, { method: 'DELETE' });
      const out = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(out.error || 'Odebrání selhalo');
      if (out.message) alert(out.message);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Chyba při odebrání úkolu');
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllActive = () => {
    if (selectedIds.length === activeOrders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(activeOrders.map((o) => o.id));
    }
  };

  const handlePlanRouteForSelected = () => {
    if (selectedIds.length === 0) return;
    router.push(`/work/route?date=${planTargetDate}&jobIds=${selectedIds.join(',')}`);
  };

  const displayedOrders = activeTab === 'ACTIVE' ? activeOrders : completedOrders;

  return (
    <section className="space-y-4">
      {/* Header Tabs & Cleanup Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ACTIVE');
              setSelectedIds([]);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition shadow-2xs ${
              activeTab === 'ACTIVE'
                ? 'bg-slate-950 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Zap size={16} className={activeTab === 'ACTIVE' ? 'text-amber-400' : 'text-slate-400'} />
            <span>Aktuální a nejbližší úkoly ({activeOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('HISTORY');
              setSelectedIds([]);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition shadow-2xs ${
              activeTab === 'HISTORY'
                ? 'bg-slate-950 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <History size={16} className={activeTab === 'HISTORY' ? 'text-sky-400' : 'text-slate-400'} />
            <span>Historie splněných úkolů ({completedOrders.length})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'ACTIVE' && activeOrders.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAllActive}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
            >
              <span>{selectedIds.length === activeOrders.length ? 'Odznačit vše' : `Vybrat vše k výjezdu (${activeOrders.length})`}</span>
            </button>
          )}

          {canCleanup && (
            <button
              type="button"
              onClick={handleCleanup}
              disabled={cleaning}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-extrabold text-red-800 hover:bg-red-100 transition disabled:opacity-50"
              title="Vymazat staré vyřízené a zrušené úkoly před dnešním dnem z databáze"
            >
              <Trash2 size={14} />
              <span>{cleaning ? 'Čistím databázi…' : '🧹 Vyčistit vyřízené z DB'}</span>
            </button>
          )}
        </div>
      </div>

      {cleanupMessage && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-extrabold text-emerald-900 animate-in fade-in">
          ✓ {cleanupMessage}
        </div>
      )}

      {/* Description */}
      <p className="text-xs font-extrabold text-slate-600">
        {activeTab === 'ACTIVE'
          ? '⚡ Úkoly jsou seřazeny od nejbližšího termínu provedení. Zaškrtněte úkoly pro hromadné zařazení do plánovače výjezdů.'
          : '📜 Archiv splněných a vyřízených pracovních zakázek.'}
      </p>

      {/* Orders List */}
      <div className="space-y-3">
        {displayedOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-extrabold text-slate-700 text-sm">
              {activeTab === 'ACTIVE'
                ? 'Žádné aktivní úkoly. Všechny plánované práce jsou hotové!'
                : 'V historii zatím nejsou žádné splněné úkoly.'}
            </p>
          </div>
        ) : (
          displayedOrders.map((order) => {
            const isOverdue =
              order.deadlineAt &&
              new Date(order.deadlineAt) < now &&
              !['DONE', 'CANCELLED'].includes(order.status);

            const isToday =
              new Date(order.scheduledAt).toDateString() === now.toDateString();

            const isWorkshop = Boolean(
              order.locationNote?.toLowerCase().includes('dílna') ||
              order.mediaLabel?.toLowerCase().includes('dílna') ||
              order.mediaLabel?.toLowerCase().includes('tisk') ||
              order.mediaLabel?.toLowerCase().includes('grafika')
            );

            const isSelected = selectedIds.includes(order.id);

            return (
              <div
                key={order.id}
                className={`card relative block transition hover:-translate-y-0.5 hover:shadow-md ${
                  isSelected
                    ? 'border-sky-500 ring-2 ring-sky-300 bg-sky-50/30'
                    : isOverdue
                    ? 'border-red-400 ring-2 ring-red-100 bg-red-50/20'
                    : isToday
                    ? 'border-emerald-300 ring-2 ring-emerald-100 bg-emerald-50/10'
                    : 'hover:border-sky-300'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {activeTab === 'ACTIVE' && (
                      <div className="pt-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(order.id)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                          aria-label={`Vybrat zakázku ${order.title}`}
                        />
                      </div>
                    )}

                    <Link href={`/work/${order.id}`} className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${workStatusStyles[order.status as keyof typeof workStatusStyles] || 'bg-slate-100 text-slate-800'}`}>
                          {workStatusLabels[order.status as keyof typeof workStatusLabels] || order.status}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ring-1 ${workPriorityStyles[order.priority as keyof typeof workPriorityStyles] || 'bg-slate-100 text-slate-800'}`}>
                          {workPriorityLabels[order.priority as keyof typeof workPriorityLabels] || order.priority}
                        </span>
                        {isToday && (
                          <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-black text-slate-950 animate-pulse">
                            📌 Dnešní termín
                          </span>
                        )}
                        {isOverdue && (
                          <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-black text-white">
                            ⚠️ Po termínu
                          </span>
                        )}
                        {isWorkshop ? (
                          <span className="rounded-full bg-sky-100 text-sky-800 border border-sky-200 px-2.5 py-0.5 text-xs font-bold">
                            🏭 Dílna / Tisk
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold">
                            🚗 Výjezd / Montáž
                          </span>
                        )}

                        {/* ROUTE INTEGRATION BADGE */}
                        {order.routeInfo ? (
                          <span
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/work/route?date=${order.routeInfo!.planDate}&id=${order.routeInfo!.planId}`);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-black border transition cursor-pointer ${
                              order.routeInfo.planStatus === 'APPROVED' || order.routeInfo.planStatus === 'ACTIVE'
                                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-2xs'
                                : order.routeInfo.planStatus === 'COMPLETED'
                                ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                                : 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                            }`}
                            title={`Zobrazit výjezd na mapě (den: ${order.routeInfo.planDate}, posádka: ${order.routeInfo.crewName})`}
                          >
                            <span>🚗 Výjezd: {order.routeInfo.crewName}</span>
                            <span className="opacity-80">· #{order.routeInfo.routeOrder}</span>
                            {order.routeInfo.arrivalAt && (
                              <span className="font-mono text-[10px] opacity-90">
                                ({new Date(order.routeInfo.arrivalAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            )}
                          </span>
                        ) : !isWorkshop && !['DONE', 'CANCELLED'].includes(order.status) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[11px] font-bold">
                            <span>⏱️ Čeká na výjezd</span>
                          </span>
                        ) : null}

                        <span className="text-xs font-extrabold text-slate-600">
                          {workTypeLabels[order.workType as keyof typeof workTypeLabels] || order.workType}
                        </span>
                      </div>

                      <h3 className="text-lg font-black text-slate-950 leading-snug hover:text-sky-600 transition">
                        {order.title}
                      </h3>

                      <p className="text-xs font-extrabold text-slate-700 flex flex-wrap items-center gap-2">
                        <span>👤 {order.clientName}</span>
                        <span>· 📅 {formatWorkDate(new Date(order.scheduledAt))}</span>
                        {order.contactPhone && <span className="text-emerald-700">· 📞 {order.contactPhone}</span>}
                      </p>

                      {order.locationNote && (
                        <p className="text-xs font-semibold text-slate-600">
                          📍 Lokace: {order.locationNote}
                        </p>
                      )}

                      <p className="text-xs font-extrabold text-slate-500">
                        Zadal/a: {order.requestedBy || 'Neuvedeno'}
                        {order.carrierCode && ` · Nosič: ${order.carrierCode} (${order.carrierCity || ''})`}
                      </p>
                    </Link>
                  </div>

                  <div className="text-xs md:text-right space-y-2 shrink-0">
                    <p className="font-black text-sm text-slate-950">
                      {formatWorkPrice(order.price ?? undefined)}
                    </p>
                    <p className="font-extrabold text-slate-700">
                      🚗 {order.assignments.map((a) => a.workerName).join(', ') || 'Nepřiřazený pracovník'}
                    </p>
                    <p className="font-extrabold text-slate-500">
                      Úkoly: {order.workTasksCount}
                    </p>
                    {order.quantity && (
                      <p className="font-extrabold text-sky-800">
                        {order.quantity} ks {order.mediaLabel || ''}
                      </p>
                    )}

                    {canCleanup && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteOrder(e, order.id, order.title)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-extrabold text-red-700 hover:bg-red-100 transition"
                      >
                        <Trash2 size={12} /> Odebrat úkol
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* STICKY BOTTOM ACTION BAR FOR BATCH ROUTE PLANNING */}
      {selectedIds.length > 0 && (
        <div className="sticky bottom-4 z-40 mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-sky-500 bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 font-black text-slate-950 shadow-sm">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-sky-400">Vybrané úkoly pro výjezd</p>
              <p className="text-sm font-bold text-slate-200">
                {selectedIds.length === 1 ? 'Vybrán 1 úkol' : `${selectedIds.length} úkolů k zařazení do trasy`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="planDateInput" className="text-xs font-bold text-slate-300">
                Den výjezdu:
              </label>
              <input
                id="planDateInput"
                type="date"
                value={planTargetDate}
                onChange={(e) => setPlanTargetDate(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white focus:border-sky-400 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handlePlanRouteForSelected}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 px-4 py-2 text-xs font-black text-white shadow-md hover:from-sky-400 hover:to-emerald-400 transition transform hover:-translate-y-0.5"
            >
              <span>🚗 Naplánovat výjezd pro vybrané</span>
              <ArrowRight size={14} />
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Zrušit výběr
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
