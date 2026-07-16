import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { NavigationOfferForm } from '@/components/offers/NavigationOfferForm';
import { getOffer } from '@/lib/offers/service';
import { getSpecializedOfferOptions } from '@/lib/offers/specialized';
import type { OfferView } from '@/lib/offers/view-model';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function EditNavigationOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('offers');
  const id = (await params).id;
  const [offer, { clients }] = await Promise.all([getOffer(user, id) as Promise<OfferView>, getSpecializedOfferOptions()]);
  if (offer.offerType !== 'NAVIGATION' || offer.status !== 'DRAFT') notFound();
  return <AppShell><NavigationOfferForm clients={clients} initialOffer={offer} /></AppShell>;
}
