'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NavigationOrderStatus } from '@prisma/client';
import {
  NAVIGATION_PHASES,
  NAVIGATION_ORDER_STATUS_LABELS,
  NAVIGATION_BLOCK_STATUS_LABELS,
  NAVIGATION_ORDER_STATUS_COLORS,
  NavigationOrderListItem,
} from '@/lib/navigation/types';
import { MapPin, Compass, ChevronRight } from 'lucide-react';

export function NavigationKanbanView({
  initialOrders,
}: {
  initialOrders: NavigationOrderListItem[];
}) {
  const [orders, setOrders] = useState<NavigationOrderListItem[]>(initialOrders);
  const [movingOrder, setMovingOrder] = useState<NavigationOrderListItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<NavigationOrderStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function handleConfirmMove(e: React.FormEvent) {
    e.preventDefault();
    if (!movingOrder || !targetStatus) return;

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/navigation/orders/${movingOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se přenést zakázku do nového stavu.');
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === movingOrder.id
            ? {
                ...o,
                status: data.order.status,
                blockStatus: data.order.blockStatus,
              }
            : o
        )
      );

      setSuccessMsg(`Zakázka ${movingOrder.orderNumber} byla přesunuta do fázového stavu "${NAVIGATION_ORDER_STATUS_LABELS[targetStatus as keyof typeof NAVIGATION_ORDER_STATUS_LABELS]}".`);
      setMovingOrder(null);
      setTargetStatus(null);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Chyba při změně stavu.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm font-semibold text-rose-800">
          ⚠️ {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-semibold text-emerald-800">
          ✅ {successMsg}
        </div>
      )}

      {/* Kanban Board Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-6 min-h-[600px]">
        {NAVIGATION_PHASES.map((phase) => {
          const phaseOrders = orders.filter((o) => phase.statuses.includes(o.status));
          const phaseTotalPrice = phaseOrders.reduce((sum, o) => sum + o.totalPrice, 0);

          return (
            <div
              key={phase.key}
              className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-xs min-w-[280px]"
            >
              {/* Column Header */}
              <div className={`rounded-xl border p-3 mb-3 bg-white shadow-xs ${phase.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">{phase.label}</h3>
                  <span className="rounded-full bg-slate-900/10 px-2 py-0.5 text-xs font-black">
                    {phaseOrders.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">{phase.description}</p>
                <div className="mt-2 text-right text-xs font-bold text-slate-700">
                  {phaseTotalPrice.toLocaleString('cs-CZ')} Kč
                </div>
              </div>

              {/* Column Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[75vh] pr-1">
                {phaseOrders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400 font-medium">
                    Žádné zakázky v této fázi
                  </div>
                ) : (
                  phaseOrders.map((o) => {
                    const statusColor = NAVIGATION_ORDER_STATUS_COLORS[o.status] || 'bg-slate-100 text-slate-800';
                    const statusLabel = NAVIGATION_ORDER_STATUS_LABELS[o.status] || o.status;
                    const blockLabel = o.blockStatus ? NAVIGATION_BLOCK_STATUS_LABELS[o.blockStatus] : null;

                    return (
                      <div
                        key={o.id}
                        className="group relative rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:shadow-md hover:border-sky-300"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/navigation/orders/${o.id}`}
                            className="font-bold text-slate-900 text-sm hover:text-sky-700 hover:underline flex items-center gap-1.5"
                          >
                            <Compass size={15} className="text-sky-600 shrink-0" />
                            {o.orderNumber}
                          </Link>
                          <span className="text-xs font-black text-slate-900 shrink-0">
                            {o.totalPrice.toLocaleString('cs-CZ')} Kč
                          </span>
                        </div>

                        <p className="font-bold text-xs text-slate-800 mt-1 line-clamp-1">{o.clientName}</p>
                        <p className="text-xs text-slate-500 line-clamp-1 flex items-center gap-1 mt-0.5">
                          <MapPin size={12} className="text-rose-500 shrink-0" /> {o.targetName}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusColor}`}>
                            {statusLabel}
                          </span>
                          {blockLabel && (
                            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              ⏳ {blockLabel}
                            </span>
                          )}
                        </div>

                        {/* Progress stats */}
                        <div className="mt-3 border-t border-slate-100 pt-2 flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                          <span>📍 {o.installedPointsCount} / {o.pointsCount} bodů</span>
                          <span>📷 {o.photosCount} / {o.pointsCount} fotek</span>
                        </div>

                        {/* Card footer & Action trigger */}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 font-medium">
                            {o.daysInStatus > 0 ? `${o.daysInStatus}d ve stavu` : 'Dnes'}
                          </span>
                          <button
                            onClick={() => {
                              setMovingOrder(o);
                              setTargetStatus(o.status);
                            }}
                            className="btn border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:text-sky-700 text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1"
                          >
                            Posunout <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transition Modal */}
      {movingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleConfirmMove} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Posun fázového stavu: {movingOrder.orderNumber}
            </h3>
            <p className="text-xs text-slate-500">
              Vyberte cílový stav pro zakázku <b>{movingOrder.title}</b> ({movingOrder.clientName}). Přechod bude ověřen podle pravidel workflow modulu Navigace.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Cílový stav workflow</label>
              <select
                value={targetStatus || ''}
                onChange={(e) => setTargetStatus(e.target.value as NavigationOrderStatus)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm font-semibold"
              >
                {Object.entries(NAVIGATION_ORDER_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 font-medium">
              ℹ️ Přesunutí zakázky automaticky aktualizuje navazující kontrolní seznam a vytvoří auditní záznam.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMovingOrder(null)}
                className="btn border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold px-4 py-2 rounded-lg"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                {submitting ? 'Ukládám...' : 'Potvrdit posun stavu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
