import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { executeNavigationHandoffInTransaction, type HandoffActor } from './adapters/navigation-handoff-adapter';

export const SAFE_NAVIGATION_SYNC_STATUSES = [
  'POPTAVKA',
  'NABIDKA',
  'POTVRZENO_KLIENTEM',
  'SMLOUVA_OBJEDNAVKA',
  'GRAFICKE_PODKLADY',
  'SCHVALENI_GRAFIKY',
];

export interface NavigationDiffResult {
  hasChanges: boolean;
  addedTargets: Array<{ name: string; latitude: number; longitude: number }>;
  removedTargets: Array<{ id: string; name: string }>;
  modifiedTargets: Array<{ id: string; name: string; changes: Record<string, { from?: unknown; to?: unknown }> }>;
  addedPoints: Array<{ label: string; latitude: number; longitude: number; unitPrice?: unknown }>;
  removedPoints: Array<{ id: string; label: string; status: string }>;
  modifiedPoints: Array<{ id: string; label: string; changes: Record<string, { from?: unknown; to?: unknown }> }>;
}

export function computeNavigationDiff(
  offerTargets: Array<{ id: string; stableKey?: string | null; name: string; latitude: number; longitude: number; address?: string | null }>,
  orderTargets: Array<{ id: string; sourceOfferTargetId?: string | null; stableKey?: string | null; name: string; latitude: number; longitude: number; address?: string | null }>,
  offerPoints: Array<{ id: string; stableKey?: string | null; label: string; latitude: number; longitude: number; unitPrice?: unknown; subtotal?: unknown }>,
  orderPoints: Array<{ id: string; sourceOfferPointKey?: string | null; sourceOfferPointId?: string | null; label: string; latitude: number; longitude: number; status: string; unitPrice?: unknown }>
): NavigationDiffResult {
  const addedTargets: NavigationDiffResult['addedTargets'] = [];
  const removedTargets: NavigationDiffResult['removedTargets'] = [];
  const modifiedTargets: NavigationDiffResult['modifiedTargets'] = [];

  for (const ot of offerTargets) {
    const matched = orderTargets.find(
      (eot) => eot.sourceOfferTargetId === ot.id || (ot.stableKey && eot.stableKey === ot.stableKey)
    );
    if (!matched) {
      addedTargets.push({ name: ot.name, latitude: ot.latitude, longitude: ot.longitude });
    } else {
      const changes: Record<string, { from?: unknown; to?: unknown }> = {};
      if (matched.name !== ot.name) changes.name = { from: matched.name, to: ot.name };
      if (Math.abs(matched.latitude - ot.latitude) > 0.0001) changes.latitude = { from: matched.latitude, to: ot.latitude };
      if (Math.abs(matched.longitude - ot.longitude) > 0.0001) changes.longitude = { from: matched.longitude, to: ot.longitude };
      if (Object.keys(changes).length > 0) {
        modifiedTargets.push({ id: matched.id, name: ot.name, changes });
      }
    }
  }

  for (const eot of orderTargets) {
    if (eot.sourceOfferTargetId && !offerTargets.some((ot) => ot.id === eot.sourceOfferTargetId)) {
      removedTargets.push({ id: eot.id, name: eot.name });
    }
  }

  const addedPoints: NavigationDiffResult['addedPoints'] = [];
  const removedPoints: NavigationDiffResult['removedPoints'] = [];
  const modifiedPoints: NavigationDiffResult['modifiedPoints'] = [];

  for (const op of offerPoints) {
    const matched = orderPoints.find(
      (eop) =>
        (op.stableKey && eop.sourceOfferPointKey === op.stableKey) ||
        eop.sourceOfferPointId === op.id ||
        (Math.abs(eop.latitude - op.latitude) < 0.0001 && Math.abs(eop.longitude - op.longitude) < 0.0001)
    );
    if (!matched) {
      addedPoints.push({ label: op.label, latitude: op.latitude, longitude: op.longitude, unitPrice: op.unitPrice });
    } else {
      const changes: Record<string, { from?: unknown; to?: unknown }> = {};
      if (matched.label !== op.label) changes.label = { from: matched.label, to: op.label };
      if (Math.abs(matched.latitude - op.latitude) > 0.0001) changes.latitude = { from: matched.latitude, to: op.latitude };
      if (Math.abs(matched.longitude - op.longitude) > 0.0001) changes.longitude = { from: matched.longitude, to: op.longitude };
      if (Number(matched.unitPrice || 0) !== Number(op.unitPrice || 0)) {
        changes.unitPrice = { from: matched.unitPrice, to: op.unitPrice };
      }
      if (Object.keys(changes).length > 0) {
        modifiedPoints.push({ id: matched.id, label: op.label, changes });
      }
    }
  }

  for (const eop of orderPoints) {
    const isPresentInOffer = offerPoints.some(
      (op) =>
        (eop.sourceOfferPointKey && op.stableKey === eop.sourceOfferPointKey) ||
        (eop.sourceOfferPointId && op.id === eop.sourceOfferPointId) ||
        (Math.abs(op.latitude - eop.latitude) < 0.0001 && Math.abs(op.longitude - eop.longitude) < 0.0001)
    );
    if (!isPresentInOffer) {
      removedPoints.push({ id: eop.id, label: eop.label, status: eop.status });
    }
  }

  const hasChanges =
    addedTargets.length > 0 ||
    removedTargets.length > 0 ||
    modifiedTargets.length > 0 ||
    addedPoints.length > 0 ||
    removedPoints.length > 0 ||
    modifiedPoints.length > 0;

  return {
    hasChanges,
    addedTargets,
    removedTargets,
    modifiedTargets,
    addedPoints,
    removedPoints,
    modifiedPoints,
  };
}

export async function syncNavigationOfferToOrderInTransaction(
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

  if (!offer || offer.offerType !== 'NAVIGATION') return null;
  const navOrder = offer.crmOrder?.navigationOrder;
  if (!navOrder) return null;

  const isSafePhase = SAFE_NAVIGATION_SYNC_STATUSES.includes(navOrder.status);

  if (isSafePhase) {
    // Direct in-place synchronization
    const result = await executeNavigationHandoffInTransaction(tx, offerId, actor);

    // Remove uninstalled points that were deleted from offer
    const offerPoints = offer.navigationOffer?.points || [];
    const validOfferKeys = new Set(offerPoints.map((p) => p.stableKey).filter(Boolean));
    const validOfferIds = new Set(offerPoints.map((p) => p.id));

    for (const op of navOrder.points) {
      const isStillInOffer =
        (op.sourceOfferPointKey && validOfferKeys.has(op.sourceOfferPointKey)) ||
        (op.sourceOfferPointId && validOfferIds.has(op.sourceOfferPointId));

      if (!isStillInOffer && op.status === 'PLANNED' && !op.installedPhotoId) {
        await tx.navigationPoint.delete({ where: { id: op.id } }).catch(() => null);
      }
    }

    return { type: 'DIRECT_SYNC', navOrder: result.navigationOrder };
  }

  // Freeze phase: compute persistent change set
  const offerTargets = offer.navigationOffer?.targets || [];
  const orderTargets = navOrder.targets || [];
  const offerPoints = (offer.navigationOffer?.points || []).filter((p) => p.isSelectedByClient !== false);
  const orderPoints = navOrder.points || [];

  const diff = computeNavigationDiff(offerTargets, orderTargets, offerPoints, orderPoints);

  if (diff.hasChanges) {
    // Supersede any existing pending changesets for this order
    await tx.navigationChangeSet.updateMany({
      where: {
        navigationOrderId: navOrder.id,
        status: 'PENDING',
      },
      data: {
        status: 'SUPERSEDED',
      },
    });

    const changeSet = await tx.navigationChangeSet.create({
      data: {
        organizationId: offer.organizationId,
        offerId: offer.id,
        crmOrderId: offer.crmOrder!.id,
        navigationOrderId: navOrder.id,
        status: 'PENDING',
        diff: diff as unknown as Prisma.InputJsonValue,
      },
    });

    return { type: 'CHANGESET_CREATED', changeSet };
  }

  return { type: 'NO_CHANGES' };
}

export async function applyNavigationChangeSetInTransaction(
  tx: Prisma.TransactionClient,
  changeSetId: string,
  actor: HandoffActor
) {
  const changeSet = await tx.navigationChangeSet.findUnique({
    where: { id: changeSetId },
  });

  if (!changeSet || changeSet.status !== 'PENDING') {
    throw new Error('Změnový balíček nebyl nalezen nebo již není ve stavu PENDING.');
  }

  // Execute sync
  const result = await executeNavigationHandoffInTransaction(tx, changeSet.offerId, actor);

  // Mark changeset APPLIED
  await tx.navigationChangeSet.update({
    where: { id: changeSetId },
    data: {
      status: 'APPLIED',
      appliedAt: new Date(),
      reviewedAt: new Date(),
      reviewedByUserId: actor.id,
    },
  });

  return result;
}

export async function rejectNavigationChangeSetInTransaction(
  tx: Prisma.TransactionClient,
  changeSetId: string
) {
  return tx.navigationChangeSet.update({
    where: { id: changeSetId },
    data: {
      status: 'REJECTED',
    },
  });
}

/**
 * Generic reconciler to repair navigation orders that missed targets or points
 * due to previous partial syncs or legacy migrations.
 */
export async function reconcileNavigationOrderFromOffer(
  offerId: string,
  options: { dryRun?: boolean; actor?: HandoffActor } = {}
) {
  const dryRun = options.dryRun !== false; // defaults to true for safety

  const offer = await prisma.offer.findUnique({
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
    throw new Error(`Nabídka ${offerId} nebyla nalezena nebo není navigační.`);
  }

  const navOrder = offer.crmOrder?.navigationOrder;
  if (!navOrder) {
    throw new Error(`K nabídce ${offerId} neexistuje NavigationOrder.`);
  }

  const organizationId = offer.organizationId;
  const navData = offer.navigationOffer;

  // Resolve offer targets (from navigationOffer.targets or fallback to campaignStrategy.targets)
  let offerTargets = navData?.targets ? [...navData.targets] : [];
  if (offerTargets.length === 0 && offer.campaignStrategy && typeof offer.campaignStrategy === 'object') {
    const stTargets = (offer.campaignStrategy as { targets?: Array<{ name: string; address?: string; latitude: number; longitude: number; note?: string }> }).targets;
    if (Array.isArray(stTargets)) {
      offerTargets = stTargets.map((st, idx) => ({
        id: `virtual-${idx}`,
        organizationId,
        navigationOfferId: navData?.id || null,
        navigationOrderId: null,
        sourceOfferTargetId: null,
        stableKey: `st-${idx}`,
        name: st.name,
        address: st.address || null,
        latitude: st.latitude,
        longitude: st.longitude,
        note: st.note || null,
        photoUrl: null,
        color: null,
        sortOrder: idx,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }
  }

  const orderTargets = navOrder.targets || [];
  const targetsToCreate: Array<typeof offerTargets[number]> = [];
  const targetsToUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const ot of offerTargets) {
    const matched = orderTargets.find(
      (eot) =>
        eot.sourceOfferTargetId === ot.id ||
        (ot.stableKey && eot.stableKey === ot.stableKey) ||
        (Math.abs(eot.latitude - ot.latitude) < 0.0001 && Math.abs(eot.longitude - ot.longitude) < 0.0001)
    );
    if (!matched) {
      targetsToCreate.push(ot);
    } else {
      targetsToUpdate.push({
        id: matched.id,
        data: {
          name: ot.name,
          address: ot.address,
          latitude: ot.latitude,
          longitude: ot.longitude,
          sourceOfferTargetId: ot.id.startsWith('virtual-') ? null : ot.id,
          stableKey: ot.stableKey,
        },
      });
    }
  }

  const offerPoints = (navData?.points || []).filter((p) => p.isSelectedByClient !== false);
  const orderPoints = navOrder.points || [];

  const pointsToCreate: Array<typeof offerPoints[number]> = [];
  const pointsToUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const op of offerPoints) {
    const matched = orderPoints.find(
      (eop) =>
        (op.stableKey && eop.sourceOfferPointKey === op.stableKey) ||
        eop.sourceOfferPointId === op.id ||
        (Math.abs(eop.latitude - op.latitude) < 0.0001 && Math.abs(eop.longitude - op.longitude) < 0.0001)
    );

    if (!matched) {
      pointsToCreate.push(op);
    } else {
      pointsToUpdate.push({
        id: matched.id,
        data: {
          sourceOfferPointKey: op.stableKey,
          sourceOfferPointId: op.id,
          label: op.label,
          targetLatitude: op.targetLatitude,
          targetLongitude: op.targetLongitude,
          unitPrice: op.unitPrice,
          subtotal: op.subtotal,
        },
      });
    }
  }

  const report = {
    dryRun,
    offerId,
    orderId: navOrder.id,
    orderNumber: offer.crmOrder?.orderNumber,
    targetsToCreateCount: targetsToCreate.length,
    targetsToCreate: targetsToCreate.map((t) => ({ name: t.name, lat: t.latitude, lng: t.longitude })),
    targetsToUpdateCount: targetsToUpdate.length,
    pointsToCreateCount: pointsToCreate.length,
    pointsToCreate: pointsToCreate.map((p) => ({ label: p.label, lat: p.latitude, lng: p.longitude, targetLat: p.targetLatitude })),
    pointsToUpdateCount: pointsToUpdate.length,
    unchangedPointsCount: orderPoints.length - pointsToUpdate.length,
  };

  if (!dryRun) {
    await prisma.$transaction(async (tx) => {
      // 1. Ensure offer targets exist in DB if they were virtual
      const targetMap = new Map<string, string>(); // coords "lat,lng" -> orderTargetId
      for (const t of targetsToUpdate) {
        const updated = await tx.navigationTarget.update({
          where: { id: t.id },
          data: t.data,
        });
        targetMap.set(`${updated.latitude.toFixed(5)},${updated.longitude.toFixed(5)}`, updated.id);
      }

      for (const t of targetsToCreate) {
        const created = await tx.navigationTarget.create({
          data: {
            organizationId,
            navigationOrderId: navOrder.id,
            sourceOfferTargetId: t.id.startsWith('virtual-') ? null : t.id,
            stableKey: t.stableKey || randomUUID(),
            name: t.name,
            address: t.address || null,
            latitude: t.latitude,
            longitude: t.longitude,
            note: t.note || null,
            sortOrder: t.sortOrder,
          },
        });
        targetMap.set(`${created.latitude.toFixed(5)},${created.longitude.toFixed(5)}`, created.id);
      }

      // Also index already existing unchanged targets
      for (const eot of orderTargets) {
        targetMap.set(`${eot.latitude.toFixed(5)},${eot.longitude.toFixed(5)}`, eot.id);
      }

      // 2. Update existing points with link keys and resolved target
      for (const p of pointsToUpdate) {
        const pointData = p.data;
        const targetCoordKey = pointData.targetLatitude != null && pointData.targetLongitude != null
          ? `${Number(pointData.targetLatitude).toFixed(5)},${Number(pointData.targetLongitude).toFixed(5)}`
          : null;
        const resolvedTargetId = targetCoordKey ? targetMap.get(targetCoordKey) || null : null;

        await tx.navigationPoint.update({
          where: { id: p.id },
          data: {
            ...pointData,
            navigationTargetId: resolvedTargetId,
          },
        });
      }

      // 3. Create missing points
      for (const p of pointsToCreate) {
        const targetCoordKey = p.targetLatitude != null && p.targetLongitude != null
          ? `${Number(p.targetLatitude).toFixed(5)},${Number(p.targetLongitude).toFixed(5)}`
          : null;
        let resolvedTargetId = targetCoordKey ? targetMap.get(targetCoordKey) || null : null;
        if (!resolvedTargetId && targetMap.size > 0) {
          resolvedTargetId = Array.from(targetMap.values())[0] || null;
        }

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

      // Update CrmOrder total price to match offer total
      if (offer.crmOrder && offer.totalPrice != null) {
        await tx.crmOrder.update({
          where: { id: offer.crmOrder.id },
          data: {
            totalPrice: offer.totalPrice,
          },
        });
      }

      // Audit log
      await tx.crmAuditLog.create({
        data: {
          organizationId,
          userId: options.actor?.id || 'system',
          userEmail: options.actor?.email || 'system@seepoint.cz',
          action: 'RECONCILE_NAVIGATION_ORDER_FROM_OFFER',
          entityType: 'NavigationOrder',
          entityId: navOrder.id,
          detailsJson: JSON.stringify({
            offerId,
            targetsAdded: targetsToCreate.length,
            pointsAdded: pointsToCreate.length,
            pointsUpdated: pointsToUpdate.length,
          }),
        },
      });
    });
  }

  return report;
}
