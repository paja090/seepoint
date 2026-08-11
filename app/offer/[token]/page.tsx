import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { SpecializedOfferSummary } from '@/components/offers/SpecializedOfferSummary';
import { SpecializedOfferResponseActions } from '@/components/offers/SpecializedOfferResponseActions';
import { OfferValidationError } from '@/lib/offers/domain';
import { toProposalOffer } from '@/lib/offers/presentation';
import { getPublicOffer } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';

export const dynamic = 'force-dynamic';

async function loadOffer(token: string) {
  try {
    return await getPublicOffer(token) as OfferView;
  } catch (error) {
    if (error instanceof OfferValidationError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const offer = await loadOffer((await params).token);
  const title = `${offer.campaignName || offer.title} | SeePOINT`;
  const description = offer.clientMessage || offer.campaignGoal || `Reklamní nabídka připravená pro ${offer.client.name}.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function PublicOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const offer = await loadOffer(token);

  if (offer.offerType === 'NAVIGATION' || offer.offerType === 'CITY_GALLERY') {
    const navigationMode = (offer.navigation as unknown as { proposalMode?: string } | undefined)?.proposalMode;
    const isLocationSelection = offer.offerType === 'NAVIGATION' && navigationMode !== 'PRICED_QUOTE';
    return (
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-500">
                  {offer.client.logoUrl ? <img alt={`Logo ${offer.client.name}`} className="h-full w-full object-contain p-2" src={offer.client.logoUrl} /> : offer.client.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-sky-600">SeePOINT · Nabídka navigace</p>
                  <h1 className="text-2xl font-black text-slate-900">{offer.campaignName || offer.title}</h1>
                  <p className="text-sm font-semibold text-slate-500">Připraveno pro společnost {offer.client.name}</p>
                </div>
              </div>
            </div>
          </header>
          <SpecializedOfferSummary offer={offer} proposalKey={token} />
          {isLocationSelection ? null : <SpecializedOfferResponseActions status={offer.status} token={token} />}
        </div>
      </div>
    );
  }

  return <OfferProposal offer={toProposalOffer(offer)} token={token} />;
}
