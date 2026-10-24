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
 * Ensures any active ElectionRemovalPoint (from dispatch intake or field campaigns)
 * has a canonical WorkOrder in Plán práce (/work).
 * Idempotent: Skips points that already have a linked WorkOrder.
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
      },
    },
    take: 50,
  });

  if (activeCampaigns.length === 0) return 0;

  // Find all existing work orders linked to an electionRemovalPointId in this org
  const existingLinkedWorkOrders = await tx.workOrder.findMany({
    where: {
      organizationId,
      planningConstraints: { path: ['electionRemovalPointId'], not: Prisma.AnyNull },
    },
    select: {
      id: true,
      status: true,
      planningConstraints: true,
    },
  });

  const existingPointIdToWorkOrder = new Map<string, { id: string; status: string }>();
  for (const wo of existingLinkedWorkOrders) {
    const pId = (wo.planningConstraints as { electionRemovalPointId?: string } | null)?.electionRemovalPointId;
    if (pId) existingPointIdToWorkOrder.set(pId, { id: wo.id, status: wo.status });
  }

  let createdCount = 0;

  for (const campaign of activeCampaigns) {
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

    for (const point of campaign.points) {
      const existing = existingPointIdToWorkOrder.get(point.id);

      if (existing) {
        // If point is COMPLETED but WorkOrder is not DONE, sync status
        if (point.status === 'COMPLETED' && existing.status !== 'DONE') {
          await tx.workOrder.update({
            where: { id: existing.id },
            data: { status: 'DONE' },
          });
          await tx.workTask.updateMany({
            where: { organizationId, workOrderId: existing.id },
            data: { status: 'DONE' },
          });
        }
        continue;
      }

      // Point does not have a WorkOrder yet - create one!
      const targetDate = point.deadlineAt || campaign.targetDate || point.createdAt;
      const workType = mapOperationToWorkType(point.operationType);
      const isCompleted = point.status === 'COMPLETED';
      const woStatus = isCompleted ? 'DONE' : point.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PLANNED';

      const workOrder = await tx.workOrder.create({
        data: {
          organizationId,
          title: point.label,
          description: point.description || `${point.operationType || 'Práce'} – ${point.objectType || point.mediaType || 'Objekt'}`,
          status: woStatus,
          priority: 'NORMAL',
          workType,
          scheduledAt: targetDate,
          deadlineAt: point.deadlineAt || campaign.targetDate,
          clientName: campaign.clientName || 'Běžná zakázka',
          locationNote: point.label,
          mediaLabel: point.objectType || point.mediaType || null,
          quantity: point.quantity,
          estimatedHours: ((point.serviceMinutes || 15) / 60).toFixed(2),
          planningConstraints: {
            electionRemovalPointId: point.id,
            dispatchIntake: true,
            latitude: point.latitude,
            longitude: point.longitude,
            scope: 'FIELD',
          },
          referenceUrl: point.referenceUrl || null,
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

      await syncWorkOrderTasks(workOrder.id, tx);
      existingPointIdToWorkOrder.set(point.id, { id: workOrder.id, status: woStatus });
      createdCount++;
    }
  }

  return createdCount;
}
