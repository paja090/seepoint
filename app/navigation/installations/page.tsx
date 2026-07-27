import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { MobileInstallationView, type MobileTaskItem } from '@/components/navigation/MobileInstallationView';

export const dynamic = 'force-dynamic';

export default async function MobileInstallationsPage() {
  await requirePageAccess('navigationProjects');

  const points = await prisma.navigationPoint.findMany({
    where: {
      navigationOrder: {
        status: { in: ['PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE'] },
      },
    },
    include: {
      navigationOrder: {
        include: {
          crmOrder: { select: { orderNumber: true } },
        },
      },
      carrier: { select: { address: true } },
      installedPhoto: { select: { url: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const items: MobileTaskItem[] = points.map((p) => ({
    id: p.navigationOrder?.id || '',
    orderNumber: p.navigationOrder?.crmOrder?.orderNumber || 'NAV-000',
    targetName: p.navigationOrder?.targetName || 'Navigační cíl',
    pointId: p.id,
    label: p.label,
    address: p.address || p.carrier?.address || p.navigationOrder?.targetAddress,
    latitude: p.latitude,
    longitude: p.longitude,
    orientation: p.orientation || 'Směr centrum',
    navigationType: p.navigationType,
    installedPhotoUrl: p.installedPhoto?.url || null,
    status: p.status === 'INSTALLED' ? 'INSTALLED' : 'WAITING',
  }));

  return <MobileInstallationView initialItems={items} />;
}
