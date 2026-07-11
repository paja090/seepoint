import { SectionHeading } from './SectionHeading';
import { pricing, discount, vatRate } from '@/lib/proposal-data';

const fmt = (n: number) => new Intl.NumberFormat('cs-CZ').format(n) + ' Kč';

export function PriceCalculation() {
  const gross = pricing.reduce((sum, p) => sum + p.value, 0);
  const subtotal = gross - discount;
  const vat = Math.round(subtotal * vatRate);
  const total = subtotal + vat;

  return (
    <section className="mx-auto mt-20 max-w-6xl px-6 lg:mt-28">
      <SectionHeading
        eyebrow="Investment"
        title="Transparent price calculation"
        description="A complete breakdown of everything included in your Summer Campaign 2026."
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft lg:p-8">
          <dl className="divide-y divide-slate-100">
            {pricing.map((p) => (
              <div key={p.label} className="flex items-center justify-between py-3.5">
                <dt className="text-sm text-slate-600">{p.label}</dt>
                <dd className="text-sm font-semibold text-slate-900">{fmt(p.value)}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between py-3.5">
              <dt className="text-sm font-medium text-emerald-600">Discount</dt>
              <dd className="text-sm font-semibold text-emerald-600">− {fmt(discount)}</dd>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <dt className="text-sm font-semibold text-slate-900">Subtotal (excl. VAT)</dt>
              <dd className="text-sm font-semibold text-slate-900">{fmt(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between py-3.5">
              <dt className="text-sm text-slate-600">VAT (21%)</dt>
              <dd className="text-sm font-semibold text-slate-900">{fmt(vat)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-brand/20 bg-brand/[0.04] p-6 shadow-soft lg:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Total investment</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-end justify-between">
                <span className="text-sm text-slate-600">Total without VAT</span>
                <span className="text-lg font-semibold text-slate-900">{fmt(subtotal)}</span>
              </div>
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-brand/10">
                <span className="text-sm text-slate-500">Total with VAT</span>
                <p className="mt-1 text-balance text-4xl font-semibold tracking-tight text-brand">{fmt(total)}</p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-slate-500">
            Pricing valid for 30 days from the date of this proposal. Includes production, installation,
            monitoring and post-campaign reporting.
          </p>
        </div>
      </div>
    </section>
  );
}
