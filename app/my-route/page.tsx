import { enterTenantContext } from '@/lib/tenant-context';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { myRoute } from '@/lib/field-planning/execution';
import { MyRouteView } from '@/components/field-planning/MyRouteView';
export const dynamic = 'force-dynamic';
export default async function MyRoutePage() {
  const user = await requirePageAccess('myTasks', 'workRoute');
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  return <AppShell><MyRouteView initial={await myRoute(user.id)} /></AppShell>;
}
