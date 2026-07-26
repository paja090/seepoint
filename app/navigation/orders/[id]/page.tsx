import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { getNavigationOrderDetail } from '@/lib/navigation/navigation-service';
import { NavigationOrderDetailView } from '@/components/navigation/NavigationOrderDetailView';

export const dynamic = 'force-dynamic';

export default async function NavigationOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess('navigationProjects');
  const id = (await params).id;

  try {
    const order = await getNavigationOrderDetail(id, user);
    return (
      <AppShell>
        <NavigationOrderDetailView order={order} />
      </AppShell>
    );
  } catch (err: unknown) {
    notFound();
  }
}
