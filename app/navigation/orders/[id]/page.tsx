import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { getNavigationOrderDetail } from '@/lib/navigation/navigation-service';
import { NavigationOrderDetailView } from '@/components/navigation/NavigationOrderDetailView';
import { canInvoiceNavigationOrderRole } from '@/lib/navigation/permissions';

export const dynamic = 'force-dynamic';

export default async function NavigationOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess('navigationProjects');
  const id = (await params).id;

  try {
    const [order, salesUsers] = await Promise.all([
      getNavigationOrderDetail(id, user),
      prisma.user.findMany({
        where: user.organizationId
          ? { organizationMemberships: { some: { organizationId: user.organizationId, isActive: true } } }
          : {},
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return (
      <AppShell>
        <NavigationOrderDetailView
          order={order}
          canInvoice={canInvoiceNavigationOrderRole(user.role)}
          currentDate={new Date().toISOString().slice(0, 10)}
          salesUsers={salesUsers}
        />
      </AppShell>
    );
  } catch {
    notFound();
  }
}
