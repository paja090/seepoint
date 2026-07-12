import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { checkOccupancyConflicts, hasBlockingConflict, prisma, updateOccupancyAction, upsertOccupancy } from '@/lib/db';
import { isMissingDatabaseStructureError, productionMigrationMessage } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';

const occupancyStatuses = ['AVAILABLE', 'NEGOTIATION', 'RESERVED', 'OCCUPIED', 'FINISHED', 'CANCELLED', 'OUT_OF_SERVICE'] as const;
const mediaTypes = ['NAVIGATION_SIGN', 'BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE', 'LED_SCREEN', 'PROMO_BENCH', 'PROMO_HORIZON', 'CITY_POSTER', 'PROMO_TOWER', 'PROMO_MINITOWER', 'OTHER'] as const;

function clean(value: string | null) {
  return value?.trim() || undefined;
}

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isOccupancyStatus(value: string | undefined): value is typeof occupancyStatuses[number] {
  return Boolean(value && occupancyStatuses.includes(value as typeof occupancyStatuses[number]));
}

function isMediaType(value: string | undefined): value is typeof mediaTypes[number] {
  return Boolean(value && mediaTypes.includes(value as typeof mediaTypes[number]));
}

function buildWhere(url: URL) {
  const q = clean(url.searchParams.get('q'));
  const client = clean(url.searchParams.get('client'));
  const city = clean(url.searchParams.get('city'));
  const status = clean(url.searchParams.get('status'));
  const mediaType = clean(url.searchParams.get('mediaType'));
  const dateFrom = parseDate(clean(url.searchParams.get('dateFrom')));
  const dateTo = parseDate(clean(url.searchParams.get('dateTo')));
  const surfaceWhere: Prisma.AdvertisingSurfaceWhereInput = {
    carrier: { archivedAt: null },
  };
  const where: Prisma.OccupancyWhereInput = {};

  if (q) {
    where.OR = [
      { campaignName: { contains: q, mode: 'insensitive' } },
      { clientName: { contains: q, mode: 'insensitive' } },
      { surface: { name: { contains: q, mode: 'insensitive' } } },
      { surface: { carrier: { code: { contains: q, mode: 'insensitive' } } } },
      { surface: { carrier: { name: { contains: q, mode: 'insensitive' } } } },
      { surface: { carrier: { city: { contains: q, mode: 'insensitive' } } } },
    ];
  }
  if (client) where.clientName = { contains: client, mode: 'insensitive' };
  if (isOccupancyStatus(status)) where.status = status;
  if (dateFrom && dateTo) Object.assign(where, { dateFrom: { lte: dateTo }, dateTo: { gte: dateFrom } });
  else if (dateFrom) where.dateTo = { gte: dateFrom };
  else if (dateTo) where.dateFrom = { lte: dateTo };
  if (isMediaType(mediaType)) surfaceWhere.mediaType = mediaType;
  if (city) surfaceWhere.carrier = { city: { contains: city, mode: 'insensitive' }, archivedAt: null };
  where.surface = surfaceWhere;

  return where;
}

function serializeOccupancyRow(row: Prisma.OccupancyGetPayload<{ include: { client: true; surface: { include: { carrier: true } } } }>) {
  return {
    id: row.id,
    surfaceId: row.surfaceId,
    clientId: row.clientId,
    clientName: row.client?.name ?? row.clientName,
    campaignName: row.campaignName,
    dateFrom: row.dateFrom.toISOString(),
    dateTo: row.dateTo.toISOString(),
    status: row.status,
    price: row.price?.toNumber() ?? null,
    note: row.note,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    reservedUntil: row.reservedUntil?.toISOString() ?? null,
    offerId: row.offerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    surface: {
      id: row.surface.id,
      name: row.surface.name,
      mediaType: row.surface.mediaType,
      status: row.surface.status,
      carrier: {
        id: row.surface.carrier.id,
        name: row.surface.carrier.name,
        code: row.surface.carrier.code,
        city: row.surface.carrier.city,
        locality: row.surface.carrier.locality ?? row.surface.carrier.cadastralArea,
        address: row.surface.carrier.address ?? row.surface.carrier.street,
      },
    },
  };
}

export async function GET(request: Request) {
  const auth = await requireApiAccess('occupancy'); if (isApiDenied(auth)) return auth;
  try {
    const url = new URL(request.url);
    const where = buildWhere(url);
    const [total, rows] = await Promise.all([
      prisma.occupancy.count({ where }),
      prisma.occupancy.findMany({
        where,
        include: { client: true, surface: { include: { carrier: true } } },
        orderBy: [{ dateTo: 'asc' }, { dateFrom: 'asc' }],
        take: 500,
      }),
    ]);

    return NextResponse.json({
      rows: rows.map(serializeOccupancyRow),
      meta: {
        total,
        returned: rows.length,
        limit: 500,
        hasMore: total > rows.length,
        activeFilters: Object.fromEntries([...url.searchParams.entries()].filter(([, value]) => value.trim())),
        statuses: occupancyStatuses,
      },
    });
  } catch (error) {
    console.error('Occupancy list failed', error);
    if (isMissingDatabaseStructureError(error)) {
      return NextResponse.json({ error: productionMigrationMessage(), rows: [], meta: { total: 0, returned: 0, limit: 500, hasMore: false } }, { status: 503 });
    }
    return NextResponse.json({ error: 'Obsazenost se nepodarilo nacist.', rows: [], meta: { total: 0, returned: 0, limit: 500, hasMore: false } }, { status: 500 });
  }
}

async function save(request: Request, status = 200) {
  try {
    const input = await request.json();
    const surfaceId = typeof input.surfaceId === 'string' ? input.surfaceId : '';
    const dateFrom = typeof input.dateFrom === 'string' ? input.dateFrom : '';
    const dateTo = typeof input.dateTo === 'string' ? input.dateTo : '';
    const occupancyStatus = typeof input.status === 'string' ? input.status : 'RESERVED';
    const shouldCheck = ['OCCUPIED', 'RESERVED', 'NEGOTIATION'].includes(occupancyStatus) && surfaceId && dateFrom && dateTo;

    if (shouldCheck) {
      const conflicts = await checkOccupancyConflicts([surfaceId], dateFrom, dateTo, typeof input.id === 'string' ? input.id : undefined);
      if (hasBlockingConflict(conflicts)) {
        return NextResponse.json({
          error: 'Plocha je v tomto terminu uz obsazena nebo rezervovana.',
          conflicts,
        }, { status: 409 });
      }
      if (conflicts.length > 0 && !input.allowNegotiationConflict) {
        return NextResponse.json({
          warning: 'Plocha je v tomto terminu v jednani. Muzete pokracovat po potvrzeni.',
          conflicts,
        }, { status: 409 });
      }
    }

    const occupancy = await upsertOccupancy(input);
    return NextResponse.json({ occupancy, conflicts: [] }, { status });
  } catch (error) {
    console.error('Occupancy save failed', error);
    if (isMissingDatabaseStructureError(error)) {
      return NextResponse.json({ error: productionMigrationMessage() }, { status: 503 });
    }
    return NextResponse.json({ error: 'Obsazenost se nepodarilo ulozit.' }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAccess('occupancy'); if (isApiDenied(auth)) return auth;
  return save(request, 201);
}

export async function PUT(request: Request) {
  const auth = await requireApiAccess('occupancy'); if (isApiDenied(auth)) return auth;
  return save(request);
}

export async function PATCH(request: Request) {
  const auth = await requireApiAccess('occupancy'); if (isApiDenied(auth)) return auth;
  try {
    const input = await request.json();
    const id = typeof input.id === 'string' ? input.id : '';
    const action = typeof input.action === 'string' ? input.action : '';
    if (!id) return NextResponse.json({ error: 'Chybi ID obsazenosti.' }, { status: 400 });
    if (action !== 'extend' && action !== 'finish' && action !== 'free') {
      return NextResponse.json({ error: 'Neplatna akce obsazenosti.' }, { status: 400 });
    }

    const occupancy = await updateOccupancyAction(id, action, {
      dateTo: typeof input.dateTo === 'string' ? input.dateTo : undefined,
      updatedBy: typeof input.updatedBy === 'string' ? input.updatedBy : undefined,
    });
    return NextResponse.json({ occupancy });
  } catch (error) {
    console.error('Occupancy action failed', error);
    if (isMissingDatabaseStructureError(error)) {
      return NextResponse.json({ error: productionMigrationMessage() }, { status: 503 });
    }
    const conflicts = error instanceof Error && 'conflicts' in error
      ? (error as Error & { conflicts?: unknown }).conflicts
      : undefined;
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Akci obsazenosti se nepodarilo ulozit.',
      conflicts,
    }, { status: conflicts ? 409 : 400 });
  }
}
