import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { MobileInstallationView, type MobileTaskItem } from '@/components/navigation/MobileInstallationView';

export const dynamic = 'force-dynamic';

export default async function MobileInstallationsPage() {
  const user = await requirePageAccess('navigationProjects');

  const points = await prisma.navigationPoint.findMany({
    where: {
      navigationOrder: {
        status: { in: ['PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE'] },
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
      carrier: { select: { address: true, code: true } },
      surface: { select: { name: true } },
      installedPhoto: { select: { url: true } },
    },
    orderBy: { routeOrder: 'asc' },
  });

  const items: MobileTaskItem[] = points.map((p) => ({
    id: p.navigationOrder?.id || '',
    orderNumber: p.navigationOrder?.crmOrder?.orderNumber || 'NAV-000',
    clientName: p.navigationOrder?.crmOrder?.client?.name || 'Klient',
    targetName: p.navigationOrder?.targetName || 'Navigační cíl',
    pointId: p.id,
    label: p.label,
    address: p.address || p.carrier?.address || p.navigationOrder?.targetAddress,
    latitude: p.latitude,
    longitude: p.longitude,
    orientation: p.orientation || 'Směr centrum',
    navigationType: p.navigationType,
    carrierCode: p.carrier?.code || null,
    surfaceName: p.surface?.name || null,
    installedPhotoUrl: p.installedPhoto?.url || null,
    status: p.status === 'INSTALLED' ? 'INSTALLED' : 'WAITING',
    routeOrder: p.routeOrder || 0,
    issueReported: p.issueReported,
    issueType: p.issueType,
    issueNote: p.issueNote,
    plannedInstallationAt: p.plannedInstallationAt ? p.plannedInstallationAt.toISOString() : null,
  }));

  return <MobileInstallationView initialItems={items} userName={user.name || user.email} />;
}
