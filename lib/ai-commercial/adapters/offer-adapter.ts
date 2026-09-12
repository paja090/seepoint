import type { CurrentUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import type { OfferDraftInput, OfferDraftResult } from '../contracts/offer-draft';
import { verifySurfacesAvailability } from './occupancy-adapter';
import { normalizeClientName } from '@/lib/crm/domain';

/**
 * Creates a formal Draft Offer from a structured OfferDraftInput.
 * Strictly verifies inventory availability via the canonical Availability Engine before creation.
 * Does NOT require arbitrary LLM free-text prompts.
 */
export async function generateOfferDraftFromStructuredInput(
  input: OfferDraftInput,
  currentUser: CurrentUser
): Promise<OfferDraftResult> {
  const { organizationId, selectedSurfaceIds } = input;

  if (currentUser.organizationId !== organizationId) {
    throw new Error('Tenant security violation: User organization does not match request organization.');
  }

  if (!selectedSurfaceIds.length) {
    return {
      success: false,
      surfaceCount: 0,
      availabilityConfirmed: false,
      conflictsDetected: false,
      warnings: ['Nebyly vybrány žádné plochy pro tvorbu nabídky.'],
    };
  }

  const dateFrom = input.dateFrom || new Date();
  const dateTo = input.dateTo || new Date(dateFrom.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. Canonical Availability Check
  const availabilityCheck = await verifySurfacesAvailability(
    organizationId,
    selectedSurfaceIds,
    dateFrom,
    dateTo
  );

  const conflictMessages: string[] = [];
  if (!availabilityCheck.allAvailable) {
    for (const surfaceId of availabilityCheck.conflictingSurfaceIds) {
      const res = availabilityCheck.results.get(surfaceId);
      if (res?.hasHardConflict) {
        const hard = res.hardConflicts[0];
        conflictMessages.push(
          `Plocha ${hard?.surfaceName || surfaceId} je blokována kampaní '${hard?.campaignName}' (${hard?.clientName}) v termínu ${hard?.dateFrom}–${hard?.dateTo}.`
        );
      } else if (res?.hasOfferConflict) {
        const off = res.offerConflicts[0];
        conflictMessages.push(
          `Plocha ${off?.surfaceName || surfaceId} má existující akceptovanou nabídku '${off?.offerTitle}'.`
        );
      }
    }

    return {
      success: false,
      surfaceCount: selectedSurfaceIds.length,
      availabilityConfirmed: false,
      conflictsDetected: true,
      conflictDetails: conflictMessages,
      warnings: ['Vybrané plochy nelze zařadit do nabídky kvůli kolizi v kalendáři obsazenosti.'],
    };
  }

  // 2. Resolve Client
  let resolvedClientId: string | undefined = input.clientId;
  if (!resolvedClientId && input.clientName) {
    const existing = await prisma.client.findFirst({
      where: {
        organizationId,
        active: true,
        OR: [
          { name: { equals: input.clientName.trim(), mode: 'insensitive' } },
          { normalizedName: { equals: normalizeClientName(input.clientName) } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      resolvedClientId = existing.id;
    } else {
      // Create prospect client safely with organizationId
      const newClient = await prisma.client.create({
        data: {
          organizationId,
          name: input.clientName.trim(),
          normalizedName: normalizeClientName(input.clientName),
          status: 'LEAD',
          pricingSegment: 'COMMERCIAL',
        },
        select: { id: true },
      });
      resolvedClientId = newClient.id;
    }
  }

  // 3. Fetch Surface details to construct Offer items
  const surfaces = await prisma.advertisingSurface.findMany({
    where: {
      organizationId,
      id: { in: selectedSurfaceIds },
    },
    select: {
      id: true,
      name: true,
      price: true,
      carrier: {
        select: {
          code: true,
          city: true,
        },
      },
    },
  });

  const offerItems = surfaces.map((s) => ({
    surfaceId: s.id,
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo: dateTo.toISOString().slice(0, 10),
    rentalPricePerMonth: s.price ? Number(s.price) : 5000,
    mountingPrice: 0,
    productionPrice: 0,
  }));

  const offerPayload = {
    clientId: resolvedClientId,
    title: input.campaignName || `Nabídka ploch: ${input.clientName || 'Klient'} (${surfaces.length} ploch)`,
    contactPerson: undefined,
    contactEmail: undefined,
    contactPhone: undefined,
    taxRate: 21,
    notes: input.notes,
    items: offerItems,
    charges: [],
  };

  // 4. Create Draft Offer
  const { createOffer } = await import('@/lib/offers/service');
  const { offer } = await createOffer(currentUser, offerPayload, 'draft');

  // 5. Link Source References
  if (input.sourceOpportunityId && offer.id) {
    await prisma.salesOpportunity.updateMany({
      where: {
        id: input.sourceOpportunityId,
        organizationId,
      },
      data: {
        createdOfferId: offer.id,
        status: 'PROPOSAL_CREATED',
      },
    }).catch(() => null);
  }

  return {
    success: true,
    offerId: offer.id,
    offerTitle: offer.title,
    totalPrice: offer.totalWithTax ? Number(offer.totalWithTax) : undefined,
    surfaceCount: surfaces.length,
    availabilityConfirmed: true,
    conflictsDetected: false,
  };
}
