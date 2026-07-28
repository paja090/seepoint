import Link from 'next/link';
import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { prisma } from '@/lib/db';
import { getCarrierHistoryTimeline, listCarrierSurfaces } from '@/lib/navigation/carrier-history-service';
import { CarrierDetailTimelineView } from '@/components/navigation/CarrierDetailTimelineView';

export const dynamic = 'force-dynamic';

export default async function NavigationCarrierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageAccess('navigationProjects');
  const carrierId = (await params).id;

  const carrier = await prisma.advertisingCarrier.findUnique({
    where: { id: carrierId },
    include: {
      surfaces: {
        include: {
          currentClient: { select: { id: true, name: true } },
          contract: { select: { id: true, contractNumber: true, endDate: true } },
        },
      },
    },
  });

  if (!carrier) {
    return (
      <AppShell>
        <div className="p-8 text-center text-slate-500">Nosič nebyl nalezen.</div>
      </AppShell>
    );
  }

  const [history, surfaces, clients] = await Promise.all([
    getCarrierHistoryTimeline(carrierId),
    listCarrierSurfaces(carrierId),
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);

  return (
    <AppShell>
      <PageHeader
        title={`📌 Nosič VO #${carrier.code} – ${carrier.city} ${carrier.address || ''}`}
        description="Kompletní časová osa historie nosiče, audity zásahů a správu více samostatných reklamních ploch na jednom sloupu."
        actions={
          <Link href="/navigation" className="btn btn-secondary text-xs">
            ← Zpět na přehled navigace
          </Link>
        }
      />

      <CarrierDetailTimelineView
        carrier={JSON.parse(JSON.stringify(carrier))}
        history={JSON.parse(JSON.stringify(history))}
        surfaces={JSON.parse(JSON.stringify(surfaces))}
        clients={clients}
      />
    </AppShell>
  );
}
