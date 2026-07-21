import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAccess('carriers');
  if (isApiDenied(auth)) return auth;

  try {
    const currentCarrierId = (await params).id;
    const body = (await request.json()) as {
      surfaceId?: unknown;
      targetCarrierId?: unknown;
      detachToNewPole?: unknown;
    };

    if (typeof body.surfaceId !== 'string' || !body.surfaceId.trim()) {
      return NextResponse.json({ error: 'ID pozice je povinné.' }, { status: 400 });
    }

    const surfaceId = body.surfaceId.trim();
    const surface = await prisma.advertisingSurface.findUnique({
      where: { id: surfaceId },
      include: { carrier: true },
    });

    if (!surface || surface.carrierId !== currentCarrierId) {
      return NextResponse.json({ error: 'Pozice nebyla nalezena na tomto sloupu.' }, { status: 404 });
    }

    // Case 1: Move to existing target carrier
    if (typeof body.targetCarrierId === 'string' && body.targetCarrierId.trim()) {
      const targetCarrierId = body.targetCarrierId.trim();
      if (targetCarrierId === currentCarrierId) {
        return NextResponse.json({ error: 'Pozice již je na tomto sloupu.' }, { status: 400 });
      }

      await prisma.advertisingSurface.update({
        where: { id: surfaceId },
        data: { carrierId: targetCarrierId },
      });

      return NextResponse.json({
        success: true,
        message: 'Pozice byla úspěšně přesunuta na jiný sloup.',
      });
    }

    // Case 2: Detach surface to a newly created standalone pole
    if (body.detachToNewPole) {
      const newPole = await prisma.$transaction(async (tx) => {
        const createdCarrier = await tx.advertisingCarrier.create({
          data: {
            name: `${surface.name} (Samostatný sloup)`,
            code: surface.sourcePosition ? `NAV-${surface.sourcePosition}` : `NAV-${Date.now().toString(36).toUpperCase()}`,
            type: 'NAVIGATION',
            latitude: surface.carrier.latitude,
            longitude: surface.carrier.longitude,
            gpsStatus: surface.carrier.gpsStatus,
            city: surface.carrier.city,
            street: surface.carrier.street,
            address: surface.carrier.address,
            cadastralArea: surface.carrier.cadastralArea,
            structureCode: surface.sourcePosition || surface.carrier.structureCode,
            status: 'ACTIVE',
            mountingType: surface.carrier.mountingType,
          },
        });

        await tx.advertisingSurface.update({
          where: { id: surfaceId },
          data: { carrierId: createdCarrier.id },
        });

        return createdCarrier;
      });

      return NextResponse.json({
        success: true,
        newCarrierId: newPole.id,
        message: 'Pozice byla vyčleněna na nový samostatný sloup.',
      });
    }

    return NextResponse.json({ error: 'Zadejte cílový sloup nebo vyčlenění na nový sloup.' }, { status: 400 });
  } catch (err) {
    console.error('Move surface error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chyba při přesunu pozice.' },
      { status: 500 },
    );
  }
}
