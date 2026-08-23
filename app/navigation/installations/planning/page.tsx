import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { InstallationPlanningView, type PlanningPointItem, type InstallerOption } from '@/components/navigation/InstallationPlanningView';

export const dynamic = 'force-dynamic';

export default async function MobilePlanningPage() {
  const currentUser = await requirePageAccess('navigationProjects');

  const pointsRaw = await prisma.navigationPoint.findMany({
    where: {
      navigationOrder: {
        status: { in: ['SMLOUVA_OBJEDNAVKA', 'GRAFICKE_PODKLADY', 'SCHVALENI_GRAFIKY', 'TISK_VYROBA', 'PRIPRAVENO_K_INSTALACI', 'INSTALACE'] },
      },
    },
    include: {
      navigationOrder: {
        include: {
          crmOrder: {
            include: {
              client: { select: { name: true } },
            },
          },
        },
      },
      carrier: { select: { code: true } },
      surface: { select: { name: true } },
      installerUser: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const membersRaw = await prisma.organizationMember.findMany({
    where: { organizationId: currentUser.organizationId!, isActive: true },
    select: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: 'asc' } },
  });
  const usersRaw = membersRaw.map((member) => member.user);

  const points: PlanningPointItem[] = pointsRaw.map((p) => ({
    id: p.id,
    orderId: p.navigationOrder?.id || '',
    orderNumber: p.navigationOrder?.crmOrder?.orderNumber || 'NAV-000',
    clientName: p.navigationOrder?.crmOrder?.client.name || 'Klient',
    targetName: p.navigationOrder?.targetName || 'Navigační cíl',
    targetAddress: p.navigationOrder?.targetAddress || null,
    label: p.label,
    navigationType: p.navigationType,
    latitude: p.latitude,
    longitude: p.longitude,
    carrierCode: p.carrier?.code || null,
    surfaceName: p.surface?.name || null,
    status: p.status,
    plannedInstallationAt: p.plannedInstallationAt ? p.plannedInstallationAt.toISOString() : p.navigationOrder?.plannedInstallationAt ? p.navigationOrder.plannedInstallationAt.toISOString() : null,
    installerUserId: p.installerUserId || p.navigationOrder?.installerUserId || null,
    installerName: p.installerUser?.name || null,
    routeOrder: p.routeOrder || 0,
  }));

  const installers: InstallerOption[] = usersRaw.map((u) => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email,
  }));

  return (
    <AppShell>
      <InstallationPlanningView initialPoints={points} installers={installers} />
    </AppShell>
  );
}
