'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Camera,
  Image as ImageIcon,
  ArrowLeft,
  Search,
  Check,
  RotateCcw,
  ZoomIn,
  MapPin,
  ChevronRight,
} from 'lucide-react';

export type QcPointItem = {
  id: string;
  orderId: string;
  orderNumber: string;
  clientName: string;
  targetName: string;
  label: string;
  navigationType: string;
  installedPhotoUrl?: string | null;
  carrierCode?: string | null;
  surfaceName?: string | null;
  qcStatus: string;
  qcNote?: string | null;
  createdAt: string;
};

export function QualityControlQueueView({
  initialPoints,
}: {
  initialPoints: QcPointItem[];
}) {
  const [points, setPoints] = useState<QcPointItem[]>(initialPoints);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [query, setQuery] = useState('');
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

  // Reject Modal
  const [rejectingPoint, setRejectingPoint] = useState<QcPointItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const filteredPoints = points.filter((p) => {
    const matchesTab =
      activeTab === 'all'
        ? true
        : activeTab === 'pending'
        ? p.qcStatus === 'PENDING'
        : activeTab === 'approved'
        ? p.qcStatus === 'APPROVED'
        : p.qcStatus === 'REJECTED';

    const matchesQuery =
      !query ||
      p.orderNumber.toLowerCase().includes(query.toLowerCase()) ||
      p.clientName.toLowerCase().includes(query.toLowerCase()) ||
      p.label.toLowerCase().includes(query.toLowerCase());

    return matchesTab && matchesQuery;
  });

  async function handleApprove(point: QcPointItem) {
    setSubmitting(true);
    setMsg('');

    try {
      const res = await fetch('/api/navigation/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointId: point.id,
          action: 'APPROVE',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se schválit bod.');
      }

      setPoints((prev) =>
        prev.map((p) => (p.id === point.id ? { ...p, qcStatus: 'APPROVED' } : p))
      );

      setMsg(`Fotodokumentace pro bod "${point.label}" byla schválena.`);
    } catch (err: unknown) {
      setMsg(`⚠️ ${err instanceof Error ? err.message : 'Chyba při schvalování.'}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReject(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectingPoint || !rejectReason) return;

    setSubmitting(true);
    setMsg('');

    try {
      const res = await fetch('/api/navigation/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointId: rejectingPoint.id,
          action: 'REJECT',
          qcNote: rejectReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se vrati bod k opravě.');
      }

      setPoints((prev) =>
        prev.map((p) =>
          p.id === rejectingPoint.id
            ? { ...p, qcStatus: 'REJECTED', qcNote: rejectReason }
            : p
        )
      );

      setRejectingPoint(null);
      setRejectReason('');
      setMsg(`Bod "${rejectingPoint.label}" byl vrácen montérovi k opravě s odůvodněním.`);
    } catch (err: unknown) {
      setMsg(`⚠️ ${err instanceof Error ? err.message : 'Chyba při vrácení.'}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/navigation" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kontrola fotodokumentace realizací</h1>
            <p className="text-xs text-slate-500">Kontrolujte pořízené snímky z terénu, schvalujte realizace nebo vracejte body k dopracování.</p>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'pending' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500'
            }`}
          >
            Čeká na kontrolu ({points.filter((p) => p.qcStatus === 'PENDING').length})
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'approved' ? 'bg-white shadow-xs text-emerald-700' : 'text-slate-500'
            }`}
          >
            Schváleno ({points.filter((p) => p.qcStatus === 'APPROVED').length})
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'rejected' ? 'bg-white shadow-xs text-amber-700' : 'text-slate-500'
            }`}
          >
            Vráceno k opravě ({points.filter((p) => p.qcStatus === 'REJECTED').length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'all' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
            }`}
          >
            Vše ({points.length})
          </button>
        </div>

        <div className="relative max-w-xs flex-1">
          <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Hledat zakázku, klienta, bod..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs font-medium focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {msg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
          ✅ {msg}
        </div>
      )}

      {/* Grid of QC Items */}
      {filteredPoints.length === 0 ? (
        <div className="card text-center p-12 text-slate-500">
          <Camera size={44} className="mx-auto mb-2 text-slate-300" />
          <p className="font-bold text-slate-700 text-base">Žádné fotografie v této sekci</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPoints.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-black text-sky-800 bg-sky-50 px-2 py-0.5 rounded">
                      {p.orderNumber}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm mt-1">{p.label}</h3>
                    <p className="text-xs text-slate-500">{p.clientName} | {p.targetName}</p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      p.qcStatus === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : p.qcStatus === 'REJECTED'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-sky-50 text-sky-800 border-sky-200'
                    }`}
                  >
                    {p.qcStatus === 'APPROVED'
                      ? '✓ Schváleno'
                      : p.qcStatus === 'REJECTED'
                      ? '✕ Vráceno'
                      : '⏳ Čeká na kontrolu'}
                  </span>
                </div>

                {/* Photo Preview Container */}
                <div className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
                  {p.installedPhotoUrl ? (
                    <>
                      <img src={p.installedPhotoUrl} alt={p.label} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setZoomPhotoUrl(p.installedPhotoUrl!)}
                        className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white font-bold text-xs gap-1"
                      >
                        <ZoomIn size={18} /> Zvětšit snímek
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                      <ImageIcon size={32} />
                      <span className="mt-1">Chybí fotka</span>
                    </div>
                  )}
                </div>

                {p.qcNote && (
                  <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 italic">
                    Poznámka kontroly: {p.qcNote}
                  </p>
                )}
              </div>

              {/* Actions Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setRejectingPoint(p)}
                  disabled={submitting}
                  className="flex-1 btn border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1"
                >
                  <XCircle size={14} /> Vrátit k opravě
                </button>

                <button
                  onClick={() => handleApprove(p)}
                  disabled={submitting || p.qcStatus === 'APPROVED'}
                  className="flex-1 btn bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1"
                >
                  <Check size={14} /> Schválit ✔
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {zoomPhotoUrl && (
        <div
          onClick={() => setZoomPhotoUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 cursor-pointer"
        >
          <div className="max-w-4xl max-h-[90vh] relative">
            <img src={zoomPhotoUrl} alt="Zvětšená fotka" className="w-full h-full object-contain rounded-2xl" />
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={handleConfirmReject} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Vrátit fotodokumentaci k opravě</h3>
            <p className="text-xs text-slate-500">
              Napište montážnímu pracovníkovi důvod zamítnutí snímku pro bod <b>{rejectingPoint.label}</b>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Důvod zamítnutí / pokyny pro montéra</label>
              <textarea
                required
                rows={3}
                placeholder="např. Fotografie je rozmazaná, vyfoťte detail uchycení cedule..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingPoint(null)}
                className="btn border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold px-4 py-2 rounded-lg"
              >
                Zrušit
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                Potvrdit vrácení k opravě
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
