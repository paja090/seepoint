import { CalendarRange, Eye, Layers, MapPin, PanelsTopLeft, Users } from 'lucide-react';
import type { MockOffer } from '@/lib/mock-offer-data';
import { formatNumber } from '@/lib/mock-offer-data';

export function OfferStats({ offer }: { offer: MockOffer }) {
  const stats = [
    { icon: PanelsTopLeft, value: formatNumber(offer.stats.carriers), label: 'Vybraných nosičů' },
    { icon: Layers, value: formatNumber(offer.stats.mediaTypes), label: 'Typů médií' },
    { icon: MapPin, value: formatNumber(offer.stats.locations), label: 'Lokalit' },
    { icon: Users, value: `${formatNumber(offer.stats.estimatedReach)}+`, label: 'Odhadovaný zásah' },
    { icon: Eye, value: '2,4 mil.+', label: 'Odhad zobrazení' },
    { icon: CalendarRange, value: `${offer.stats.days} dní`, label: 'Délka kampaně' },
  ];

  return (
    <section aria-label="Statistiky kampaně">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <Icon aria-hidden size={20} />
            </div>
            <p className="text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="text-xs font-medium leading-4 text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-400">Uvedené hodnoty jsou ilustrační.</p>
    </section>
  );
}
