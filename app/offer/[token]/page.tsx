import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OfferProposal } from '@/components/offer/OfferProposal';
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
  return <OfferProposal offer={toProposalOffer(offer)} token={token} />;
}
