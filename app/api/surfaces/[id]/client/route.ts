import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

function normalizeClientName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseIsoDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3])
    ? date
    : undefined;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function campaignStatuses(dateFrom: Date | undefined, dateTo: Date | undefined) {
  if (!dateFrom || !dateTo) return { occupancy: undefined, surface: 'OCCUPIED' as const };
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (dateTo < today) return { occupancy: 'FINISHED' as const, surface: 'AVAILABLE' as const };
  if (dateFrom > today) return { occupancy: 'RESERVED' as const, surface: 'RESERVED' as const };
  return { occupancy: 'OCCUPIED' as const, surface: 'OCCUPIED' as const };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('occupancy'); if (isApiDenied(auth)) return auth;
  try {
    const surfaceId = (await params).id;
    const body = await request.json() as {
      clientName?: unknown;
      dateFrom?: unknown;
      dateTo?: unknown;
      occupancyId?: unknown;
      destinationName?: unknown;
      distanceMeters?: unknown;
      directionDescription?: unknown;
      sourcePosition?: unknown;
    };
    if (body.clientName !== null && body.clientName !== undefined && typeof body.clientName !== 'string') {
      return NextResponse.json({ error: 'Název klienta musí být text.' }, { status: 400 });
    }

    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
    if (clientName.length > 200) {
      return NextResponse.json({ error: 'Název klienta je příliš dlouhý.' }, { status: 400 });
    }

    const destinationName = typeof body.destinationName === 'string' ? body.destinationName.trim() : undefined;
    const distanceMeters = typeof body.distanceMeters === 'number' && Number.isFinite(body.distanceMeters) && body.distanceMeters >= 0
      ? Math.round(body.distanceMeters)
      : typeof body.distanceMeters === 'string' && /^\d+$/.test(body.distanceMeters.trim())
      ? Number(body.distanceMeters.trim())
      : undefined;
    const directionDescription = typeof body.directionDescription === 'string' ? body.directionDescription.trim() : undefined;
    const sourcePosition = typeof body.sourcePosition === 'string' ? body.sourcePosition.trim() : undefined;

    const hasDateFrom = typeof body.dateFrom === 'string' && Boolean(body.dateFrom.trim());
    const hasDateTo = typeof body.dateTo === 'string' && Boolean(body.dateTo.trim());
    if (hasDateFrom !== hasDateTo) {
      return NextResponse.json({ error: 'Vyplňte datum od i datum do.' }, { status: 400 });
    }
    const dateFrom = parseIsoDate(body.dateFrom);
    const dateTo = parseIsoDate(body.dateTo);
    if ((hasDateFrom && !dateFrom) || (hasDateTo && !dateTo)) {
      return NextResponse.json({ error: 'Termín kampaně není platné datum.' }, { status: 400 });
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return NextResponse.json({ error: 'Datum od musí být před datem do.' }, { status: 400 });
    }
    if ((dateFrom || dateTo) && !clientName) {
      return NextResponse.json({ error: 'Pro termín kampaně nejprve vyberte klienta.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.advertisingSurface.findUnique({ where: { id: surfaceId } });
      if (!existing) return null;

      if (!clientName) {
        const surface = await transaction.advertisingSurface.update({
          where: { id: surfaceId },
          data: {
            currentClientId: null,
            status: ['OCCUPIED', 'RESERVED', 'NEGOTIATION'].includes(existing.status)
              ? 'AVAILABLE'
              : existing.status,
            ...(destinationName !== undefined ? { destinationName } : {}),
            ...(distanceMeters !== undefined ? { distanceMeters } : {}),
            ...(directionDescription !== undefined ? { directionDescription } : {}),
            ...(sourcePosition !== undefined ? { sourcePosition } : {}),
          },
        });
        return { surface, client: null, occupancy: null };
      }

      const normalizedName = normalizeClientName(clientName);
      if (!normalizedName) throw new Error('Zadejte platný název klienta.');
      const existingClient = await transaction.client.findFirst({ where: { normalizedName } });
      const client = existingClient
        ? await transaction.client.update({ where: { id: existingClient.id }, data: { active: true } })
        : await transaction.client.create({ data: { name: clientName, normalizedName, active: true } });
      const statuses = campaignStatuses(dateFrom, dateTo);
      const surface = await transaction.advertisingSurface.update({
        where: { id: surfaceId },
        data: {
          currentClientId: client.id,
          status: existing.status === 'OUT_OF_SERVICE' ? existing.status : statuses.surface,
          ...(destinationName !== undefined ? { destinationName } : {}),
          ...(distanceMeters !== undefined ? { distanceMeters } : {}),
          ...(directionDescription !== undefined ? { directionDescription } : {}),
          ...(sourcePosition !== undefined ? { sourcePosition } : {}),
        },
      });

      let occupancy = null;
      if (dateFrom && dateTo && statuses.occupancy) {
        const occupancyId = typeof body.occupancyId === 'string' ? body.occupancyId : undefined;
        const occupancyData = {
          surfaceId,
          clientId: client.id,
          clientName: client.name,
          campaignName: `Navigace – ${client.name}`,
          dateFrom,
          dateTo,
          status: statuses.occupancy,
        };
        if (occupancyId) {
          const existingOccupancy = await transaction.occupancy.findUnique({ where: { id: occupancyId } });
          if (!existingOccupancy || existingOccupancy.surfaceId !== surfaceId) {
            throw new Error('Původní kampaň nebyla nalezena. Obnovte stránku.');
          }
          occupancy = await transaction.occupancy.update({ where: { id: occupancyId }, data: occupancyData });
        } else {
          occupancy = await transaction.occupancy.create({ data: occupancyData });
        }
      }

      return { surface, client, occupancy };
    });

    if (!result) return NextResponse.json({ error: 'Navigace nebyla nalezena.' }, { status: 404 });
    return NextResponse.json({
      id: result.surface.id,
      currentClientId: result.surface.currentClientId,
      currentClient: result.client ? { id: result.client.id, name: result.client.name } : null,
      status: result.surface.status,
      occupancy: result.occupancy ? {
        id: result.occupancy.id,
        surfaceId: result.occupancy.surfaceId,
        clientId: result.occupancy.clientId,
        clientName: result.occupancy.clientName,
        campaignName: result.occupancy.campaignName,
        dateFrom: dateOnly(result.occupancy.dateFrom),
        dateTo: dateOnly(result.occupancy.dateTo),
        status: result.occupancy.status,
      } : null,
    });
  } catch (error) {
    console.error('Surface client assignment failed', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Klienta se nepodařilo uložit.' },
      { status: 400 },
    );
  }
}
