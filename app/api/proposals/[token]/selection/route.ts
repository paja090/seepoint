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
    const selectedPointIds: string[] = Array.isArray(body?.selectedPointIds) ? body.selectedPointIds : [];

    const offer = await getPublicRow(token);

    if (!offer.navigationOffer) {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena' }, { status: 404 });
    }
    if (offer.navigationOffer.proposalMode !== 'LOCATION_SELECTION' || offer.status !== 'SENT') {
      throw new OfferValidationError('Výběr bodů už v této fázi nelze změnit.');
    }

    const allPoints = offer.navigationOffer.points;
    const selectedKeys = new Set(selectedPointIds);
    const pointIdByPublicKey = new Map(allPoints.map((point, index) => [`point-${index + 1}`, point.id]));
    if (selectedKeys.size === 0) throw new OfferValidationError('Vyberte alespoň jeden navigační bod.');
    if (selectedKeys.size !== selectedPointIds.length || selectedPointIds.some((key) => !pointIdByPublicKey.has(key))) {
      throw new OfferValidationError('Výběr obsahuje neplatný navigační bod.');
    }
    const selectedInternalIds = new Set(selectedPointIds.map((key) => pointIdByPublicKey.get(key)!));

    await prisma.$transaction(async (tx) => {
      await Promise.all(allPoints.map((point: { id: string }) =>
        tx.navigationPoint.update({
          where: { id: point.id },
          data: { isSelectedByClient: selectedInternalIds.has(point.id) },
        })
      ));
      await tx.offerEvent.create({ data: {
        offerId: offer.id,
        type: 'UPDATED',
        actorName: 'Klient (veřejný odkaz)',
        message: `Klient vybral ${selectedPointIds.length} z ${allPoints.length} navigačních bodů k nacenění.`,
        metadata: { channel: 'public-token', action: 'navigation-selection' },
      } });
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
