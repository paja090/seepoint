import { notFound } from 'next/navigation';
import { OfferProposal } from '@/components/offer/OfferProposal';
import { getPublicOffer } from '@/lib/offers/service';
import { OfferValidationError } from '@/lib/offers/domain';
import type { OfferView } from '@/lib/offers/view-model';
import { toProposalOffer } from '@/lib/offers/presentation';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reklamní nabídka | SeePOINT', robots: { index: false, follow: false } };
export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) { const token = (await params).token; let offer: OfferView; try { offer = await getPublicOffer(token) as OfferView; } catch (error) { if (error instanceof OfferValidationError) notFound(); throw error; } return <OfferProposal offer={toProposalOffer(offer)} token={token} />; }
