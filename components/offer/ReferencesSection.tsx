import { Quote } from 'lucide-react';
import type { MockOffer } from '@/lib/mock-offer-data';
import { LogoPlaceholder } from './LogoPlaceholder';
import { SectionHeading } from './SectionHeading';

export function ReferencesSection({ offer }: { offer: MockOffer }) {
  return (
    <section aria-labelledby="references-heading">
      <SectionHeading
        id="references-heading"
        eyebrow="Reference klientů"
        title="Značky, které nám důvěřují"
        description="Ilustrační reference. Skutečná loga a citace doplní obchodní tým."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offer.references.map((reference) => (
          <article
            key={reference.id}
            className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <LogoPlaceholder label={reference.logoLabel} size="sm" />
              <Quote aria-hidden className="text-slate-200" size={28} />
            </div>
            <p className="text-sm leading-6 text-slate-600">{`„${reference.testimonial}“`}</p>
            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
              <span className="font-medium text-slate-500">{reference.cooperation}</span>
              <span className="font-semibold text-sky-600">{reference.campaigns} kampaní</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
