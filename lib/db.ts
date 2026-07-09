import { Prisma, PrismaClient } from '@prisma/client';
import { carrierMapColor } from './carrier-map';
import type { Carrier, CarrierType, GpsStatus, MediaType, Occupancy, Surface, SurfaceStatus } from './types';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const carrierInclude = {
  surfaces: { include: { currentClient: true, occupancies: true, photos: true }, orderBy: { name: 'asc' } },
  photos: true,
} satisfies Prisma.AdvertisingCarrierInclude;

type CarrierRow = Prisma.AdvertisingCarrierGetPayload<{ include: typeof carrierInclude }>;

export type SurfaceTemplate = {
  name: string;
  mediaType: Surface['mediaType'];
  orientation?: string;
};

export type CarrierArchiveInput = {
  archivedBy?: string;
  archiveReason?: string;
};

export type CarrierFilters = {
  q?: string;
  carrierType?: CarrierType;
  mediaType?: MediaType;
  city?: string;
  locality?: string;
  street?: string;
  client?: string;
  surfaceStatus?: SurfaceStatus;
  gps?: 'missing' | 'present' | GpsStatus;
  photo?: 'missing' | 'present';
  description?: 'missing' | 'present';
  occupancy?: 'missing' | 'present';
  archived?: 'active' | 'archived' | 'all';
  importBatchId?: string;
  page?: number;
  pageSize?: number;
};

export type CarrierFilterOptions = {
  cities: string[];
  localities: string[];
  streets: string[];
  clients: string[];
  importBatches: { id: string; label: string }[];
};

function serializeCarrier(carrier: CarrierRow): Carrier {
  return {
    id: carrier.id,
    name: carrier.name,
    code: carrier.code,
    type: carrier.type,
    latitude: carrier.latitude ?? undefined,
    longitude: carrier.longitude ?? undefined,
    gpsStatus: carrier.gpsStatus,
    street: carrier.street ?? undefined,
    address: carrier.address ?? undefined,
    locality: carrier.locality ?? undefined,
    city: carrier.city,
    region: carrier.region ?? undefined,
    cadastralArea: carrier.cadastralArea ?? undefined,
    structureCode: carrier.structureCode ?? undefined,
    mountingType: carrier.mountingType,
    status: carrier.status,
    description: carrier.description ?? undefined,
    placementDescription: carrier.placementDescription ?? undefined,
    note: carrier.note ?? undefined,
    archivedAt: carrier.archivedAt?.toISOString(),
    archivedBy: carrier.archivedBy ?? undefined,
    archiveReason: carrier.archiveReason ?? undefined,
    sourceSystem: carrier.sourceSystem ?? undefined,
    sourceSheet: carrier.sourceSheet ?? undefined,
    sourceRow: carrier.sourceRow ?? undefined,
    importBatchId: carrier.importBatchId ?? undefined,
    photos: carrier.photos.map((photo) => ({ id: photo.id, carrierId: photo.carrierId ?? undefined, surfaceId: photo.surfaceId ?? undefined, url: photo.url, type: photo.type, note: photo.note ?? undefined })),
    surfaces: carrier.surfaces.map((surface) => ({
      id: surface.id,
      carrierId: surface.carrierId,
      currentClientId: surface.currentClientId ?? undefined,
      currentClient: surface.currentClient ? { id: surface.currentClient.id, name: surface.currentClient.name } : undefined,
      name: surface.name,
      mediaType: surface.mediaType,
      sourcePosition: surface.sourcePosition ?? undefined,
      directionDescription: surface.directionDescription ?? undefined,
      rawMediaType: surface.rawMediaType ?? undefined,
      size: surface.size ?? undefined,
      orientation: surface.orientation ?? undefined,
      status: surface.status,
      price: surface.price?.toNumber(),
      note: surface.note ?? undefined,
      photos: surface.photos.map((photo) => ({ id: photo.id, carrierId: photo.carrierId ?? undefined, surfaceId: photo.surfaceId ?? undefined, url: photo.url, type: photo.type, note: photo.note ?? undefined })),
      occupancies: surface.occupancies.map((occupancy) => ({ id: occupancy.id, surfaceId: occupancy.surfaceId, clientId: occupancy.clientId ?? undefined, clientName: occupancy.clientName, campaignName: occupancy.campaignName, dateFrom: occupancy.dateFrom.toISOString().slice(0, 10), dateTo: occupancy.dateTo.toISOString().slice(0, 10), status: occupancy.status, price: occupancy.price?.toNumber(), note: occupancy.note ?? undefined })),
    })),
  };
}

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function buildCarrierWhere(filters: CarrierFilters = {}): Prisma.AdvertisingCarrierWhereInput {
  const q = clean(filters.q);
  const city = clean(filters.city);
  const locality = clean(filters.locality);
  const street = clean(filters.street);
  const client = clean(filters.client);
  const importBatchId = clean(filters.importBatchId);
  const where: Prisma.AdvertisingCarrierWhereInput = {};

  if (filters.archived === 'archived') where.archivedAt = { not: null };
  else if (filters.archived !== 'all') where.archivedAt = null;

  if (filters.carrierType) where.type = filters.carrierType;
  if (filters.mediaType) where.surfaces = { some: { mediaType: filters.mediaType } };
  if (city) where.city = { equals: city, mode: 'insensitive' };
  if (locality) {
    where.OR = [
      ...(where.OR as Prisma.AdvertisingCarrierWhereInput[] | undefined ?? []),
      { locality: { contains: locality, mode: 'insensitive' } },
      { cadastralArea: { contains: locality, mode: 'insensitive' } },
    ];
  }
  if (street) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { street: { contains: street, mode: 'insensitive' } },
          { address: { contains: street, mode: 'insensitive' } },
        ],
      },
    ];
  }
  if (client) {
    where.surfaces = {
      ...(where.surfaces && 'some' in where.surfaces ? where.surfaces : {}),
      some: {
        ...(where.surfaces && 'some' in where.surfaces && typeof where.surfaces.some === 'object' ? where.surfaces.some : {}),
        currentClient: { name: { contains: client, mode: 'insensitive' } },
      },
    };
  }
  if (filters.surfaceStatus) {
    where.surfaces = {
      ...(where.surfaces && 'some' in where.surfaces ? where.surfaces : {}),
      some: {
        ...(where.surfaces && 'some' in where.surfaces && typeof where.surfaces.some === 'object' ? where.surfaces.some : {}),
        status: filters.surfaceStatus,
      },
    };
  }
  if (filters.gps === 'missing') where.OR = [...(where.OR as Prisma.AdvertisingCarrierWhereInput[] | undefined ?? []), { gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }];
  else if (filters.gps === 'present') where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { latitude: { not: null }, longitude: { not: null } }];
  else if (filters.gps) where.gpsStatus = filters.gps;

  if (filters.photo === 'missing') where.photos = { none: {} };
  if (filters.photo === 'present') where.photos = { some: {} };
  if (filters.description === 'missing') {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: [{ description: null }, { description: '' }, { note: null }, { note: '' }] },
    ];
  }
  if (filters.description === 'present') {
    where.OR = [...(where.OR as Prisma.AdvertisingCarrierWhereInput[] | undefined ?? []), { description: { not: '' } }, { note: { not: '' } }];
  }
  if (filters.occupancy === 'missing') where.surfaces = { none: { occupancies: { some: { status: { in: ['ACTIVE', 'RESERVED'] } } } } };
  if (filters.occupancy === 'present') where.surfaces = { some: { occupancies: { some: { status: { in: ['ACTIVE', 'RESERVED'] } } } } };
  if (importBatchId) where.importBatchId = importBatchId;

  if (q) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { street: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
          { locality: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { cadastralArea: { contains: q, mode: 'insensitive' } },
          { structureCode: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { placementDescription: { contains: q, mode: 'insensitive' } },
          { note: { contains: q, mode: 'insensitive' } },
          { surfaces: { some: { name: { contains: q, mode: 'insensitive' } } } },
          { surfaces: { some: { directionDescription: { contains: q, mode: 'insensitive' } } } },
          { surfaces: { some: { currentClient: { name: { contains: q, mode: 'insensitive' } } } } },
        ],
      },
    ];
  }

  return where;
}

export async function getCarriers(filters: CarrierFilters = {}): Promise<Carrier[]> {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 500, 1), 1000);
  const page = Math.max(filters.page ?? 1, 1);
  const carriers = await prisma.advertisingCarrier.findMany({
    where: buildCarrierWhere(filters),
    include: carrierInclude,
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return carriers.map(serializeCarrier);
}

export async function getCarrier(id: string): Promise<Carrier | undefined> {
  const carrier = await prisma.advertisingCarrier.findUnique({ where: { id }, include: carrierInclude });
  return carrier ? serializeCarrier(carrier) : undefined;
}

export async function getCarrierFilterOptions(): Promise<CarrierFilterOptions> {
  const [cities, carriers, clients, importBatches] = await Promise.all([
    prisma.advertisingCarrier.findMany({ where: { city: { not: '' } }, distinct: ['city'], select: { city: true }, orderBy: { city: 'asc' } }),
    prisma.advertisingCarrier.findMany({
      select: { street: true, address: true, locality: true, cadastralArea: true },
      orderBy: [{ city: 'asc' }, { address: 'asc' }],
      take: 2000,
    }),
    prisma.client.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.importBatch.findMany({ select: { id: true, fileName: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  const unique = (values: Array<string | null>) => [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right, 'cs'));
  return {
    cities: unique(cities.map((item) => item.city)),
    localities: unique(carriers.flatMap((item) => [item.locality, item.cadastralArea])),
    streets: unique(carriers.flatMap((item) => [item.street, item.address])),
    clients: clients.map((client) => client.name),
    importBatches: importBatches.map((batch) => ({
      id: batch.id,
      label: `${batch.fileName} (${batch.createdAt.toLocaleDateString('cs-CZ')})`,
    })),
  };
}

export async function upsertCarrier(input: Partial<Carrier>, surfaceTemplates: SurfaceTemplate[] = []): Promise<Carrier> {
  const existing = input.id ? await prisma.advertisingCarrier.findUnique({ where: { id: input.id } }) : null;
  const latitude = input.latitude ?? existing?.latitude ?? null;
  const longitude = input.longitude ?? existing?.longitude ?? null;
  const data = {
    name: input.name ?? existing?.name ?? 'Nový nosič',
    code: input.code ?? existing?.code ?? `NEW-${Date.now()}`,
    type: input.type ?? existing?.type ?? 'BILLBOARD',
    latitude,
    longitude,
    gpsStatus: input.gpsStatus ?? existing?.gpsStatus ?? (latitude === null || longitude === null ? 'MISSING' : 'UNVERIFIED'),
    street: input.street ?? existing?.street ?? null,
    address: input.address ?? existing?.address ?? null,
    locality: input.locality ?? existing?.locality ?? null,
    city: input.city ?? existing?.city ?? 'Praha',
    region: input.region ?? existing?.region ?? null,
    cadastralArea: input.cadastralArea ?? existing?.cadastralArea ?? null,
    structureCode: input.structureCode ?? existing?.structureCode ?? null,
    mountingType: input.mountingType ?? existing?.mountingType ?? 'UNKNOWN',
    status: input.status ?? existing?.status ?? 'ACTIVE',
    description: input.description ?? existing?.description ?? null,
    placementDescription: input.placementDescription ?? existing?.placementDescription ?? null,
    note: input.note ?? existing?.note ?? null,
    sourceSystem: input.sourceSystem ?? existing?.sourceSystem ?? null,
    sourceSheet: input.sourceSheet ?? existing?.sourceSheet ?? null,
    sourceRow: input.sourceRow ?? existing?.sourceRow ?? null,
  };
  const saved = existing
    ? await prisma.advertisingCarrier.update({ where: { id: existing.id }, data })
    : await prisma.advertisingCarrier.create({
        data: {
          ...data,
          id: input.id,
          surfaces: surfaceTemplates.length
            ? {
                create: surfaceTemplates.map((surface) => ({
                  name: surface.name,
                  mediaType: surface.mediaType,
                  orientation: surface.orientation ?? null,
                  status: 'AVAILABLE',
                })),
              }
            : undefined,
        },
      });
  return (await getCarrier(saved.id))!;
}

export async function archiveCarrier(id: string, input: CarrierArchiveInput = {}) {
  await prisma.advertisingCarrier.update({
    where: { id },
    data: {
      archivedAt: new Date(),
      archivedBy: input.archivedBy?.trim() || null,
      archiveReason: input.archiveReason?.trim() || null,
      status: 'INACTIVE',
    },
  });
  return (await getCarrier(id))!;
}

export async function restoreCarrier(id: string) {
  await prisma.advertisingCarrier.update({
    where: { id },
    data: {
      archivedAt: null,
      archivedBy: null,
      archiveReason: null,
      status: 'ACTIVE',
    },
  });
  return (await getCarrier(id))!;
}

export async function deleteCarrier(id: string) {
  const linked = await prisma.advertisingCarrier.findUnique({
    where: { id },
    select: {
      _count: { select: { surfaces: true, photos: true, workItems: true } },
    },
  });
  if (!linked) return;
  if (linked._count.surfaces > 0 || linked._count.photos > 0 || linked._count.workItems > 0) {
    throw new Error('Nosič má navázané plochy, fotky nebo práci. Použijte archivaci.');
  }
  await prisma.advertisingCarrier.delete({ where: { id } });
}

export async function upsertSurface(input: Partial<Surface> & { carrierId: string }): Promise<Surface> {
  const existing = input.id ? await prisma.advertisingSurface.findUnique({ where: { id: input.id } }) : null;
  const data = {
    carrierId: input.carrierId,
    currentClientId: input.currentClientId ?? existing?.currentClientId ?? null,
    name: input.name ?? existing?.name ?? 'Plocha',
    mediaType: input.mediaType ?? existing?.mediaType ?? 'OTHER',
    sourcePosition: input.sourcePosition ?? existing?.sourcePosition ?? null,
    directionDescription: input.directionDescription ?? existing?.directionDescription ?? null,
    rawMediaType: input.rawMediaType ?? existing?.rawMediaType ?? null,
    size: input.size ?? existing?.size ?? null,
    orientation: input.orientation ?? existing?.orientation ?? null,
    status: input.status ?? existing?.status ?? 'AVAILABLE',
    price: input.price ?? existing?.price ?? null,
    note: input.note ?? existing?.note ?? null,
  };
  const saved = existing
    ? await prisma.advertisingSurface.update({ where: { id: existing.id }, data })
    : await prisma.advertisingSurface.create({ data: { ...data, id: input.id } });
  return {
    id: saved.id,
    carrierId: saved.carrierId,
    currentClientId: saved.currentClientId ?? undefined,
    name: saved.name,
    mediaType: saved.mediaType,
    sourcePosition: saved.sourcePosition ?? undefined,
    directionDescription: saved.directionDescription ?? undefined,
    rawMediaType: saved.rawMediaType ?? undefined,
    size: saved.size ?? undefined,
    orientation: saved.orientation ?? undefined,
    status: saved.status,
    price: saved.price?.toNumber(),
    note: saved.note ?? undefined,
    occupancies: [],
    photos: [],
  };
}

export async function upsertOccupancy(input: Partial<Occupancy> & { surfaceId: string }): Promise<Occupancy> {
  const existing = input.id ? await prisma.occupancy.findUnique({ where: { id: input.id } }) : null;
  const data = {
    surfaceId: input.surfaceId,
    clientId: input.clientId ?? existing?.clientId ?? null,
    clientName: input.clientName ?? existing?.clientName ?? 'Klient',
    campaignName: input.campaignName ?? existing?.campaignName ?? 'Kampaň',
    dateFrom: input.dateFrom ? new Date(input.dateFrom) : existing?.dateFrom ?? new Date(),
    dateTo: input.dateTo ? new Date(input.dateTo) : existing?.dateTo ?? new Date(),
    status: input.status ?? existing?.status ?? 'RESERVED',
    price: input.price ?? existing?.price ?? null,
    note: input.note ?? existing?.note ?? null,
  };
  const saved = existing
    ? await prisma.occupancy.update({ where: { id: existing.id }, data })
    : await prisma.occupancy.create({ data: { ...data, id: input.id } });
  return { id: saved.id, surfaceId: saved.surfaceId, clientId: saved.clientId ?? undefined, clientName: saved.clientName, campaignName: saved.campaignName, dateFrom: saved.dateFrom.toISOString().slice(0, 10), dateTo: saved.dateTo.toISOString().slice(0, 10), status: saved.status, price: saved.price?.toNumber(), note: saved.note ?? undefined };
}

export { carrierMapColor };
