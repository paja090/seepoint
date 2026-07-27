import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/AppShell';
import { QualityControlQueueView, type QcPointItem } from '@/components/navigation/QualityControlQueueView';

export const dynamic = 'force-dynamic';

export default async function NavigationQcPage() {
  await requirePageAccess('navigationProjects');

  const pointsRaw = await prisma.navigationPoint.findMany({
    where: {
      installedPhotoId: { not: null },
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
      installedPhoto: { select: { url: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const points: QcPointItem[] = pointsRaw.map((p) => ({
    id: p.id,
    orderId: p.navigationOrder?.id || '',
    orderNumber: p.navigationOrder?.crmOrder?.orderNumber || 'NAV-000',
    clientName: p.navigationOrder?.crmOrder?.client.name || 'Klient',
    targetName: p.navigationOrder?.targetName || 'Navigační cíl',
    label: p.label,
    navigationType: p.navigationType,
    installedPhotoUrl: p.installedPhoto?.url || null,
    carrierCode: p.carrier?.code || null,
    surfaceName: p.surface?.name || null,
    qcStatus: p.qcStatus || 'PENDING',
    qcNote: p.qcNote || null,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <AppShell>
      <QualityControlQueueView initialPoints={points} />
    </AppShell>
  );
}
