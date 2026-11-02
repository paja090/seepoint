'use client';

import { useState } from 'react';
import { CheckCircle2, HelpCircle, MapPin, PencilLine } from 'lucide-react';
import { OfferActionDialog, type OfferActionType } from '@/components/offer/OfferActionDialog';

export function SpecializedOfferResponseActions({
  status,
  token,
  isLocationSelection,
  offerType,
  pointsCount,
  isFooter = false,
  placement,
}: {
  status: string;
  token: string;
  isLocationSelection?: boolean;
  offerType?: string | null;
  pointsCount?: number;
  isFooter?: boolean;
  placement?: 'top' | 'bottom';
}) {
  const [action, setAction] = useState<OfferActionType | null>(null);
  const isTop = placement === 'top' || (!placement && !isFooter);
  const canRespond = !['ACCEPTED', 'REJECTED', 'ARCHIVED', 'CONVERTED'].includes(status);
  const isAccepted = ['ACCEPTED', 'CONVERTED'].includes(status);
  const isRejected = status === 'REJECTED';

  if (!canRespond) {
    if (!isTop) return null;
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {isAccepted ? (
          <div className="flex flex-col items-center justify-center gap-2 text-emerald-800">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={26} />
            </span>
            <h2 className="text-xl font-black text-slate-950">Nabídka byla schválena</h2>
            <p className="max-w-xl text-sm text-slate-600">
              Děkujeme za schválení této nabídky. Obchodník a náš realizační tým již připravují zakázku a podklady k realizaci.
            </p>
          </div>
        ) : isRejected ? (
          <div className="text-slate-800">
            <h2 className="text-lg font-bold text-slate-900">Nabídka byla odmítnuta</h2>
            <p className="mt-1 text-sm text-slate-600">Pokud máte zájem o jiné řešení nebo lokalitu, kontaktujte prosím svého obchodníka.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-bold text-slate-900">Rozhodnutí k nabídce bylo zaznamenáno</h2>
            <p className="mt-2 text-sm text-slate-600">Tato nabídka už není ve stavu, ve kterém ji lze znovu schválit nebo odmítnout.</p>
          </div>
        )}
      </section>
    );
  }

  const approveButtonText = isLocationSelection ? 'Potvrdit výběr lokalit' : 'Schválit nabídku';
  const hasNavigationPoints = offerType === 'NAVIGATION' || typeof pointsCount === 'number';

  return (
    <>
      <section
        id={isTop ? 'offer-approval-top' : 'offer-approval-bottom'}
        className={`overflow-hidden rounded-3xl border p-6 shadow-sm transition-all sm:p-7 ${
          isTop
            ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/95 via-white to-sky-50/80 shadow-md ring-2 ring-emerald-500/10'
            : 'border-emerald-200 bg-emerald-50/90'
        }`}
      >
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-black tracking-wide text-emerald-900">
                  <CheckCircle2 size={13} className="text-emerald-700" />
                  {isLocationSelection ? 'Rozhodnutí k lokačnímu návrhu' : 'Schválení nabídky klientem'}
                </span>
                {hasNavigationPoints && typeof pointsCount === 'number' && pointsCount > 0 && (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-800">
                    Celkem {pointsCount} {pointsCount === 1 ? 'navržený bod' : pointsCount < 5 ? 'navržené body' : 'navržených bodů'}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-black text-slate-950 sm:text-2xl">
                {isLocationSelection ? 'Vyhovuje vám tento navigační návrh?' : 'Vyhovuje vám tato cenová nabídka?'}
              </h2>

              <p className="max-w-2xl text-xs sm:text-sm text-slate-600 leading-relaxed">
                {isLocationSelection
                  ? 'Potvrzením schválíte výběr bodů a trasu bez cenových závazků. Dodavatel následně připraví přesnou cenovou nabídku pro vybrané pozice.'
                  : 'Schválením potvrdíte zájem o realizaci. Dodavatel následně připraví zakázku, tiskové podklady a domluví termín montáže.'}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap md:shrink-0">
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-md transition hover:bg-emerald-700 cursor-pointer"
                onClick={() => setAction('approve')}
                type="button"
              >
                <CheckCircle2 size={18} />
                {approveButtonText}
              </button>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-4 py-3 text-sm font-bold text-sky-900 shadow-2xs transition hover:bg-sky-50 cursor-pointer"
                onClick={() => setAction('revision')}
                type="button"
              >
                <PencilLine size={17} />
                Požádat o úpravu
              </button>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
                onClick={() => setAction('question')}
                type="button"
              >
                <HelpCircle size={17} />
                Mám dotaz
              </button>
            </div>
          </div>

          {/* 📍 Point Selection Guidance Note for the Client */}
          {hasNavigationPoints && isTop && (
            <div className="mt-5 rounded-2xl border border-sky-200 bg-white/90 p-4 text-left shadow-2xs backdrop-blur-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 font-bold border border-sky-200">
                    <MapPin size={18} />
                  </span>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900">
                      V nabídce si můžete sami označit a vybrat konkrétní body
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">
                      Nemusíte realizovat celou síť. Níže na mapě a v seznamu můžete u každého navigačního bodu kliknout na tlačítko <strong>„+ Vybrat do nabídky“</strong> nebo <strong>„✓ Vybráno v nabídce“</strong>. Nabídka i celková cena se automaticky přizpůsobí pouze vámi označeným bodům.
                    </p>
                  </div>
                </div>

                <a
                  href="#nav-points-section"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-900 shadow-2xs hover:bg-sky-100 transition cursor-pointer self-start sm:self-auto"
                >
                  <MapPin size={14} className="text-sky-600" />
                  Zobrazit body na mapě ➔
                </a>
              </div>
            </div>
          )}

          <p className="mt-3 text-left text-[11px] text-slate-500">
            Požadavek na úpravu ani dotaz nabídku neschválí. Vaše zpráva se okamžitě doručí přidělenému obchodníkovi.
          </p>
        </div>
      </section>
      <OfferActionDialog
        action={action}
        offerStatus={status}
        onClose={() => setAction(null)}
        onReject={() => setAction('reject')}
        token={token}
        isLocationSelection={isLocationSelection}
      />
    </>
  );
}

