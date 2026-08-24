import { NextResponse } from 'next/server';
import { offerErrorResponse } from '@/lib/offers/http';
import { getPublicRow } from '@/lib/offers/service';
import { prisma } from '@/lib/db';
import { OfferValidationError } from '@/lib/offers/domain';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { sendTransactionalEmail } from '@/lib/email';

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
    if (clientArtworkUrl.length > 5_500_000 || !clientArtworkUrl.startsWith('data:')) {
      throw new OfferValidationError('Soubor podkladů je příliš velký nebo nemá platný formát (max 4 MB).');
    }

    const offer = await getPublicRow(token);

    if (!offer.navigationOffer) {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena' }, { status: 404 });
    }
    if (['REJECTED', 'ARCHIVED'].includes(offer.status)) {
      throw new OfferValidationError('K této nabídce již nelze nahrávat grafické podklady.');
    }

    // Save client uploaded artwork to navigation offer
    await prisma.navigationOffer.update({
      where: { id: offer.navigationOffer.id },
      data: {
        clientArtworkUrl,
        clientArtworkFileName,
      },
    });

    // Add event log to offer with explicit organizationId
    await prisma.offerEvent.create({
      data: {
        organizationId: offer.organizationId,
        offerId: offer.id,
        type: 'UPDATED',
        actorName: 'Klient (Veřejný odkaz)',
        message: `Klient nahrál vlastní grafické podklady: ${clientArtworkFileName}`,
        metadata: { channel: 'public-token', action: 'navigation-artwork-upload' },
      },
    });

    // Notify salesperson by email
    const salesEmail = offer.createdByUser?.email || offer.contactEmail || process.env.SALES_NOTIFICATION_EMAIL || 'info@seepoint.cz';
    try {
      await sendTransactionalEmail({
        to: salesEmail,
        subject: `[SeePOINT] Klient nahrál logo / grafické podklady k nabídce ${offer.title}`,
        template: 'artwork-uploaded',
        message: `Klient ${offer.client?.name || 'Zákazník'} právě nahrál grafické podklady k nabídce "${offer.title}".\n\nSoubor: ${clientArtworkFileName}\nKlient: ${offer.client?.name || 'Nezadáno'}\n\nPodklady jsou uloženy v detailu nabídky v administraci SeePOINT.`,
      });
    } catch {
      // Background email delivery fallback
    }

    return NextResponse.json({
      success: true,
      clientArtworkFileName,
    });
  } catch (error) {
    return offerErrorResponse(error);
  }
}
