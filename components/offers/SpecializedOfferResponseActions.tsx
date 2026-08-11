'use client';

import { useState } from 'react';
import { CheckCircle2, HelpCircle, PencilLine } from 'lucide-react';
import { OfferActionDialog, type OfferActionType } from '@/components/offer/OfferActionDialog';

export function SpecializedOfferResponseActions({ status, token }: { status: string; token: string }) {
  const [action, setAction] = useState<OfferActionType | null>(null);
  const canRespond = status === 'SENT';

  if (!canRespond) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Rozhodnutí k nabídce bylo zaznamenáno</h2>
        <p className="mt-2 text-sm text-slate-600">Tato nabídka už není ve stavu, ve kterém ji lze znovu schválit nebo odmítnout.</p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-black text-slate-950">Vyhovuje vám tato navigační nabídka?</h2>
          <p className="mt-2 text-sm text-slate-600">Schválením potvrdíte zájem o realizaci. SeePOINT následně připraví zakázku a termín montáže.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700" onClick={() => setAction('approve')} type="button"><CheckCircle2 size={18} />Schválit nabídku</button>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 text-sm font-bold text-sky-800 hover:bg-sky-50" onClick={() => setAction('revision')} type="button"><PencilLine size={18} />Požádat o úpravu</button>
            <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => setAction('question')} type="button"><HelpCircle size={18} />Mám dotaz</button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Požadavek na úpravu ani dotaz nabídku neschválí. Zpráva se uloží k nabídce pro obchodníka SeePOINT.</p>
        </div>
      </section>
      <OfferActionDialog action={action} offerStatus={status} onClose={() => setAction(null)} onReject={() => setAction('reject')} token={token} />
    </>
  );
}
