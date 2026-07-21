import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await requireApiAccess('carriers');
  if (isApiDenied(auth)) return auth;

  try {
    const body = (await request.json()) as {
      targetCarrierId?: unknown;
      sourceCarrierIds?: unknown;
      updateGps?: unknown;
    };

    if (typeof body.targetCarrierId !== 'string' || !body.targetCarrierId.trim()) {
      return NextResponse.json({ error: 'Cílový nosič je povinný.' }, { status: 400 });
    }

    if (!Array.isArray(body.sourceCarrierIds) || body.sourceCarrierIds.length === 0) {
      return NextResponse.json({ error: 'Vyberte alespoň jeden nosič ke sloučení.' }, { status: 400 });
    }

    const targetCarrierId = body.targetCarrierId.trim();
    const sourceCarrierIds = body.sourceCarrierIds
      .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
      .map((id) => id.trim())
      .filter((id) => id !== targetCarrierId);

    if (sourceCarrierIds.length === 0) {
      return NextResponse.json({ error: 'Nelze sloučit nosič sám se sebou.' }, { status: 400 });
    }

    const updateGps = Boolean(body.updateGps);

    const mergedCarrier = await prisma.$transaction(async (tx) => {
      const targetCarrier = await tx.advertisingCarrier.findUnique({
        where: { id: targetCarrierId },
      });

      if (!targetCarrier) {
        throw new Error('Cílový nosič nebyl nalezen.');
      }

      const sourceCarriers = await tx.advertisingCarrier.findMany({
        where: { id: { in: sourceCarrierIds } },
        include: { photos: true, surfaces: true },
      });

      if (sourceCarriers.length === 0) {
        throw new Error('Žádný ze zdrojových nosičů nebyl nalezen.');
      }

      // 1. Move all surfaces from source carriers to target carrier
      await tx.advertisingSurface.updateMany({
        where: { carrierId: { in: sourceCarrierIds } },
        data: { carrierId: targetCarrierId },
      });

      // 2. Move all photos from source carriers to target carrier
      await tx.photo.updateMany({
        where: { carrierId: { in: sourceCarrierIds } },
        data: { carrierId: targetCarrierId },
      });

      // 3. Optional: Recalculate average GPS coordinates if requested
      if (updateGps) {
        const allCarriersWithGps = [targetCarrier, ...sourceCarriers].filter(
          (c) => c.latitude !== null && c.longitude !== null,
        );

        if (allCarriersWithGps.length > 0) {
          const avgLat =
            allCarriersWithGps.reduce((acc, c) => acc + (c.latitude ?? 0), 0) / allCarriersWithGps.length;
          const avgLng =
            allCarriersWithGps.reduce((acc, c) => acc + (c.longitude ?? 0), 0) / allCarriersWithGps.length;

          await tx.advertisingCarrier.update({
            where: { id: targetCarrierId },
            data: {
              latitude: Number(avgLat.toFixed(6)),
              longitude: Number(avgLng.toFixed(6)),
              gpsStatus: 'VERIFIED',
            },
          });
        }
      }

      // 4. Archive source carriers
      await tx.advertisingCarrier.updateMany({
        where: { id: { in: sourceCarrierIds } },
        data: {
          archivedAt: new Date(),
          archiveReason: `Sloučeno do sloupu ${targetCarrier.code || targetCarrier.name}`,
          status: 'INACTIVE',
        },
      });

      return tx.advertisingCarrier.findUnique({
        where: { id: targetCarrierId },
        include: { surfaces: true, photos: true },
      });
    });

    return NextResponse.json({
      success: true,
      mergedCarrier,
      message: `Úspěšně sloučeno ${sourceCarrierIds.length} nosičů na tento sloup.`,
    });
  } catch (err) {
    console.error('Merge error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chyba při slučování nosičů.' },
      { status: 500 },
    );
  }
}
