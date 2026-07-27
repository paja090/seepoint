import { GalleryHorizontalEnd } from 'lucide-react';
import type { OfferView } from '@/lib/offers/view-model';
import { NavigationOfferPublicView } from './NavigationOfferPublicView';

export function SpecializedOfferSummary({ offer }: { offer: OfferView }) {
  if (offer.offerType === 'NAVIGATION' && offer.navigation) {
    return <NavigationOfferPublicView offer={offer} />;
  }
  if (offer.offerType === 'CITY_GALLERY') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-fuchsia-100 p-2 text-fuchsia-700">
            <GalleryHorizontalEnd size={21} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-fuchsia-700">Galerie venku</p>
            <h2 className="text-xl font-semibold">{offer.cityGallery?.projectTitle || offer.campaignName}</h2>
          </div>
        </div>
        <dl className="mt-6 grid gap-5 md:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold text-slate-400">Koncept</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{offer.cityGallery?.concept || 'Bude doplněno'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400">Lokalita</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{offer.cityGallery?.locationBrief || 'Bude doplněno'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400">Realizace</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{offer.cityGallery?.realizationNote || 'Bude doplněno'}</dd>
          </div>
        </dl>
      </section>
    );
  }
  return null;
}
