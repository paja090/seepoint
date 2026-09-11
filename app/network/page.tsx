import { AppShell } from '@/components/AppShell';
import { NetworkHubView } from '@/components/network/NetworkHubView';
import { requirePageAccess } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';

export default async function NetworkPage() {
  await requirePageAccess('offers', 'network');

  return (
    <AppShell>
      <NetworkHubView />
    </AppShell>
  );
}
