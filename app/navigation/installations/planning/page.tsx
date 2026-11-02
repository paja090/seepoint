import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { InstallationPlanningView, type PlanningPointItem, type InstallerOption } from '@/components/navigation/InstallationPlanningView';

export const dynamic = 'force-dynamic';

export default async function MobilePlanningPage(props: {
  searchParams?: Promise<{ filter?: string; query?: string }>;
}) {
  const currentUser = await requirePageAccess('navigationProjects');
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialFilter = searchParams?.filter || 'active';

  const pointsRaw = await prisma.navigationPoint.findMany({
    where: {
      organizationId: currentUser.organizationId!,
      navigationOrderId: { not: null },
      status: { notIn: ['CANCELLED', 'REMOVED'] },
    },
    include: {
      navigationOrder: {
        include: {
          crmOrder: {
            include: {
              client: { select: { name: true } },
            },
          },
          points: {
            select: {
              id: true,
              installedPhotoId: true,
              status: true,
            },
          },
        },
      },
      carrier: { select: { code: true } },
      surface: { select: { name: true } },
      installerUser: { select: { name: true } },
      installedPhoto: { select: { id: true, url: true } },
    },
    orderBy: [
      { plannedInstallationAt: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  const membersRaw = await prisma.organizationMember.findMany({
    where: { organizationId: currentUser.organizationId!, isActive: true },
    select: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });
  const usersRaw = membersRaw.map((member) => member.user);

  const points: PlanningPointItem[] = pointsRaw.map((p) => {
    const orderPoints = p.navigationOrder?.points || [];
    const orderTotalPoints = orderPoints.length || 1;
    const orderPhotosCount = orderPoints.filter((pt) => pt.installedPhotoId !== null).length;
    const hasPhoto = Boolean(p.installedPhotoId || p.installedPhoto?.url);
    const orderStatus = p.navigationOrder?.status || 'PRIPRAVENO_K_INSTALACI';
    const isOrderComplete =
      (orderTotalPoints > 0 && orderPhotosCount === orderTotalPoints) ||
      ['PRIPRAVENO_K_FAKTURACI', 'FAKTUROVANO', 'DOKONCENO'].includes(orderStatus);

    return {
      id: p.id,
      orderId: p.navigationOrder?.id || '',
      orderNumber: p.navigationOrder?.crmOrder?.orderNumber || 'NAV-000',
      clientName: p.navigationOrder?.crmOrder?.client?.name || 'Klient',
      targetName: p.navigationOrder?.targetName || 'Navigační cíl',
      targetAddress: p.navigationOrder?.targetAddress || null,
      label: p.label,
      navigationType: p.navigationType,
      latitude: p.latitude,
      longitude: p.longitude,
      carrierCode: p.carrier?.code || null,
      surfaceName: p.surface?.name || null,
      status: p.status,
      plannedInstallationAt: p.plannedInstallationAt
        ? p.plannedInstallationAt.toISOString()
        : p.navigationOrder?.plannedInstallationAt
        ? p.navigationOrder.plannedInstallationAt.toISOString()
        : null,
      installerUserId: p.installerUserId || p.navigationOrder?.installerUserId || null,
      installerName: p.installerUser?.name || null,
      routeOrder: p.routeOrder || 0,
      installedPhotoId: p.installedPhotoId || p.installedPhoto?.id || null,
      installedPhotoUrl: p.installedPhoto?.url || null,
      hasPhoto,
      orderStatus,
      orderTotalPoints,
      orderPhotosCount,
      isOrderComplete,
    };
  });

  const installers: InstallerOption[] = usersRaw.map((u) => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email,
  }));

  return (
    <AppShell>
      <InstallationPlanningView
        initialPoints={points}
        installers={installers}
        initialFilter={initialFilter}
      />
    </AppShell>
  );
}
