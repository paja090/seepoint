import { NextResponse } from 'next/server';
import { offerErrorResponse } from '@/lib/offers/http';
import { getPublicRow } from '@/lib/offers/service';
import { prisma } from '@/lib/db';
import { OfferValidationError } from '@/lib/offers/domain';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limited = await enforceRateLimit(req, hashRateLimitIdentity(token), rateLimitPolicies.publicOfferResponse);
    if (limited) return limited;
    const body = await req.json();

    const clientArtworkUrl = typeof body?.clientArtworkUrl === 'string' ? body.clientArtworkUrl : '';
    const clientArtworkFileName = typeof body?.clientArtworkFileName === 'string' ? body.clientArtworkFileName : 'podklady_klient.png';

    if (!clientArtworkUrl) {
      return NextResponse.json({ error: 'Chybí soubor podkladů' }, { status: 400 });
    }
    if (clientArtworkUrl.length > 4_200_000 || !clientArtworkUrl.startsWith('data:')) {
      throw new OfferValidationError('Soubor podkladů je příliš velký nebo nemá platný formát.');
    }

    const offer = await getPublicRow(token);

    if (!offer.navigationOffer) {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena' }, { status: 404 });
    }
    if (offer.navigationOffer.proposalMode !== 'PRICED_QUOTE' || offer.status !== 'ACCEPTED') {
      throw new OfferValidationError('Grafické podklady lze nahrát až po schválení cenové nabídky.');
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
        metadata: { channel: 'public-token', action: 'navigation-artwork-upload' },
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
