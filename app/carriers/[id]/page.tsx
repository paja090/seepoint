import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { CarrierDetail } from '@/components/CarrierDetail';
import { CarrierForm } from '@/components/CarrierForm';
import { getCarrier, prisma } from '@/lib/db';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';
import { getCarrierHistoryTimeline, listCarrierSurfaces } from '@/lib/navigation/carrier-history-service';
import { CarrierDetailTimelineView } from '@/components/navigation/CarrierDetailTimelineView';

export const dynamic = 'force-dynamic';

export default async function CarrierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageAccess('carriers');
  const carrierId = (await params).id;
  const canEdit = user.role === 'ADMIN' || user.role === 'MANAGER';
  let carrier;

  try {
    carrier = await getCarrier(carrierId);
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

  const [history, surfaces, clients, prevCarrier, nextCarrier] = await Promise.all([
    getCarrierHistoryTimeline(carrierId),
    listCarrierSurfaces(carrierId),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.advertisingCarrier.findFirst({
      where: { code: { lt: carrier.code }, archivedAt: null },
      orderBy: { code: 'desc' },
      select: { id: true, code: true, name: true },
    }),
    prisma.advertisingCarrier.findFirst({
      where: { code: { gt: carrier.code }, archivedAt: null },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="card">
            <CarrierDetail
              carrier={carrier}
              clients={clients}
              showLocationMap
              canEdit={canEdit}
              prevCarrier={prevCarrier}
              nextCarrier={nextCarrier}
            />
          </div>
          <div id="carrier-form" className="card scroll-mt-6">
            <h2 className="mb-4 font-bold">Upravit nosič</h2>
            <CarrierForm carrier={carrier} />
          </div>
        </div>

        {/* Carrier History Audit Timeline & Multi-surface Management */}
        <CarrierDetailTimelineView
          carrier={{
            id: carrier.id,
            code: carrier.code,
            name: carrier.name,
            city: carrier.city,
            street: carrier.street,
            address: carrier.address,
            latitude: carrier.latitude,
            longitude: carrier.longitude,
            structureCode: carrier.structureCode,
            status: carrier.status,
            type: carrier.type,
          }}
          history={JSON.parse(JSON.stringify(history))}
          surfaces={JSON.parse(JSON.stringify(surfaces))}
          clients={clients}
        />
      </div>
    </AppShell>
  );
}
