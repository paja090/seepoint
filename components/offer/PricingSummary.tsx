import { Receipt } from 'lucide-react';
import type { ProposalOffer } from '@/lib/offers/presentation';
import { formatCzk, formatCzkDecimal } from '@/lib/offers/presentation';

export function PricingSummary({ offer }: { offer: ProposalOffer }) {
  return (
    <section aria-labelledby="pricing-heading" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
          <Receipt aria-hidden size={20} />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950" id="pricing-heading">
            Kalkulace nabídky
          </h2>
          <p className="text-sm text-slate-500">Přehledné rozpadnutí ceny kampaně.</p>
        </div>
      </div>

      <dl className="divide-y divide-slate-100">
        {offer.pricing.map((row) => {
          const isTotal = row.emphasis === 'total';
          const isSubtotal = row.emphasis === 'subtotal';
          const isDiscount = row.emphasis === 'discount';

          return (
            <div
              key={row.label}
              className={`flex items-start justify-between gap-4 py-3 ${
                isTotal
                  ? '-mx-6 mt-2 rounded-2xl bg-slate-950 px-6 py-4 lg:-mx-8 lg:px-8'
                  : ''
              }`}
            >
              <div className="min-w-0">
                <dt
                  className={`text-sm ${
                    isTotal
                      ? 'font-semibold text-white'
                      : isSubtotal
                        ? 'font-semibold text-slate-900'
                        : 'text-slate-600'
                  }`}
                >
                  {row.label}
                </dt>
                {row.note && <p className={`mt-0.5 text-xs ${isTotal ? 'text-slate-300' : 'text-slate-400'}`}>{row.note}</p>}
              </div>
              <dd
                className={`shrink-0 text-right tabular-nums ${
                  isTotal
                    ? 'text-lg font-semibold text-white'
                    : isSubtotal
                      ? 'text-base font-semibold text-slate-900'
                      : isDiscount
                        ? 'text-sm font-semibold text-emerald-600'
                        : 'text-sm font-medium text-slate-700'
                }`}
              >
                {isTotal ? formatCzkDecimal(row.amount) : formatCzk(row.amount)}
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="mt-4 text-xs leading-5 text-slate-400">
        Kalkulace vychází z uložených položek nabídky. Realizace podléhá potvrzení dostupnosti ploch.
      </p>
    </section>
  );
}
