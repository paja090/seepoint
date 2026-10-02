import { AppShell } from '@/components/AppShell';
import { NavigationOfferForm } from '@/components/offers/NavigationOfferForm';
import { getSpecializedOfferOptions } from '@/lib/offers/specialized';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function NewNavigationOfferPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const user = await requirePageAccess('offers');
  const { clients } = await getSpecializedOfferOptions();
  const { clientId } = await searchParams;
  return <AppShell><NavigationOfferForm organizationId={user.organizationId ?? undefined} clients={clients} initialClientId={clientId} /></AppShell>;
}
