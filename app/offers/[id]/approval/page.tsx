import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { OfferApproval } from '@/components/offers/OfferApproval';
import { PageHeader } from '@/components/ui';
import { OfferValidationError } from '@/lib/offers/domain';
import { checkOfferAvailability, getOffer } from '@/lib/offers/service';
import type { OfferView } from '@/lib/offers/view-model';
import { offerAvailabilityInput } from '@/lib/offers/workflow';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function OfferApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('offers');
  try {
    const offer = await getOffer(user, (await params).id) as OfferView;
    const availability = offer.offerType === 'STANDARD_MEDIA' || !offer.offerType ? await checkOfferAvailability(user, offerAvailabilityInput(offer)) : { conflicts: [] };
    return <AppShell><PageHeader description={`${offer.campaignName} · ${offer.client.name}`} title="Interní schválení nabídky" /><OfferApproval conflicts={availability.conflicts} offer={offer} /></AppShell>;
  } catch (error) {
    if (error instanceof OfferValidationError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
}
