import { Prisma, type WorkType } from '@prisma/client';
import { syncWorkOrderTasks } from '../work-task-sync';

function mapOperationToWorkType(operationType: string | null | undefined): WorkType {
  switch (operationType) {
    case 'INSTALL_OBJECT':
    case 'INSTALL_AD':
      return 'INSTALLATION';
    case 'REPLACE_AD':
      return 'REINSTALLATION';
    case 'REMOVE_OBJECT':
    case 'REMOVE_AD':
      return 'DEINSTALLATION';
    case 'REPAIR':
      return 'REPAIR';
    case 'INSPECTION':
      return 'CHECK';
    case 'RELOCATION':
      return 'TRANSPORT';
    default:
      return 'OTHER';
  }
}

/**
 * Ensures active dispatch intake campaigns (ElectionCampaign) are consolidated
 * into a single canonical WorkOrder in Plán práce (/work) with itemized points,
 * rather than creating multiple duplicate individual cards for each point.
 * Also cleans up any previously generated per-point duplicate WorkOrders.
 */
export async function syncUnlinkedDispatchPointsInTransaction(
  tx: Prisma.TransactionClient,
  organizationId: string
): Promise<number> {
  // Find active campaigns that are not archived or cancelled
  const activeCampaigns = await tx.electionCampaign.findMany({
    where: {
      organizationId,
      status: { notIn: ['ARCHIVED', 'CANCELLED'] },
    },
    select: {
      id: true,
      name: true,
      clientName: true,
      targetDate: true,
      mediaDefaults: true,
      points: {
        where: {
          status: { notIn: ['CANCELLED'] },
        },
        select: {
          id: true,
          label: true,
          description: true,
          operationType: true,
          objectType: true,
          mediaType: true,
          quantity: true,
          serviceMinutes: true,
          latitude: true,
          longitude: true,
          deadlineAt: true,
          status: true,
          referenceUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    take: 50,
  });

  if (activeCampaigns.length === 0) return 0;

  // 1. Clean up any legacy per-point WorkOrders created previously by dispatch intake
  // so they do not duplicate the unified campaign WorkOrder.
  const pointIdsInActiveCampaigns = new Set(
    activeCampaigns.flatMap((c) => c.points.map((p) => p.id))
  );

  const legacyPerPointOrders = await tx.workOrder.findMany({
    where: {
      organizationId,
      planningConstraints: {
        path: ['dispatchIntake'],
        equals: true,
      },
    },
    select: {
      id: true,
      planningConstraints: true,
    },
  });

  const ordersToDelete = legacyPerPointOrders.filter((wo) => {
    const pId = (wo.planningConstraints as { electionRemovalPointId?: string } | null)?.electionRemovalPointId;
    return pId && pointIdsInActiveCampaigns.has(pId);
  });

  if (ordersToDelete.length > 0) {
    const idsToDelete = ordersToDelete.map((o) => o.id);
    await tx.workTask.deleteMany({
      where: { organizationId, workOrderId: { in: idsToDelete } },
    });
    await tx.workAssignment.deleteMany({
      where: { organizationId, workOrderId: { in: idsToDelete } },
    });
    await tx.workOrderItem.deleteMany({
      where: { organizationId, workOrderId: { in: idsToDelete } },
    });
    await tx.workOrder.deleteMany({
      where: { organizationId, id: { in: idsToDelete } },
    });
  }

  // 2. Find existing consolidated campaign WorkOrders
  const existingCampaignWorkOrders = await tx.workOrder.findMany({
    where: {
      organizationId,
      planningConstraints: {
        path: ['electionCampaignId'],
        not: Prisma.AnyNull,
      },
    },
    select: {
      id: true,
      status: true,
      planningConstraints: true,
      assignments: { select: { id: true, userId: true, workerName: true } },
    },
  });

  const campaignIdToWorkOrder = new Map<string, { id: string; status: string; assignments: Array<{ userId: string | null; workerName: string }> }>();
  for (const wo of existingCampaignWorkOrders) {
    const cId = (wo.planningConstraints as { electionCampaignId?: string } | null)?.electionCampaignId;
    if (cId) campaignIdToWorkOrder.set(cId, wo);
  }

  let createdCount = 0;

  for (const campaign of activeCampaigns) {
    if (campaign.points.length === 0) continue;

    const points = campaign.points;
    const totalQuantity = points.reduce((acc, p) => acc + (p.quantity || 1), 0);
    const totalMinutes = points.reduce((acc, p) => acc + (p.serviceMinutes || 25), 0);
    const estimatedHours = (totalMinutes / 60).toFixed(2);

    const allCompleted = points.every((p) => p.status === 'COMPLETED');
    const anyStarted = points.some((p) => p.status === 'IN_PROGRESS' || p.status === 'COMPLETED');
    const targetStatus = allCompleted ? 'DONE' : anyStarted ? 'IN_PROGRESS' : 'PLANNED';

    const primaryOperation = points[0]?.operationType || 'INSTALL_OBJECT';
    const workType = mapOperationToWorkType(primaryOperation);

    const objectType =
      points.find((p) => p.objectType)?.objectType ||
      points.find((p) => p.mediaType)?.mediaType ||
      'Objekt';
    const mediaLabel = `${objectType} (${totalQuantity} ks)`;

    const targetDate = campaign.targetDate || points[0]?.deadlineAt || points[0]?.createdAt || new Date();
    const deadlineAt = campaign.targetDate || points[0]?.deadlineAt || null;
    const clientName = campaign.clientName || 'Běžná zakázka';

    const locationSummary =
      points.length === 1
        ? points[0].label
        : `${points.length} lokací: ${points.slice(0, 3).map((p) => p.label).join(', ')}${
            points.length > 3 ? ' a další' : ''
          }`;

    const description = [
      `Zakázka z dispečinku: ${campaign.name}`,
      `Klient: ${clientName}`,
      `Typ objektu: ${objectType}`,
      `Celkem bodů k realizaci: ${points.length} ks (odhad celkem: ${estimatedHours} hod)`,
      '',
      'Seznam lokací k instalaci:',
      ...points.map(
        (p, idx) =>
          `${idx + 1}. ${p.label}${p.description ? ` (${p.description})` : ''} – ${p.quantity || 1} ks (${p.serviceMinutes || 25} min)`
      ),
    ].join('\n');

    const pointIds = points.map((p) => p.id);

    const mediaDefaults = campaign.mediaDefaults as {
      preferredEmployeeId?: string | null;
    } | null;
    const preferredEmployeeId = mediaDefaults?.preferredEmployeeId || null;

    let preferredEmployee: { id: string; firstName: string; lastName: string; userId: string | null } | null = null;
    if (preferredEmployeeId) {
      preferredEmployee = await tx.employee.findUnique({
        where: { id: preferredEmployeeId },
        select: { id: true, firstName: true, lastName: true, userId: true },
      });
    }

    const existing = campaignIdToWorkOrder.get(campaign.id);

    if (existing) {
      // Update existing consolidated WorkOrder to reflect current points/status
      await tx.workOrder.update({
        where: { id: existing.id },
        data: {
          status: targetStatus,
          quantity: totalQuantity,
          estimatedHours,
          mediaLabel,
          locationNote: locationSummary,
          description,
          planningConstraints: {
            electionCampaignId: campaign.id,
            pointIds,
            dispatchCampaign: true,
            scope: 'FIELD',
          },
        },
      });

      // Synchronize WorkOrderItems for all points
      const existingItems = await tx.workOrderItem.findMany({
        where: { organizationId, workOrderId: existing.id },
        select: { id: true, description: true },
      });
      const existingDescs = new Set(existingItems.map((i) => i.description));

      for (const point of points) {
        const itemDesc = `${point.label}${point.description ? ` – ${point.description}` : ''}`;
        if (!existingDescs.has(itemDesc)) {
          await tx.workOrderItem.create({
            data: {
              organizationId,
              workOrderId: existing.id,
              description: itemDesc,
              quantity: point.quantity || 1,
              estimatedMinutes: point.serviceMinutes || 25,
              executionStatus:
                point.status === 'COMPLETED'
                  ? 'DONE'
                  : point.status === 'IN_PROGRESS'
                  ? 'IN_PROGRESS'
                  : 'PLANNED',
            },
          });
        }
      }

      if (preferredEmployee && (!existing.assignments || existing.assignments.length === 0)) {
        await tx.workAssignment.create({
          data: {
            organizationId,
            workOrderId: existing.id,
            userId: preferredEmployee.userId,
            workerName: `${preferredEmployee.firstName} ${preferredEmployee.lastName}`.trim(),
          },
        });
      }

      await syncWorkOrderTasks(existing.id, tx);
      continue;
    }

    // Create a new consolidated WorkOrder for the campaign
    const workOrder = await tx.workOrder.create({
      data: {
        organizationId,
        title: campaign.name,
        description,
        status: targetStatus,
        priority: 'NORMAL',
        workType,
        scheduledAt: targetDate,
        deadlineAt,
        clientName,
        locationNote: locationSummary,
        mediaLabel,
        quantity: totalQuantity,
        estimatedHours,
        planningConstraints: {
          electionCampaignId: campaign.id,
          pointIds,
          dispatchCampaign: true,
          scope: 'FIELD',
        },
      },
    });

    if (preferredEmployee) {
      await tx.workAssignment.create({
        data: {
          organizationId,
          workOrderId: workOrder.id,
          userId: preferredEmployee.userId,
          workerName: `${preferredEmployee.firstName} ${preferredEmployee.lastName}`.trim(),
        },
      });
    }

    for (const point of points) {
      const itemDesc = `${point.label}${point.description ? ` – ${point.description}` : ''}`;
      await tx.workOrderItem.create({
        data: {
          organizationId,
          workOrderId: workOrder.id,
          description: itemDesc,
          quantity: point.quantity || 1,
          estimatedMinutes: point.serviceMinutes || 25,
          executionStatus:
            point.status === 'COMPLETED'
              ? 'DONE'
              : point.status === 'IN_PROGRESS'
              ? 'IN_PROGRESS'
              : 'PLANNED',
        },
      });
    }

    await syncWorkOrderTasks(workOrder.id, tx);
    campaignIdToWorkOrder.set(campaign.id, {
      id: workOrder.id,
      status: targetStatus,
      assignments: preferredEmployee
        ? [{ userId: preferredEmployee.userId, workerName: `${preferredEmployee.firstName} ${preferredEmployee.lastName}`.trim() }]
        : [],
    });
    createdCount++;
  }

  return createdCount;
}
