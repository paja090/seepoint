import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { nextCrmOrderNumber } from '@/lib/crm/domain';

export type HandoffActor = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export async function executeNavigationHandoffInTransaction(
  tx: Prisma.TransactionClient,
  offerId: string,
  actor: HandoffActor
) {
  const offer = await tx.offer.findUnique({
    where: { id: offerId },
    include: {
      navigationOffer: {
        include: {
          targets: true,
          points: true,
        },
      },
      crmOrder: {
        include: {
          navigationOrder: {
            include: {
              targets: true,
              points: true,
            },
          },
        },
      },
    },
  });

  if (!offer || offer.offerType !== 'NAVIGATION') {
    throw new Error('Navigační nabídka nebyla nalezena.');
  }

  const organizationId = offer.organizationId;
  const navData = offer.navigationOffer;

  // 1. Locate or create CrmOrder
  let crmOrder = offer.crmOrder;
  if (!crmOrder) {
    const year = new Date().getFullYear();
    const latestOrder = await tx.crmOrder.findFirst({
      where: { organizationId, orderNumber: { startsWith: `ZAK-${year}-` } },
      select: { orderNumber: true },
      orderBy: { orderNumber: 'desc' },
    });
    const orderNumber = nextCrmOrderNumber(year, latestOrder?.orderNumber);

    crmOrder = await tx.crmOrder.create({
      data: {
        organizationId,
        orderNumber,
        clientId: offer.clientId,
        offerId: offer.id,
        assignedUserId: offer.createdByUserId || actor.id,
        title: `Navigační zakázka: ${offer.title}`,
        projectType: 'NAVIGATION',
        status: 'CONFIRMED',
        totalPrice: offer.totalPrice ?? offer.totalWithTax ?? offer.subtotal ?? 0,
        note: offer.note || null,
        internalNote: offer.internalNote || null,
      },
      include: {
        navigationOrder: {
          include: {
            targets: true,
            points: true,
          },
        },
      },
    });
  } else {
    // Update CrmOrder total price if changed
    const currentTotal = offer.totalPrice ?? offer.totalWithTax ?? offer.subtotal ?? 0;
    if (crmOrder.totalPrice == null || Number(crmOrder.totalPrice) !== Number(currentTotal)) {
      crmOrder = await tx.crmOrder.update({
        where: { id: crmOrder.id },
        data: {
          totalPrice: currentTotal,
        },
        include: {
          navigationOrder: {
            include: {
              targets: true,
              points: true,
            },
          },
        },
      });
    }
  }

  // 2. Resolve target metadata
  const offerTargets = navData?.targets || [];
  // If targets are empty on navigationOffer, check campaignStrategy.targets JSON
  if (offerTargets.length === 0 && offer.campaignStrategy && typeof offer.campaignStrategy === 'object') {
    const strategyTargets = (offer.campaignStrategy as { targets?: Array<{ name: string; address?: string; latitude: number; longitude: number; note?: string }> }).targets;
    if (Array.isArray(strategyTargets) && strategyTargets.length > 0) {
      for (let idx = 0; idx < strategyTargets.length; idx++) {
        const st = strategyTargets[idx];
        const createdTarget = await tx.navigationTarget.create({
          data: {
            organizationId,
            navigationOfferId: navData?.id,
            stableKey: randomUUID(),
            name: st.name,
            address: st.address || null,
            latitude: st.latitude,
            longitude: st.longitude,
            note: st.note || null,
            sortOrder: idx,
          },
        });
        offerTargets.push(createdTarget);
      }
    }
  }

  const primaryTarget = offerTargets[0];
  const targetName = primaryTarget?.name || navData?.targetName || offer.title;
  const targetAddress = primaryTarget?.address || navData?.targetAddress || null;
  const targetLatitude = primaryTarget?.latitude || navData?.targetLatitude || 0;
  const targetLongitude = primaryTarget?.longitude || navData?.targetLongitude || 0;
  const targetNote = primaryTarget?.note || navData?.targetNote || null;

  // 3. Locate or create NavigationOrder
  let navOrder = crmOrder.navigationOrder;
  if (!navOrder) {
    navOrder = await tx.navigationOrder.create({
      data: {
        organizationId,
        crmOrderId: crmOrder.id,
        status: 'POTVRZENO_KLIENTEM',
        blockStatus: 'CEKA_NA_OBJEDNAVKU',
        targetName,
        targetAddress,
        targetLatitude,
        targetLongitude,
        targetNote,
      },
      include: {
        targets: true,
        points: true,
      },
    });
  }

  // 4. Propagate / Sync NavigationTargets to NavigationOrder
  const existingOrderTargets = navOrder.targets || [];
  const targetMap = new Map<string, string>(); // offerTargetId / stableKey -> orderTargetId
  const targetCoordsMap = new Map<string, string>(); // "lat,lng" -> orderTargetId

  for (let idx = 0; idx < offerTargets.length; idx++) {
    const ot = offerTargets[idx];
    const matchedOrderTarget = existingOrderTargets.find(
      (eot) =>
        eot.sourceOfferTargetId === ot.id ||
        (ot.stableKey && eot.stableKey === ot.stableKey) ||
        (Math.abs(eot.latitude - ot.latitude) < 0.0001 && Math.abs(eot.longitude - ot.longitude) < 0.0001)
    );

    if (matchedOrderTarget) {
      const updated = await tx.navigationTarget.update({
        where: { id: matchedOrderTarget.id },
        data: {
          sourceOfferTargetId: ot.id,
          stableKey: ot.stableKey,
          name: ot.name,
          address: ot.address,
          latitude: ot.latitude,
          longitude: ot.longitude,
          note: ot.note,
          photoUrl: ot.photoUrl,
          sortOrder: idx,
        },
      });
      targetMap.set(ot.id, updated.id);
      targetMap.set(ot.stableKey, updated.id);
      targetCoordsMap.set(`${ot.latitude.toFixed(5)},${ot.longitude.toFixed(5)}`, updated.id);
    } else {
      const created = await tx.navigationTarget.create({
        data: {
          organizationId,
          navigationOrderId: navOrder.id,
          sourceOfferTargetId: ot.id,
          stableKey: ot.stableKey || randomUUID(),
          name: ot.name,
          address: ot.address,
          latitude: ot.latitude,
          longitude: ot.longitude,
          note: ot.note,
          photoUrl: ot.photoUrl,
          sortOrder: idx,
        },
      });
      targetMap.set(ot.id, created.id);
      targetMap.set(created.stableKey, created.id);
      targetCoordsMap.set(`${ot.latitude.toFixed(5)},${ot.longitude.toFixed(5)}`, created.id);
    }
  }

  // 5. Propagate / Sync NavigationPoints to NavigationOrder
  const existingOrderPoints = navOrder.points || [];
  const selectedOfferPoints = navData?.points?.filter((p) => p.isSelectedByClient !== false) || [];

  for (const p of selectedOfferPoints) {
    const matchedOrderPoint = existingOrderPoints.find(
      (eop) =>
        (p.stableKey && eop.sourceOfferPointKey === p.stableKey) ||
        eop.sourceOfferPointId === p.id ||
        (Math.abs(eop.latitude - p.latitude) < 0.0001 && Math.abs(eop.longitude - p.longitude) < 0.0001)
    );

    // Resolve target for this point
    let resolvedTargetId: string | null = null;
    if (p.navigationTargetId && targetMap.has(p.navigationTargetId)) {
      resolvedTargetId = targetMap.get(p.navigationTargetId)!;
    } else if (p.targetLatitude != null && p.targetLongitude != null) {
      const coordKey = `${p.targetLatitude.toFixed(5)},${p.targetLongitude.toFixed(5)}`;
      resolvedTargetId = targetCoordsMap.get(coordKey) || null;
    }
    if (!resolvedTargetId && targetMap.size > 0) {
      resolvedTargetId = Array.from(targetMap.values())[0] || null;
    }

    if (matchedOrderPoint) {
      // Update existing order point (preserves installedPhotoId, sitePhotoId, carrierId, status)
      await tx.navigationPoint.update({
        where: { id: matchedOrderPoint.id },
        data: {
          sourceOfferPointKey: p.stableKey,
          sourceOfferPointId: p.id,
          navigationTargetId: resolvedTargetId,
          label: p.label,
          latitude: p.latitude,
          longitude: p.longitude,
          address: p.address,
          navigationType: p.navigationType,
          variant: p.variant,
          orientation: p.orientation,
          signOrientation: p.signOrientation,
          roadSide: p.roadSide,
          arrowDirection: p.arrowDirection || (typeof p.arrowDirectionEnum === 'string' ? p.arrowDirectionEnum : null),
          arrowDirectionEnum: p.arrowDirectionEnum || 'STRAIGHT',
          pillarNumber: p.pillarNumber,
          pillarType: p.pillarType,
          distanceValue: p.distanceValue,
          distanceUnit: p.distanceUnit,
          calculatedDistanceMeters: p.calculatedDistanceMeters,
          manualDistanceValue: p.manualDistanceValue,
          manualDistanceUnit: p.manualDistanceUnit,
          distanceSource: p.distanceSource,
          routePolyline: p.routePolyline,
          targetLatitude: p.targetLatitude,
          targetLongitude: p.targetLongitude,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          subtotal: p.subtotal,
          installationPrice: p.installationPrice,
          removalPrice: p.removalPrice,
          productionPrice: p.productionPrice,
          internalNote: p.internalNote,
          clientNote: p.clientNote,
        },
      });
    } else {
      // Create newly added point
      await tx.navigationPoint.create({
        data: {
          organizationId,
          navigationOrderId: navOrder.id,
          navigationTargetId: resolvedTargetId,
          stableKey: randomUUID(),
          sourceOfferPointKey: p.stableKey,
          sourceOfferPointId: p.id,
          carrierId: null,
          sortOrder: p.sortOrder,
          latitude: p.latitude,
          longitude: p.longitude,
          address: p.address,
          label: p.label,
          navigationType: p.navigationType,
          variant: p.variant,
          orientation: p.orientation,
          signOrientation: p.signOrientation,
          roadSide: p.roadSide,
          arrowDirection: p.arrowDirection || (typeof p.arrowDirectionEnum === 'string' ? p.arrowDirectionEnum : null),
          arrowDirectionEnum: p.arrowDirectionEnum || 'STRAIGHT',
          pillarNumber: p.pillarNumber,
          pillarType: p.pillarType,
          distanceValue: p.distanceValue,
          distanceUnit: p.distanceUnit,
          calculatedDistanceMeters: p.calculatedDistanceMeters,
          manualDistanceValue: p.manualDistanceValue,
          manualDistanceUnit: p.manualDistanceUnit,
          distanceSource: p.distanceSource,
          routePolyline: p.routePolyline,
          targetLatitude: p.targetLatitude,
          targetLongitude: p.targetLongitude,
          sitePhotoId: p.sitePhotoId,
          installedPhotoId: p.installedPhotoId,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          subtotal: p.subtotal,
          installationPrice: p.installationPrice,
          removalPrice: p.removalPrice,
          productionPrice: p.productionPrice,
          internalNote: p.internalNote,
          clientNote: p.clientNote,
          status: 'PLANNED',
        },
      });
    }
  }

  // 6. Mark offer ACCEPTED
  await tx.offer.update({
    where: { id: offerId },
    data: { status: 'ACCEPTED', acceptedAt: offer.acceptedAt || new Date() },
  });

  // 7. Audit log
  await tx.crmAuditLog.create({
    data: {
      organizationId,
      userId: actor.id,
      userEmail: actor.email || 'system@seepoint.cz',
      action: 'CONVERT_OFFER_TO_NAVIGATION_ORDER',
      entityType: 'NavigationOrder',
      entityId: navOrder.id,
      detailsJson: JSON.stringify({
        offerId: offer.id,
        orderNumber: crmOrder.orderNumber,
        targetsCount: offerTargets.length,
        pointsCount: selectedOfferPoints.length,
      }),
    },
  });

  return {
    crmOrder,
    navigationOrder: navOrder,
  };
}
