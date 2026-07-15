import { Eye, Lock, Receipt, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { MEDIA_TYPE_META, type ProposalMediaTypeKey } from '@/lib/offers/presentation';
import type { OfferView } from '@/lib/offers/view-model';
import { OfferProcessStepper } from './OfferProcessStepper';

const money = (value: string | number | null) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 2 }).format(Number(value ?? 0));
const mediaLabel = (value: string) => MEDIA_TYPE_META[(value in MEDIA_TYPE_META ? value : 'OTHER') as ProposalMediaTypeKey].label;

export function OfferPricing({ offer }: { offer: OfferView }) {
  const groups = [...new Set(offer.items.map((item) => item.groupLabel || item.surface.mediaType))].map((group) => {
    const items = offer.items.filter((item) => (item.groupLabel || item.surface.mediaType) === group);
    return { group, items, total: items.reduce((sum, item) => sum + Number(item.subtotal ?? 0), 0) };
  });
  const budget = Number(offer.budget ?? 0);
  const subtotal = Number(offer.subtotal ?? 0);
  const budgetDifference = budget ? budget - subtotal : null;

  return (
    <div className="space-y-6">
      <OfferProcessStepper current="pricing" offerId={offer.id!} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {groups.map(({ group, items, total }) => (
            <section className="card" key={group}>
              <div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{mediaLabel(group)}</h2><span className="text-sm font-semibold text-slate-950">{money(total)}</span></div>
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div className="flex items-center gap-3 py-3" key={item.id ?? item.surfaceId}>
                    <div className="min-w-0 flex-1"><p className="font-medium text-slate-900">{item.customTitle || `${item.surface.carrier.code} · ${item.surface.name}`}</p><p className="text-xs text-slate-500">{item.surface.carrier.city} · {item.dateFrom} – {item.dateTo}</p></div>
                    <div className="hidden text-right text-xs text-slate-500 sm:block">{Number(item.quantity).toLocaleString('cs-CZ')} {item.unit} × {money(item.unitPrice)}</div>
                    <div className="w-28 text-right font-semibold text-slate-950">{money(item.subtotal)}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className="card border-dashed !border-slate-300 bg-slate-50/60">
            <div className="flex items-center gap-2"><Lock aria-hidden="true" className="text-slate-500" size={16} /><span className="text-sm font-semibold text-slate-800">Interní rozpočtová kontrola</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">Neviditelné klientovi</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <InternalStat label="Rozpočet klienta" value={budget ? money(budget) : 'Neuveden'} />
              <InternalStat label="Cena bez DPH" value={money(subtotal)} />
              <InternalStat label="Rozdíl proti rozpočtu" tone={budgetDifference != null && budgetDifference < 0 ? 'amber' : 'green'} value={budgetDifference == null ? '—' : money(budgetDifference)} />
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="card">
            <div className="mb-4 flex items-center gap-2"><Receipt aria-hidden="true" className="text-slate-500" size={18} /><h2 className="text-base font-semibold text-slate-950">Souhrn nabídky</h2></div>
            <dl className="space-y-2.5 text-sm">
              <PriceRow label="Cena před slevou" value={money(offer.subtotalBeforeDiscount)} />
              <PriceRow className="text-emerald-700" label="Sleva" value={`−${money(offer.discountAmount)}`} />
              <PriceRow border label="Cena bez DPH" value={money(offer.subtotal)} />
              <PriceRow label={`DPH (${offer.taxRate ?? 0} %)`} value={money(offer.taxAmount)} />
            </dl>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-white"><span className="text-sm font-medium">Celkem s DPH</span><span className="text-xl font-semibold tracking-tight">{money(offer.totalWithTax)}</span></div>
            <Link className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700" href={`/offers/${offer.id}/approval`}><TrendingUp aria-hidden="true" size={16} />Odeslat ke schválení</Link>
            <Link className="mt-3 inline-flex w-full items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900" href={`/offers/${offer.id}/edit`}><Eye aria-hidden="true" size={15} />Upravit položky a ceny</Link>
          </section>
        </aside>
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 pt-6"><Link className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700" href={`/offers/${offer.id}/planner`}>← Zpět: Plánování</Link><Link className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white" href={`/offers/${offer.id}/approval`}>Pokračovat: Interní schválení →</Link></footer>
    </div>
  );
}

function PriceRow({ label, value, border, className = '' }: { label: string; value: string; border?: boolean; className?: string }) {
  return <div className={`flex justify-between ${border ? 'border-t border-slate-100 pt-2.5' : ''}`}><dt className="text-slate-600">{label}</dt><dd className={`font-medium ${className || 'text-slate-900'}`}>{value}</dd></div>;
}

function InternalStat({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'green' | 'amber' }) {
  const color = tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-950';
  return <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p></div>;
}
