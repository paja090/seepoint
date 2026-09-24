import { randomUUID } from 'node:crypto';
import { Prisma, NavigationArrowDirection } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CurrentUser } from '@/lib/rbac';
import { canAccessOffer, canManageOfferRole, OfferValidationError, parseDateOnly, serverOfferAuthor } from './domain';
import { calculateNavigationOfferTotals, calculateNavigationPointSubtotal } from './navigation-pricing';
import { syncNavigationOfferToOrderInTransaction } from '@/lib/ai-realization/navigation-sync';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const nullable = (value: string) => value || null;
const boundedText = (value: unknown, label: string, maxLength: number, required = false) => {
  const result = text(value);
  if (required && !result) throw new OfferValidationError(`${label} je povinný údaj.`);
  if (result.length > maxLength) throw new OfferValidationError(`${label} je příliš dlouhý.`);
  return result;
};
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

export type ParsedNavigationTarget = {
  id: string;
  stableKey: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  note: string | null;
  photoUrl: string | null;
};

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
    
    const validArrows = [
      'LEFT', 'RIGHT', 'STRAIGHT', 'SLANTED_LEFT', 'SLANTED_RIGHT', 'U_TURN', 'TWO_WAY',
      'ROUNDABOUT_1', 'ROUNDABOUT_2', 'ROUNDABOUT_3', 'ROUNDABOUT_4', 'ROUNDABOUT_5', 'ROUNDABOUT',
    ];
    const arrowDir = (validArrows.includes(text(point.arrowDirectionEnum))
      ? (text(point.arrowDirectionEnum) as NavigationArrowDirection)
      : ('STRAIGHT' as NavigationArrowDirection));

    const pointTargetLat = point.targetLatitude !== undefined && point.targetLatitude !== null && point.targetLatitude !== ''
      ? coordinate(point.targetLatitude, 'latitude')
      : null;
    const pointTargetLng = point.targetLongitude !== undefined && point.targetLongitude !== null && point.targetLongitude !== ''
      ? coordinate(point.targetLongitude, 'longitude')
      : null;

    const pointId = text(point.id) || null;
    const pointStableKey = text(point.stableKey) || pointId || null;
    const navTargetId = text(point.navigationTargetId) || text((point as { targetId?: unknown }).targetId) || null;

    return {
      id: pointId,
      stableKey: pointStableKey,
      navigationTargetId: navTargetId,
      carrierId: text(point.carrierId) || null, surfaceId: text(point.surfaceId) || null, sortOrder: index,
      latitude: coordinate(point.latitude, 'latitude'), longitude: coordinate(point.longitude, 'longitude'),
      targetLatitude: pointTargetLat, targetLongitude: pointTargetLng,
      address: nullable(text(point.address)), label: text(point.label) || `Navigační bod ${index + 1}`,
      navigationType: text(point.navigationType) || 'Směrová tabule', variant: nullable(text(point.variant)), orientation: nullable(text(point.orientation)),
      quantity, unitPrice, subtotal, installationPrice, removalPrice, productionPrice, framePrice,
      internalNote: nullable(text(point.internalNote)), clientNote: nullable(text(point.clientNote)),
      
      // New structured fields
      pillarNumber: nullable(text(point.pillarNumber)),
      pillarType: nullable(text(point.pillarType)),
      calculatedDistanceMeters: typeof point.calculatedDistanceMeters === 'number' && point.calculatedDistanceMeters > 0
        ? Math.max(50, Math.round(point.calculatedDistanceMeters / 50) * 50)
        : null,
      manualDistanceValue: manualDistanceVal,
      manualDistanceUnit: manualDistUnit,
      distanceSource: distSource,
      routePolyline: nullable(text(point.routePolyline)),
      routeProvider: 'GOOGLE_ROUTES' as const,
      routeDistanceMeters: typeof point.routeDistanceMeters === 'number' && point.routeDistanceMeters > 0
        ? Math.max(50, Math.round(point.routeDistanceMeters / 50) * 50)
        : null,
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
  const dateFrom = text(input.dateFrom);
  if (dateFrom) parseDateOnly(dateFrom, 'Termín kampaně (od)');
  const dateTo = text(input.dateTo);
  if (dateTo) parseDateOnly(dateTo, 'Termín kampaně (do)');
  if (dateFrom && dateTo && dateTo < dateFrom) {
    throw new OfferValidationError('Konec kampaně (do) nemůže předcházet začátku (od).');
  }
  const propMode = text(input.proposalMode) === 'PRICED_QUOTE' ? 'PRICED_QUOTE' : 'LOCATION_SELECTION';
  const city = text(input.city) === 'Havířov' ? 'Havířov' : (text(input.targetAddress).toLowerCase().includes('havířov') ? 'Havířov' : 'Ostrava');

  const rawPres = (input.presentationSettings && typeof input.presentationSettings === 'object' && !Array.isArray(input.presentationSettings))
    ? (input.presentationSettings as Record<string, unknown>)
    : null;
  const presentationSettings = rawPres ? {
    showGraphicProofBadge: rawPres.showGraphicProofBadge !== false,
    showReferences: rawPres.showReferences !== false,
    showRealizations: rawPres.showRealizations !== false,
    showPartnershipGuarantee: rawPres.showPartnershipGuarantee !== false,
    showAboutCompany: rawPres.showAboutCompany !== false,
  } : undefined;

  // Parse optional multiple targets
  const rawTargets = Array.isArray(input.targets) ? input.targets : [];
  const targets: ParsedNavigationTarget[] = [];
  for (let idx = 0; idx < rawTargets.length; idx++) {
    const t = rawTargets[idx];
    if (!t || typeof t !== 'object') continue;
    const tRec = t as Record<string, unknown>;
    const tId = text(tRec.id) || `target-${idx + 1}`;
    const tStableKey = text(tRec.stableKey) || tId;
    const tName = text(tRec.name || tRec.label || `Prodejna ${idx + 1}`);
    const tAddr = text(tRec.address);
    const tLat = coordinate(tRec.latitude, 'latitude');
    const tLng = coordinate(tRec.longitude, 'longitude');
    targets.push({
      id: tId,
      stableKey: tStableKey,
      name: tName,
      address: tAddr,
      latitude: tLat,
      longitude: tLng,
      note: nullable(text(tRec.note)),
      photoUrl: nullable(text(tRec.photoUrl)),
    });
  }

  return {
    clientId, title, campaignName: text(input.campaignName) || title, contactPerson: text(input.contactPerson), contactEmail: text(input.contactEmail), contactPhone: text(input.contactPhone),
    validUntil, dateFrom: nullable(dateFrom), dateTo: nullable(dateTo), internalNote: text(input.internalNote), clientMessage: text(input.clientMessage), city, targetName, targetAddress: text(input.targetAddress),
    targetLatitude: coordinate(input.targetLatitude, 'latitude'), targetLongitude: coordinate(input.targetLongitude, 'longitude'), targetNote: text(input.targetNote), 
    targetPhotoUrl: nullable(text(input.targetPhotoUrl)),
    targets: targets.length > 0 ? targets : [
      {
        id: 'target-1',
        stableKey: 'target-1',
        name: targetName,
        address: text(input.targetAddress),
        latitude: coordinate(input.targetLatitude, 'latitude'),
        longitude: coordinate(input.targetLongitude, 'longitude'),
        note: nullable(text(input.targetNote)),
        photoUrl: nullable(text(input.targetPhotoUrl)),
      }
    ],
    googlePlaceId: nullable(text(input.googlePlaceId)), formattedAddress: nullable(text(input.formattedAddress)),
    proposalMode: propMode,
    graphicArtworkUrl: nullable(text(input.graphicArtworkUrl)),
    includeGraphicProof: input.includeGraphicProof !== false,
    clientArtworkUrl: nullable(text(input.clientArtworkUrl)),
    clientArtworkFileName: nullable(text(input.clientArtworkFileName)),
    presentationSettings,
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
        const existing = await tx.offer.findUnique({
          where: { id: offerId },
          include: {
            navigationOffer: {
              include: {
                targets: true,
                points: true,
              },
            },
          },
        });
        if (!existing || existing.offerType !== 'NAVIGATION') throw new OfferValidationError('Navigační nabídka nebyla nalezena.', 'NOT_FOUND');
        if (!canAccessOffer(user, existing.createdByUserId)) throw new OfferValidationError('K nabídce nemáte přístup.', 'FORBIDDEN');

        const existingStrategy = (existing.campaignStrategy && typeof existing.campaignStrategy === 'object' && !Array.isArray(existing.campaignStrategy))
          ? (existing.campaignStrategy as Record<string, unknown>)
          : {};
        const updatedStrategy = {
          ...existingStrategy,
          targets: input.targets,
          ...(input.presentationSettings ? { presentationSettings: input.presentationSettings } : {}),
          ...(input.dateFrom !== undefined ? { dateFrom: input.dateFrom } : {}),
          ...(input.dateTo !== undefined ? { dateTo: input.dateTo } : {}),
        };

        let navOffer = existing.navigationOffer;
        if (!navOffer) {
          navOffer = await tx.navigationOffer.create({
            data: {
              organizationId: user.organizationId,
              offerId,
              city: input.city,
              targetName: input.targetName,
              targetAddress: nullable(input.targetAddress),
              targetLatitude: input.targetLatitude,
              targetLongitude: input.targetLongitude,
              targetNote: nullable(input.targetNote),
              targetPhotoUrl: input.targetPhotoUrl,
              googlePlaceId: input.googlePlaceId,
              formattedAddress: input.formattedAddress,
              proposalMode: input.proposalMode,
              graphicArtworkUrl: input.graphicArtworkUrl,
              includeGraphicProof: input.includeGraphicProof,
              clientArtworkUrl: input.clientArtworkUrl,
              clientArtworkFileName: input.clientArtworkFileName,
            },
            include: { targets: true, points: true },
          });
        } else {
          navOffer = await tx.navigationOffer.update({
            where: { id: navOffer.id },
            data: {
              city: input.city,
              targetName: input.targetName,
              targetAddress: nullable(input.targetAddress),
              targetLatitude: input.targetLatitude,
              targetLongitude: input.targetLongitude,
              targetNote: nullable(input.targetNote),
              targetPhotoUrl: input.targetPhotoUrl,
              googlePlaceId: input.googlePlaceId,
              formattedAddress: input.formattedAddress,
              proposalMode: input.proposalMode,
              graphicArtworkUrl: input.graphicArtworkUrl,
              includeGraphicProof: input.includeGraphicProof,
              clientArtworkUrl: input.clientArtworkUrl,
              clientArtworkFileName: input.clientArtworkFileName,
            },
            include: { targets: true, points: true },
          });
        }

        // 1. Targets Diff/Upsert
        const existingTargets = navOffer.targets || [];
        const targetIdMap = new Map<string, string>(); // stableKey/id -> db target id
        const targetCoordsMap = new Map<string, string>(); // "lat,lng" -> db target id
        const matchedTargetDbIds = new Set<string>();

        for (let idx = 0; idx < input.targets.length; idx++) {
          const t = input.targets[idx];
          const matchedTarget = existingTargets.find(
            (et) => (t.stableKey && et.stableKey === t.stableKey) || (t.id && et.id === t.id)
          );

          if (matchedTarget) {
            matchedTargetDbIds.add(matchedTarget.id);
            const updated = await tx.navigationTarget.update({
              where: { id: matchedTarget.id },
              data: {
                name: t.name,
                address: t.address || null,
                latitude: t.latitude,
                longitude: t.longitude,
                note: t.note || null,
                photoUrl: t.photoUrl || null,
                sortOrder: idx,
              },
            });
            targetIdMap.set(t.id, updated.id);
            if (t.stableKey) targetIdMap.set(t.stableKey, updated.id);
            targetIdMap.set(updated.id, updated.id);
            targetIdMap.set(updated.stableKey, updated.id);
            targetCoordsMap.set(`${t.latitude.toFixed(5)},${t.longitude.toFixed(5)}`, updated.id);
          } else {
            const stableKey = t.stableKey || randomUUID();
            const created = await tx.navigationTarget.create({
              data: {
                organizationId: user.organizationId,
                navigationOfferId: navOffer.id,
                stableKey,
                name: t.name,
                address: t.address || null,
                latitude: t.latitude,
                longitude: t.longitude,
                note: t.note || null,
                photoUrl: t.photoUrl || null,
                sortOrder: idx,
              },
            });
            targetIdMap.set(t.id, created.id);
            targetIdMap.set(stableKey, created.id);
            targetIdMap.set(created.id, created.id);
            targetCoordsMap.set(`${t.latitude.toFixed(5)},${t.longitude.toFixed(5)}`, created.id);
          }
        }

        // Delete removed targets from offer that aren't in input targets
        for (const et of existingTargets) {
          if (!matchedTargetDbIds.has(et.id)) {
            await tx.navigationTarget.delete({ where: { id: et.id } }).catch(() => null);
          }
        }

        // 2. Points Diff/Upsert (NO deleteMany, preserves stable identities & relations)
        const existingPoints = navOffer.points || [];
        const matchedPointDbIds = new Set<string>();

        for (let idx = 0; idx < input.points.length; idx++) {
          const p = input.points[idx];
          const matchedPoint = existingPoints.find(
            (ep) => (p.stableKey && ep.stableKey === p.stableKey) || (p.id && ep.id === p.id)
          ) || (
            existingPoints.length === input.points.length
              ? existingPoints.find((ep) => ep.sortOrder === idx && Math.abs(ep.latitude - p.latitude) < 0.0001 && !matchedPointDbIds.has(ep.id))
              : undefined
          );

          let resolvedTargetId: string | null = null;
          if (p.navigationTargetId && targetIdMap.has(p.navigationTargetId)) {
            resolvedTargetId = targetIdMap.get(p.navigationTargetId)!;
          } else if (p.targetLatitude != null && p.targetLongitude != null) {
            const coordsKey = `${p.targetLatitude.toFixed(5)},${p.targetLongitude.toFixed(5)}`;
            resolvedTargetId = targetCoordsMap.get(coordsKey) || null;
          }
          if (!resolvedTargetId && targetIdMap.size > 0) {
            resolvedTargetId = Array.from(targetIdMap.values())[0] || null;
          }

          const { id: _ignoreId, ...pData } = p;

          if (matchedPoint) {
            matchedPointDbIds.add(matchedPoint.id);
            const stableKey = matchedPoint.stableKey || p.stableKey || randomUUID();
            await tx.navigationPoint.update({
              where: { id: matchedPoint.id },
              data: {
                ...pData,
                sortOrder: idx,
                stableKey,
                navigationTargetId: resolvedTargetId,
              },
            });
          } else {
            const stableKey = p.stableKey || randomUUID();
            const created = await tx.navigationPoint.create({
              data: {
                ...pData,
                organizationId: user.organizationId,
                navigationOfferId: navOffer.id,
                sortOrder: idx,
                stableKey,
                navigationTargetId: resolvedTargetId,
              },
            });
            matchedPointDbIds.add(created.id);
          }
        }

        // Delete removed points that were intentionally deleted from offer
        for (const ep of existingPoints) {
          if (!matchedPointDbIds.has(ep.id)) {
            await tx.navigationPoint.delete({ where: { id: ep.id } }).catch(() => null);
          }
        }

        const updatedOffer = await tx.offer.update({
          where: { id: offerId },
          data: {
            ...common,
            campaignStrategy: updatedStrategy,
            organizationId: user.organizationId,
            events: { create: { type: 'UPDATED', actorUserId: user.id, actorName: user.name, organizationId: user.organizationId } },
          },
          select: { id: true },
        });

        await syncNavigationOfferToOrderInTransaction(tx, offerId, {
          id: user.id,
          name: user.name,
          email: user.email,
        });

        return updatedOffer;
      }

      // Brand new offer creation
      const initialStrategy = {
        targets: input.targets,
        ...(input.presentationSettings ? { presentationSettings: input.presentationSettings } : {}),
        ...(input.dateFrom ? { dateFrom: input.dateFrom } : {}),
        ...(input.dateTo ? { dateTo: input.dateTo } : {}),
      };

      const createdOffer = await tx.offer.create({
        data: {
          ...common,
          campaignStrategy: initialStrategy,
          organizationId: user.organizationId,
          offerType: 'NAVIGATION',
          status: 'DRAFT',
          ...serverOfferAuthor(user),
          navigationOffer: {
            create: {
              organizationId: user.organizationId,
              city: input.city,
              targetName: input.targetName,
              targetAddress: nullable(input.targetAddress),
              targetLatitude: input.targetLatitude,
              targetLongitude: input.targetLongitude,
              targetNote: nullable(input.targetNote),
              targetPhotoUrl: input.targetPhotoUrl,
              googlePlaceId: input.googlePlaceId,
              formattedAddress: input.formattedAddress,
              proposalMode: input.proposalMode,
              graphicArtworkUrl: input.graphicArtworkUrl,
              includeGraphicProof: input.includeGraphicProof,
              clientArtworkUrl: input.clientArtworkUrl,
              clientArtworkFileName: input.clientArtworkFileName,
            },
          },
          events: { create: { type: 'CREATED', toStatus: 'DRAFT', actorUserId: user.id, actorName: user.name, organizationId: user.organizationId } },
        },
        include: { navigationOffer: true },
      });

      const navOfferId = createdOffer.navigationOffer!.id;
      const targetIdMap = new Map<string, string>();
      const targetCoordsMap = new Map<string, string>();

      for (let idx = 0; idx < input.targets.length; idx++) {
        const t = input.targets[idx];
        const stableKey = t.stableKey || randomUUID();
        const createdTarget = await tx.navigationTarget.create({
          data: {
            organizationId: user.organizationId,
            navigationOfferId: navOfferId,
            stableKey,
            name: t.name,
            address: t.address || null,
            latitude: t.latitude,
            longitude: t.longitude,
            note: t.note || null,
            photoUrl: t.photoUrl || null,
            sortOrder: idx,
          },
        });
        targetIdMap.set(t.id, createdTarget.id);
        targetIdMap.set(stableKey, createdTarget.id);
        targetCoordsMap.set(`${t.latitude.toFixed(5)},${t.longitude.toFixed(5)}`, createdTarget.id);
      }

      for (let idx = 0; idx < input.points.length; idx++) {
        const p = input.points[idx];
        let resolvedTargetId: string | null = null;
        if (p.navigationTargetId && targetIdMap.has(p.navigationTargetId)) {
          resolvedTargetId = targetIdMap.get(p.navigationTargetId)!;
        } else if (p.targetLatitude != null && p.targetLongitude != null) {
          const coordsKey = `${p.targetLatitude.toFixed(5)},${p.targetLongitude.toFixed(5)}`;
          resolvedTargetId = targetCoordsMap.get(coordsKey) || null;
        }
        if (!resolvedTargetId && targetIdMap.size > 0) {
          resolvedTargetId = Array.from(targetIdMap.values())[0] || null;
        }

        const { id: _ignoreId, ...pData } = p;
        await tx.navigationPoint.create({
          data: {
            ...pData,
            organizationId: user.organizationId,
            navigationOfferId: navOfferId,
            sortOrder: idx,
            stableKey: p.stableKey || randomUUID(),
            navigationTargetId: resolvedTargetId,
          },
        });
      }

      return { id: createdOffer.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function parseCityGalleryOfferInput(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw new OfferValidationError('Data nabídky nejsou platná.');
  const input = raw as Record<string, unknown>;
  const clientId = boundedText(input.clientId, 'Klient', 80, true);
  const title = boundedText(input.title, 'Název nabídky', 180, true);
  const validUntil = text(input.validUntil); if (validUntil) parseDateOnly(validUntil, 'Platnost nabídky');
  const subtotal = decimal(input.subtotal, 'Cena bez DPH');
  if (subtotal.gt(1_000_000_000)) throw new OfferValidationError('Cena bez DPH je příliš vysoká.');
  const contactEmail = boundedText(input.contactEmail, 'Kontaktní e-mail', 254);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new OfferValidationError('Kontaktní e-mail není platný.');
  const taxAmount = subtotal.mul(21).div(100).toDecimalPlaces(2);
  return {
    clientId,
    title,
    campaignName: boundedText(input.campaignName, 'Název kampaně', 180) || title,
    projectId: boundedText(input.projectId, 'Projekt', 80),
    concept: boundedText(input.concept, 'Koncept projektu', 5000),
    locationBrief: boundedText(input.locationBrief, 'Lokalita projektu', 3000),
    realizationNote: boundedText(input.realizationNote, 'Poznámka k realizaci', 3000),
    internalNote: boundedText(input.internalNote, 'Interní poznámka', 5000),
    clientMessage: boundedText(input.clientMessage, 'Sdělení klientovi', 5000),
    contactPerson: boundedText(input.contactPerson, 'Kontaktní osoba', 180),
    contactEmail,
    contactPhone: boundedText(input.contactPhone, 'Telefon', 80),
    validUntil,
    subtotal,
    taxAmount,
    totalWithTax: subtotal.add(taxAmount).toDecimalPlaces(2),
  };
}

export async function createCityGalleryOffer(user: CurrentUser, raw: unknown) {
  assertRole(user); const input = parseCityGalleryOfferInput(raw);
  if (!user.organizationId) throw new OfferValidationError('Není vybraná aktivní organizace.', 'FORBIDDEN');
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: input.clientId, organizationId: user.organizationId, active: true }, select: { id: true } });
    if (!client) throw new OfferValidationError('Vybraný klient neexistuje nebo není aktivní.');
    if (input.projectId && !await tx.cityGalleryProject.findFirst({ where: { id: input.projectId, organizationId: user.organizationId, status: { not: 'ARCHIVED' } }, select: { id: true } })) throw new OfferValidationError('Projekt Galerie venku nebyl nalezen nebo je archivovaný.');
    return tx.offer.create({ data: { clientId: input.clientId, title: input.title, campaignName: input.campaignName, organizationId: user.organizationId, offerType: 'CITY_GALLERY', status: 'DRAFT', contactPerson: nullable(input.contactPerson), contactEmail: nullable(input.contactEmail), contactPhone: nullable(input.contactPhone), validUntil: input.validUntil ? parseDateOnly(input.validUntil, 'Platnost nabídky') : null, internalNote: nullable(input.internalNote), clientMessage: nullable(input.clientMessage), taxRate: new Prisma.Decimal(21), subtotal: input.subtotal, discountAmount: new Prisma.Decimal(0), taxAmount: input.taxAmount, totalPrice: input.subtotal, totalWithTax: input.totalWithTax, ...serverOfferAuthor(user), cityGalleryOffer: { create: { organizationId: user.organizationId, projectId: input.projectId || null, concept: nullable(input.concept), locationBrief: nullable(input.locationBrief), realizationNote: nullable(input.realizationNote) } }, events: { create: { type: 'CREATED', toStatus: 'DRAFT', actorUserId: user.id, actorName: user.name, organizationId: user.organizationId } } }, select: { id: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateCityGalleryOffer(user: CurrentUser, offerId: string, raw: unknown) {
  assertRole(user); const input = parseCityGalleryOfferInput(raw);
  if (!user.organizationId) throw new OfferValidationError('Není vybraná aktivní organizace.', 'FORBIDDEN');
  return prisma.$transaction(async (tx) => {
    const existing = await tx.offer.findUnique({ where: { id: offerId }, select: { offerType: true, status: true, createdByUserId: true } });
    if (!existing || existing.offerType !== 'CITY_GALLERY') throw new OfferValidationError('Nabídka Galerie venku nebyla nalezena.', 'NOT_FOUND');
    if (!canAccessOffer(user, existing.createdByUserId)) throw new OfferValidationError('K nabídce nemáte přístup.', 'FORBIDDEN');
    if (['CONVERTED', 'ARCHIVED'].includes(existing.status)) throw new OfferValidationError('Převedenou nebo archivovanou nabídku již nelze upravovat.', 'INVALID_STATUS_TRANSITION');
    const client = await tx.client.findFirst({ where: { id: input.clientId, organizationId: user.organizationId, active: true }, select: { id: true } }); if (!client) throw new OfferValidationError('Vybraný klient neexistuje nebo není aktivní.');
    if (input.projectId && !await tx.cityGalleryProject.findFirst({ where: { id: input.projectId, organizationId: user.organizationId, status: { not: 'ARCHIVED' } }, select: { id: true } })) throw new OfferValidationError('Projekt Galerie venku nebyl nalezen nebo je archivovaný.');
    return tx.offer.update({ where: { id: offerId }, data: { clientId: input.clientId, title: input.title, campaignName: input.campaignName, organizationId: user.organizationId, contactPerson: nullable(input.contactPerson), contactEmail: nullable(input.contactEmail), contactPhone: nullable(input.contactPhone), validUntil: input.validUntil ? parseDateOnly(input.validUntil, 'Platnost nabídky') : null, internalNote: nullable(input.internalNote), clientMessage: nullable(input.clientMessage), subtotal: input.subtotal, totalPrice: input.subtotal, taxAmount: input.taxAmount, totalWithTax: input.totalWithTax, updatedByUserId: user.id, cityGalleryOffer: { update: { projectId: input.projectId || null, concept: nullable(input.concept), locationBrief: nullable(input.locationBrief), realizationNote: nullable(input.realizationNote) } }, events: { create: { type: 'UPDATED', actorUserId: user.id, actorName: user.name, organizationId: user.organizationId } } }, select: { id: true } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getSpecializedOfferOptions() {
  const [clients, projects] = await Promise.all([
    prisma.client.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        email: true,
        phone: true,
        branches: {
          where: { active: true },
          select: { id: true, name: true, street: true, city: true, zip: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.cityGalleryProject.findMany({ where: { status: { not: 'ARCHIVED' } }, select: { id: true, title: true, city: true, status: true }, orderBy: { updatedAt: 'desc' } }),
  ]);
  return { clients, projects };
}
