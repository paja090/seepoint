import { NextResponse } from 'next/server';
import { offerErrorResponse } from '@/lib/offers/http';
import { getPublicRow } from '@/lib/offers/service';
import { prisma } from '@/lib/db';
import { OfferValidationError } from '@/lib/offers/domain';
import { enforceRateLimit, rateLimitPolicies } from '@/lib/rate-limit';
import { hashRateLimitIdentity } from '@/lib/rate-limit-core';
import { sendTransactionalEmail } from '@/lib/email';
import { runWithTenantContext } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const limited = await enforceRateLimit(req, hashRateLimitIdentity(token), rateLimitPolicies.publicOfferResponse);
    if (limited) return limited;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const selectedPointIds: string[] = Array.isArray(body?.selectedPointIds) ? (body.selectedPointIds as string[]) : [];

    const offer = await getPublicRow(token);

    if (!offer.navigationOffer) {
      return NextResponse.json({ error: 'Nabídka nebyla nalezena' }, { status: 404 });
    }
    if (offer.navigationOffer.proposalMode !== 'LOCATION_SELECTION') {
      throw new OfferValidationError('Výběr bodů už v této fázi nelze změnit.');
    }
    if (['ACCEPTED', 'REJECTED', 'EXPIRED'].includes(offer.status)) {
      throw new OfferValidationError('Nabídka již byla uzavřena a její výběr nelze měnit.');
    }

    const allPoints = offer.navigationOffer.points;
    const selectedKeys = new Set(selectedPointIds);
    const pointIdByPublicKey = new Map<string, string>();
    allPoints.forEach((point, index) => {
      pointIdByPublicKey.set(`point-${index + 1}`, point.id);
      pointIdByPublicKey.set(point.id, point.id);
    });

    if (selectedKeys.size === 0) throw new OfferValidationError('Vyberte alespoň jeden navigační bod.');
    if (selectedKeys.size !== selectedPointIds.length || selectedPointIds.some((key) => !pointIdByPublicKey.has(key))) {
      throw new OfferValidationError('Výběr obsahuje neplatný navigační bod.');
    }
    const selectedInternalIds = new Set(selectedPointIds.map((key) => pointIdByPublicKey.get(key)!));

    // Idempotency check: if client submits the same selection that is already saved and confirmed, avoid duplicate events
    const currentlySelectedIds = new Set(
      allPoints.filter((p) => p.isSelectedByClient !== false).map((p) => p.id)
    );
    const hasExistingSelectionEvent = offer.events.some((e) => {
      const meta = e.metadata as Record<string, unknown> | null;
      return meta?.action === 'navigation-selection' || meta?.stage === 'phase-1-approved';
    });

    const isIdenticalSelection =
      hasExistingSelectionEvent &&
      currentlySelectedIds.size === selectedInternalIds.size &&
      [...selectedInternalIds].every((id) => currentlySelectedIds.has(id));

    if (isIdenticalSelection) {
      return NextResponse.json({
        success: true,
        alreadySubmitted: true,
        selectedCount: selectedPointIds.length,
        totalCount: allPoints.length,
        message: 'Výběr navigačních bodů byl již dříve potvrzen.',
      });
    }

    const actorName = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : 'Klient (veřejný odkaz)';
    const actorEmail = typeof body.email === 'string' && body.email.trim() ? body.email.trim().slice(0, 200) : null;
    const clientNote = typeof body.note === 'string' && body.note.trim()
      ? body.note.trim().slice(0, 1000)
      : typeof body.message === 'string' && body.message.trim()
      ? body.message.trim().slice(0, 1000)
      : null;

    await runWithTenantContext({ organizationId: offer.organizationId, source: 'public-token' }, () =>
      prisma.$transaction(async (tx) => {
        await Promise.all(
          allPoints.map((point: { id: string }) =>
            tx.navigationPoint.update({
              where: { id: point.id },
              data: { isSelectedByClient: selectedInternalIds.has(point.id) },
            })
          )
        );

        if (offer.status === 'DRAFT') {
          await tx.offer.update({
            where: { id: offer.id },
            data: { status: 'SENT', sentAt: new Date() },
          });
        }

        const eventMessage = `${actorName} potvrdil/a výběr ${selectedPointIds.length} z ${allPoints.length} navigačních bodů k nacenění.${clientNote ? ` Poznámka: ${clientNote}` : ''}`;

        await tx.offerEvent.create({
          data: {
            organizationId: offer.organizationId,
            offerId: offer.id,
            type: 'UPDATED',
            actorName,
            actorEmail,
            message: eventMessage,
            metadata: {
              channel: 'public-token',
              action: 'navigation-selection',
              stage: 'phase-1-approved',
              selectedCount: selectedPointIds.length,
              totalCount: allPoints.length,
              note: clientNote,
            },
          },
        });
      })
    );

    // Non-blocking transactional notification email to salesperson / agency team
    try {
      const recipientEmail = offer.createdByUser?.email || offer.contactEmail || process.env.EMAIL_BCC || 'info@seepoint.cz';
      const emailSubject = `📍 Klient potvrdil výběr bodů navigace (${offer.campaignName || offer.title})`;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://os.seepoint.cz';
      const emailText = [
        `Klient potvrdil návrh navigační trasy v SeePOINT OS (fáze 1 – výběr bodů bez cen).\n`,
        `Kampaň: ${offer.campaignName || offer.title}`,
        `Klient: ${offer.client?.name || 'Neuveden'}`,
        `Potvrdil/a: ${actorName}${actorEmail ? ` (${actorEmail})` : ''}`,
        `Vybráno bodů: ${selectedPointIds.length} z ${allPoints.length}`,
        clientNote ? `Poznámka klienta:\n${clientNote}` : null,
        `\nNyní můžete nabídku otevřít a připravit cenovou kalkulaci (fáze 2):`,
        `${appUrl}/offers/${offer.id}/navigation/edit`,
      ].filter(Boolean).join('\n');

      await sendTransactionalEmail({
        to: recipientEmail,
        subject: emailSubject,
        message: emailText,
        template: 'offer-client-response',
      });
    } catch (emailError) {
      console.error('[proposals/selection] Nepodařilo se odeslat notifikační email k výběru bodů:', emailError);
    }

    return NextResponse.json({
      success: true,
      selectedCount: selectedPointIds.length,
      totalCount: allPoints.length,
      message: 'Výběr bodů byl úspěšně potvrzen a předán obchodníkovi k nacenění.',
    });
  } catch (error) {
    return offerErrorResponse(error);
  }
}
