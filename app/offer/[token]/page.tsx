import type { Metadata } from 'next';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { getMockOfferByToken } from '@/lib/mock-offer-data';

export const metadata: Metadata = {
  title: 'Nabídka reklamní kampaně | SeePOINT',
  description: 'Návrh venkovní reklamní kampaně připravený společností SeePOINT.',
  robots: { index: false, follow: false },
};

export default async function PublicOfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = getMockOfferByToken(token);

  return <OfferProposal offer={offer} variant="public" />;
}
