import { AppShell } from '@/components/AppShell';
import { OfferWizard } from '@/components/offers/OfferWizard';
import { requirePageAccess } from '@/lib/page-auth';
import { getOfferFormOptions } from '@/lib/offers/form-options';

export const dynamic = 'force-dynamic';

export default async function NewOfferPage() {
  await requirePageAccess('offers');
  const options = await getOfferFormOptions();

  return (
    <AppShell>
      <OfferWizard {...options} />
    </AppShell>
  );
}
