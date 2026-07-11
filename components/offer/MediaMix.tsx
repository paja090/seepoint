import type { MockOffer } from '@/lib/mock-offer-data';
import { formatCzk } from '@/lib/mock-offer-data';
import { MediaMixCard } from './MediaMixCard';
import { SectionHeading } from './SectionHeading';

export function MediaMix({ offer }: { offer: MockOffer }) {
  const totalMedia = offer.mediaMix.reduce((sum, media) => sum + media.subtotal, 0);
  const totalSurfaces = offer.mediaMix.reduce((sum, media) => sum + media.surfaceCount, 0);

  return (
    <section aria-labelledby="media-mix-heading">
      <SectionHeading
        id="media-mix-heading"
        eyebrow="Media mix"
        title="Přehled médií v kampani"
        description="Vybraná média se vzájemně doplňují a zajišťují pokrytí pěší i automobilové dopravy."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {offer.mediaMix.map((media) => (
          <MediaMixCard
            key={media.key}
            media={media}
            sharePercent={Math.round((media.subtotal / totalMedia) * 100)}
          />
        ))}
        <div className="flex flex-col justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm font-medium text-slate-500">Celkem media mix</p>
          <p className="text-3xl font-semibold tracking-tight text-slate-950">{formatCzk(totalMedia)}</p>
          <p className="text-sm text-slate-500">{totalSurfaces} reklamních ploch napříč 5 typy médií.</p>
        </div>
      </div>
    </section>
  );
}
