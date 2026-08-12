import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { QrCarrierQuickActions } from '@/components/qr/QrCarrierQuickActions';

export const dynamic = 'force-dynamic';

export default async function QrCarrierPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const decodedCode = decodeURIComponent(code);

  const carrier = await prisma.advertisingCarrier.findFirst({
    where: {
      OR: [
        { code: { equals: decodedCode, mode: 'insensitive' } },
        { id: decodedCode },
        { structureCode: { equals: decodedCode, mode: 'insensitive' } },
      ],
      archivedAt: null,
    },
    include: {
      photos: { take: 6, orderBy: { createdAt: 'desc' } },
      surfaces: {
        include: {
          photos: { take: 3, orderBy: { createdAt: 'desc' } },
          occupancies: {
            where: { status: { in: ['OCCUPIED', 'RESERVED'] } },
            take: 1,
            orderBy: { dateTo: 'desc' },
          },
        },
      },
    },
  });

  if (!carrier) {
    notFound();
  }

  const surfacesData = carrier.surfaces.map((s) => ({
    id: s.id,
    name: s.name,
    sidePosition: s.sidePosition,
    mediaType: s.mediaType,
    currentClientName: s.occupancies[0]?.clientName || null,
    campaignName: s.occupancies[0]?.campaignName || null,
  }));

  const history = await prisma.carrierHistoryLog.findMany({
    where: { carrierId: carrier.id },
    take: 5,
    orderBy: { performedAt: 'desc' },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-sky-500 selection:text-white">
      <QrCarrierQuickActions
        carrier={{
          id: carrier.id,
          code: carrier.code,
          name: carrier.name,
          city: carrier.city,
          street: carrier.street,
          address: carrier.address,
          type: carrier.type,
          structureCode: carrier.structureCode,
          latitude: carrier.latitude,
          longitude: carrier.longitude,
          status: carrier.status,
          surfacesCount: carrier.surfaces.length,
          photosCount: carrier.photos.length + carrier.surfaces.reduce((sum, s) => sum + s.photos.length, 0),
        }}
        surfaces={surfacesData}
        recentPhotos={carrier.photos.map((p) => ({
          id: p.id,
          url: p.url,
          createdAt: p.createdAt.toISOString(),
        }))}
        recentHistory={history.map((h) => ({
          id: h.id,
          eventType: h.eventType,
          title: h.title,
          description: h.description,
          performedBy: h.performedBy,
          performedAt: h.performedAt.toISOString(),
        }))}
      />
    </div>
  );
}
