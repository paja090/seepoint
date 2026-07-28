import { NextResponse } from 'next/server';
import { offerErrorResponse } from '@/lib/offers/http';
import { getPublicRow } from '@/lib/offers/service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();

    const clientArtworkUrl = typeof body?.clientArtworkUrl === 'string' ? body.clientArtworkUrl : '';
    const clientArtworkFileName = typeof body?.clientArtworkFileName === 'string' ? body.clientArtworkFileName : 'podklady_klient.png';

    if (!clientArtworkUrl) {
      return NextResponse.json({ error: 'Chybí soubor podkladů' }, { status: 400 });
    }

    const offer = await getPublicRow(token);

    if (!offer.navigationOffer) {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena' }, { status: 404 });
    }

    // Save client uploaded artwork to navigation offer
    await prisma.navigationOffer.update({
      where: { id: offer.navigationOffer.id },
      data: {
        clientArtworkUrl,
        clientArtworkFileName,
      },
    });

    // Add event log to offer
    await prisma.offerEvent.create({
      data: {
        offerId: offer.id,
        type: 'UPDATED',
        actorName: 'Klient (Veřejný odkaz)',
        message: `Klient nahrál vlastní grafické podklady: ${clientArtworkFileName}`,
      },
    });

    return NextResponse.json({
      success: true,
      clientArtworkFileName,
    });
  } catch (error) {
    return offerErrorResponse(error);
  }
}
