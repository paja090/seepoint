import { enterTenantContext } from '@/lib/tenant-context';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { WorkRoutePlanner } from '@/components/WorkRoutePlanner';
import { navigationAvailable } from '@/lib/field-planning/capabilities';
import { loadProfile } from '@/lib/field-planning/data';
import { dayInZone } from '@/lib/field-planning/profile';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';

export default async function WorkRoutePage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string; jobIds?: string; id?: string }>;
}) {
  const user = await requirePageAccess('work', 'workRoute');
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  if (!['ADMIN', 'MANAGER'].includes(user.role)) redirect('/my-route');
  const profile = await loadProfile();
  const resolved = searchParams ? await searchParams : undefined;
  const initialDate = resolved?.date && /^\d{4}-\d{2}-\d{2}$/.test(resolved.date)
    ? resolved.date
    : dayInZone(new Date(), profile?.timezone ?? 'Europe/Prague');
  const initialJobIds = resolved?.jobIds ? resolved.jobIds.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
  const initialPlanId = resolved?.id || undefined;

  return (
    <AppShell>
      <WorkRoutePlanner
        navigation={await navigationAvailable()}
        defaultDate={initialDate}
        initialJobIds={initialJobIds}
        initialPlanId={initialPlanId}
        country={user.organization?.country ?? null}
      />
    </AppShell>
  );
}
