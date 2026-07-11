import { Camera, Clock, Landmark, MapPin, TrafficCone, Users } from 'lucide-react';
import type { MockBenefit, MockOffer } from '@/lib/mock-offer-data';
import { SectionHeading } from './SectionHeading';

const iconMap: Record<MockBenefit['icon'], typeof Users> = {
  reach: Users,
  clock: Clock,
  pin: MapPin,
  traffic: TrafficCone,
  brand: Landmark,
  camera: Camera,
};

export function BenefitsGrid({ offer }: { offer: MockOffer }) {
  return (
    <section aria-labelledby="benefits-heading">
      <SectionHeading
        id="benefits-heading"
        eyebrow="Proč SeePOINT"
        title="Co vám kampaň přinese"
        description="Silné stránky venkovní reklamy, na kterých je návrh postaven."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {offer.benefits.map((benefit) => {
          const Icon = iconMap[benefit.icon];
          return (
            <article
              key={benefit.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Icon aria-hidden size={20} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">{benefit.title}</h3>
              <p className="text-sm leading-6 text-slate-600">{benefit.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
