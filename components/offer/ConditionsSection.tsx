import { Check } from 'lucide-react';
import type { MockOffer } from '@/lib/mock-offer-data';

export function ConditionsSection({ offer }: { offer: MockOffer }) {
  return (
    <section
      aria-labelledby="conditions-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8"
    >
      <h2 className="text-xl font-semibold tracking-tight text-slate-950" id="conditions-heading">
        Podmínky kampaně
      </h2>
      <p className="mt-1 text-sm text-slate-500">Shrnutí klíčových podmínek této nabídky.</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {offer.conditions.map((condition) => (
          <li key={condition.id} className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <Check aria-hidden size={14} />
            </span>
            <span className="text-sm leading-6 text-slate-600">{condition.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
