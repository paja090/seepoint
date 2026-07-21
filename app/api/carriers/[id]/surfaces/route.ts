import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('carriers'); if (isApiDenied(auth)) return auth;
  try {
    const carrierId = (await params).id;
    const body = await request.json() as {
      name?: unknown;
      sourcePosition?: unknown;
      directionDescription?: unknown;
      destinationName?: unknown;
      distanceMeters?: unknown;
      price?: unknown;
      note?: unknown;
    };

    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Pozice navigace';
    const sourcePosition = typeof body.sourcePosition === 'string' ? body.sourcePosition.trim() : undefined;
    const directionDescription = typeof body.directionDescription === 'string' ? body.directionDescription.trim() : undefined;
    const destinationName = typeof body.destinationName === 'string' ? body.destinationName.trim() : undefined;
    const distanceMeters = typeof body.distanceMeters === 'number' && Number.isFinite(body.distanceMeters) && body.distanceMeters >= 0
      ? Math.round(body.distanceMeters)
      : typeof body.distanceMeters === 'string' && /^\d+$/.test(body.distanceMeters.trim())
      ? Number(body.distanceMeters.trim())
      : undefined;
    const price = typeof body.price === 'number' && Number.isFinite(body.price) ? body.price : undefined;
    const note = typeof body.note === 'string' ? body.note.trim() : undefined;

    const carrier = await prisma.advertisingCarrier.findUnique({ where: { id: carrierId } });
    if (!carrier) return NextResponse.json({ error: 'Nosič nebyl nalezena.' }, { status: 404 });

    const surface = await prisma.advertisingSurface.create({
      data: {
        carrierId,
        name,
        mediaType: 'NAVIGATION_SIGN',
        sourcePosition,
        directionDescription,
        destinationName,
        distanceMeters,
        price,
        note,
        status: 'AVAILABLE',
      },
      include: {
        currentClient: { select: { id: true, name: true } },
        occupancies: true,
      },
    });

    return NextResponse.json(surface, { status: 201 });
  } catch (error) {
    console.error('Failed to create surface position', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepodařilo se vytvořit novou navigační pozici.' },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAccess('carriers'); if (isApiDenied(auth)) return auth;
  try {
    const carrierId = (await params).id;
    const body = await request.json() as {
      surfaceId?: unknown;
      name?: unknown;
      sourcePosition?: unknown;
      directionDescription?: unknown;
      destinationName?: unknown;
      distanceMeters?: unknown;
      status?: unknown;
      price?: unknown;
      note?: unknown;
    };

    if (typeof body.surfaceId !== 'string' || !body.surfaceId.trim()) {
      return NextResponse.json({ error: 'ID pozice je povinné.' }, { status: 400 });
    }

    const surfaceId = body.surfaceId.trim();
    const existing = await prisma.advertisingSurface.findFirst({
      where: { id: surfaceId, carrierId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Navigační pozice nebyla nalezena.' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (typeof body.sourcePosition === 'string') data.sourcePosition = body.sourcePosition.trim();
    if (typeof body.directionDescription === 'string') data.directionDescription = body.directionDescription.trim();
    if (typeof body.destinationName === 'string') data.destinationName = body.destinationName.trim();
    if (typeof body.distanceMeters === 'number' && Number.isFinite(body.distanceMeters) && body.distanceMeters >= 0) {
      data.distanceMeters = Math.round(body.distanceMeters);
    } else if (typeof body.distanceMeters === 'string' && /^\d+$/.test(body.distanceMeters.trim())) {
      data.distanceMeters = Number(body.distanceMeters.trim());
    }
    if (typeof body.price === 'number' && Number.isFinite(body.price)) data.price = body.price;
    if (typeof body.note === 'string') data.note = body.note.trim();
    if (typeof body.status === 'string' && ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'NEGOTIATION', 'OUT_OF_SERVICE'].includes(body.status)) {
      data.status = body.status;
    }

    const updated = await prisma.advertisingSurface.update({
      where: { id: surfaceId },
      data,
      include: {
        currentClient: { select: { id: true, name: true } },
        occupancies: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update surface position', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nepodařilo se upravit pozici.' },
      { status: 400 },
    );
  }
}
