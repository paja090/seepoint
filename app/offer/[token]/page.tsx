import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { SpecializedOfferSummary } from '@/components/offers/SpecializedOfferSummary';
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
    return (
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-widest text-sky-600">SeePOINT · Nabídka navigace</p>
              <h1 className="text-2xl font-black text-slate-900">{offer.campaignName || offer.title}</h1>
              <p className="text-sm font-semibold text-slate-500">Připraveno pro společnost {offer.client.name}</p>
            </div>
            <a
              href={`/api/proposals/${encodeURIComponent(token)}/pdf`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition shrink-0"
              target="_blank"
              rel="noreferrer"
            >
              📄 Stáhnout PDF nabídku
            </a>
          </header>
          <SpecializedOfferSummary offer={offer} />
        </div>
      </div>
    );
  }

  return <OfferProposal offer={toProposalOffer(offer)} token={token} />;
}
