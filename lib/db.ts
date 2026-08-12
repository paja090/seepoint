import { Prisma, PrismaClient } from '@prisma/client';
import { carrierMapColor } from './carrier-map.ts';
import type { Carrier, CarrierType, GpsStatus, MediaType, Occupancy, OccupancyStatus, Surface, SurfaceStatus } from './types';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL;
export const prisma = globalForPrisma.prisma ?? new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined);
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const carrierInclude = {
  surfaces: {
    include: {
      currentClient: true,
      occupancies: { orderBy: { dateFrom: 'desc' } },
      photos: {
        where: {
          type: { not: 'EXPENSE_RECEIPT' },
        },
      },
    },
    orderBy: { name: 'asc' },
  },
  photos: {
    where: {
      type: { not: 'EXPENSE_RECEIPT' },
    },
  },
} satisfies Prisma.AdvertisingCarrierInclude;

type CarrierRow = Prisma.AdvertisingCarrierGetPayload<{ include: typeof carrierInclude }>;
type OccupancyRow = Prisma.OccupancyGetPayload<Record<string, never>>;

export type SurfaceTemplate = { name: string; mediaType: Surface['mediaType']; orientation?: string };
export type CarrierArchiveInput = { archivedBy?: string; archiveReason?: string };
export type CarrierFilters = { q?: string; carrierType?: CarrierType; mediaType?: MediaType; city?: string; locality?: string; street?: string; client?: string; surfaceStatus?: SurfaceStatus; gps?: 'missing' | 'present' | GpsStatus; photo?: 'missing' | 'present'; description?: 'missing' | 'present'; occupancy?: 'missing' | 'present'; archived?: 'active' | 'archived' | 'all'; importBatchId?: string; page?: number; pageSize?: number };
export type CarrierResultMeta = { total: number; returned: number; limit: number; page: number; pageSize: number; hasMore: boolean; missingGpsCount: number; archivedCount: number };
export type CarrierFilterOptions = { cities: string[]; localities: string[]; streets: string[]; clients: string[]; importBatches: { id: string; label: string }[] };

function dateOnly(date: Date | null | undefined) { return date?.toISOString().slice(0, 10); }
function clean(value?: string) { const trimmed = value?.trim(); return trimmed || undefined; }

function serializeOccupancy(occupancy: OccupancyRow): Occupancy {
  return { id: occupancy.id, surfaceId: occupancy.surfaceId, clientId: occupancy.clientId ?? undefined, clientName: occupancy.clientName, campaignName: occupancy.campaignName, dateFrom: dateOnly(occupancy.dateFrom)!, dateTo: dateOnly(occupancy.dateTo)!, status: occupancy.status, price: occupancy.price?.toNumber(), note: occupancy.note ?? undefined, createdBy: occupancy.createdBy ?? undefined, updatedBy: occupancy.updatedBy ?? undefined, reservedUntil: dateOnly(occupancy.reservedUntil), offerId: occupancy.offerId ?? undefined, createdAt: occupancy.createdAt.toISOString(), updatedAt: occupancy.updatedAt.toISOString() };
}

function serializeCarrier(carrier: CarrierRow): Carrier {
  const mapPhoto = (photo: typeof carrier.photos[number]) => ({
    id: photo.id,
    carrierId: photo.carrierId ?? undefined,
    surfaceId: photo.surfaceId ?? undefined,
    url: photo.url,
    type: photo.type,
    note: photo.note ?? undefined,
    sortOrder: photo.sortOrder,
    isPrimary: photo.isPrimary,
    isClientVisible: photo.isClientVisible,
    driveFileId: photo.driveFileId ?? undefined,
    fileName: photo.fileName ?? undefined,
    mimeType: photo.mimeType ?? undefined,
    size: photo.size ?? undefined,
  });
  const todayStr = new Date().toISOString().slice(0, 10);
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
    photos: carrier.photos.map(mapPhoto),
    surfaces: carrier.surfaces.map((surface) => {
      // Find current active occupancy running today (dateFrom <= today && dateTo >= today)
      const activeOccupancy = surface.occupancies.find((o) => {
        if (!['OCCUPIED', 'RESERVED'].includes(o.status)) return false;
        const dateFromStr = dateOnly(o.dateFrom)!;
        const dateToStr = dateOnly(o.dateTo)!;
        return dateFromStr <= todayStr && dateToStr >= todayStr;
      });

      // Find upcoming reservation starting in the future (dateFrom > today)
      const upcomingReservation = !activeOccupancy
        ? surface.occupancies.find((o) => {
            if (!['OCCUPIED', 'RESERVED'].includes(o.status)) return false;
            const dateFromStr = dateOnly(o.dateFrom)!;
            return dateFromStr > todayStr;
          })
        : null;

      let derivedStatus: SurfaceStatus = surface.status;
      let derivedClientId: string | undefined = surface.currentClientId ?? undefined;
      let derivedClient = surface.currentClient
        ? { id: surface.currentClient.id, name: surface.currentClient.name }
        : undefined;

      if (surface.status !== 'OUT_OF_SERVICE') {
        if (activeOccupancy) {
          derivedStatus = activeOccupancy.status === 'RESERVED' ? 'RESERVED' : 'OCCUPIED';
          derivedClientId = activeOccupancy.clientId ?? undefined;
          derivedClient = {
            id: activeOccupancy.clientId ?? `client-${activeOccupancy.id}`,
            name: activeOccupancy.clientName,
          };
        } else if (upcomingReservation) {
          derivedStatus = 'RESERVED';
          derivedClientId = upcomingReservation.clientId ?? undefined;
          derivedClient = {
            id: upcomingReservation.clientId ?? `client-${upcomingReservation.id}`,
            name: upcomingReservation.clientName,
          };
        } else if (carrier.type !== 'NAVIGATION') {
          // Campaign ended and no upcoming reservation: Bench/Billboard/CLP automatically becomes AVAILABLE & clears client
          derivedStatus = 'AVAILABLE';
          derivedClientId = undefined;
          derivedClient = undefined;
        }
      }

      return {
        id: surface.id,
        carrierId: surface.carrierId,
        currentClientId: derivedClientId,
        currentClient: derivedClient,
        name: surface.name,
        mediaType: surface.mediaType,
        sourcePosition: surface.sourcePosition ?? undefined,
        directionDescription: surface.directionDescription ?? undefined,
        destinationName: surface.destinationName ?? undefined,
        distanceMeters: surface.distanceMeters ?? undefined,
        rawMediaType: surface.rawMediaType ?? undefined,
        size: surface.size ?? undefined,
        orientation: surface.orientation ?? undefined,
        status: derivedStatus,
        price: surface.price?.toNumber(),
        note: surface.note ?? undefined,
        photos: surface.photos.map(mapPhoto),
        occupancies: surface.occupancies.map(serializeOccupancy),
      };
    }),
  };
}

export function buildCarrierWhere(filters: CarrierFilters = {}): Prisma.AdvertisingCarrierWhereInput {
  const q = clean(filters.q); const city = clean(filters.city); const locality = clean(filters.locality); const street = clean(filters.street); const client = clean(filters.client); const importBatchId = clean(filters.importBatchId); const where: Prisma.AdvertisingCarrierWhereInput = {};
  if (filters.archived === 'archived') where.archivedAt = { not: null }; else if (filters.archived !== 'all') where.archivedAt = null;
  if (filters.carrierType) where.type = filters.carrierType;
  if (filters.mediaType) where.surfaces = { some: { mediaType: filters.mediaType } };
  if (city) where.city = { equals: city, mode: 'insensitive' };
  if (locality) where.OR = [{ locality: { contains: locality, mode: 'insensitive' } }, { cadastralArea: { contains: locality, mode: 'insensitive' } }];
  if (street) where.AND = [{ OR: [{ street: { contains: street, mode: 'insensitive' } }, { address: { contains: street, mode: 'insensitive' } }] }];
  if (client) where.surfaces = { some: { currentClient: { name: { contains: client, mode: 'insensitive' } } } };
  if (filters.surfaceStatus) where.surfaces = { some: { status: filters.surfaceStatus } };
  if (filters.gps === 'missing') where.OR = [...(where.OR as Prisma.AdvertisingCarrierWhereInput[] | undefined ?? []), { gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }];
  else if (filters.gps === 'present') where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { latitude: { not: null }, longitude: { not: null } }];
  else if (filters.gps) where.gpsStatus = filters.gps;
  if (filters.photo === 'missing') where.photos = { none: {} };
  if (filters.photo === 'present') where.photos = { some: {} };
  if (filters.occupancy === 'missing') where.surfaces = { none: { occupancies: { some: { status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] } } } } };
  if (filters.occupancy === 'present') where.surfaces = { some: { occupancies: { some: { status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] } } } } };
  if (importBatchId) where.importBatchId = importBatchId;
  if (q) where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { OR: [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }, { street: { contains: q, mode: 'insensitive' } }, { address: { contains: q, mode: 'insensitive' } }, { locality: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }, { cadastralArea: { contains: q, mode: 'insensitive' } }, { structureCode: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }, { placementDescription: { contains: q, mode: 'insensitive' } }, { note: { contains: q, mode: 'insensitive' } }, { surfaces: { some: { name: { contains: q, mode: 'insensitive' } } } }, { surfaces: { some: { directionDescription: { contains: q, mode: 'insensitive' } } } }, { surfaces: { some: { currentClient: { name: { contains: q, mode: 'insensitive' } } } } }] }];
  return where;
}

async function getCarrierCounts(where: Prisma.AdvertisingCarrierWhereInput) {
  const [total, missingGpsCount, archivedCount] = await Promise.all([
    prisma.advertisingCarrier.count({ where }),
    prisma.advertisingCarrier.count({ where: { ...where, OR: [{ gpsStatus: 'MISSING' }, { latitude: null }, { longitude: null }] } }),
    prisma.advertisingCarrier.count({ where: { archivedAt: { not: null } } }),
  ]);
  return { total, missingGpsCount, archivedCount };
}

export async function getCarriersPage(filters: CarrierFilters = {}) {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 500, 1), 2000);
  const page = Math.max(filters.page ?? 1, 1);
  const where = buildCarrierWhere(filters);
  const [{ total, missingGpsCount, archivedCount }, rows] = await Promise.all([
    getCarrierCounts(where),
    prisma.advertisingCarrier.findMany({ where, include: carrierInclude, orderBy: [{ city: 'asc' }, { name: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  const carriers = rows.map(serializeCarrier);
  return { carriers, meta: { total, returned: carriers.length, limit: pageSize, page, pageSize, hasMore: page * pageSize < total, missingGpsCount, archivedCount } satisfies CarrierResultMeta };
}

export async function getCarriers(filters: CarrierFilters = {}): Promise<Carrier[]> { return (await getCarriersPage(filters)).carriers; }

export async function getMapCarriers(filters: CarrierFilters = {}) {
  const limit = Math.min(Math.max(filters.pageSize ?? 2000, 1), 5000);
  const where = buildCarrierWhere({ ...filters, archived: filters.archived ?? 'active' });
  const mapWhere: Prisma.AdvertisingCarrierWhereInput = { ...where, AND: [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), { latitude: { not: null }, longitude: { not: null } }] };
  const [{ total, missingGpsCount, archivedCount }, rows] = await Promise.all([
    getCarrierCounts(where),
    prisma.advertisingCarrier.findMany({ where: mapWhere, include: carrierInclude, orderBy: [{ city: 'asc' }, { name: 'asc' }], take: limit }),
  ]);
  const carriers = rows.map(serializeCarrier);
  return { carriers, meta: { total, returned: carriers.length, limit, page: 1, pageSize: limit, hasMore: carriers.length >= limit && carriers.length < total - missingGpsCount, missingGpsCount, archivedCount } satisfies CarrierResultMeta };
}

export async function getCarrier(id: string): Promise<Carrier | undefined> { const carrier = await prisma.advertisingCarrier.findUnique({ where: { id }, include: carrierInclude }); return carrier ? serializeCarrier(carrier) : undefined; }

export async function getCarrierFilterOptions(): Promise<CarrierFilterOptions> {
  const [cities, carriers, clients, importBatches] = await Promise.all([
    prisma.advertisingCarrier.findMany({ where: { city: { not: '' } }, distinct: ['city'], select: { city: true }, orderBy: { city: 'asc' } }),
    prisma.advertisingCarrier.findMany({ select: { street: true, address: true, locality: true, cadastralArea: true }, take: 2000 }),
    prisma.client.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.importBatch.findMany({ select: { id: true, fileName: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  const unique = (values: Array<string | null>) => [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right, 'cs'));
  return { cities: unique(cities.map((item) => item.city)), localities: unique(carriers.flatMap((item) => [item.locality, item.cadastralArea])), streets: unique(carriers.flatMap((item) => [item.street, item.address])), clients: clients.map((client) => client.name), importBatches: importBatches.map((batch) => ({ id: batch.id, label: `${batch.fileName} (${batch.createdAt.toLocaleDateString('cs-CZ')})` })) };
}

export type OccupancyFilters = { q?: string; client?: string; mediaType?: MediaType; city?: string; locality?: string; status?: OccupancyStatus | SurfaceStatus; dateFrom?: string; dateTo?: string };
export type OccupancyRowView = { occupancy: Occupancy | null; surface: Pick<Surface, 'id' | 'name' | 'mediaType' | 'status' | 'price'>; carrier: Pick<Carrier, 'id' | 'name' | 'code' | 'city' | 'locality' | 'address'>; currentClient?: Pick<NonNullable<Surface['currentClient']>, 'id' | 'name'> };
export type OccupancyConflict = { surfaceId: string; surfaceName: string; carrierName: string; carrierCode: string; status: OccupancyStatus; clientName: string; campaignName: string; dateFrom: string; dateTo: string; severity: 'block' | 'warning' };
function overlaps(dateFrom: Date, dateTo: Date) { return { dateFrom: { lte: dateTo }, dateTo: { gte: dateFrom } }; }
function parseDateInput(value?: string) { if (!value) return undefined; const parsed = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(parsed.getTime()) ? undefined : parsed; }

export async function getOccupancyOverview(filters: OccupancyFilters = {}) {
  const dateFrom = parseDateInput(filters.dateFrom); const dateTo = parseDateInput(filters.dateTo); const surfaceWhere: Prisma.AdvertisingSurfaceWhereInput = {}; const carrierWhere: Prisma.AdvertisingCarrierWhereInput = { archivedAt: null }; const occupancyWhere: Prisma.OccupancyWhereInput = {}; const q = clean(filters.q);
  if (filters.mediaType) surfaceWhere.mediaType = filters.mediaType;
  if (filters.status && ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'NEGOTIATION', 'OUT_OF_SERVICE'].includes(filters.status)) surfaceWhere.status = filters.status as SurfaceStatus;
  if (filters.client) surfaceWhere.OR = [{ currentClient: { name: { contains: filters.client, mode: 'insensitive' } } }, { occupancies: { some: { clientName: { contains: filters.client, mode: 'insensitive' } } } }];
  if (filters.city) carrierWhere.city = { equals: filters.city, mode: 'insensitive' };
  if (filters.locality) carrierWhere.OR = [{ locality: { contains: filters.locality, mode: 'insensitive' } }, { cadastralArea: { contains: filters.locality, mode: 'insensitive' } }];
  if (q) carrierWhere.OR = [{ code: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }, { address: { contains: q, mode: 'insensitive' } }, { street: { contains: q, mode: 'insensitive' } }, { surfaces: { some: { name: { contains: q, mode: 'insensitive' } } } }];
  if (dateFrom && dateTo) Object.assign(occupancyWhere, overlaps(dateFrom, dateTo));
  if (filters.status && ['AVAILABLE', 'NEGOTIATION', 'RESERVED', 'OCCUPIED', 'FINISHED', 'CANCELLED', 'OUT_OF_SERVICE'].includes(filters.status)) occupancyWhere.status = filters.status as OccupancyStatus;
  const surfaces = await prisma.advertisingSurface.findMany({ where: { ...surfaceWhere, carrier: carrierWhere, ...(Object.keys(occupancyWhere).length ? { occupancies: { some: occupancyWhere } } : {}) }, include: { currentClient: true, carrier: true, occupancies: { where: Object.keys(occupancyWhere).length ? occupancyWhere : undefined, orderBy: [{ dateTo: 'asc' }, { dateFrom: 'asc' }] } }, orderBy: [{ carrier: { city: 'asc' } }, { carrier: { name: 'asc' } }, { name: 'asc' }], take: 1000 });
  const rows = surfaces.flatMap((surface): OccupancyRowView[] => { const base = { surface: { id: surface.id, name: surface.name, mediaType: surface.mediaType, status: surface.status, price: surface.price?.toNumber() }, carrier: { id: surface.carrier.id, name: surface.carrier.name, code: surface.carrier.code, city: surface.carrier.city, locality: surface.carrier.locality ?? surface.carrier.cadastralArea ?? undefined, address: surface.carrier.address ?? surface.carrier.street ?? undefined }, currentClient: surface.currentClient ? { id: surface.currentClient.id, name: surface.currentClient.name } : undefined }; if (surface.occupancies.length === 0) return [{ ...base, occupancy: null }]; return surface.occupancies.map((occupancy) => ({ ...base, occupancy: serializeOccupancy(occupancy) })); });
  const today = new Date(); const in7 = new Date(today); in7.setDate(today.getDate() + 7); const in30 = new Date(today); in30.setDate(today.getDate() + 30); const activeRows = rows.filter((row) => row.occupancy && ['OCCUPIED', 'RESERVED', 'NEGOTIATION'].includes(row.occupancy.status));
  return { rows, ending7: activeRows.filter((row) => row.occupancy && parseDateInput(row.occupancy.dateTo)! <= in7), ending30: activeRows.filter((row) => row.occupancy && parseDateInput(row.occupancy.dateTo)! <= in30), available: rows.filter((row) => !row.occupancy && row.surface.status === 'AVAILABLE'), reserved: rows.filter((row) => row.occupancy?.status === 'RESERVED'), negotiation: rows.filter((row) => row.occupancy?.status === 'NEGOTIATION'), occupied: rows.filter((row) => row.occupancy?.status === 'OCCUPIED') };
}

export async function checkOccupancyConflicts(surfaceIds: string[], dateFromInput: string, dateToInput: string, ignoreOccupancyId?: string): Promise<OccupancyConflict[]> { const dateFrom = parseDateInput(dateFromInput); const dateTo = parseDateInput(dateToInput); if (!dateFrom || !dateTo || dateFrom > dateTo || surfaceIds.length === 0) return []; const conflicts = await prisma.occupancy.findMany({ where: { surfaceId: { in: surfaceIds }, id: ignoreOccupancyId ? { not: ignoreOccupancyId } : undefined, status: { in: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'] }, ...overlaps(dateFrom, dateTo) }, include: { surface: { include: { carrier: true } } }, orderBy: { dateFrom: 'asc' } }); return conflicts.map((conflict) => ({ surfaceId: conflict.surfaceId, surfaceName: conflict.surface.name, carrierName: conflict.surface.carrier.name, carrierCode: conflict.surface.carrier.code, status: conflict.status, clientName: conflict.clientName, campaignName: conflict.campaignName, dateFrom: dateOnly(conflict.dateFrom)!, dateTo: dateOnly(conflict.dateTo)!, severity: conflict.status === 'OCCUPIED' || conflict.status === 'RESERVED' ? 'block' : 'warning' })); }
export function hasBlockingConflict(conflicts: OccupancyConflict[]) { return conflicts.some((conflict) => conflict.severity === 'block'); }
export async function upsertCarrier(input: Partial<Carrier>, surfaceTemplates: SurfaceTemplate[] = []): Promise<Carrier> { const existing = input.id ? await prisma.advertisingCarrier.findUnique({ where: { id: input.id } }) : null; const latitude = input.latitude ?? existing?.latitude ?? null; const longitude = input.longitude ?? existing?.longitude ?? null; const data = { name: input.name ?? existing?.name ?? 'Novy nosic', code: input.code ?? existing?.code ?? `NEW-${Date.now()}`, type: input.type ?? existing?.type ?? 'BILLBOARD', latitude, longitude, gpsStatus: input.gpsStatus ?? existing?.gpsStatus ?? (latitude === null || longitude === null ? 'MISSING' : 'UNVERIFIED'), street: input.street ?? existing?.street ?? null, address: input.address ?? existing?.address ?? null, locality: input.locality ?? existing?.locality ?? null, city: input.city ?? existing?.city ?? 'Praha', region: input.region ?? existing?.region ?? null, cadastralArea: input.cadastralArea ?? existing?.cadastralArea ?? null, structureCode: input.structureCode ?? existing?.structureCode ?? null, mountingType: input.mountingType ?? existing?.mountingType ?? 'UNKNOWN', status: input.status ?? existing?.status ?? 'ACTIVE', description: input.description ?? existing?.description ?? null, placementDescription: input.placementDescription ?? existing?.placementDescription ?? null, note: input.note ?? existing?.note ?? null, sourceSystem: input.sourceSystem ?? existing?.sourceSystem ?? null, sourceSheet: input.sourceSheet ?? existing?.sourceSheet ?? null, sourceRow: input.sourceRow ?? existing?.sourceRow ?? null }; const saved = existing ? await prisma.advertisingCarrier.update({ where: { id: existing.id }, data }) : await prisma.advertisingCarrier.create({ data: { ...data, id: input.id, surfaces: surfaceTemplates.length ? { create: surfaceTemplates.map((surface) => ({ name: surface.name, mediaType: surface.mediaType, orientation: surface.orientation ?? null, status: 'AVAILABLE' })) } : undefined } }); return (await getCarrier(saved.id))!; }
export async function archiveCarrier(id: string, input: CarrierArchiveInput = {}) { await prisma.advertisingCarrier.update({ where: { id }, data: { archivedAt: new Date(), archivedBy: input.archivedBy?.trim() || null, archiveReason: input.archiveReason?.trim() || null, status: 'INACTIVE' } }); return (await getCarrier(id))!; }
export async function restoreCarrier(id: string) { await prisma.advertisingCarrier.update({ where: { id }, data: { archivedAt: null, archivedBy: null, archiveReason: null, status: 'ACTIVE' } }); return (await getCarrier(id))!; }
export async function deleteCarrier(id: string) { const linked = await prisma.advertisingCarrier.findUnique({ where: { id }, select: { _count: { select: { surfaces: true, photos: true, workItems: true } } } }); if (!linked) return; if (linked._count.surfaces > 0 || linked._count.photos > 0 || linked._count.workItems > 0) throw new Error('Nosic ma navazane plochy, fotky nebo praci. Pouzijte archivaci.'); await prisma.advertisingCarrier.delete({ where: { id } }); }
export async function upsertSurface(input: Partial<Surface> & { carrierId: string }): Promise<Surface> { const existing = input.id ? await prisma.advertisingSurface.findUnique({ where: { id: input.id } }) : null; const data = { carrierId: input.carrierId, currentClientId: input.currentClientId ?? existing?.currentClientId ?? null, name: input.name ?? existing?.name ?? 'Plocha', mediaType: input.mediaType ?? existing?.mediaType ?? 'OTHER', sourcePosition: input.sourcePosition ?? existing?.sourcePosition ?? null, directionDescription: input.directionDescription ?? existing?.directionDescription ?? null, rawMediaType: input.rawMediaType ?? existing?.rawMediaType ?? null, size: input.size ?? existing?.size ?? null, orientation: input.orientation ?? existing?.orientation ?? null, status: input.status ?? existing?.status ?? 'AVAILABLE', price: input.price ?? existing?.price ?? null, note: input.note ?? existing?.note ?? null }; const saved = existing ? await prisma.advertisingSurface.update({ where: { id: existing.id }, data }) : await prisma.advertisingSurface.create({ data: { ...data, id: input.id } }); return { id: saved.id, carrierId: saved.carrierId, currentClientId: saved.currentClientId ?? undefined, name: saved.name, mediaType: saved.mediaType, sourcePosition: saved.sourcePosition ?? undefined, directionDescription: saved.directionDescription ?? undefined, rawMediaType: saved.rawMediaType ?? undefined, size: saved.size ?? undefined, orientation: saved.orientation ?? undefined, status: saved.status, price: saved.price?.toNumber(), note: saved.note ?? undefined, occupancies: [], photos: [] }; }
export async function upsertOccupancy(input: Partial<Occupancy> & { surfaceId: string }): Promise<Occupancy> { const existing = input.id ? await prisma.occupancy.findUnique({ where: { id: input.id } }) : null; const data = { surfaceId: input.surfaceId, clientId: input.clientId ?? existing?.clientId ?? null, clientName: input.clientName ?? existing?.clientName ?? 'Klient', campaignName: input.campaignName ?? existing?.campaignName ?? 'Kampan', dateFrom: input.dateFrom ? new Date(input.dateFrom) : existing?.dateFrom ?? new Date(), dateTo: input.dateTo ? new Date(input.dateTo) : existing?.dateTo ?? new Date(), status: input.status ?? existing?.status ?? 'RESERVED', price: input.price ?? existing?.price ?? null, note: input.note ?? existing?.note ?? null, createdBy: input.createdBy ?? existing?.createdBy ?? null, updatedBy: input.updatedBy ?? existing?.updatedBy ?? null, reservedUntil: input.reservedUntil ? new Date(input.reservedUntil) : existing?.reservedUntil ?? null, offerId: input.offerId ?? existing?.offerId ?? null }; const saved = existing ? await prisma.occupancy.update({ where: { id: existing.id }, data }) : await prisma.occupancy.create({ data: { ...data, id: input.id } }); const activeSurfaceStatuses: Partial<Record<OccupancyStatus, SurfaceStatus>> = { AVAILABLE: 'AVAILABLE', NEGOTIATION: 'NEGOTIATION', RESERVED: 'RESERVED', OCCUPIED: 'OCCUPIED', OUT_OF_SERVICE: 'OUT_OF_SERVICE' }; const surfaceStatus = activeSurfaceStatuses[saved.status] ?? 'AVAILABLE'; await prisma.advertisingSurface.update({ where: { id: saved.surfaceId }, data: { status: surfaceStatus, currentClientId: ['NEGOTIATION', 'RESERVED', 'OCCUPIED'].includes(saved.status) ? saved.clientId : null } }); return serializeOccupancy(saved); }
export type OccupancyAction = 'extend' | 'finish' | 'free';
export async function updateOccupancyAction(id: string, action: OccupancyAction, input: { dateTo?: string; updatedBy?: string } = {}) { return prisma.$transaction(async (transaction) => { const existing = await transaction.occupancy.findUnique({ where: { id }, include: { surface: true } }); if (!existing) throw new Error('Zaznam obsazenosti nebyl nalezen.'); if (action === 'extend') { const dateTo = parseDateInput(input.dateTo); if (!dateTo) throw new Error('Zadejte platne datum prodlouzeni.'); if (dateTo < existing.dateFrom) throw new Error('Datum do musi byt po zacatku kampane.'); const conflicts = await checkOccupancyConflicts([existing.surfaceId], dateOnly(existing.dateFrom)!, dateOnly(dateTo)!, existing.id); if (hasBlockingConflict(conflicts)) { const error = new Error('Kampan nelze prodlouzit kvuli obsazene nebo rezervovane plose.'); (error as Error & { conflicts?: OccupancyConflict[] }).conflicts = conflicts; throw error; } const occupancy = await transaction.occupancy.update({ where: { id }, data: { dateTo, updatedBy: clean(input.updatedBy) ?? existing.updatedBy } }); return serializeOccupancy(occupancy); } const now = new Date(); const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); const nextStatus = action === 'free' ? 'CANCELLED' : 'FINISHED'; const occupancy = await transaction.occupancy.update({ where: { id }, data: { status: nextStatus, dateTo: existing.dateTo > today ? today : existing.dateTo, updatedBy: clean(input.updatedBy) ?? existing.updatedBy } }); await transaction.advertisingSurface.update({ where: { id: existing.surfaceId }, data: { status: 'AVAILABLE', currentClientId: null } }); return serializeOccupancy(occupancy); }); }
export { carrierMapColor };
