import { AppShell } from '@/components/AppShell';
import { OfferWizard } from '@/components/offers/OfferWizard';
import { getOfferFormOptions } from '@/lib/offers/form-options';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';
export default async function NewStandardOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  await requirePageAccess('offers');
  const options = await getOfferFormOptions();
  const { clientId } = await searchParams;
  return <AppShell><OfferWizard {...options} initialClientId={clientId} /></AppShell>;
}
