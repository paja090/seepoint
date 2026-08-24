import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { OfferWizard } from '@/components/offers/OfferWizard';
import { requirePageAccess } from '@/lib/page-auth';
import { getOffer } from '@/lib/offers/service';
import { getOfferFormOptions } from '@/lib/offers/form-options';
import type { OfferView } from '@/lib/offers/view-model';

export const dynamic = 'force-dynamic';

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('offers');
  const id = (await params).id;
  const [offer, options] = await Promise.all([
    getOffer(user, id) as Promise<OfferView>,
    getOfferFormOptions(),
  ]);

  if (!offer || ['CONVERTED', 'ARCHIVED'].includes(offer.status) || (offer.offerType && offer.offerType !== 'STANDARD_MEDIA')) notFound();

  return (
    <AppShell>
      <OfferWizard {...options} initialOffer={offer} />
    </AppShell>
  );
}
