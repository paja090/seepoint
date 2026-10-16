import { getCurrentUser } from '@/lib/auth';
import { canAccess, AccessDenied } from '@/lib/rbac';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getCommercialCenterData } from '@/lib/ai-orchestrator';
import { CommercialCenterView } from '@/components/commercial/CommercialCenterView';

export const dynamic = 'force-dynamic';

export default async function CommercialCenterPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  if (!canAccess(user.role, 'commercial')) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  const organizationId = user.organizationId;
  if (!organizationId) {
    return (
      <AppShell>
        <div className="card text-center p-8">
          <p className="text-slate-600 font-medium">Chybí kontext organizace.</p>
        </div>
      </AppShell>
    );
  }

  const data = await getCommercialCenterData(organizationId);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl py-2 sm:py-4">
        <CommercialCenterView data={data} />
      </div>
    </AppShell>
  );
}
