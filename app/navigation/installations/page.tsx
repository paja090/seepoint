import { requirePageAccess } from '@/lib/page-auth';
import { listNavigationOrders } from '@/lib/navigation/navigation-service';
import { MobileInstallationView, type MobileTaskItem } from '@/components/navigation/MobileInstallationView';

export const dynamic = 'force-dynamic';

export default async function MobileInstallationsPage() {
  const user = await requirePageAccess('navigationProjects');
  const orders = await listNavigationOrders(user, {});

  const items: MobileTaskItem[] = orders.flatMap((o) => [
    {
      id: o.id,
      orderNumber: o.orderNumber,
      targetName: o.targetName,
      pointId: `point-${o.id}-1`,
      label: `Směrová tabule k ${o.targetName}`,
      address: o.targetAddress,
      latitude: o.targetLatitude,
      longitude: o.targetLongitude,
      orientation: 'Jednosměrný – Směr centrum',
      navigationType: 'Směrová tabule',
      status: o.status === 'INSTALACE' ? 'WAITING' : 'INSTALACE',
    },
  ]);

  return <MobileInstallationView initialItems={items} />;
}
