import { AppShell } from '@/components/AppShell';
import { OfferWizard } from '@/components/offers/OfferWizard';
import { getOfferFormOptions } from '@/lib/offers/form-options';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';
export default async function NewStandardOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; surfaceIds?: string }>;
}) {
  await requirePageAccess('offers');
  const options = await getOfferFormOptions();
  const { clientId, surfaceIds } = await searchParams;
  const initialSurfaceIds = surfaceIds
    ? surfaceIds.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  return (
    <AppShell>
      <OfferWizard {...options} initialClientId={clientId} initialSurfaceIds={initialSurfaceIds} />
    </AppShell>
  );
}
