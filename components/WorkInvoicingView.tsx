'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileCheck,
  Camera,
  FolderOpen,
  Search,
  Download,
  CheckCircle2,
  Ban,
  RotateCcw,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import type { WorkOrderData } from './WorkPlanListView';
import {
  formatWorkDate,
  formatWorkPrice,
  isOrderDoneWithoutFtdFlag,
  isOrderReadyForInvoicing,
  resolveGoogleDriveUrl,
} from '@/lib/work';

type InvoicingBucket =
  | 'READY_FTD'
  | 'DONE_WITH_FTD_LINK'
  | 'DONE_OTHER'
  | 'EXEMPT'
  | 'INVOICED';

export type WorkInvoicingViewProps = {
  orders: WorkOrderData[];
  onOrderUpdated?: (orderId: string, patch: Partial<WorkOrderData>) => void;
};

function escapeCsvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function WorkInvoicingView({ orders, onOrderUpdated }: WorkInvoicingViewProps) {
  const [bucket, setBucket] = useState<InvoicingBucket>('READY_FTD');
  const [requesterFilter, setRequesterFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const buckets = useMemo(() => {
    const readyFtd: WorkOrderData[] = [];
    const doneWithFtdLink: WorkOrderData[] = [];
    const doneOther: WorkOrderData[] = [];
    const exempt: WorkOrderData[] = [];
    const invoiced: WorkOrderData[] = [];

    for (const order of orders) {
      if (order.status === 'CANCELLED') continue;
      if (order.invoiced) {
        invoiced.push(order);
        continue;
      }
      if (order.invoiceExempt) {
        exempt.push(order);
        continue;
      }
      if (isOrderReadyForInvoicing(order)) {
        readyFtd.push(order);
        continue;
      }
      if (isOrderDoneWithoutFtdFlag(order)) {
        if (order.ftdUrl) {
          doneWithFtdLink.push(order);
        } else {
          doneOther.push(order);
        }
      }
    }

    const byDateDesc = (a: WorkOrderData, b: WorkOrderData) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime();

    readyFtd.sort(byDateDesc);
    doneWithFtdLink.sort(byDateDesc);
    doneOther.sort(byDateDesc);
    exempt.sort(byDateDesc);
    invoiced.sort(byDateDesc);

    return { readyFtd, doneWithFtdLink, doneOther, exempt, invoiced };
  }, [orders]);

  const activeBucketOrders = useMemo(() => {
    switch (bucket) {
      case 'READY_FTD':
        return buckets.readyFtd;
      case 'DONE_WITH_FTD_LINK':
        return buckets.doneWithFtdLink;
      case 'DONE_OTHER':
        return buckets.doneOther;
      case 'EXEMPT':
        return buckets.exempt;
      case 'INVOICED':
        return buckets.invoiced;
    }
  }, [bucket, buckets]);

  const requesterStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of activeBucketOrders) {
      const key = order.requestedBy?.trim() || '__NONE__';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => {
      if (a[0] === '__NONE__') return 1;
      if (b[0] === '__NONE__') return -1;
      return b[1] - a[1] || a[0].localeCompare(b[0], 'cs');
    });
  }, [activeBucketOrders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeBucketOrders.filter((order) => {
      const reqKey = order.requestedBy?.trim() || '__NONE__';
      if (requesterFilter !== 'ALL' && reqKey !== requesterFilter) return false;
      if (!q) return true;
      const hay = [
        order.clientName,
        order.title,
        order.requestedBy || '',
        order.locationNote || '',
        order.mediaLabel || '',
        ...order.assignments.map((a) => a.workerName),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeBucketOrders, requesterFilter, searchQuery]);

  const knownPriceSum = useMemo(() => {
    let sum = 0;
    let pricedCount = 0;
    for (const o of filteredOrders) {
      const num = o.price ? Number(o.price) : NaN;
      if (Number.isFinite(num) && num > 0) {
        sum += num;
        pricedCount++;
      }
    }
    return { sum, pricedCount };
  }, [filteredOrders]);

  async function updateBillingState(
    order: WorkOrderData,
    patch: { invoiced: boolean; invoiceExempt: boolean; ftdSent?: boolean },
    noticeText: string
  ) {
    setSavingId(order.id);
    setActionError(null);
    setActionNotice(null);
    const nextFtdSent = patch.ftdSent ?? Boolean(order.ftdSent);
    try {
      const res = await fetch(`/api/work-orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: order.status,
          ftdSent: nextFtdSent,
          invoiced: patch.invoiced,
          invoiceExempt: patch.invoiceExempt,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(data?.error || 'Uložení stavu fakturace selhalo.');
      }
      onOrderUpdated?.(order.id, {
        invoiced: patch.invoiced,
        invoiceExempt: patch.invoiceExempt,
        ftdSent: nextFtdSent,
      });
      setActionNotice(`${noticeText}: ${order.clientName} (${order.title})`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Uložení selhalo.');
    } finally {
      setSavingId(null);
    }
  }

  function handleExportCsv() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const header = [
      'Datum',
      'Klient',
      'Zakázka',
      'Zadavatel',
      'Pracovníci',
      'Stav',
      'FTD odeslána',
      'Vyfakturováno',
      'Bez fakturace',
      'Cena (Kč)',
      'Odkaz na FTD',
      'Podklady',
      'Detail v SeePOINT OS',
    ];
    const rows = filteredOrders.map((o) => [
      o.scheduledAt.slice(0, 10),
      o.clientName,
      o.title,
      o.requestedBy || '',
      o.assignments.map((a) => a.workerName).join(', '),
      o.status,
      o.ftdSent ? 'ANO' : o.ftdSkipped ? 'BEZ' : 'NE',
      o.invoiced ? 'ANO' : 'NE',
      o.invoiceExempt ? 'ANO' : 'NE',
      o.price || '',
      resolveGoogleDriveUrl(o.ftdUrl) || '',
      resolveGoogleDriveUrl(o.referenceUrl) || '',
      `${origin}/work/${o.id}`,
    ]);
    const csv = `\uFEFF${[header, ...rows]
      .map((line) => line.map((cell) => escapeCsvCell(String(cell ?? ''))).join(';'))
      .join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seepoint-k-fakturaci-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4" aria-labelledby="invoicing-overview-heading">
      {/* Header Banner */}
      <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50 via-white to-sky-50/70 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-800">
              <FileCheck size={16} className="text-purple-600" />
              <span>Přehled fakturace hotových zakázek</span>
            </div>
            <h2 id="invoicing-overview-heading" className="text-lg font-black text-slate-900">
              Dokončené úkoly připravené k vystavení faktury
            </h2>
            <p className="text-xs font-medium text-slate-600">
              Automaticky odfiltrovává zakázky označené <code className="rounded bg-slate-200/70 px-1 py-0.5 font-bold">FAKT = BEZ</code> a ukládá ruční vyfakturování tak, aby ho 15minutová synchronizace tabulky nepřepsala.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {knownPriceSum.pricedCount > 0 && (
              <div className="rounded-xl border border-purple-200 bg-white px-3.5 py-2 text-right shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Známé ceny ({knownPriceSum.pricedCount} z {filteredOrders.length})
                </p>
                <p className="text-sm font-black text-purple-950">
                  {formatWorkPrice(knownPriceSum.sum)}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredOrders.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-black text-slate-800 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50 cursor-pointer"
            >
              <Download size={14} className="text-purple-700" />
              <span>Export CSV ({filteredOrders.length})</span>
            </button>
          </div>
        </div>

        {/* Bucket Switcher */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setBucket('READY_FTD');
              setRequesterFilter('ALL');
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition cursor-pointer ${
              bucket === 'READY_FTD'
                ? 'bg-purple-700 text-white shadow-sm'
                : 'border border-purple-200 bg-white text-purple-900 hover:bg-purple-50'
            }`}
          >
            <span>💶 Připraveno (FTD = ANO)</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${bucket === 'READY_FTD' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'}`}>
              {buckets.readyFtd.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBucket('DONE_WITH_FTD_LINK');
              setRequesterFilter('ALL');
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition cursor-pointer ${
              bucket === 'DONE_WITH_FTD_LINK'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'border border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
            }`}
            title="Zelené/hotové zakázky s odkazem na FTD složku, kde v tabulce chybí FTD=ANO i FAKT=BEZ"
          >
            <span>📸 Hotové s odkazem FTD (bez ANO)</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${bucket === 'DONE_WITH_FTD_LINK' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
              {buckets.doneWithFtdLink.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBucket('DONE_OTHER');
              setRequesterFilter('ALL');
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              bucket === 'DONE_OTHER'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title="Ostatní dokončené úkoly bez FAKT=ANO a bez FAKT=BEZ (včetně interních úkolů před roztříděním)"
          >
            <span>📋 Ostatní hotové bez FAKT</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${bucket === 'DONE_OTHER' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {buckets.doneOther.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBucket('EXEMPT');
              setRequesterFilter('ALL');
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              bucket === 'EXEMPT'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>🚫 Bez fakturace (BEZ)</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${bucket === 'EXEMPT' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {buckets.exempt.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBucket('INVOICED');
              setRequesterFilter('ALL');
            }}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              bucket === 'INVOICED'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'border border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            <span>✓ Vyfakturováno</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${bucket === 'INVOICED' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {buckets.invoiced.length}
            </span>
          </button>
        </div>
      </div>

      {/* Requester & Search Filter Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <UserCheck size={13} /> Zadavatel:
          </span>
          <button
            type="button"
            onClick={() => setRequesterFilter('ALL')}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
              requesterFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Všichni ({activeBucketOrders.length})
          </button>
          {requesterStats.map(([reqKey, count]) => (
            <button
              key={reqKey}
              type="button"
              onClick={() => setRequesterFilter(requesterFilter === reqKey ? 'ALL' : reqKey)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                requesterFilter === reqKey
                  ? 'bg-purple-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {reqKey === '__NONE__' ? 'Neuvedeno' : reqKey} ({count})
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat klienta, zakázku, pracovníka…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-purple-400 focus:outline-none"
          />
        </div>
      </div>

      {actionNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-900 flex items-center justify-between">
          <span>✓ {actionNotice}</span>
          <button type="button" onClick={() => setActionNotice(null)} className="text-emerald-700 hover:text-emerald-950 font-black ml-4">
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-900 flex items-center justify-between">
          <span>⚠️ {actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="text-rose-700 hover:text-rose-950 font-black ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-extrabold text-slate-700">
            V této záložce teď nejsou žádné zakázky odpovídající filtru.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map((order) => {
            const ftdHref = resolveGoogleDriveUrl(order.ftdUrl);
            const refHref = resolveGoogleDriveUrl(order.referenceUrl);
            const isSaving = savingId === order.id;

            return (
              <div
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-purple-300 hover:shadow-sm transition flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-800">
                      📅 {formatWorkDate(new Date(order.scheduledAt))}
                    </span>

                    {order.requestedBy && (
                      <span className="rounded-md bg-sky-100 border border-sky-200 px-2 py-0.5 text-[11px] font-black text-sky-900">
                        Zadal: {order.requestedBy}
                      </span>
                    )}

                    {order.ftdSent ? (
                      <span className="rounded-md bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[11px] font-black text-emerald-900">
                        📸 FTD odeslána
                      </span>
                    ) : order.ftdSkipped ? (
                      <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                        FTD: BEZ
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                        Bez FTD = ANO
                      </span>
                    )}

                    {order.completedBySheetColor && (
                      <span className="rounded-md bg-lime-100 border border-lime-300 px-2 py-0.5 text-[11px] font-bold text-lime-900">
                        🟢 Zelená v tabulce
                      </span>
                    )}

                    {order.invoiced && (
                      <span className="rounded-md bg-purple-100 border border-purple-200 px-2 py-0.5 text-[11px] font-black text-purple-900">
                        ✓ Vyfakturováno
                      </span>
                    )}

                    {order.invoiceExempt && (
                      <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        🚫 FAKT = BEZ
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/work/${order.id}`}
                    className="block text-sm font-black text-slate-950 hover:text-purple-700 transition truncate"
                    title={order.title}
                  >
                    {order.title}
                  </Link>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-slate-600">
                    <span className="font-extrabold text-slate-800">🏢 {order.clientName}</span>
                    {order.assignments.length > 0 && (
                      <span>👷 {order.assignments.map((a) => a.workerName).join(', ')}</span>
                    )}
                    {order.quantity && (
                      <span className="text-sky-800 font-bold">
                        {order.quantity} ks {order.mediaLabel || ''}
                      </span>
                    )}
                    {order.price && (
                      <span className="font-black text-purple-900">
                        {formatWorkPrice(order.price)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Drive Links + 1-Click Invoicing Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {ftdHref && (
                    <a
                      href={ftdHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-900 hover:bg-emerald-100 transition"
                    >
                      <Camera size={13} className="text-emerald-700" />
                      <span>FTD Disk</span>
                      <ExternalLink size={11} />
                    </a>
                  )}

                  {refHref && (
                    <a
                      href={refHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                    >
                      <FolderOpen size={13} className="text-slate-500" />
                      <span>Podklady</span>
                      <ExternalLink size={11} />
                    </a>
                  )}

                  {!order.invoiced && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        void updateBillingState(
                          order,
                          { invoiced: true, invoiceExempt: false, ftdSent: order.ftdSent || true },
                          'Označeno jako vyfakturováno'
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-xl bg-purple-700 px-3 py-1.5 text-xs font-black text-white hover:bg-purple-800 shadow-2xs transition disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 size={13} />
                      <span>{isSaving ? 'Ukládám…' : 'Faktura vystavena'}</span>
                    </button>
                  )}

                  {!order.invoiceExempt && !order.invoiced && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        void updateBillingState(
                          order,
                          { invoiced: false, invoiceExempt: true },
                          'Označeno jako bez fakturace (BEZ)'
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
                      title="Interní nebo neúčtovaná zakázka (stejné jako FAKT = BEZ)"
                    >
                      <Ban size={13} className="text-slate-500" />
                      <span>Bez fakturace</span>
                    </button>
                  )}

                  {(order.invoiced || order.invoiceExempt) && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() =>
                        void updateBillingState(
                          order,
                          { invoiced: false, invoiceExempt: false },
                          'Vráceno do přehledu k fakturaci'
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>Vrátit k fakturaci</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
