'use client';

import { Receipt, ShieldCheck, Calendar, CreditCard, Sparkles } from 'lucide-react';
import type { ProposalOffer } from '@/lib/offers/presentation';
import { formatCzk, formatCzkDecimal } from '@/lib/offers/presentation';

export function PricingSummary({ offer }: { offer: ProposalOffer }) {
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
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950" id="pricing-heading">
              Cenová kalkulace kampaně
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Přehledný rozpad nákladů na pronájem, výrobu, instalaci a platné slevy.
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
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Celková částka k úhradě
            </span>
            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {totalRow ? formatCzkDecimal(totalRow.amount) : '0,00 Kč'}
            </div>
            <p className="text-xs text-slate-400">včetně DPH 21 %</p>
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
