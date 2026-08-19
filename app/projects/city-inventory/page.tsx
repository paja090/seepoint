import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { requirePageAccess } from '@/lib/page-auth';
import { CityInventoryModuleClient } from '@/components/city-inventory/CityInventoryModuleClient';

export const dynamic = 'force-dynamic';

export default async function CityInventoryProjectsPage() {
  await requirePageAccess('carriers');

  let carriersRaw: any[] = [];
  try {
    carriersRaw = await prisma.advertisingCarrier.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        type: true,
        status: true,
        address: true,
      },
      orderBy: { code: 'asc' },
      take: 500,
    }).catch(() => []);
  } catch (err) {
    console.error('Error fetching carriers:', err);
  }

  const carriers = carriersRaw.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    city: c.city,
    type: c.type || 'Standardní nosič',
    status: c.status || 'ACTIVE',
    address: c.address,
  }));

  return (
    <AppShell>
      <CityInventoryModuleClient carriers={carriers} />
    </AppShell>
  );
}
