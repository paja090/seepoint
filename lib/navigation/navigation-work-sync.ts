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
  const existingWorkOrder = navOrder.workOrders[0] || null;
  let workOrderId: string;

  if (!existingWorkOrder) {
    const created = await tx.workOrder.create({
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
          create: navOrder.points.map((p) => ({
            organizationId,
            carrierId: p.carrierId || null,
            surfaceId: p.surfaceId || null,
            quantity: Number(p.quantity) || 1,
            description: p.pillarNumber ? `Sloup VO ${p.pillarNumber} · ${p.label}` : p.label,
          })),
        },
      },
    });
    workOrderId = created.id;
  } else {
    workOrderId = existingWorkOrder.id;
    // Update existing workOrder
    await tx.workOrder.update({
      where: { id: existingWorkOrder.id },
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
      const existingAssignment = existingWorkOrder.assignments.find(
        (a) => (assignedUserId && a.userId === assignedUserId) || a.workerName === workerName
      );
      if (!existingAssignment) {
        await tx.workAssignment.create({
          data: {
            organizationId,
            workOrderId: existingWorkOrder.id,
            userId: assignedUserId,
            workerName,
          },
        });
      }
    }

    // Sync items: add items for points not yet present in existingWorkOrder.items
    const existingDescriptions = new Set(existingWorkOrder.items.map((i) => i.description).filter(Boolean));
    const existingCarrierIds = new Set(existingWorkOrder.items.map((i) => i.carrierId).filter(Boolean));
    const newPoints = navOrder.points.filter((p) => {
      if (p.carrierId && existingCarrierIds.has(p.carrierId)) return false;
      const desc = p.pillarNumber ? `Sloup VO ${p.pillarNumber} · ${p.label}` : p.label;
      if (existingDescriptions.has(desc) || existingDescriptions.has(p.label)) return false;
      return true;
    });
    for (const p of newPoints) {
      await tx.workOrderItem.create({
        data: {
          organizationId,
          workOrderId: existingWorkOrder.id,
          carrierId: p.carrierId || null,
          surfaceId: p.surfaceId || null,
          quantity: Number(p.quantity) || 1,
          description: p.pillarNumber ? `Sloup VO ${p.pillarNumber} · ${p.label}` : p.label,
        },
      });
    }

    // Link carriers to existing items that missed them
    for (const item of existingWorkOrder.items) {
      if (!item.carrierId) {
        const matchedPoint = navOrder.points.find(
          (p) => (p.label === item.description || (p.pillarNumber && item.description?.includes(p.pillarNumber))) && p.carrierId
        );
        if (matchedPoint?.carrierId) {
          await tx.workOrderItem.update({
            where: { id: item.id },
            data: {
              carrierId: matchedPoint.carrierId,
              surfaceId: matchedPoint.surfaceId,
            },
          });
        }
      }
    }
  }

  // Generate / synchronize work tasks for employees
  await syncWorkOrderTasks(workOrderId, tx);

  return { workOrderId };
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
