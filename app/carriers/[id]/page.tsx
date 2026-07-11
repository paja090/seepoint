import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { CarrierDetail } from '@/components/CarrierDetail';
import { CarrierForm } from '@/components/CarrierForm';
import { getCarrier, prisma } from '@/lib/db';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';

export default async function CarrierPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess('carriers');
  let carrier;
  try {
    carrier = await getCarrier((await params).id);
  } catch (error) {
    console.error('Carrier detail failed', error);
    if (isMissingDatabaseStructureError(error)) {
      return (
        <AppShell>
          <section className="card">
            <h1 className="text-2xl font-bold">Detail nosiče zatím nelze načíst</h1>
            <p className="mt-2 text-sm text-slate-600">{productionMigrationMessage()}</p>
          </section>
        </AppShell>
      );
    }
    throw error;
  }

  if (!carrier) notFound();
  const clients = await prisma.client.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="card">
          <CarrierDetail carrier={carrier} clients={clients} showLocationMap />
        </div>
        <div id="carrier-form" className="card scroll-mt-6">
          <h2 className="mb-4 font-bold">Upravit nosič</h2>
          <CarrierForm carrier={carrier} />
        </div>
      </div>
    </AppShell>
  );
}
