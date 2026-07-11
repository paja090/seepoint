'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ImageOff, MapPinOff, Send, ShieldCheck, XCircle } from 'lucide-react';
import { TONE_CLASSES } from '@/lib/mock-offer-data';
import { approvalChecklist, missingAssets, type ChecklistItem } from '@/lib/mock-sales-data';
import { WorkflowStepper } from './WorkflowStepper';
import { Chip, WorkflowFooter } from './ui';

const STATUS_META: Record<ChecklistItem['status'], { icon: React.ReactNode; ring: string; bg: string; text: string; label: string }> = {
  ok: { icon: <CheckCircle2 size={18} />, ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'V pořádku' },
  warning: { icon: <AlertTriangle size={18} />, ring: 'ring-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Upozornění' },
  error: { icon: <XCircle size={18} />, ring: 'ring-red-200', bg: 'bg-red-50', text: 'text-red-700', label: 'Chybí' },
};

export function ApprovalReview() {
  const [resolvedAssets, setResolvedAssets] = useState<Set<string>>(new Set());

  const openErrors = useMemo(
    () => approvalChecklist.filter((item) => item.status === 'error').length,
    [],
  );
  const outstandingAssets = missingAssets.filter((asset) => !resolvedAssets.has(asset.id));
  const canSend = outstandingAssets.length === 0;

  return (
    <div className="space-y-6">
      <WorkflowStepper current="approval" />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Checklist */}
          <section className="card">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck aria-hidden className="text-slate-500" size={18} />
              <h2 className="text-base font-semibold text-slate-950">Kontrola před odesláním</h2>
              <Chip className="ml-auto" tone={openErrors > 0 ? 'red' : 'green'}>
                {approvalChecklist.filter((i) => i.status === 'ok').length}/{approvalChecklist.length} splněno
              </Chip>
            </div>
            <ul className="space-y-2.5">
              {approvalChecklist.map((item) => {
                const meta = STATUS_META[item.status];
                return (
                  <li className={`flex items-start gap-3 rounded-xl p-3 ring-1 ${meta.ring} ${meta.bg}`} key={item.id}>
                    <span className={`mt-0.5 ${meta.text}`}>{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{item.label}</p>
                        <span className={`text-xs font-semibold ${meta.text}`}>· {meta.label}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-slate-600">{item.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Missing assets */}
          <section className="card">
            <div className="mb-4 flex items-center gap-2">
              <ImageOff aria-hidden className="text-slate-500" size={18} />
              <h2 className="text-base font-semibold text-slate-950">Chybějící podklady</h2>
              <Chip className="ml-auto" tone={outstandingAssets.length > 0 ? 'orange' : 'green'}>
                {outstandingAssets.length} k doplnění
              </Chip>
            </div>
            {outstandingAssets.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
                <CheckCircle2 aria-hidden size={16} /> Všechny podklady doplněny. Nabídka je připravena k odeslání.
              </p>
            ) : (
              <div className="space-y-2.5">
                {missingAssets.map((asset) => {
                  const done = resolvedAssets.has(asset.id);
                  return (
                    <div
                      className={`flex items-center gap-3 rounded-xl border p-3 transition ${done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200'}`}
                      key={asset.id}
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-lg text-white ${TONE_CLASSES[asset.tone].bg}`}>
                        {asset.type === 'photo' ? <Camera aria-hidden size={16} /> : <MapPinOff aria-hidden size={16} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{asset.surface} · {asset.city}</p>
                        <p className="text-xs text-slate-500">{asset.type === 'photo' ? 'Chybí fotodokumentace plochy' : 'Chybí GPS souřadnice'}</p>
                      </div>
                      <button
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${done ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        onClick={() =>
                          setResolvedAssets((prev) => {
                            const next = new Set(prev);
                            if (next.has(asset.id)) next.delete(asset.id);
                            else next.add(asset.id);
                            return next;
                          })
                        }
                        type="button"
                      >
                        {done ? <><CheckCircle2 aria-hidden size={15} /> Doplněno</> : 'Doplnit'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Decision rail */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="card">
            <h2 className="text-base font-semibold text-slate-950">Rozhodnutí</h2>
            <p className="mt-1 text-sm text-slate-500">
              Nabídku lze odeslat klientovi až po doplnění všech povinných podkladů.
            </p>

            <div className={`mt-4 rounded-xl p-4 ring-1 ${canSend ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}>
              <p className={`flex items-center gap-2 text-sm font-semibold ${canSend ? 'text-emerald-700' : 'text-amber-700'}`}>
                {canSend ? <CheckCircle2 aria-hidden size={16} /> : <AlertTriangle aria-hidden size={16} />}
                {canSend ? 'Připraveno k odeslání' : `Zbývá doplnit ${outstandingAssets.length} podkladů`}
              </p>
            </div>

            <a
              aria-disabled={!canSend}
              className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${canSend ? 'bg-slate-950 text-white hover:bg-slate-800' : 'pointer-events-none bg-slate-200 text-slate-400'}`}
              href={canSend ? '/offers/preview' : undefined}
              target={canSend ? '_blank' : undefined}
              rel="noreferrer"
            >
              <Send aria-hidden size={16} /> Odeslat nabídku klientovi
            </a>
            <p className="mt-3 text-center text-xs text-slate-400">Otevře klientský náhled nabídky</p>
          </section>
        </aside>
      </div>

      <WorkflowFooter current="approval" nextLabel="Pokračovat: Nabídka klientovi" />
    </div>
  );
}
