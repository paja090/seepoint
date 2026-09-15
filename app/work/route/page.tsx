import { enterTenantContext } from '@/lib/tenant-context';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { WorkRoutePlanner } from '@/components/WorkRoutePlanner';
import { navigationAvailable } from '@/lib/field-planning/capabilities';
import { loadProfile } from '@/lib/field-planning/data';
import { dayInZone } from '@/lib/field-planning/profile';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function WorkRoutePage() {
  const user = await requirePageAccess('work', 'workRoute');
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  if (!['ADMIN', 'MANAGER'].includes(user.role)) redirect('/my-route');
  const profile = await loadProfile();
  return <AppShell><WorkRoutePlanner navigation={await navigationAvailable()} defaultDate={dayInZone(new Date(), profile?.timezone ?? 'Europe/Prague')} country={user.organization?.country ?? null} /></AppShell>;
}
