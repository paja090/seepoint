import { Prisma } from '@prisma/client';
import { syncWorkOrderTasks } from '../work-task-sync';

/**
 * Synchronizes a CrmOrder and its CrmRealizations into a central WorkOrder
 * in the Work Plan (/work) and dispatch queue so technicians and dispatchers
 * see the real operational jobs and can take photo documentation.
 */
export async function syncCrmOrderToWorkOrderInTransaction(
  tx: Prisma.TransactionClient,
  crmOrderId: string
): Promise<{ workOrderId: string } | null> {
  const crmOrder = await tx.crmOrder.findUnique({
    where: { id: crmOrderId },
    include: {
      client: true,
      realizations: {
        include: {
          surface: { include: { carrier: true } },
          carrier: true,
          workOrderItem: true,
        },
      },
      workOrders: {
        include: {
          assignments: true,
          items: true,
        },
      },
      offer: {
        include: {
          client: true,
          items: {
            include: {
              surface: { include: { carrier: true } },
            },
          },
        },
      },
    },
  });

  if (!crmOrder || crmOrder.realizations.length === 0) {
    return null;
  }

  const organizationId = crmOrder.organizationId;
  const clientName = crmOrder.client?.name || crmOrder.offer?.client?.name || 'Klient';
  const clientId = crmOrder.clientId || crmOrder.offer?.clientId || null;
  const rawTitle = crmOrder.title.replace(/^Zakázka:\s*/i, '').trim();
  const title = `Montáž: ${rawTitle || clientName}`;
  const scheduledAt = crmOrder.dateFrom || crmOrder.offer?.items[0]?.dateFrom || crmOrder.realizations[0]?.plannedDate || new Date();
  const deadlineAt = crmOrder.dateTo || crmOrder.offer?.items[0]?.dateTo || null;
  const description = crmOrder.note || `Realizace zakázky ${crmOrder.orderNumber} pro klienta ${clientName}. Počet ploch: ${crmOrder.realizations.length}.`;

  // Find or create WorkOrder linked to this crmOrderId
  let workOrder = crmOrder.workOrders[0] || null;

  if (!workOrder) {
    workOrder = await tx.workOrder.create({
      data: {
        organizationId,
        crmOrderId: crmOrder.id,
        title,
        description,
        status: 'PLANNED',
        workType: 'INSTALLATION',
        priority: 'NORMAL',
        scheduledAt,
        deadlineAt,
        campaignDateFrom: crmOrder.dateFrom || null,
        campaignDateTo: crmOrder.dateTo || null,
        clientId,
        clientName,
        price: crmOrder.totalPrice,
        planningConstraints: {
          scope: 'FIELD',
          crmOrderId: crmOrder.id,
        },
      },
      include: {
        assignments: true,
        items: true,
      },
    });
  }

  // Ensure each realization is linked to the workOrder and has a WorkOrderItem
  for (const realization of crmOrder.realizations) {
    if (realization.workOrderId !== workOrder.id) {
      await tx.crmRealization.update({
        where: { id: realization.id },
        data: { workOrderId: workOrder.id },
      });
    }

    const carrierId = realization.carrierId || realization.surface?.carrierId || null;
    const surfaceId = realization.surfaceId || null;
    const itemDescription = realization.surface?.name || realization.note || 'Realizační plocha';

    let item = realization.workOrderItem;
    if (!item) {
      item = await tx.workOrderItem.findFirst({
        where: { organizationId, crmRealizationId: realization.id },
      });
    }

    if (!item) {
      await tx.workOrderItem.create({
        data: {
          organizationId,
          workOrderId: workOrder.id,
          carrierId,
          surfaceId,
          crmRealizationId: realization.id,
          description: itemDescription,
          quantity: 1,
          executionStatus: 'PLANNED',
        },
      });
    } else if (item.workOrderId !== workOrder.id) {
      await tx.workOrderItem.update({
        where: { id: item.id },
        data: { workOrderId: workOrder.id },
      });
    }
  }

  // Assign user if crmOrder has assignedUserId and no assignment exists yet
  if (crmOrder.assignedUserId) {
    const existingAssignment = workOrder.assignments.find((a) => a.userId === crmOrder.assignedUserId);
    if (!existingAssignment) {
      const user = await tx.user.findUnique({
        where: { id: crmOrder.assignedUserId },
        select: { name: true, email: true },
      });
      const workerName = user?.name || user?.email || 'Realizátor';

      await tx.workAssignment.create({
        data: {
          organizationId,
          workOrderId: workOrder.id,
          userId: crmOrder.assignedUserId,
          workerName,
        },
      });
    }
  }

  await syncWorkOrderTasks(workOrder.id, tx);

  return { workOrderId: workOrder.id };
}
