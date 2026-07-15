import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { OfferPricing } from '@/components/offers/OfferPricing';
import { PageHeader } from '@/components/ui';
import { OfferValidationError } from '@/lib/offers/domain';
import { getOffer } from '@/lib/offers/service';
import { listOfferPriceRules } from '@/lib/offers/price-rules';
import type { OfferView } from '@/lib/offers/view-model';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function OfferPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('offers');
  try {
    const [offer, priceRules] = await Promise.all([getOffer(user, (await params).id) as Promise<OfferView>, listOfferPriceRules(true)]);
    return <AppShell><PageHeader description={`${offer.campaignName} · ${offer.client.name}`} title="Cenotvorba a kalkulace" /><OfferPricing offer={offer} priceRules={priceRules} /></AppShell>;
  } catch (error) {
    if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
}
