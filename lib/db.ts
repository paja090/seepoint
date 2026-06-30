import { Prisma, PrismaClient } from '@prisma/client';
import type { Carrier, Occupancy, Surface } from './types';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const carrierInclude = {
  surfaces: { include: { occupancies: true, photos: true } },
  photos: true,
} satisfies Prisma.AdvertisingCarrierInclude;

type CarrierRow = Prisma.AdvertisingCarrierGetPayload<{ include: typeof carrierInclude }>;

function serializeCarrier(carrier: CarrierRow): Carrier {
  return {
    id: carrier.id,
    name: carrier.name,
    code: carrier.code,
    type: carrier.type,
    latitude: carrier.latitude,
    longitude: carrier.longitude,
    address: carrier.address ?? undefined,
    city: carrier.city,
    region: carrier.region ?? undefined,
    status: carrier.status,
    note: carrier.note ?? undefined,
    photos: carrier.photos.map((photo) => ({ id: photo.id, carrierId: photo.carrierId ?? undefined, surfaceId: photo.surfaceId ?? undefined, url: photo.url, type: photo.type, note: photo.note ?? undefined })),
    surfaces: carrier.surfaces.map((surface) => ({
      id: surface.id,
      carrierId: surface.carrierId,
      name: surface.name,
      size: surface.size ?? undefined,
      orientation: surface.orientation ?? undefined,
      status: surface.status,
      price: surface.price?.toNumber(),
      note: surface.note ?? undefined,
      photos: surface.photos.map((photo) => ({ id: photo.id, carrierId: photo.carrierId ?? undefined, surfaceId: photo.surfaceId ?? undefined, url: photo.url, type: photo.type, note: photo.note ?? undefined })),
      occupancies: surface.occupancies.map((occupancy) => ({ id: occupancy.id, surfaceId: occupancy.surfaceId, clientName: occupancy.clientName, campaignName: occupancy.campaignName, dateFrom: occupancy.dateFrom.toISOString().slice(0, 10), dateTo: occupancy.dateTo.toISOString().slice(0, 10), status: occupancy.status, price: occupancy.price?.toNumber(), note: occupancy.note ?? undefined })),
    })),
  };
}

export async function getCarriers(): Promise<Carrier[]> {
  const carriers = await prisma.advertisingCarrier.findMany({ include: carrierInclude, orderBy: { name: 'asc' } });
  return carriers.map(serializeCarrier);
}

export async function getCarrier(id: string): Promise<Carrier | undefined> {
  const carrier = await prisma.advertisingCarrier.findUnique({ where: { id }, include: carrierInclude });
  return carrier ? serializeCarrier(carrier) : undefined;
}

export async function upsertCarrier(input: Partial<Carrier>): Promise<Carrier> {
  const existing = input.id ? await prisma.advertisingCarrier.findUnique({ where: { id: input.id } }) : null;
  const data = {
    name: input.name ?? existing?.name ?? 'Nový nosič',
    code: input.code ?? existing?.code ?? `NEW-${Date.now()}`,
    type: input.type ?? existing?.type ?? 'BILLBOARD',
    latitude: input.latitude ?? existing?.latitude ?? 50.0755,
    longitude: input.longitude ?? existing?.longitude ?? 14.4378,
    address: input.address ?? existing?.address ?? null,
    city: input.city ?? existing?.city ?? 'Praha',
    region: input.region ?? existing?.region ?? null,
    status: input.status ?? existing?.status ?? 'ACTIVE',
    note: input.note ?? existing?.note ?? null,
  };
  const saved = existing
    ? await prisma.advertisingCarrier.update({ where: { id: existing.id }, data })
    : await prisma.advertisingCarrier.create({ data: { ...data, id: input.id } });
  return (await getCarrier(saved.id))!;
}

export async function deleteCarrier(id: string) {
  await prisma.advertisingCarrier.delete({ where: { id } });
}

export async function upsertSurface(input: Partial<Surface> & { carrierId: string }): Promise<Surface> {
  const existing = input.id ? await prisma.advertisingSurface.findUnique({ where: { id: input.id } }) : null;
  const data = { carrierId: input.carrierId, name: input.name ?? existing?.name ?? 'Plocha', size: input.size ?? existing?.size ?? null, orientation: input.orientation ?? existing?.orientation ?? null, status: input.status ?? existing?.status ?? 'AVAILABLE', price: input.price ?? existing?.price ?? null, note: input.note ?? existing?.note ?? null };
  const saved = existing
    ? await prisma.advertisingSurface.update({ where: { id: existing.id }, data })
    : await prisma.advertisingSurface.create({ data: { ...data, id: input.id } });
  return { id: saved.id, carrierId: saved.carrierId, name: saved.name, size: saved.size ?? undefined, orientation: saved.orientation ?? undefined, status: saved.status, price: saved.price?.toNumber(), note: saved.note ?? undefined, occupancies: [], photos: [] };
}

export async function upsertOccupancy(input: Partial<Occupancy> & { surfaceId: string }): Promise<Occupancy> {
  const existing = input.id ? await prisma.occupancy.findUnique({ where: { id: input.id } }) : null;
  const data = { surfaceId: input.surfaceId, clientName: input.clientName ?? existing?.clientName ?? 'Klient', campaignName: input.campaignName ?? existing?.campaignName ?? 'Kampaň', dateFrom: input.dateFrom ? new Date(input.dateFrom) : existing?.dateFrom ?? new Date(), dateTo: input.dateTo ? new Date(input.dateTo) : existing?.dateTo ?? new Date(), status: input.status ?? existing?.status ?? 'RESERVED', price: input.price ?? existing?.price ?? null, note: input.note ?? existing?.note ?? null };
  const saved = existing
    ? await prisma.occupancy.update({ where: { id: existing.id }, data })
    : await prisma.occupancy.create({ data: { ...data, id: input.id } });
  return { id: saved.id, surfaceId: saved.surfaceId, clientName: saved.clientName, campaignName: saved.campaignName, dateFrom: saved.dateFrom.toISOString().slice(0, 10), dateTo: saved.dateTo.toISOString().slice(0, 10), status: saved.status, price: saved.price?.toNumber(), note: saved.note ?? undefined };
}

export function carrierMapColor(carrier: Carrier) {
  if (carrier.status !== 'ACTIVE') return '#64748b';
  if (carrier.surfaces.some((surface) => surface.status === 'OCCUPIED')) return '#ef4444';
  if (carrier.surfaces.some((surface) => surface.status === 'RESERVED')) return '#f97316';
  return '#22c55e';
}
