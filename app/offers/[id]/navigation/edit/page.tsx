import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { NavigationOfferForm } from '@/components/offers/NavigationOfferForm';
import { getOffer } from '@/lib/offers/service';
import { getSpecializedOfferOptions } from '@/lib/offers/specialized';
import type { OfferView } from '@/lib/offers/view-model';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function EditNavigationOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const user = await requirePageAccess('offers');
  const id = (await params).id;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialMode = resolvedSearchParams?.mode === 'pricing' ? ('PRICED_QUOTE' as const) : undefined;
  const [offer, { clients }] = await Promise.all([getOffer(user, id) as Promise<OfferView>, getSpecializedOfferOptions()]);
  if (offer.offerType !== 'NAVIGATION') notFound();
  return <AppShell><NavigationOfferForm clients={clients} initialOffer={offer} initialMode={initialMode} /></AppShell>;
}
