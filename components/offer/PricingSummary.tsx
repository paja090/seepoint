'use client';

import { Receipt, ShieldCheck, Calendar, CreditCard, Sparkles } from 'lucide-react';
import type { ProposalCarrier, ProposalOffer } from '@/lib/offers/presentation';
import { formatCzk, formatCzkDecimal } from '@/lib/offers/presentation';



export function PricingSummary({
  offer,
  activeCarriers,
  onRequestPricing,
  onSelectAll,
}: {
  offer: ProposalOffer;
  activeCarriers?: ProposalCarrier[];
  onRequestPricing?: () => void;
  onSelectAll?: () => void;
}) {
  if (offer.isNoPriceConcept) {

    return (
      <section aria-labelledby="concept-pricing-heading" className="rounded-3xl border border-purple-200/80 bg-gradient-to-br from-white via-purple-50/20 to-sky-50/30 p-6 shadow-sm lg:p-8">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-purple-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 ring-1 ring-purple-200">
              <Sparkles aria-hidden size={22} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950" id="concept-pricing-heading">
                Strategický balíček kampaně na klíč
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Připraveno pro společnost {offer.client.name} — nezávazný koncept k výběru lokalit a stanovení rozpočtu.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100/80 px-3.5 py-1 text-xs font-bold text-purple-900 ring-1 ring-purple-300">
              <ShieldCheck size={14} className="text-purple-700" /> Nezávazný koncept k projednání
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          {/* Left: 4 pillars included */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Co všechno tento balíček zahrnuje
            </h3>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <span className="text-base">🎯</span>
                  <span>Výběr & rezervace ploch</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Prověření volných kapacit v požadovaném termínu a přednostní opce na schválené lokality.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <span className="text-base">🖨️</span>
                  <span>UV tisk & tisková data</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Kontrola grafiky, předtisková příprava a velkoformátový tisk odolnými pigmentovými barvami.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <span className="text-base">🛠️</span>
                  <span>Profesionální montáž</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Instalace našimi certifikovanými výlepovými týmy v přesně odsouhlasený den startu.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <span className="text-base">📸</span>
                  <span>100% fotodokumentace</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Protokolární fotoreport každé plochy po instalaci přímo v klientském portálu.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              * Po výběru finálních lokalit připravíme položkovou kalkulaci s garantovanou fixní cenou bez skrytých poplatků.
            </p>
          </div>

          {/* Right: CTA box */}
          <div className="flex flex-col gap-4 rounded-3xl border border-purple-900/60 bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 p-6 sm:p-7 text-white shadow-xl">
            <div className="space-y-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-purple-300">
                Cenová kalkulace na míru
              </span>
              <div className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Rozpočet na vyžádání
              </div>
              <p className="text-xs text-slate-300 pt-1 leading-relaxed">
                Pošlete nám svůj zájem. Obchodník obratem ověří termíny a spočítá přesnou částku pro {offer.carriers.length} vybraných nosičů.
              </p>
            </div>

            {onRequestPricing && (
              <button
                type="button"
                onClick={onRequestPricing}
                className="mt-2 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Sparkles size={16} />
                Požádat o cenovou kalkulaci
              </button>
            )}

            <div className="border-t border-white/10 pt-3 space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Doporučený počet nosičů:</span>
                <span className="font-bold text-white">{offer.carriers.length} ks</span>
              </div>
              <div className="flex justify-between">
                <span>Kategorie médií:</span>
                <span className="font-bold text-white">{offer.mediaMix.length} typy</span>
              </div>
              <div className="flex justify-between">
                <span>Platnost konceptu:</span>
                <span className="font-bold text-white">{offer.validUntil}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const hasZeroSelection = activeCarriers !== undefined && activeCarriers.length === 0;
  const isFiltered = activeCarriers !== undefined && activeCarriers.length !== offer.carriers.length;

  const currentCarriers = activeCarriers || offer.carriers;
  const activeMonthly = currentCarriers.reduce((sum, c) => sum + (Number(c.unitPrice) || 0), 0);
  const activeDaily = Math.round(activeMonthly / 30);
  const activeDailyPerSurface = currentCarriers.length > 0 ? Math.round(activeDaily / currentCarriers.length) : 0;

  if (hasZeroSelection) {
    return (
      <section aria-labelledby="pricing-heading" className="rounded-3xl border-2 border-dashed border-sky-300 bg-gradient-to-br from-sky-50/60 via-white to-emerald-50/40 p-8 sm:p-10 text-center shadow-xs space-y-4">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 font-black text-2xl shadow-inner">
          📊
        </div>
        <div className="space-y-1.5 max-w-xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-black text-slate-950" id="pricing-heading">
            Máte zvolený start od 0 ploch (rozpočet 0 Kč)
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Tento režim vám umožňuje sestavit si kampaň přesně podle rozpočtu. Klikněte na <strong>„+ Přidat do kampaně“</strong> u ploch, které vám dávají největší smysl. Rozpočet se okamžitě živě spočítá.
          </p>
        </div>
        {onSelectAll && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onSelectAll}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-sky-500 transition cursor-pointer"
            >
              ✓ Označit všech {offer.carriers.length} ploch
            </button>
          </div>
        )}
      </section>
    );
  }

  const regularRows = offer.pricing.filter((r) => r.emphasis !== 'total');
  const totalRow = offer.pricing.find((r) => r.emphasis === 'total');

  return (
    <section aria-labelledby="pricing-heading" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
            <Receipt aria-hidden size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950" id="pricing-heading">
                Cenová kalkulace kampaně
              </h2>
              {isFiltered && (
                <span className="rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-xs px-2.5 py-0.5">
                  Přizpůsobeno: {currentCarriers.length} z {offer.carriers.length} ploch
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Přehledný rozpad nákladů na pronájem, výrobu, instalaci a platné slevy.
              {activeDailyPerSurface > 0 && (
                <span className="ml-1 text-emerald-700 font-bold hidden sm:inline">
                  · Denní náklad na 1 plochu: cca {formatCzk(activeDailyPerSurface)} / den.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
            <ShieldCheck size={14} /> Garance fixní ceny
          </span>
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        {/* Left Column: Itemized Breakdown */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Položkový rozpis služeb
          </h3>

          <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            {regularRows.map((row) => {
              const isSubtotal = row.emphasis === 'subtotal';
              const isDiscount = row.emphasis === 'discount';

              return (
                <div
                  key={row.label}
                  className={`flex items-start justify-between gap-4 py-3 first:pt-1 last:pb-1 ${
                    isSubtotal ? 'font-bold text-slate-950 border-t border-slate-200 pt-4 mt-1' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <dt
                      className={`text-sm ${
                        isSubtotal
                          ? 'font-extrabold text-slate-900'
                          : isDiscount
                            ? 'font-bold text-emerald-700'
                            : 'text-slate-700'
                      }`}
                    >
                      {row.label}
                    </dt>
                    {row.note && (
                      <p className={`mt-0.5 text-xs ${isDiscount ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {row.note}
                      </p>
                    )}
                  </div>
                  <dd
                    className={`shrink-0 text-right tabular-nums ${
                      isSubtotal
                        ? 'text-base font-extrabold text-slate-950'
                        : isDiscount
                          ? 'text-sm font-extrabold text-emerald-600'
                          : 'text-sm font-semibold text-slate-800'
                    }`}
                  >
                    {formatCzk(row.amount)}
                  </dd>
                </div>
              );
            })}
          </dl>

          <p className="text-xs text-slate-400 leading-relaxed">
            * Ceny pronájmu ploch vycházejí z ceníkových a sjednaných sazeb. Výroba zahrnuje certifikovaný velkoformátový tisk odolný vůči UV záření a povětrnostním vlivům.
          </p>
        </div>

        {/* Right Column: Total Highlight Box */}
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-900 bg-slate-950 p-6 sm:p-7 text-white shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                Celková částka k úhradě
              </span>
              {isFiltered && (
                <span className="text-[10px] font-black uppercase bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                  {currentCarriers.length} z {offer.carriers.length} ploch
                </span>
              )}
            </div>
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {totalRow ? formatCzkDecimal(totalRow.amount) : '0,00 Kč'}
            </div>
            <p className="text-xs text-slate-400">včetně DPH 21 %</p>

            {activeMonthly > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Měsíční investice:</span>
                  <span className="font-extrabold text-white">{formatCzk(activeMonthly)} / měs.</span>
                </div>
                {activeDailyPerSurface > 0 && (
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span className="text-slate-400 font-normal">Denní náklad na 1 plochu:</span>
                    <span>jen cca {formatCzk(activeDailyPerSurface)} / den</span>
                  </div>
                )}
              </div>
            )}
          </div>


          <div className="space-y-2 border-t border-slate-800 pt-4 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Calendar size={13} /> Platnost kalkulace:
              </span>
              <strong className="text-white font-bold">{offer.validUntil}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <CreditCard size={13} /> Platební podmínky:
              </span>
              <span className="text-slate-200">Faktura se splatností 14 dní</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Sparkles size={13} className="text-purple-400" /> Rezervace termínu:
              </span>
              <span className="text-emerald-400 font-bold">Okamžitá po schválení</span>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/90 p-3.5 border border-slate-800 text-xs text-slate-400 leading-relaxed">
            Potvrzením této nabídky dochází k blokaci termínu a zahájení přípravy tiskových podkladů. Všechny ceny jsou garantované po dobu platnosti nabídky.
          </div>
        </div>
      </div>
    </section>
  );
}
