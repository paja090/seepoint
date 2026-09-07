import type { ClientPricingSegment, OfferType } from '@prisma/client';
import type { CurrentUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { normalizeClientName } from '@/lib/crm/domain';
import { createOffer } from '@/lib/offers/service';
import { createCityGalleryOffer, saveNavigationOffer } from '@/lib/offers/specialized';
import { OfferValidationError } from '@/lib/offers/domain';
import { generateCityGalleryPreview } from './city-gallery-generator';
import { inferMediaType, inferQuantity, recommendOfferType } from './intent-parser';
import { generateNavigationPreview } from './navigation-generator';
import { generateStandardMediaPreview } from './standard-media-generator';
import type { AiNavigationPointInput, AiOfferPreview, AiOfferRequest, AiResolvedClient } from './types';

const pricingSegments: ClientPricingSegment[] = ['COMMERCIAL', 'CULTURE_SPORT', 'PUBLIC_NONPROFIT', 'CUSTOM'];
const offerTypes: OfferType[] = ['STANDARD_MEDIA', 'NAVIGATION', 'CITY_GALLERY'];

function parseRequest(raw: unknown): AiOfferRequest {
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Požadavek AI Copilota není platný.');
  const value = raw as Record<string, unknown>;
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';
  if (!prompt) throw new OfferValidationError('Zadejte požadavek klienta.');
  const request = { ...value, prompt } as AiOfferRequest;
  request.selectedSurfaceIds = Array.isArray(value.selectedSurfaceIds) ? value.selectedSurfaceIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : undefined;
  request.selectedCandidateIds = Array.isArray(value.selectedCandidateIds) ? value.selectedCandidateIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : undefined;
  request.candidateMountingTypes = value.candidateMountingTypes && typeof value.candidateMountingTypes === 'object'
    ? Object.fromEntries(Object.entries(value.candidateMountingTypes as Record<string, unknown>).filter((entry): entry is [string, 'LIGHT_POLE' | 'TRACTION' | 'COLUMN' | 'POLE' | 'OTHER' | 'UNKNOWN'] => typeof entry[1] === 'string' && ['LIGHT_POLE', 'TRACTION', 'COLUMN', 'POLE', 'OTHER', 'UNKNOWN'].includes(entry[1])))
    : undefined;
  request.navigationPoints = Array.isArray(value.navigationPoints)
    ? value.navigationPoints.flatMap((rawPoint): AiNavigationPointInput[] => {
        if (!rawPoint || typeof rawPoint !== 'object') return [];
        const point = rawPoint as Record<string, unknown>;
        const latitude = Number(point.latitude);
        const longitude = Number(point.longitude);
        if (typeof point.id !== 'string' || !point.id || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
        return [{
          id: point.id,
          title: typeof point.title === 'string' && point.title.trim() ? point.title.trim() : 'Navržený navigační bod',
          latitude,
          longitude,
          score: Math.max(0, Math.min(100, Number(point.score) || 0)),
          reasons: Array.isArray(point.reasons) ? point.reasons.filter((reason): reason is string => typeof reason === 'string').slice(0, 5) : [],
          distanceMeters: Number.isFinite(Number(point.distanceMeters)) ? Number(point.distanceMeters) : undefined,
          routeDurationSeconds: Number.isFinite(Number(point.routeDurationSeconds)) ? Number(point.routeDurationSeconds) : undefined,
          routePolyline: typeof point.routePolyline === 'string' ? point.routePolyline : undefined,
          arrowDirection: ['LEFT', 'RIGHT', 'STRAIGHT'].includes(String(point.arrowDirection)) ? point.arrowDirection as AiNavigationPointInput['arrowDirection'] : undefined,
        }];
      }).slice(0, 20)
    : undefined;
  if (request.offerType && !offerTypes.includes(request.offerType)) throw new OfferValidationError('Typ nabídky není platný.');
  if (request.pricingSegment && !pricingSegments.includes(request.pricingSegment)) throw new OfferValidationError('Cenový segment není platný.');
  return request;
}

async function resolveClient(request: AiOfferRequest, createNew: boolean): Promise<AiResolvedClient> {
  if (request.clientId) {
    const client = await prisma.client.findFirst({ where: { id: request.clientId, active: true }, select: { id: true, name: true, pricingSegment: true } });
    if (!client) throw new OfferValidationError('Vybraný klient neexistuje nebo není aktivní.');
    return { ...client, segmentLocked: true, isNew: false };
  }
  const name = request.clientName?.trim();
  if (!name) throw new OfferValidationError('Vyberte klienta nebo zadejte nového potenciálního klienta. AI klienta sama nepřiřadí.');
  const segment = request.pricingSegment ?? 'COMMERCIAL';
  if (!createNew) return { name, pricingSegment: segment, segmentLocked: false, isNew: true };
  const client = await prisma.client.create({ data: { name, normalizedName: normalizeClientName(name), status: 'LEAD', pricingSegment: segment }, select: { id: true, name: true, pricingSegment: true } });
  return { ...client, segmentLocked: true, isNew: true };
}

function resolvePeriod(request: AiOfferRequest) {
  const durationMonths = Math.max(1, Math.min(60, Math.round(Number(request.durationMonths) || 12)));
  const dateFrom = request.dateFrom ? new Date(`${request.dateFrom}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(dateFrom.getTime())) throw new OfferValidationError('Začátek kampaně není platný.');
  const dateTo = request.dateTo ? new Date(`${request.dateTo}T00:00:00.000Z`) : new Date(dateFrom);
  if (!request.dateTo) dateTo.setUTCMonth(dateTo.getUTCMonth() + durationMonths);
  if (Number.isNaN(dateTo.getTime()) || dateTo < dateFrom) throw new OfferValidationError('Konec kampaně není platný.');
  return { dateFrom, dateTo, durationMonths };
}

export async function previewAiOffer(raw: unknown): Promise<AiOfferPreview> {
  const request = parseRequest(raw);
  const client = await resolveClient(request, false);
  const recommendedOfferType = recommendOfferType(request.prompt);
  const offerType = request.offerType ?? recommendedOfferType;
  const period = resolvePeriod(request);
  const quantity = Math.max(1, Math.min(100, Math.round(Number(request.quantity) || inferQuantity(request.prompt))));
  if (offerType === 'NAVIGATION') return generateNavigationPreview({ request, client, recommendedOfferType, ...period, quantity });
  if (offerType === 'CITY_GALLERY') return generateCityGalleryPreview({ request, client, recommendedOfferType, ...period });
  return generateStandardMediaPreview({ request, client, recommendedOfferType, ...period, quantity, mediaType: request.mediaType ?? inferMediaType(request.prompt) });
}

async function auditAiConfirmation(offerId: string, user: CurrentUser, preview: AiOfferPreview) {
  await prisma.offerEvent.createMany({ data: [
    { offerId, type: 'UPDATED', actorUserId: user.id, actorName: user.name, message: 'AI návrh nabídky vytvořen.', metadata: { event: 'AI_PROPOSAL_CREATED', offerType: preview.offerType, pricingSegment: preview.client.pricingSegment, candidateCount: preview.candidateCount, selectedCount: preview.items.length, warnings: preview.warnings } },
    { offerId, type: 'UPDATED', actorUserId: user.id, actorName: user.name, message: 'AI návrh potvrzen obchodníkem.', metadata: { event: 'AI_PROPOSAL_CONFIRMED', offerType: preview.offerType, pricingSegment: preview.client.pricingSegment } },
  ] });
}

async function confirmStandard(user: CurrentUser, request: AiOfferRequest, client: AiResolvedClient, preview: AiOfferPreview) {
  if (preview.items.some((item) => !item.surfaceId)) throw new OfferValidationError('Standardní návrh obsahuje neplatnou plochu. Připravte návrh znovu.');
  const cleanName = request.targetName || client.name;
  const cleanCity = request.city || 'Ostrava';
  const shortTitle = request.isNoPriceConcept
    ? `Koncept OOH kampaně – ${cleanName}`
    : `Návrh OOH kampaně – ${cleanName} (${cleanCity})`;

  const result = await createOffer(user, {
    clientId: client.id, title: shortTitle, campaignName: shortTitle,
    pricingTier: client.pricingSegment, budget: request.budget ? String(request.budget) : '', taxRate: '21', confirmNegotiation: false, chargeSelections: [],
    internalNote: `AI Copilot: ${request.prompt}`,
    clientMessage: request.clientMessage?.trim() || preview.explanation || 'Na základě zadání jsme připravili transparentní návrh dostupných reklamních ploch.',
    items: preview.items.map((item) => ({ surfaceId: item.surfaceId!, dateFrom: item.dateFrom, dateTo: item.dateTo, quantity: String(item.quantity), unit: item.unit, unitPrice: String(item.price?.unitPrice ?? 0), discountPercent: '0', discountAmount: '0', customTitle: item.title, clientDescription: item.reasons.join(' ') })),
  });
  const offerId = result.offer.id!;
  await prisma.$transaction([
    prisma.offer.update({
      where: { id: offerId },
      data: {
        pricingSegment: client.pricingSegment,
        isNoPriceConcept: Boolean(request.isNoPriceConcept),
        campaignStrategy: {
          summary: preview.explanation,
          city: request.city || client.name,
          recommendedMediaTypes: [request.mediaType || 'CITY_POSTER'],
        },
        campaignPhases: [
          {
            phase: 'TEASER',
            name: 'Před-otvírací fáze (Teaser)',
            timeframe: '2–3 týdny před otevřením',
            recommendedMediaTypes: ['CITY_POSTER', 'PROMO_BENCH'],
            description: 'Budování povědomí o příchodu značky a vyvolání prvotního zájmu obyvatel v širším okolí.',
          },
          {
            phase: 'OPENING',
            name: 'Fáze slavnostního otevření',
            timeframe: 'Týden otevření',
            recommendedMediaTypes: ['CITY_POSTER', 'NAVIGATION_SIGN', 'PROMO_BENCH'],
            description: 'Intenzivní lokální kampaň s přímou navigací zákazníků z hlavních příjezdových křižovatek k novému objektu.',
          },
          {
            phase: 'FOLLOW_UP',
            name: 'Stabilizační fáze (Follow-up)',
            timeframe: '1–2 týdny po otevření',
            recommendedMediaTypes: ['PROMO_BENCH', 'CITY_POSTER'],
            description: 'Upevnění návyku zákazníků navštěvovat novou pobočku v rezidenčních a spádových čtvrtích.',
          },
        ],
      },
    }),
    ...preview.items.map((item) => prisma.offerItem.updateMany({ where: { offerId, surfaceId: item.surfaceId! }, data: {
      priceRuleId: item.price?.ruleId ?? null, pricingSegment: client.pricingSegment,
      catalogPrice: item.price?.unitPrice ?? null, finalPrice: item.price?.unitPrice ?? null, priceSource: item.price ? 'OFFER_PRICE_RULE' : 'MISSING',
      priceValidFrom: item.price?.validFrom ? new Date(item.price.validFrom) : null, priceValidTo: item.price?.validTo ? new Date(item.price.validTo) : null,
    } })),
  ]);

  if (request.opportunityId) {
    await prisma.salesOpportunity.update({
      where: { id: request.opportunityId },
      data: {
        createdOfferId: offerId,
        clientId: client.id,
        status: 'PROPOSAL_CREATED',
      },
    }).catch(() => undefined);
  }

  return offerId;
}

async function confirmNavigation(user: CurrentUser, request: AiOfferRequest, client: AiResolvedClient, preview: AiOfferPreview) {
  if (!preview.target) throw new OfferValidationError('Navigační návrh nemá cíl.');
  const result = await saveNavigationOffer(user, {
    clientId: client.id, title: `AI navigace – ${preview.target.name}`, campaignName: request.prompt,
    internalNote: `AI Copilot: ${request.prompt}`, clientMessage: preview.explanation,
    targetName: preview.target.name, targetAddress: preview.target.address, targetLatitude: preview.target.latitude, targetLongitude: preview.target.longitude,
    proposalMode: 'LOCATION_SELECTION',
    points: preview.items.map((item) => ({
      carrierId: null, surfaceId: null, latitude: item.latitude, longitude: item.longitude, address: item.title,
      label: item.carrierCode, navigationType: 'Směrová tabule', quantity: 1,
      unitPrice: item.rentalTotal ?? 0,
      installationPrice: item.componentPrices?.INSTALLATION?.unitPrice ?? 0, removalPrice: item.componentPrices?.REMOVAL?.unitPrice ?? 0,
      productionPrice: (item.componentPrices?.PRODUCTION?.unitPrice ?? 0) + (item.componentPrices?.PRINT?.unitPrice ?? 0), calculatedDistanceMeters: item.distanceMeters,
      routeDistanceMeters: item.distanceMeters, routeDurationSeconds: item.routeDurationSeconds, routePolyline: item.routePolyline,
      arrowDirectionEnum: item.arrowDirection, pillarType: item.mountingType ?? '', clientNote: item.reasons.join(' '),
      internalNote: item.finalPrice === null ? 'AI návrhový bod bez potvrzené ceny. Vyžaduje fotografii a terénní ověření konstrukce.' : 'AI návrhový bod. Typ konstrukce a cenu potvrďte podle fotografie z terénu.',
    })),
  });
  await prisma.offer.update({ where: { id: result.id }, data: { pricingSegment: client.pricingSegment } });
  const points = await prisma.navigationPoint.findMany({ where: { navigationOffer: { offerId: result.id } }, orderBy: { sortOrder: 'asc' } });
  await prisma.$transaction(points.map((point, index) => prisma.navigationPoint.update({ where: { id: point.id }, data: { priceSnapshot: {
    status: preview.items[index]?.finalPrice === null ? 'MISSING' : 'PROVISIONAL',
    mountingType: preview.items[index]?.mountingType ?? null,
    components: preview.items[index]?.componentPrices ?? {},
    requiresSitePhoto: true,
  } } })));
  const pricedPoints = points.flatMap((point, index) => preview.items[index]?.finalPrice === null ? [] : [{ point, item: preview.items[index] }]);
  if (pricedPoints.length) await prisma.navigationPriceVersion.createMany({ data: pricedPoints.map(({ point }) => ({
    navigationPointId: point.id, validFrom: new Date(preview.dateFrom), validTo: new Date(preview.dateTo), unitPrice: point.unitPrice,
    installationPrice: point.installationPrice, removalPrice: point.removalPrice, productionPrice: point.productionPrice, subtotal: point.subtotal,
    reason: `AI ceníkový snapshot – segment ${client.pricingSegment}`, changedByUserId: user.id,
  })) });
  return result.id;
}

export async function confirmAiOffer(user: CurrentUser, raw: unknown) {
  const request = parseRequest(raw);
  const preview = await previewAiOffer(request);
  const client = await resolveClient(request, true);
  request.clientId = client.id;
  let offerId: string;
  if (preview.offerType === 'NAVIGATION') offerId = await confirmNavigation(user, request, client, preview);
  else if (preview.offerType === 'CITY_GALLERY') {
    const offer = await createCityGalleryOffer(user, { clientId: client.id, title: `AI Galerie venku – ${request.city || client.name}`, campaignName: request.prompt, concept: request.prompt, locationBrief: request.city, subtotal: 0 });
    offerId = offer.id;
    await prisma.offer.update({ where: { id: offerId }, data: { pricingSegment: client.pricingSegment } });
  } else offerId = await confirmStandard(user, request, client, preview);
  await auditAiConfirmation(offerId, user, preview);
  return { ok: true, offerId, offerType: preview.offerType, redirectUrl: preview.offerType === 'NAVIGATION' ? `/offers/${offerId}/navigation/edit` : `/offers/${offerId}`, warnings: preview.warnings };
}

import { logAIUsage } from '@/lib/ai-usage';

export async function handleAiOffer(user: CurrentUser, raw: unknown) {
  const request = parseRequest(raw);
  if (user.organizationId) {
    void logAIUsage({
      organizationId: user.organizationId,
      userId: user.id,
      feature: 'OFFER_GENERATOR',
      modelName: 'gemini-3.6-flash',
      promptTokens: (request.prompt?.length || 10) * 2,
      outputTokens: 400,
      costEstimateUsd: 0.002,
      metadata: { promptSnippet: request.prompt?.slice(0, 100) },
    });
  }
  return request.action === 'confirm' ? confirmAiOffer(user, request) : previewAiOffer(request);
}
