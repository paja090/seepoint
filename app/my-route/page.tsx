import { enterTenantContext } from '@/lib/tenant-context';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { myRoute } from '@/lib/field-planning/execution';
import { MyRouteView } from '@/components/field-planning/MyRouteView';
export const dynamic = 'force-dynamic';
export default async function MyRoutePage({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const user = await requirePageAccess('myTasks', 'workRoute');
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  return <AppShell><MyRouteView initial={await myRoute(user.id, resolvedSearchParams?.date)} initialNow={new Date().toISOString()} /></AppShell>;
}

