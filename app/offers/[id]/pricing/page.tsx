import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { OfferPricing } from '@/components/offers/OfferPricing';
import { PageHeader } from '@/components/ui';
import { OfferValidationError } from '@/lib/offers/domain';
import { getOffer } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function OfferPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('offers');
  try {
    const offer = await getOffer(user, (await params).id) as OfferView;
    return <AppShell><PageHeader description={`${offer.campaignName} · ${offer.client.name}`} title="Cenotvorba a kalkulace" /><OfferPricing offer={offer} /></AppShell>;
  } catch (error) {
    if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
}
