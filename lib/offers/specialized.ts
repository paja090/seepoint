import { Prisma, NavigationArrowDirection } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CurrentUser } from '@/lib/rbac';
import { canAccessOffer, canManageOfferRole, OfferValidationError, parseDateOnly, serverOfferAuthor } from './domain';
import { calculateNavigationOfferTotals, calculateNavigationPointSubtotal } from './navigation-pricing';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullable = (value: string) => value || null;
const coordinate = (value: unknown, kind: 'latitude' | 'longitude') => {
  const parsed = Number(value);
  const limit = kind === 'latitude' ? 90 : 180;
  if (!Number.isFinite(parsed) || parsed < -limit || parsed > limit) throw new OfferValidationError(`Souřadnice ${kind} není platná.`);
  return parsed;
};
const decimal = (value: unknown, label: string, fallback = '0') => {
  try { const normalized = typeof value === 'string' || typeof value === 'number' ? String(value).trim().replace(',', '.') : ''; const result = new Prisma.Decimal(normalized || fallback); if (result.lt(0)) throw new Error(); return result.toDecimalPlaces(2); } catch { throw new OfferValidationError(`${label} musí být nezáporné číslo.`); }
};
const assertRole = (user: CurrentUser) => { if (!canManageOfferRole(user.role)) throw new OfferValidationError('Nemáte oprávnění spravovat nabídky.', 'FORBIDDEN'); };

export type NavigationOfferInput = ReturnType<typeof parseNavigationOfferInput>;

export function parseNavigationOfferInput(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Data navigační nabídky nejsou platná.');
  const input = raw as Record<string, unknown>;
  const clientId = text(input.clientId); const title = text(input.title); const targetName = text(input.targetName);
  if (!clientId || !title || !targetName) throw new OfferValidationError('Klient, název nabídky a cíl navigace jsou povinné.');
  const rows = Array.isArray(input.points) ? input.points : [];
  if (rows.length === 0) throw new OfferValidationError('Přidejte alespoň jeden navigační bod.', 'EMPTY_NAVIGATION');
  const points = rows.map((rawPoint, index) => {
    if (!rawPoint || typeof rawPoint !== 'object') throw new OfferValidationError(`Navigační bod ${index + 1} není platný.`);
    const point = rawPoint as Record<string, unknown>;
    const quantity = decimal(point.quantity, `Množství bodu ${index + 1}`, '1');
    if (quantity.lte(0)) throw new OfferValidationError(`Množství bodu ${index + 1} musí být větší než nula.`);
    const unitPrice = decimal(point.unitPrice, `Cena bodu ${index + 1}`);
    const installationPrice = decimal(point.installationPrice, `Montáž bodu ${index + 1}`);
    const removalPrice = decimal(point.removalPrice, `Demontáž bodu ${index + 1}`);
    const productionPrice = decimal(point.productionPrice, `Výroba bodu ${index + 1}`);
    const framePrice = decimal(point.framePrice, `Výroba rámu bodu ${index + 1}`);
    const subtotal = calculateNavigationPointSubtotal({ quantity, unitPrice, installationPrice, removalPrice, productionPrice, framePrice });
    
    // Parse new Google Maps structured fields
    const manualDistanceVal = point.manualDistanceValue !== undefined && point.manualDistanceValue !== null && point.manualDistanceValue !== '' 
      ? decimal(point.manualDistanceValue, `Ruční vzdálenost bodu ${index + 1}`) 
      : null;
    const manualDistUnit = text(point.manualDistanceUnit) === 'KILOMETERS' ? ('KILOMETERS' as const) : text(point.manualDistanceUnit) === 'METERS' ? ('METERS' as const) : null;
    const distSource = text(point.distanceSource) === 'MANUAL' ? ('MANUAL' as const) : ('CALCULATED' as const);
    
    const arrowDir = (['LEFT', 'RIGHT', 'STRAIGHT', 'SLANTED_LEFT', 'SLANTED_RIGHT', 'U_TURN', 'TWO_WAY'].includes(text(point.arrowDirectionEnum))
      ? (text(point.arrowDirectionEnum) as NavigationArrowDirection)
      : ('STRAIGHT' as NavigationArrowDirection));

    return {
      carrierId: text(point.carrierId) || null, surfaceId: text(point.surfaceId) || null, sortOrder: index,
      latitude: coordinate(point.latitude, 'latitude'), longitude: coordinate(point.longitude, 'longitude'),
      address: nullable(text(point.address)), label: text(point.label) || `Navigační bod ${index + 1}`,
      navigationType: text(point.navigationType) || 'Směrová tabule', variant: nullable(text(point.variant)), orientation: nullable(text(point.orientation)),
      quantity, unitPrice, subtotal, installationPrice, removalPrice, productionPrice, framePrice,
      internalNote: nullable(text(point.internalNote)), clientNote: nullable(text(point.clientNote)),
      
      // New structured fields
      pillarNumber: nullable(text(point.pillarNumber)),
      pillarType: nullable(text(point.pillarType)),
      calculatedDistanceMeters: typeof point.calculatedDistanceMeters === 'number' ? point.calculatedDistanceMeters : null,
      manualDistanceValue: manualDistanceVal,
      manualDistanceUnit: manualDistUnit,
      distanceSource: distSource,
      routePolyline: nullable(text(point.routePolyline)),
      routeProvider: 'GOOGLE_ROUTES' as const,
      routeDistanceMeters: typeof point.routeDistanceMeters === 'number' ? point.routeDistanceMeters : null,
      routeDurationSeconds: typeof point.routeDurationSeconds === 'number' ? point.routeDurationSeconds : null,
      routeTravelMode: 'DRIVING' as const,
      routeCalculatedAt: point.routeCalculatedAt ? new Date(String(point.routeCalculatedAt)) : new Date(),
      routeStatus: 'OK' as const,
      arrowDirectionEnum: arrowDir,
      visualizedPhotoUrl: nullable(text(point.visualizedPhotoUrl)),
      sitePhotoId: nullable(text(point.sitePhotoId)),
      isSelectedByClient: point.isSelectedByClient !== false,
    };
  });
  const validUntil = text(input.validUntil);
  if (validUntil) parseDateOnly(validUntil, 'Platnost nabídky');
  const propMode = text(input.proposalMode) === 'PRICED_QUOTE' ? 'PRICED_QUOTE' : 'LOCATION_SELECTION';
  return {
    clientId, title, campaignName: text(input.campaignName) || title, contactPerson: text(input.contactPerson), contactEmail: text(input.contactEmail), contactPhone: text(input.contactPhone),
    validUntil, internalNote: text(input.internalNote), clientMessage: text(input.clientMessage), targetName, targetAddress: text(input.targetAddress),
    targetLatitude: coordinate(input.targetLatitude, 'latitude'), targetLongitude: coordinate(input.targetLongitude, 'longitude'), targetNote: text(input.targetNote), 
    targetPhotoUrl: nullable(text(input.targetPhotoUrl)),
    googlePlaceId: nullable(text(input.googlePlaceId)), formattedAddress: nullable(text(input.formattedAddress)),
    proposalMode: propMode,
    graphicArtworkUrl: nullable(text(input.graphicArtworkUrl)),
    includeGraphicProof: input.includeGraphicProof !== false,
    clientArtworkUrl: nullable(text(input.clientArtworkUrl)),
    clientArtworkFileName: nullable(text(input.clientArtworkFileName)),
    points,
  };
}

function navigationTotals(input: NavigationOfferInput) {
  return calculateNavigationOfferTotals(input.points.map((point) => point.subtotal));
}

export async function saveNavigationOffer(user: CurrentUser, raw: unknown, offerId?: string) {
  assertRole(user); const input = parseNavigationOfferInput(raw); const totals = navigationTotals(input);
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: input.clientId, active: true }, select: { id: true } });
    if (!client) throw new OfferValidationError('Vybraný klient neexistuje nebo není aktivní.');
    const common = {
      clientId: input.clientId, title: input.title, campaignName: input.campaignName,
      contactPerson: nullable(input.contactPerson), contactEmail: nullable(input.contactEmail), contactPhone: nullable(input.contactPhone),
      validUntil: input.validUntil ? parseDateOnly(input.validUntil, 'Platnost nabídky') : null,
      internalNote: nullable(input.internalNote), clientMessage: nullable(input.clientMessage), taxRate: new Prisma.Decimal(21),
      subtotal: totals.subtotal, discountAmount: new Prisma.Decimal(0), taxAmount: totals.taxAmount, totalPrice: totals.subtotal, totalWithTax: totals.totalWithTax,
      updatedByUserId: user.id,
    };
      if (offerId) {
        const existing = await tx.offer.findUnique({ where: { id: offerId }, select: { id: true, offerType: true, status: true, createdByUserId: true } });
        if (!existing || existing.offerType !== 'NAVIGATION') throw new OfferValidationError('Navigační nabídka nebyla nalezena.', 'NOT_FOUND');
        if (!canAccessOffer(user, existing.createdByUserId)) throw new OfferValidationError('K nabídce nemáte přístup.', 'FORBIDDEN');

        const existingPoints = await tx.navigationPoint.findMany({
          where: { navigationOffer: { offerId } },
          select: { id: true },
        });
        const pointIds = existingPoints.map((p) => p.id);
        if (pointIds.length > 0) {
          await tx.navigationPoint.updateMany({
            where: { id: { in: pointIds } },
            data: { sitePhotoId: null },
          });
        }

        await tx.navigationPoint.deleteMany({ where: { navigationOffer: { offerId } } });
        return tx.offer.update({ where: { id: offerId }, data: { ...common, navigationOffer: { update: { targetName: input.targetName, targetAddress: nullable(input.targetAddress), targetLatitude: input.targetLatitude, targetLongitude: input.targetLongitude, targetNote: nullable(input.targetNote), targetPhotoUrl: input.targetPhotoUrl, googlePlaceId: input.googlePlaceId, formattedAddress: input.formattedAddress, proposalMode: input.proposalMode, graphicArtworkUrl: input.graphicArtworkUrl, includeGraphicProof: input.includeGraphicProof, points: { create: input.points } } }, events: { create: { type: 'UPDATED', actorUserId: user.id, actorName: user.name } } }, select: { id: true } });
      }
    return tx.offer.create({ data: { ...common, offerType: 'NAVIGATION', status: 'DRAFT', ...serverOfferAuthor(user), navigationOffer: { create: { targetName: input.targetName, targetAddress: nullable(input.targetAddress), targetLatitude: input.targetLatitude, targetLongitude: input.targetLongitude, targetNote: nullable(input.targetNote), targetPhotoUrl: input.targetPhotoUrl, googlePlaceId: input.googlePlaceId, formattedAddress: input.formattedAddress, proposalMode: input.proposalMode, graphicArtworkUrl: input.graphicArtworkUrl, includeGraphicProof: input.includeGraphicProof, clientArtworkUrl: input.clientArtworkUrl, clientArtworkFileName: input.clientArtworkFileName, points: { create: input.points } } }, events: { create: { type: 'CREATED', toStatus: 'DRAFT', actorUserId: user.id, actorName: user.name } } }, select: { id: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function parseCityGalleryOfferInput(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Data nabídky nejsou platná.');
  const input = raw as Record<string, unknown>;
  const clientId = text(input.clientId); const title = text(input.title);
  if (!clientId || !title) throw new OfferValidationError('Klient a název nabídky jsou povinné.');
  const validUntil = text(input.validUntil); if (validUntil) parseDateOnly(validUntil, 'Platnost nabídky');
  const subtotal = decimal(input.subtotal, 'Cena bez DPH'); const taxAmount = subtotal.mul(21).div(100).toDecimalPlaces(2);
  return { clientId, title, campaignName: text(input.campaignName) || title, projectId: text(input.projectId), concept: text(input.concept), locationBrief: text(input.locationBrief), realizationNote: text(input.realizationNote), internalNote: text(input.internalNote), clientMessage: text(input.clientMessage), contactPerson: text(input.contactPerson), contactEmail: text(input.contactEmail), contactPhone: text(input.contactPhone), validUntil, subtotal, taxAmount, totalWithTax: subtotal.add(taxAmount).toDecimalPlaces(2) };
}

export async function createCityGalleryOffer(user: CurrentUser, raw: unknown) {
  assertRole(user); const input = parseCityGalleryOfferInput(raw);
  const client = await prisma.client.findFirst({ where: { id: input.clientId, active: true }, select: { id: true } });
  if (!client) throw new OfferValidationError('Vybraný klient neexistuje nebo není aktivní.');
  if (input.projectId && !await prisma.cityGalleryProject.findUnique({ where: { id: input.projectId }, select: { id: true } })) throw new OfferValidationError('Projekt Galerie venku nebyl nalezen.');
  return prisma.offer.create({ data: { clientId: input.clientId, title: input.title, campaignName: input.campaignName, offerType: 'CITY_GALLERY', status: 'DRAFT', contactPerson: nullable(input.contactPerson), contactEmail: nullable(input.contactEmail), contactPhone: nullable(input.contactPhone), validUntil: input.validUntil ? parseDateOnly(input.validUntil, 'Platnost nabídky') : null, internalNote: nullable(input.internalNote), clientMessage: nullable(input.clientMessage), taxRate: new Prisma.Decimal(21), subtotal: input.subtotal, discountAmount: new Prisma.Decimal(0), taxAmount: input.taxAmount, totalPrice: input.subtotal, totalWithTax: input.totalWithTax, ...serverOfferAuthor(user), cityGalleryOffer: { create: { projectId: input.projectId || null, concept: nullable(input.concept), locationBrief: nullable(input.locationBrief), realizationNote: nullable(input.realizationNote) } }, events: { create: { type: 'CREATED', toStatus: 'DRAFT', actorUserId: user.id, actorName: user.name } } }, select: { id: true } });
}

export async function updateCityGalleryOffer(user: CurrentUser, offerId: string, raw: unknown) {
  assertRole(user); const input = parseCityGalleryOfferInput(raw);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.offer.findUnique({ where: { id: offerId }, select: { offerType: true, status: true, createdByUserId: true } });
    if (!existing || existing.offerType !== 'CITY_GALLERY') throw new OfferValidationError('Nabídka Galerie venku nebyla nalezena.', 'NOT_FOUND');
    if (!canAccessOffer(user, existing.createdByUserId)) throw new OfferValidationError('K nabídce nemáte přístup.', 'FORBIDDEN');
    if (existing.status !== 'DRAFT') throw new OfferValidationError('Upravovat lze pouze koncept.', 'INVALID_STATUS_TRANSITION');
    const client = await tx.client.findFirst({ where: { id: input.clientId, active: true }, select: { id: true } }); if (!client) throw new OfferValidationError('Vybraný klient neexistuje nebo není aktivní.');
    if (input.projectId && !await tx.cityGalleryProject.findUnique({ where: { id: input.projectId }, select: { id: true } })) throw new OfferValidationError('Projekt Galerie venku nebyl nalezen.');
    return tx.offer.update({ where: { id: offerId }, data: { clientId: input.clientId, title: input.title, campaignName: input.campaignName, contactPerson: nullable(input.contactPerson), contactEmail: nullable(input.contactEmail), contactPhone: nullable(input.contactPhone), validUntil: input.validUntil ? parseDateOnly(input.validUntil, 'Platnost nabídky') : null, internalNote: nullable(input.internalNote), clientMessage: nullable(input.clientMessage), subtotal: input.subtotal, totalPrice: input.subtotal, taxAmount: input.taxAmount, totalWithTax: input.totalWithTax, updatedByUserId: user.id, cityGalleryOffer: { update: { projectId: input.projectId || null, concept: nullable(input.concept), locationBrief: nullable(input.locationBrief), realizationNote: nullable(input.realizationNote) } }, events: { create: { type: 'UPDATED', actorUserId: user.id, actorName: user.name } } }, select: { id: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getSpecializedOfferOptions() {
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({ where: { active: true }, select: { id: true, name: true, contactPerson: true, email: true, phone: true }, orderBy: { name: 'asc' } }),
    prisma.cityGalleryProject.findMany({ where: { status: { not: 'ARCHIVED' } }, select: { id: true, title: true, city: true, status: true }, orderBy: { updatedAt: 'desc' } }),
  ]);
  return { clients, projects };
}
