import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { syncWorkOrderTasks } from '../work-task-sync';

/**
 * Synchronizes a NavigationOrder and its planned installation into a central WorkOrder
 * in the Work Plan (/work) so dispatchers and technicians see the field job.
 */
export async function syncNavigationOrderToWorkOrderInTransaction(
  tx: Prisma.TransactionClient,
  navigationOrderId: string
): Promise<{ workOrderId: string } | null> {
  const navOrder = await tx.navigationOrder.findUnique({
    where: { id: navigationOrderId },
    include: {
      crmOrder: {
        include: {
          client: true,
        },
      },
      points: {
        include: {
          carrier: true,
          surface: true,
        },
      },
      installerUser: true,
      workOrders: {
        include: {
          assignments: true,
          items: true,
        },
      },
    },
  });

  if (!navOrder) return null;

  // We only sync to WorkOrder once an installation date/time or status indicates an operational job
  const hasScheduledDate = Boolean(navOrder.plannedInstallationAt || navOrder.installationDate);
  const isInstallationPhase = [
    'PRIPRAVENO_K_INSTALACI',
    'INSTALACE',
    'FOTODOKUMENTACE',
    'PRIPRAVENO_K_FAKTURACI',
    'FAKTUROVANO',
    'DOKONCENO',
  ].includes(navOrder.status);

  if (!hasScheduledDate && !isInstallationPhase) {
    return null;
  }

  const organizationId = navOrder.organizationId;
  const clientName = navOrder.crmOrder?.client?.name || 'Klient';
  const clientId = navOrder.crmOrder?.clientId || null;
  const targetName = navOrder.targetName || 'Cíl navigace';
  const title = `Montáž navigace: ${clientName} – ${targetName}`;
  const scheduledAt = navOrder.plannedInstallationAt || navOrder.installationDate || new Date();
  const workStatus = navOrder.status === 'DOKONCENO' ? 'DONE' : 'PLANNED';
  const description = `Montáž ${navOrder.points.length} navigačních bodů pro cíl ${targetName}.`;
  const locationNote = navOrder.targetAddress || null;

  // Resolve installer workerName and userId
  let assignedUserId: string | null = navOrder.installerUserId || null;
  let workerName: string | null = navOrder.installerUser?.name || null;

  if (!assignedUserId) {
    // Check if any points have an installerUserId
    const pointWithInstaller = navOrder.points.find((p) => p.installerUserId);
    if (pointWithInstaller?.installerUserId) {
      assignedUserId = pointWithInstaller.installerUserId;
      const u = await tx.user.findUnique({ where: { id: assignedUserId }, select: { name: true, email: true } });
      workerName = u?.name || u?.email || null;
    }
  }

  // Also resolve matching Employee if possible
  if (assignedUserId && !workerName) {
    const employee = await tx.employee.findFirst({
      where: { organizationId, userId: assignedUserId, isActive: true },
      select: { firstName: true, lastName: true },
    });
    if (employee) {
      workerName = `${employee.firstName} ${employee.lastName}`.trim();
    }
  }

  // Find existing workOrder linked to this navigationOrderId
  let workOrder = navOrder.workOrders[0] || null;

  if (!workOrder) {
    workOrder = await tx.workOrder.create({
      data: {
        organizationId,
        navigationOrderId: navOrder.id,
        crmOrderId: navOrder.crmOrderId,
        title,
        description,
        status: workStatus,
        priority: 'NORMAL',
        workType: 'INSTALLATION',
        scheduledAt,
        clientId,
        clientName,
        locationNote,
        planningConstraints: { scope: 'FIELD' },
        quantity: navOrder.points.length,
        assignments: workerName
          ? {
              create: [
                {
                  organizationId,
                  userId: assignedUserId,
                  workerName,
                },
              ],
            }
          : undefined,
        items: {
          create: navOrder.points
            .filter((p) => p.carrierId)
            .map((p) => ({
              organizationId,
              carrierId: p.carrierId,
              surfaceId: p.surfaceId,
              quantity: p.quantity || 1,
              description: p.label,
            })),
        },
      },
      include: {
        assignments: true,
        items: true,
      },
    });
  } else {
    // Update existing workOrder
    await tx.workOrder.update({
      where: { id: workOrder.id },
      data: {
        title,
        scheduledAt,
        status: workStatus,
        quantity: navOrder.points.length,
        locationNote,
      },
    });

    // Update assignment if changed and workerName exists
    if (workerName) {
      const existingAssignment = workOrder.assignments.find(
        (a) => (assignedUserId && a.userId === assignedUserId) || a.workerName === workerName
      );
      if (!existingAssignment) {
        await tx.workAssignment.create({
          data: {
            organizationId,
            workOrderId: workOrder.id,
            userId: assignedUserId,
            workerName,
          },
        });
      }
    }

    // Sync items: add carriers not yet present
    const existingCarrierIds = new Set(workOrder.items.map((i) => i.carrierId).filter(Boolean));
    const newPointsWithCarrier = navOrder.points.filter((p) => p.carrierId && !existingCarrierIds.has(p.carrierId));
    for (const p of newPointsWithCarrier) {
      await tx.workOrderItem.create({
        data: {
          organizationId,
          workOrderId: workOrder.id,
          carrierId: p.carrierId,
          surfaceId: p.surfaceId,
          quantity: p.quantity || 1,
          description: p.label,
        },
      });
    }
  }

  // Generate / synchronize work tasks for employees
  await syncWorkOrderTasks(workOrder.id, tx);

  return { workOrderId: workOrder.id };
}

/**
 * Standalone wrapper for syncNavigationOrderToWorkOrder
 */
export async function syncNavigationOrderToWorkOrder(
  navigationOrderId: string
): Promise<{ workOrderId: string } | null> {
  return prisma.$transaction(async (tx) => {
    return syncNavigationOrderToWorkOrderInTransaction(tx, navigationOrderId);
  });
}
