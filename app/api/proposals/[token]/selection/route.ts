import { NextResponse } from 'next/server';
import { offerErrorResponse } from '@/lib/offers/http';
import { getPublicRow } from '@/lib/offers/service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();
    const selectedPointIds: string[] = Array.isArray(body?.selectedPointIds) ? body.selectedPointIds : [];

    const offer = await getPublicRow(token);

    if (!offer.navigationOffer) {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena' }, { status: 404 });
    }

    const allPoints = offer.navigationOffer.points;
    const selectedSet = new Set(selectedPointIds);

    // Update point selection status in database
    await prisma.$transaction(
      allPoints.map((point: { id: string }) =>
        prisma.navigationPoint.update({
          where: { id: point.id },
          data: { isSelectedByClient: selectedSet.has(point.id) },
        })
      )
    );

    // Add event log to offer
    await prisma.offerEvent.create({
      data: {
        offerId: offer.id,
        type: 'UPDATED',
        actorName: 'Klient (Veřejný odkaz)',
        message: `Klient odsouhlasil ${selectedPointIds.length} z ${allPoints.length} navigačních bodů v terénu.`,
      },
    });

    return NextResponse.json({
      success: true,
      selectedCount: selectedPointIds.length,
      totalCount: allPoints.length,
    });
  } catch (error) {
    return offerErrorResponse(error);
  }
}
