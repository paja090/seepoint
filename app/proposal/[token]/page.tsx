import { notFound } from 'next/navigation';
import { ProposalView } from '@/components/offers/ProposalView';
import { PublicOfferActions } from '@/components/offers/PublicOfferActions';
import { getPublicOffer } from '@/lib/offers/service';
import { OfferValidationError } from '@/lib/offers/domain';
import type { OfferView } from '@/lib/offers/view-model';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reklamní nabídka | SeePOINT', robots: { index: false, follow: false } };
export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) { const token = (await params).token; let offer: OfferView; try { offer = await getPublicOffer(token) as OfferView; } catch (error) { if (error instanceof OfferValidationError) notFound(); throw error; } return <main className="min-h-screen bg-slate-50"><ProposalView offer={offer} publicView /><PublicOfferActions token={token} status={offer.status} /></main>; }
