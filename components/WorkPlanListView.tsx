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
  assignments: Array<{ workerName: string }>;
  workTasksCount: number;
  carrierCode?: string;
  carrierCity?: string;
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

  const displayedOrders = activeTab === 'ACTIVE' ? activeOrders : completedOrders;

  return (
    <section className="space-y-4">
      {/* Header Tabs & Cleanup Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIVE')}
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
            onClick={() => setActiveTab('HISTORY')}
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

      {cleanupMessage && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-extrabold text-emerald-900 animate-in fade-in">
          ✓ {cleanupMessage}
        </div>
      )}

      {/* Description */}
      <p className="text-xs font-extrabold text-slate-600">
        {activeTab === 'ACTIVE'
          ? '⚡ Úkoly jsou seřazeny od nejbližšího termínu provedení. Urgentní úkoly jsou zvýrazněny nahoře.'
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

            return (
              <Link
                key={order.id}
                href={`/work/${order.id}`}
                className={`card block transition hover:-translate-y-0.5 hover:shadow-md ${
                  isOverdue
                    ? 'border-red-400 ring-2 ring-red-100 bg-red-50/20'
                    : isToday
                    ? 'border-emerald-300 ring-2 ring-emerald-100 bg-emerald-50/10'
                    : 'hover:border-sky-300'
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1.5">
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
                      <span className="text-xs font-extrabold text-slate-600">
                        {workTypeLabels[order.workType as keyof typeof workTypeLabels] || order.workType}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-slate-950 leading-snug">
                      {order.title}
                    </h3>

                    <p className="text-xs font-extrabold text-slate-700">
                      👤 {order.clientName} · 📅 {formatWorkDate(new Date(order.scheduledAt))}
                    </p>

                    <p className="text-xs font-extrabold text-slate-500">
                      Zadal/a: {order.requestedBy || 'Neuvedeno'}
                      {order.carrierCode && ` · Nosič: ${order.carrierCode} (${order.carrierCity || ''})`}
                    </p>
                  </div>

                  <div className="text-xs md:text-right space-y-1">
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
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}
