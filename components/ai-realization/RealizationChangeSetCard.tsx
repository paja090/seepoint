'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  MapPin,
  FileEdit,
  ArrowRight,
} from 'lucide-react';

interface ChangeSetDiff {
  hasChanges?: boolean;
  addedTargets?: Array<{ name: string; latitude?: number; longitude?: number }>;
  removedTargets?: Array<{ id: string; name: string }>;
  modifiedTargets?: Array<{ id: string; name: string; changes?: Record<string, { from?: unknown; to?: unknown }> }>;
  addedPoints?: Array<{ label: string; latitude?: number; longitude?: number; unitPrice?: unknown }>;
  removedPoints?: Array<{ id: string; label: string; status?: string }>;
  modifiedPoints?: Array<{ id: string; label: string; changes?: Record<string, { from?: unknown; to?: unknown }> }>;
}

export interface PendingChangeSetItem {
  id: string;
  offerId?: string | null;
  navigationOrderId?: string | null;
  crmOrderId?: string | null;
  status: string;
  diff: ChangeSetDiff;
  detectedAt?: Date | string | null;
}

interface RealizationChangeSetCardProps {
  orderId: string;
  changeSets: PendingChangeSetItem[];
  navigationOrderId?: string | null;
  offerId?: string | null;
}

export function RealizationChangeSetCard({
  orderId,
  changeSets,
  navigationOrderId,
  offerId,
}: RealizationChangeSetCardProps) {
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!changeSets || changeSets.length === 0) {
    return null;
  }

  const handleAction = async (changeSetId: string, action: 'apply' | 'reject') => {
    setProcessingId(changeSetId);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/realization/${orderId}/changeset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, changeSetId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Akci se nepodařilo provést.');
      }

      setSuccessMessage(
        action === 'apply'
          ? '✓ Změnový balíček byl úspěšně schválen a nové cíle/body byly promítnuty do realizace.'
          : '✕ Změnový balíček byl odmítnut. Realizace pokračuje v původním rozsahu.'
      );

      // Refresh page data so blockers and items re-evaluate
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Nastala neočekávaná chyba.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div id="changeset-review" className="scroll-mt-6 space-y-4">
      {changeSets.map((cs) => {
        const diff = cs.diff || {};
        const addedTargets = diff.addedTargets || [];
        const addedPoints = diff.addedPoints || [];
        const removedPoints = diff.removedPoints || [];
        const modifiedPoints = diff.modifiedPoints || [];
        const isProcessing = processingId === cs.id;

        return (
          <div
            key={cs.id}
            className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-5 shadow-sm space-y-4"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-200/80 p-2.5 text-amber-900 mt-0.5">
                  <FileEdit className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-amber-950">
                      Změnový balíček z nabídky čeká na schválení
                    </h3>
                    <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                      Scope Change
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    V nabídce došlo k úpravám po zahájení realizace. Schválením promítnete změny do probíhající zakázky.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {navigationOrderId && (
                  <Link
                    href={`/navigation/orders/${navigationOrderId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-950 underline"
                  >
                    Navigační zakázka
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                {offerId && (
                  <Link
                    href={`/offers/${offerId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-950 underline ml-2"
                  >
                    Původní nabídka
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* Diff Breakdown */}
            <div className="rounded-xl bg-white/90 border border-amber-200 p-4 space-y-3 text-xs">
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Přehled zjištěných změn:
              </div>

              {addedTargets.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-semibold text-emerald-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                    Nové cílové lokality k osazení ({addedTargets.length}):
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {addedTargets.map((t, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center gap-2"
                      >
                        <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-emerald-950">{t.name}</div>
                          {t.latitude && t.longitude && (
                            <div className="text-[10px] font-mono text-emerald-700">
                              GPS: {t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {addedPoints.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-semibold text-blue-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                    Nově přidané navigační body ({addedPoints.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {addedPoints.map((p, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-900 font-medium"
                      >
                        📍 {p.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {removedPoints.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-semibold text-rose-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                    Odebrané body ({removedPoints.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {removedPoints.map((p, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-rose-900 line-through"
                      >
                        {p.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {modifiedPoints.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-semibold text-purple-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-500 inline-block" />
                    Upravené body ({modifiedPoints.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {modifiedPoints.map((p, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-900"
                      >
                        ✏️ {p.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {addedTargets.length === 0 &&
                addedPoints.length === 0 &&
                removedPoints.length === 0 &&
                modifiedPoints.length === 0 && (
                  <p className="text-slate-500 italic">
                    Byly zjištěny evidenční změny v nabídce.
                  </p>
                )}
            </div>

            {/* Error or Success Feedback */}
            {error && (
              <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-amber-800 font-medium">
                Rozhodnutí o změně zakázky:
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleAction(cs.id, 'reject')}
                  className="px-3.5 py-2 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <XCircle className="h-3.5 w-3.5 text-rose-500" />
                  <span>Zamítnout změnu</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleAction(cs.id, 'apply')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Schválit a promítnout do realizace</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
