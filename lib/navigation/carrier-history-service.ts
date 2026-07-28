import { prisma } from '@/lib/db';

export type HistoryEventType =
  | 'INSTALLATION'
  | 'REINSTALLATION'
  | 'GRAPHICS_CHANGE'
  | 'REPAIR'
  | 'SERVICE'
  | 'DEINSTALLATION'
  | 'CLIENT_CHANGE'
  | 'RENTAL_CHANGE';

export async function logCarrierHistoryEvent(data: {
  carrierId: string;
  surfaceId?: string | null;
  eventType: HistoryEventType;
  title: string;
  description?: string | null;
  performedBy?: string | null;
  performedAt?: Date | string;
  clientId?: string | null;
  clientName?: string | null;
  photoUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return prisma.carrierHistoryLog.create({
    data: {
      carrierId: data.carrierId,
      surfaceId: data.surfaceId || null,
      eventType: data.eventType,
      title: data.title,
      description: data.description || null,
      performedBy: data.performedBy || 'Systém',
      performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
      clientId: data.clientId || null,
      clientName: data.clientName || null,
      photoUrl: data.photoUrl || null,
      metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
    },
  });
}

export async function getCarrierHistoryTimeline(carrierId: string) {
  return prisma.carrierHistoryLog.findMany({
    where: { carrierId },
    include: {
      surface: { select: { id: true, name: true, sidePosition: true } },
    },
    orderBy: { performedAt: 'desc' },
  });
}

export async function listCarrierSurfaces(carrierId: string) {
  return prisma.advertisingSurface.findMany({
    where: { carrierId },
    include: {
      currentClient: { select: { id: true, name: true } },
      contract: { select: { id: true, contractNumber: true, endDate: true } },
      occupancies: {
        orderBy: { dateFrom: 'desc' },
        take: 5,
      },
      historyLogs: {
        orderBy: { performedAt: 'desc' },
        take: 10,
      },
    },
    orderBy: { sidePosition: 'asc' },
  });
}

export async function createCarrierSurface(data: {
  carrierId: string;
  name: string;
  sidePosition?: string;
  mediaType?: string;
  currentClientId?: string;
  contractId?: string;
  artworkUrl?: string;
  graphicNotes?: string;
  currentRentStart?: string;
  currentRentEnd?: string;
  price?: number;
  note?: string;
}) {
  const surface = await prisma.advertisingSurface.create({
    data: {
      carrierId: data.carrierId,
      name: data.name,
      sidePosition: data.sidePosition || 'Strana A',
      mediaType: (data.mediaType as any) || 'OTHER',
      currentClientId: data.currentClientId || null,
      contractId: data.contractId || null,
      artworkUrl: data.artworkUrl || null,
      graphicNotes: data.graphicNotes || null,
      currentRentStart: data.currentRentStart ? new Date(data.currentRentStart) : null,
      currentRentEnd: data.currentRentEnd ? new Date(data.currentRentEnd) : null,
      price: data.price !== undefined ? data.price : null,
      note: data.note || null,
    },
  });

  // Audit log for new surface creation
  await logCarrierHistoryEvent({
    carrierId: data.carrierId,
    surfaceId: surface.id,
    eventType: 'SERVICE',
    title: `Nová reklamní plocha "${surface.name}" (${surface.sidePosition || 'Plocha'})`,
    description: `Vytvořena samostatná plocha na sloupu s nastaveným pronájmem a grafikou.`,
  });

  return surface;
}
