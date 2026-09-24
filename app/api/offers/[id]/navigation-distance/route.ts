import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { isApiDenied, requireApiAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAccess('offers');
  if (isApiDenied(auth)) return auth;

  try {
    const offerId = (await params).id;
    const body = (await request.json()) as {
      pointId?: string;
      manualDistanceValue?: string | number | null;
      manualDistanceUnit?: 'METERS' | 'KILOMETERS';
      distanceSource?: 'MANUAL' | 'CALCULATED';
    };

    const pointId = typeof body.pointId === 'string' ? body.pointId.trim() : '';
    if (!pointId) {
      return NextResponse.json({ error: 'Chybí ID navigačního bodu.' }, { status: 400 });
    }

    const offer = await prisma.offer.findFirst({
      where: { id: offerId, organizationId: auth.organizationId },
      select: { id: true, navigationOffer: { select: { id: true } } },
    });

    if (!offer?.navigationOffer) {
      return NextResponse.json({ error: 'Navigační nabídka nebyla nalezena.' }, { status: 404 });
    }

    const rawVal =
      body.manualDistanceValue !== undefined && body.manualDistanceValue !== null
        ? String(body.manualDistanceValue).trim().replace(',', '.').replace(/[^0-9.]/g, '')
        : '';

    const hasManual = rawVal !== '' && Number(rawVal) > 0;
    const distanceSource =
      body.distanceSource === 'CALCULATED'
        ? 'CALCULATED'
        : hasManual || body.distanceSource === 'MANUAL'
        ? 'MANUAL'
        : 'CALCULATED';

    const manualDistanceValue =
      distanceSource === 'MANUAL' && hasManual ? new Prisma.Decimal(rawVal).toDecimalPlaces(2) : null;
    const manualDistanceUnit =
      body.manualDistanceUnit === 'KILOMETERS' ? 'KILOMETERS' : 'METERS';

    const updated = await prisma.navigationPoint.updateMany({
      where: {
        id: pointId,
        navigationOfferId: offer.navigationOffer.id,
      },
      data: {
        distanceSource,
        manualDistanceValue,
        manualDistanceUnit,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Navigační bod nebyl nalezen.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      pointId,
      distanceSource,
      manualDistanceValue: manualDistanceValue ? manualDistanceValue.toNumber() : null,
      manualDistanceUnit,
    });
  } catch (error) {
    console.error('[PATCH /api/offers/[id]/navigation-distance] failed:', error);
    return NextResponse.json({ error: 'Vzdálenost se nepodařilo uložit.' }, { status: 500 });
  }
}
