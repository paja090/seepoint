'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  RotateCcw,
  CheckCircle2,
  Camera,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

interface RealizationStatusSyncCardProps {
  orderId: string;
  orderNumber: string;
  overallPhase: string;
  projectType: string;
  navigationOrderId?: string | null;
  totalItems: number;
  photographedItems: number;
  installedItems: number;
  isReadyForBilling: boolean;
}

export function RealizationStatusSyncCard({
  orderId,
  overallPhase,
  navigationOrderId,
  totalItems,
  photographedItems,
  isReadyForBilling,
}: RealizationStatusSyncCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const allPhotographed = totalItems > 0 && photographedItems === totalItems;
  const isPhotoPhase = overallPhase === 'PHOTO_DOCUMENTATION';

  const handleSync = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/realization/${orderId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_ONLY' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se synchronizovat stav.');
      }
      setFeedback({ type: 'success', text: data.message || 'Stav zakázky byl úspěšně synchronizován.' });
      router.refresh();
    } catch (err: unknown) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Chyba synchronizace.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceToBilling = async () => {
    setAdvancing(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/realization/${orderId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADVANCE_TO_BILLING' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nepodařilo se schválit fotodokumentaci.');
      }
      setFeedback({
        type: 'success',
        text: data.message || 'Fotodokumentace schválena. Zakázka je připravena k fakturaci!',
      });
      router.refresh();
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Chyba při schvalování fotodokumentace.',
      });
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Feedback Alert if any */}
      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-4 text-xs font-medium transition ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="flex-1">{feedback.text}</div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Special Action Card when all photos are uploaded in PHOTO_DOCUMENTATION phase */}
      {isPhotoPhase && allPhotographed && !isReadyForBilling && (
        <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-800">
                <Camera className="h-4 w-4 text-teal-600" />
                <span>Fotodokumentace je kompletní ({photographedItems} / {totalItems})</span>
                <span className="rounded bg-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-900">
                  Připraveno ke schválení
                </span>
              </div>
              <p className="text-xs text-teal-900">
                Všech {totalItems} bodů v terénu má pořízenou a nahranou fotodokumentaci.
                Zakázku můžete 1 kliknutím schválit a posunout do fáze fakturace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {navigationOrderId && (
                <Link
                  href="/navigation/qc"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Zkontrolovat v QC
                </Link>
              )}

              <button
                type="button"
                onClick={handleAdvanceToBilling}
                disabled={advancing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                {advancing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Schvaluji...
                  </>
                ) : (
                  <>
                    <FileCheck className="h-3.5 w-3.5" />
                    Schválit a předat k fakturaci
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating / Compact Sync & Refresh Bar */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>Stav fotodokumentace:</span>
          <span className="font-semibold text-slate-900">
            {photographedItems} z {totalItems} ploch vyfoceno
          </span>
          {allPhotographed && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              Kompletní
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSync}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
          title="Ověřit aktuální stav z databáze a synchronizovat realizaci"
        >
          <RotateCcw className={`h-3 w-3 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Ověřuji...' : 'Obnovit stav'}
        </button>
      </div>
    </div>
  );
}
