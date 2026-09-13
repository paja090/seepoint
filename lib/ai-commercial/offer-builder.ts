import type { CurrentUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { runWithTenantContext } from '@/lib/tenant-context';
import { normalizeClientName } from '@/lib/crm/domain';
import { createOffer } from '@/lib/offers/service';
import {
  verifySurfacesAvailability,
  checkCommercialAvailability,
} from './adapters/occupancy-adapter';
import type {
  OfferDraftInput,
  OfferDraftResult,
  OfferDraftItemResult,
  OfferReviewChecklistItem,
} from './contracts/offer-draft';
import type { AvailableSurfaceMatch } from './contracts/availability';
import type { CommercialNextBestAction } from './contracts/next-best-action';
import { determineCommercialNextBestActions } from './next-best-action';
import { getGeminiApiKey } from '@/lib/ai-gemini';
import { logAIUsage } from '@/lib/ai-usage';
import type { ClientPricingSegment, MediaType } from '@prisma/client';

type CandidateSurfaceRecord = {
  surfaceId: string;
  surfaceName: string;
  carrierCode: string;
  carrierCity: string;
  mediaType: string;
  isAlternative: boolean;
  alternativeReason?: string;
};

/**
 * Builds a deterministic or AI-assisted commercial draft offer.
 * Strictly adheres to:
 * 1. AI always outputs status DRAFT (never SENT or RESERVED).
 * 2. Real pricing from database only (surface.price, OfferPriceRule). AI NEVER invents prices or discounts.
 * 3. Exact matches are clearly distinguished from alternative surfaces.
 * 4. Deterministic fallback copy if LLM provider fails or times out.
 * 5. Full source traceability back to request, opportunity, and availability check.
 */
export async function buildCommercialOfferDraft(
  input: OfferDraftInput,
  currentUser: CurrentUser
): Promise<OfferDraftResult> {
  const { organizationId } = input;

  if (currentUser.organizationId !== organizationId) {
    throw new Error('Tenant security violation: User organization does not match request organization.');
  }

  return runWithTenantContext({ organizationId, userId: currentUser.id, source: 'session' }, async () => {
    // 1. Resolve campaign dates
    let dateFrom = input.dateFrom;

  let dateTo = input.dateTo;

  if (!dateFrom && input.commercialRequest?.dateFrom) {
    dateFrom = new Date(input.commercialRequest.dateFrom);
  }
  if (!dateTo && input.commercialRequest?.dateTo) {
    dateTo = new Date(input.commercialRequest.dateTo);
  }

  // Strict check on dates: if dates are missing, approximate, or invalid, DO NOT invent dates!
  const hasApproximateDates =
    input.commercialRequest?.datesClarity === 'APPROXIMATE' ||
    input.commercialRequest?.datesClarity === 'UNSPECIFIED';
  if (
    !dateFrom ||
    !dateTo ||
    isNaN(dateFrom.getTime()) ||
    isNaN(dateTo.getTime()) ||
    dateFrom > dateTo ||
    (hasApproximateDates && !input.dateFrom)
  ) {
    const nextAction: CommercialNextBestAction = {
      id: `nba-draft-missing-dates-${Date.now()}`,
      organizationId,
      actionType: 'COMPLETE_INFORMATION',
      priority: 'HIGH',
      title: 'Upřesnit termín kampaně před vytvořením nabídky',
      description:
        'Poptávka nemá přesně stanovený začátek a konec kampaně. Kontaktujte klienta pro potvrzení termínu.',
      targetEntityType: 'COMMERCIAL_REQUEST',
      targetEntityId: input.sourceCommercialRequestId || input.commercialRequest?.id || 'unknown',
      recommendedAt: new Date(),
    };

    return {
      success: false,
      surfaceCount: 0,
      availabilityConfirmed: false,
      conflictsDetected: false,
      warnings: [
        'Poptávka nemá přesně specifikovaný termín kampaně. Před vytvořením nabídky je nutné upřesnit data.',
      ],
      nextBestAction: nextAction,
    };
  }

  // 2. Resolve inventory: Exact matches vs Alternatives via Canonical Availability
  const candidateSurfaces: CandidateSurfaceRecord[] = [];
  const suggestedAlternatives: AvailableSurfaceMatch[] = [];
  const conflictDetails: string[] = [];
  let availabilityConfirmed = false;

  if (input.availabilityResult) {
    const avail = input.availabilityResult;

    for (const em of avail.exactMatches) {
      candidateSurfaces.push({
        surfaceId: em.surfaceId,
        surfaceName: em.surfaceName,
        carrierCode: em.carrierCode,
        carrierCity: em.carrierCity,
        mediaType: em.mediaType,
        isAlternative: false,
      });
    }

    if (input.includeAlternatives !== false && avail.alternatives.length > 0) {
      // Include alternatives to fulfill requested quantity
      const requestedQty =
        input.commercialRequest?.quantity?.exact ||
        (avail.requestedQuantity > avail.exactMatchCount ? avail.requestedQuantity : 0);
      const needed = requestedQty - candidateSurfaces.length;
      const altsToAdd = needed > 0 ? avail.alternatives.slice(0, needed) : [];
      for (const alt of altsToAdd) {
        candidateSurfaces.push({
          surfaceId: alt.surfaceId,
          surfaceName: alt.surfaceName,
          carrierCode: alt.carrierCode,
          carrierCity: alt.carrierCity,
          mediaType: alt.mediaType,
          isAlternative: true,
          alternativeReason: alt.matchReasons.join(', ') || `Alternativa v lokalitě ${alt.carrierCity}`,
        });
      }
      suggestedAlternatives.push(...avail.alternatives.slice(altsToAdd.length));
    } else {
      suggestedAlternatives.push(...avail.alternatives);
    }

    availabilityConfirmed = avail.status === 'FULL_MATCH' || candidateSurfaces.length > 0;
  } else if (input.selectedSurfaceIds && input.selectedSurfaceIds.length > 0) {
    // Manually selected surfaces -> verify with canonical engine
    const verification = await verifySurfacesAvailability(
      organizationId,
      input.selectedSurfaceIds,
      dateFrom,
      dateTo
    );

    if (!verification.allAvailable) {
      for (const id of verification.conflictingSurfaceIds) {
        const res = verification.results.get(id);
        if (res?.hasHardConflict && res.hardConflicts[0]) {
          conflictDetails.push(
            `Plocha ${res.hardConflicts[0].surfaceName} (${res.hardConflicts[0].carrierCode}) má kolizi s kampaní '${res.hardConflicts[0].campaignName}' (${res.hardConflicts[0].dateFrom}–${res.hardConflicts[0].dateTo}).`
          );
        } else if (res?.hasOfferConflict && res.offerConflicts[0]) {
          conflictDetails.push(
            `Plocha ${res.offerConflicts[0].surfaceName} má existující nabídku '${res.offerConflicts[0].offerTitle}'.`
          );
        } else if (!res?.isTechnicallyAvailable) {
          conflictDetails.push(`Plocha ${id} je technicky nedostupná: ${res?.technicalReason || 'mimo provoz'}.`);
        }
      }

      // If all are conflicting, fail
      const availableIds = input.selectedSurfaceIds.filter(
        (id) => !verification.conflictingSurfaceIds.includes(id)
      );
      if (availableIds.length === 0) {
        return {
          success: false,
          surfaceCount: 0,
          availabilityConfirmed: false,
          conflictsDetected: true,
          conflictDetails,
          warnings: ['Vybrané plochy nelze zařadit do nabídky kvůli kolizi v kalendáři obsazenosti.'],
          nextBestAction: {
            id: `nba-draft-all-conflicting-${Date.now()}`,
            organizationId,
            actionType: 'COMPLETE_INFORMATION',
            priority: 'HIGH',
            title: 'Vyřešit kolize inventáře u poptávky',
            description:
              'Všechny zvolené plochy mají kolizi s existujícími rezervacemi. Vyberte alternativní volné plochy.',
            targetEntityType: 'COMMERCIAL_REQUEST',
            targetEntityId: input.sourceCommercialRequestId || 'unknown',
            recommendedAt: new Date(),
          },
        };
      }

      // Query available ones
      const availSurfaces = await prisma.advertisingSurface.findMany({
        where: { id: { in: availableIds }, organizationId },
        include: { carrier: true },
      });
      for (const s of availSurfaces) {
        candidateSurfaces.push({
          surfaceId: s.id,
          surfaceName: s.name,
          carrierCode: s.carrier.code,
          carrierCity: s.carrier.city,
          mediaType: s.mediaType,
          isAlternative: false,
        });
      }
      availabilityConfirmed = true;
    } else {
      const availSurfaces = await prisma.advertisingSurface.findMany({
        where: { id: { in: input.selectedSurfaceIds }, organizationId },
        include: { carrier: true },
      });
      for (const s of availSurfaces) {
        candidateSurfaces.push({
          surfaceId: s.id,
          surfaceName: s.name,
          carrierCode: s.carrier.code,
          carrierCity: s.carrier.city,
          mediaType: s.mediaType,
          isAlternative: false,
        });
      }
      availabilityConfirmed = true;
    }
  } else if (input.commercialRequest) {
    // Run commercial availability check
    const availResult = await checkCommercialAvailability({
      organizationId,
      dateFrom,
      dateTo,
      cities: input.commercialRequest.cities,
      mediaTypes: input.commercialRequest.mediaTypes,
      quantity: input.commercialRequest.quantity?.exact || 1,
    });

    for (const em of availResult.exactMatches) {
      candidateSurfaces.push({
        surfaceId: em.surfaceId,
        surfaceName: em.surfaceName,
        carrierCode: em.carrierCode,
        carrierCity: em.carrierCity,
        mediaType: em.mediaType,
        isAlternative: false,
      });
    }

    if (input.includeAlternatives !== false) {
      const needed = (input.commercialRequest.quantity?.exact || 1) - candidateSurfaces.length;
      if (needed > 0) {
        for (const alt of availResult.alternatives.slice(0, needed)) {
          candidateSurfaces.push({
            surfaceId: alt.surfaceId,
            surfaceName: alt.surfaceName,
            carrierCode: alt.carrierCode,
            carrierCity: alt.carrierCity,
            mediaType: alt.mediaType,
            isAlternative: true,
            alternativeReason: alt.matchReasons.join(', ') || `Alternativa v lokalitě ${alt.carrierCity}`,
          });
        }
      }
    }
    availabilityConfirmed = candidateSurfaces.length > 0;
  }

  // If no surfaces found at all:
  if (candidateSurfaces.length === 0) {
    const nextActions = determineCommercialNextBestActions({
      request: input.commercialRequest,
      opportunityContext: input.opportunityContext,
      availabilityResult: input.availabilityResult,
    });

    return {
      success: false,
      surfaceCount: 0,
      availabilityConfirmed: false,
      conflictsDetected: conflictDetails.length > 0,
      conflictDetails: conflictDetails.length ? conflictDetails : undefined,
      warnings: ['V požadovaném termínu a lokalitě nebyly nalezeny žádné volné ani alternativní plochy.'],
      nextBestAction: nextActions[0],
    };
  }

  // 3. Resolve or create client (only when candidate surfaces exist)
  const clientName = (
    input.clientName ||
    input.commercialRequest?.companyName ||
    input.opportunityContext?.companyName ||
    ''
  ).trim();

  let resolvedClientId: string | undefined =
    input.clientId ||
    input.commercialRequest?.clientId ||
    input.opportunityContext?.clientId ||
    undefined;
  let clientPricingSegment: ClientPricingSegment = 'COMMERCIAL';
  let clientContactEmail = input.contactEmail || input.commercialRequest?.contactEmail || undefined;
  let clientContactPerson = input.commercialRequest?.contactName || undefined;

  if (resolvedClientId) {
    const existing = await prisma.client.findFirst({
      where: { id: resolvedClientId, organizationId, active: true },
      select: { id: true, name: true, pricingSegment: true, email: true, contactPerson: true },
    });
    if (existing) {
      clientPricingSegment = existing.pricingSegment;
      clientContactEmail = clientContactEmail || existing.email || undefined;
      clientContactPerson = clientContactPerson || existing.contactPerson || undefined;
    } else {
      resolvedClientId = undefined;
    }
  }

  if (!resolvedClientId && clientName) {
    const existing = await prisma.client.findFirst({
      where: {
        organizationId,
        active: true,
        OR: [
          { name: { equals: clientName, mode: 'insensitive' } },
          { normalizedName: { equals: normalizeClientName(clientName) } },
        ],
      },
      select: { id: true, pricingSegment: true, email: true, contactPerson: true },
    });

    if (existing) {
      resolvedClientId = existing.id;
      clientPricingSegment = existing.pricingSegment;
      clientContactEmail = clientContactEmail || existing.email || undefined;
      clientContactPerson = clientContactPerson || existing.contactPerson || undefined;
    } else {
      const created = await prisma.client.create({
        data: {
          organizationId,
          name: clientName,
          normalizedName: normalizeClientName(clientName),
          status: 'LEAD',
          pricingSegment: 'COMMERCIAL',
          email: clientContactEmail,
          contactPerson: clientContactPerson,
        },
        select: { id: true, pricingSegment: true },
      });
      resolvedClientId = created.id;
      clientPricingSegment = created.pricingSegment;
    }
  }

  if (!resolvedClientId) {
    return {
      success: false,
      surfaceCount: 0,
      availabilityConfirmed: false,
      conflictsDetected: false,
      warnings: ['Nebyl identifikován ani zadán klient. Zadejte klienta pro vytvoření nabídky.'],
    };
  }

  // 4. Deterministic Pricing Integrity (Zero Hallucination)
  const surfaceIds = candidateSurfaces.map((c) => c.surfaceId);
  const dbSurfaces = await prisma.advertisingSurface.findMany({
    where: { id: { in: surfaceIds }, organizationId },
    include: {
      carrier: {
        select: {
          code: true,
          city: true,
          address: true,
          name: true,
        },
      },
    },
  });
  const dbSurfaceMap = new Map(dbSurfaces.map((s) => [s.id, s]));

  // Load active price rules for this organization and pricing segment as catalog backup
  const priceRules = await prisma.offerPriceRule.findMany({
    where: {
      organizationId,
      active: true,
      pricingSegment: clientPricingSegment,
      category: 'RENTAL',
      OR: [{ validFrom: null }, { validFrom: { lte: dateFrom } }],
      AND: [{ OR: [{ validTo: null }, { validTo: { gte: dateFrom } }] }],
    },
    orderBy: [{ sortOrder: 'asc' }],
  });

  const offerItemsPayload: Array<{
    surfaceId: string;
    dateFrom: string;
    dateTo: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    discountPercent: string;
    discountAmount: string;
    groupLabel?: string;
    customTitle?: string;
    clientDescription?: string;
  }> = [];

  const itemsResult: OfferDraftItemResult[] = [];
  const warnings: string[] = [];

  for (const cand of candidateSurfaces) {
    const s = dbSurfaceMap.get(cand.surfaceId);
    if (!s) continue;

    let unitPrice = 0;
    let catalogPrice: number | null = null;
    let priceSource: 'SURFACE_CATALOG' | 'OFFER_PRICE_RULE' | 'MANUAL' = 'MANUAL';
    let matchedRuleId: string | null = null;

    if (s.price && Number(s.price) > 0) {
      unitPrice = Number(s.price);
      catalogPrice = unitPrice;
      priceSource = 'SURFACE_CATALOG';
    } else {
      // Find matching OfferPriceRule for this mediaType and city
      const normalizedCity = s.carrier.city.trim().toLowerCase();
      const matchingRule = priceRules.find((r) => {
        const mediaMatch = !r.mediaType || r.mediaType === s.mediaType;
        const cityMatch = !r.city || r.city.trim().toLowerCase() === normalizedCity;
        return mediaMatch && cityMatch;
      });

      if (matchingRule) {
        unitPrice = matchingRule.unitPrice.toNumber();
        catalogPrice = unitPrice;
        priceSource = 'OFFER_PRICE_RULE';
        matchedRuleId = matchingRule.id;
      } else {
        unitPrice = 0;
        catalogPrice = null;
        priceSource = 'MANUAL';
        warnings.push(
          `Plocha ${s.name} (${s.carrier.code}) nemá v katalogu evidovanou cenu. Obchodník musí cenu stanovit ručně.`
        );
      }
    }

    const groupLabel = cand.isAlternative
      ? 'Alternativní doporučené plochy'
      : 'Doporučené plochy (Přímá shoda)';

    const clientDescription = cand.isAlternative
      ? cand.alternativeReason || `Alternativa v lokalitě ${cand.carrierCity}`
      : `Volná plocha v lokalitě ${cand.carrierCity} (${cand.mediaType})`;

    offerItemsPayload.push({
      surfaceId: s.id,
      dateFrom: dateFrom.toISOString().slice(0, 10),
      dateTo: dateTo.toISOString().slice(0, 10),
      quantity: '1',
      unit: 'měsíc',
      unitPrice: String(unitPrice),
      discountPercent: '0',
      discountAmount: '0',
      groupLabel,
      customTitle: `${s.name} – ${s.carrier.city}`,
      clientDescription,
    });

    itemsResult.push({
      surfaceId: s.id,
      surfaceName: s.name,
      carrierCode: s.carrier.code,
      carrierCity: s.carrier.city,
      mediaType: s.mediaType,
      isAlternative: cand.isAlternative,
      alternativeReason: cand.alternativeReason,
      unitPrice,
      catalogPrice,
      priceSource,
      priceRuleId: matchedRuleId,
    });
  }

  // 5. Facts vs AI Copy Separation with Deterministic Fallback
  const exactCount = itemsResult.filter((i) => !i.isAlternative).length;
  const altCount = itemsResult.filter((i) => i.isAlternative).length;
  const cities: string[] = Array.from(new Set(itemsResult.map((i) => i.carrierCity))).filter(
    (c): c is string => Boolean(c)
  );
  const mediaTypes: string[] = Array.from(new Set(itemsResult.map((i) => i.mediaType)));
  const dateFromStr = dateFrom.toISOString().slice(0, 10);
  const dateToStr = dateTo.toISOString().slice(0, 10);

  // Deterministic copy template (Fallback)
  let clientMessage = `Dobrý den,\n\nna základě Vaší poptávky Vám předkládáme návrh reklamních ploch pro kampaň v lokalitě ${
    cities.join(', ') || 'ČR'
  } v termínu ${dateFromStr} až ${dateToStr}.\n\nNávrh zahrnuje ${exactCount} přímo vyhovujících ploch${
    altCount > 0 ? ` a ${altCount} pečlivě vybraných alternativních ploch s vysokým zásahem` : ''
  }.\n\nVšechny uvedené plochy jsou prověřeny v kalendáři obsazenosti a připraveny k rezervaci.\n\nS pozdravem,\nObchodní tým SeePOINT`;

  let campaignStrategySummary = `Navržený media mix (${mediaTypes.join(', ')}) v městech ${cities.join(
    ', '
  )} zajišťuje optimální frekvenci a zásah cílových skupin v hlavních spádových zónách.`;

  const campaignPhases = [
    {
      phase: 'LAUNCH',
      name: 'Fáze spuštění a pokrytí klíčových tahů',
      timeframe: `${dateFromStr} – zahájení`,
      recommendedMediaTypes: mediaTypes,
      description: 'Zajištění maximální viditelnosti na hlavních dopravních uzlech a příjezdových komunikacích.',
    },
    {
      phase: 'RETENTION',
      name: 'Stabilizační fáze a lokální navigace',
      timeframe: `Průběh kampaně do ${dateToStr}`,
      recommendedMediaTypes: mediaTypes,
      description: 'Upevnění povědomí a přímé navádění zákazníků k prodejnám / provozovnám.',
    },
  ];

  // Try calling LLM for richer copy if API key is present
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    try {
      const prompt = `Jsi seniorní commercial copywriter pro českou OOH mediální agenturu SeePOINT.
Vygeneruj profesionální český průvodní text nabídky pro klienta a strategické shrnutí.

ZADÁNÍ:
- Klient: ${clientName}
- Lokality: ${cities.join(', ')}
- Termín: ${dateFromStr} až ${dateToStr}
- Formáty: ${mediaTypes.join(', ')}
- Počet přímých ploch: ${exactCount}
- Počet alternativních ploch: ${altCount}
${input.notes ? `- Poznámky klienta: ${input.notes}` : ''}
${input.opportunityContext ? `- Obchodní kontext: ${input.opportunityContext.title} (${input.opportunityContext.reason})` : ''}

PRAVIDLA:
- Text musí být zdvořilý, přesvědčivý a profesionální.
- NEVYMÝŠLEJ žádné ceny ani slevy.
- Vrať POUZE validní JSON ve formátu:
{
  "clientMessage": "string (průvodní e-mail pro klienta)",
  "strategySummary": "string (shrnutí strategie a výběru lokalit)"
}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, response_mime_type: 'application/json' },
        }),
      });

      if (resp.ok) {
        const data = (await resp.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textContent) {
          const parsed = JSON.parse(textContent) as { clientMessage?: string; strategySummary?: string };
          if (parsed.clientMessage?.trim()) clientMessage = parsed.clientMessage.trim();
          if (parsed.strategySummary?.trim()) campaignStrategySummary = parsed.strategySummary.trim();
        }

        void logAIUsage({
          organizationId,
          userId: currentUser.id,
          feature: 'OFFER_GENERATOR',
          modelName: 'gemini-3.6-flash',
          promptTokens: prompt.length / 4,
          outputTokens: 300,
          costEstimateUsd: 0.001,
          metadata: { clientId: resolvedClientId, surfaceCount: itemsResult.length },
        }).catch(() => null);
      }
    } catch {
      // Deterministic fallback is already prepared and guaranteed to succeed
    }
  }

  // 6. Create Draft Offer in Database
  const offerTitle = input.campaignName || `Návrh OOH kampaně: ${clientName} (${candidateSurfaces.length} ploch)`;

  const offerPayload = {
    clientId: resolvedClientId,
    title: offerTitle,
    campaignName: input.campaignName || offerTitle,
    contactPerson: clientContactPerson,
    contactEmail: clientContactEmail,
    contactPhone: input.contactPhone || undefined,
    pricingTier: clientPricingSegment,
    taxRate: '21',
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // 14 days default
    internalNote: `AI Commercial Engine draft (Poptávka: ${input.sourceCommercialRequestId || 'N/A'}, Příležitost: ${
      input.sourceOpportunityId || 'N/A'
    })`,
    clientMessage,
    confirmNegotiation: false,
    chargeSelections: [],
    items: offerItemsPayload,
  };

  // createOffer strictly creates in status DRAFT
  const { offer } = await createOffer(currentUser, offerPayload, 'draft');
  const offerId = offer.id;
  if (!offerId) {
    throw new Error('Nepodařilo se vytvořit koncept nabídky: chybí ID nabídky.');
  }

  // Update offer with strategy metadata and pricing segment
  await prisma.offer.update({
    where: { id: offerId },
    data: {
      pricingSegment: clientPricingSegment,
      campaignStrategy: {
        summary: campaignStrategySummary,
        cities,
        mediaTypes,
        exactMatchCount: exactCount,
        alternativeCount: altCount,
      },
      campaignPhases,
    },
  });

  // Link source references
  if (input.sourceOpportunityId) {
    await prisma.salesOpportunity
      .updateMany({
        where: { id: input.sourceOpportunityId, organizationId },
        data: {
          createdOfferId: offerId,
          clientId: resolvedClientId,
          status: 'PROPOSAL_CREATED',
        },
      })
      .catch(() => null);
  }

  // Add audit event with commercial traceability
  await prisma.offerEvent.create({
    data: {
      offerId,
      organizationId,
      type: 'UPDATED',
      actorUserId: currentUser.id,
      actorName: currentUser.name,
      message: 'AI Commercial draft nabídky vygenerován.',
      metadata: {
        event: 'AI_COMMERCIAL_DRAFT_CREATED',
        sourceCommercialRequestId: input.sourceCommercialRequestId,
        sourceOpportunityId: input.sourceOpportunityId,
        exactMatchesCount: exactCount,
        alternativesCount: altCount,
        pricingSegment: clientPricingSegment,
      },
    },
  });

  // 7. Compile Human Review Checklist
  const reviewChecklist: OfferReviewChecklistItem[] = [];

  if (altCount > 0) {
    reviewChecklist.push({
      id: 'review-alternatives',
      label: 'Kontrola alternativních ploch',
      detail: `Nabídka obsahuje ${altCount} alternativních ploch. Ověřte jejich vhodnost pro klienta.`,
      status: 'warning',
    });
  } else {
    reviewChecklist.push({
      id: 'review-inventory',
      label: 'Pokrytí inventáře',
      detail: `Všech ${exactCount} ploch přesně odpovídá požadavkům klienta.`,
      status: 'ok',
    });
  }

  const hasManualPrice = itemsResult.some((i) => i.priceSource === 'MANUAL' || i.unitPrice === 0);
  if (hasManualPrice) {
    reviewChecklist.push({
      id: 'review-prices',
      label: 'Doplnění manuálních cen',
      detail: 'Některé plochy nemají evidovanou ceníkovou cenu. Před odesláním doplňte ceny.',
      status: 'error',
    });
  } else {
    reviewChecklist.push({
      id: 'review-prices',
      label: 'Cenová integrita',
      detail: 'Všechny ceny odpovídají platným ceníkům a segmentu klienta.',
      status: 'ok',
    });
  }

  if (!clientContactEmail) {
    reviewChecklist.push({
      id: 'review-contact',
      label: 'Kontaktní e-mail',
      detail: 'Doplňte e-mail klienta pro možnost odeslání nabídky z aplikace.',
      status: 'warning',
    });
  } else {
    reviewChecklist.push({
      id: 'review-contact',
      label: 'Kontaktní e-mail',
      detail: `Připraveno k odeslání na ${clientContactEmail}.`,
      status: 'ok',
    });
  }

  reviewChecklist.push({
    id: 'review-copy',
    label: 'Revize průvodního dopisu',
    detail: 'Zkontrolujte a případně upravte text pro klienta před odesláním.',
    status: 'ok',
  });

  // 8. Determine Next Best Action
  const nextAction: CommercialNextBestAction = {
    id: `nba-draft-created-${offerId}`,
    organizationId,
    actionType: 'REVIEW_AND_SEND_OFFER',
    priority: hasManualPrice || altCount > 0 ? 'HIGH' : 'MEDIUM',
    title: `Zkontrolovat koncept nabídky: ${offer.title}`,
    description: hasManualPrice
      ? 'Koncept obsahuje položky vyžadující manuální ocenění obchodníkem.'
      : 'Koncept nabídky je připraven k finální revizi a odeslání klientovi.',
    targetEntityType: 'OFFER',
    targetEntityId: offerId,
    suggestedPayload: {
      offerId,
      exactMatchesCount: exactCount,
      alternativesCount: altCount,
    },
    recommendedAt: new Date(),
  };

  return {
    success: true,
    offerId,
    status: 'DRAFT',
    offerTitle: offer.title,
    totalPrice: offer.totalWithTax ? Number(offer.totalWithTax) : undefined,
    currency: offer.currency || 'CZK',
    surfaceCount: itemsResult.length,
    exactMatchesCount: exactCount,
    alternativesCount: altCount,
    items: itemsResult,
    availabilityConfirmed,
    conflictsDetected: conflictDetails.length > 0,
    conflictDetails: conflictDetails.length ? conflictDetails : undefined,
    suggestedAlternatives: suggestedAlternatives.length ? suggestedAlternatives : undefined,
    humanReviewChecklist: reviewChecklist,
    campaignSummary: campaignStrategySummary,
    nextBestAction: nextAction,
    sourceTraceability: {
      commercialRequestId: input.sourceCommercialRequestId,
      opportunityId: input.sourceOpportunityId,
      availabilityCheckedAt: input.availabilityResult?.checkedAt,
    },
    warnings: warnings.length ? warnings : undefined,
  };
  });
}

