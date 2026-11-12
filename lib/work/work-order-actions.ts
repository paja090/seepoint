import { Prisma, type WorkOrderStatus } from '@prisma/client';
import { prisma } from '../db';
import { usesItemExecution } from '../field-planning/item-jobs';
import { logCarrierHistoryEvent } from '../navigation/carrier-history-service';
import { syncWorkOrderTasks } from '../work-task-sync';

export class WorkOrderActionError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'WorkOrderActionError';
    this.statusCode = statusCode;
  }
}

export type RescheduleExistingOrder = {
  id: string;
  scheduledAt: Date;
  deadlineAt: Date | null;
  status: WorkOrderStatus;
  locationNote: string | null;
  planningConstraints: unknown;
};

export function parseRescheduleDate(rawTargetDate: string): Date {
  const rawDate = rawTargetDate.trim();
  if (!rawDate) {
    throw new WorkOrderActionError('Chybí cílové datum pro přeplánování.', 400);
  }

  let parsed: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split('-').map(Number);
    parsed = new Date(Date.UTC(y, m - 1, d, 7, 0, 0));
    if (
      parsed.getUTCFullYear() !== y ||
      parsed.getUTCMonth() !== m - 1 ||
      parsed.getUTCDate() !== d
    ) {
      throw new WorkOrderActionError('Zadané datum přeplánování není platné.', 400);
    }
  } else {
    parsed = new Date(rawDate);
  }

  if (Number.isNaN(parsed.getTime())) {
    throw new WorkOrderActionError('Zadané datum přeplánování není platné.', 400);
  }

  return parsed;
}

export function computeRescheduleUpdate(params: {
  existing: RescheduleExistingOrder;
  targetDate: string;
  reason?: string | null;
  note?: string | null;
  actorName: string;
  viaEmail?: boolean;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const newScheduledAt = parseRescheduleDate(params.targetDate);

  let deadlineAt = params.existing.deadlineAt;
  if (deadlineAt && newScheduledAt > deadlineAt) {
    deadlineAt = newScheduledAt;
  }

  const oldDateIso = params.existing.scheduledAt.toISOString().slice(0, 10);
  const newDateIso = newScheduledAt.toISOString().slice(0, 10);
  const oldDateStr = params.existing.scheduledAt.toLocaleDateString('cs-CZ', {
    timeZone: 'Europe/Prague',
  });
  const newDateStr = newScheduledAt.toLocaleDateString('cs-CZ', {
    timeZone: 'Europe/Prague',
  });

  const combinedReason = [params.reason?.trim(), params.note?.trim()]
    .filter((part, idx, arr): part is string => Boolean(part) && arr.indexOf(part) === idx)
    .join(' – ')
    .slice(0, 500);

  const actorTag = params.viaEmail ? `Přesunuto (${params.actorName})` : 'Přeplánováno';
  const rescheduleLog = `[${actorTag} z ${oldDateStr} na ${newDateStr}${
    combinedReason ? `: ${combinedReason}` : ''
  }]`;
  const locationNote = params.existing.locationNote
    ? `${params.existing.locationNote}\n${rescheduleLog}`
    : rescheduleLog;

  const prevPc =
    params.existing.planningConstraints &&
    typeof params.existing.planningConstraints === 'object' &&
    !Array.isArray(params.existing.planningConstraints)
      ? (params.existing.planningConstraints as Record<string, unknown>)
      : {};

  const sheetOriginDate =
    typeof prevPc.sheetScheduledDateAtReschedule === 'string' &&
    prevPc.sheetScheduledDateAtReschedule.length >= 10
      ? prevPc.sheetScheduledDateAtReschedule
      : oldDateIso;

  const status: WorkOrderStatus =
    params.existing.status === 'DONE' || params.existing.status === 'CANCELLED'
      ? 'PLANNED'
      : params.existing.status;

  return {
    scheduledAt: newScheduledAt,
    deadlineAt,
    status,
    locationNote,
    oldDateStr,
    newDateStr,
    oldDateIso,
    newDateIso,
    combinedReason,
    planningConstraints: {
      ...prevPc,
      manualScheduledDateIso: newDateIso,
      sheetScheduledDateAtReschedule: sheetOriginDate,
      manualRescheduledAt: now.toISOString(),
      lastWorkerReportBy: params.actorName,
      lastWorkerReportAt: now.toISOString(),
      lastWorkerReason: combinedReason || null,
      ...(params.viaEmail ? { lastEmailAction: 'RESCHEDULED' } : {}),
    } as Prisma.InputJsonValue,
  };
}

export async function rescheduleWorkOrderAction(params: {
  organizationId: string;
  workOrderId: string;
  targetDate: string;
  reason?: string | null;
  note?: string | null;
  actorName: string;
  viaEmail?: boolean;
  assignmentMatcher?: (assignment: { userId: string | null; workerName: string }) => boolean;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const existing = await prisma.workOrder.findFirst({
    where: { id: params.workOrderId, organizationId: params.organizationId },
    select: {
      id: true,
      title: true,
      clientName: true,
      scheduledAt: true,
      deadlineAt: true,
      status: true,
      locationNote: true,
      planningConstraints: true,
      assignments: { select: { id: true, userId: true, workerName: true, acknowledgedAt: true, note: true } },
    },
  });

  if (!existing) {
    throw new WorkOrderActionError('Pracovní zakázka nebyla nalezena.', 404);
  }

  const update = computeRescheduleUpdate({
    existing,
    targetDate: params.targetDate,
    reason: params.reason,
    note: params.note,
    actorName: params.actorName,
    viaEmail: params.viaEmail,
    now,
  });

  const saved = await prisma.$transaction(async (tx) => {
    const order = await tx.workOrder.update({
      where: { id: existing.id },
      data: {
        scheduledAt: update.scheduledAt,
        deadlineAt: update.deadlineAt,
        status: update.status,
        locationNote: update.locationNote,
        planningConstraints: update.planningConstraints,
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        scheduledAt: true,
        deadlineAt: true,
        status: true,
        priority: true,
        locationNote: true,
      },
    });

    if (params.viaEmail && params.assignmentMatcher) {
      const assignmentNote = update.combinedReason
        ? `Nestihl jsem (${update.newDateStr}): ${update.combinedReason}`
        : `Přesunuto na ${update.newDateStr} z e-mailu`;
      for (const a of existing.assignments) {
        if (params.assignmentMatcher({ userId: a.userId, workerName: a.workerName })) {
          await tx.workAssignment.update({
            where: { id: a.id },
            data: {
              acknowledgedAt: a.acknowledgedAt ?? now,
              note: assignmentNote,
            },
          });
        }
      }
    }

    await syncWorkOrderTasks(existing.id, tx);
    return order;
  });

  return {
    workOrder: saved,
    oldDateStr: update.oldDateStr,
    newDateStr: update.newDateStr,
    newDateIso: update.newDateIso,
    combinedReason: update.combinedReason,
  };
}

export async function updateWorkOrderStatusAction(params: {
  organizationId: string;
  workOrderId: string;
  status: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  note?: string | null;
  actor: {
    userId?: string | null;
    employeeId?: string | null;
    email?: string | null;
    name: string;
  };
  viaEmail?: boolean;
  assignmentMatcher?: (assignment: { userId: string | null; workerName: string }) => boolean;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const cleanNote = params.note?.trim().slice(0, 500) || undefined;

  const existing = await prisma.workOrder.findFirst({
    where: { id: params.workOrderId, organizationId: params.organizationId },
    include: {
      items: {
        include: {
          carrier: {
            include: {
              carrierTypeRef: { select: { name: true } },
            },
          },
        },
      },
      assignments: true,
      workTasks: true,
    },
  });

  if (!existing) {
    throw new WorkOrderActionError('Zakázka nebyla nalezena', 404);
  }

  const wasAlreadyDone = existing.status === 'DONE';
  const hasNavOrder = Boolean(existing.navigationOrderId);
  const allItemsDone =
    existing.items.length > 0 &&
    existing.items.every((i) => ['DONE', 'CANCELLED'].includes(i.executionStatus || ''));

  const campaignId = (existing.planningConstraints as { electionCampaignId?: string } | null)
    ?.electionCampaignId;
  let allCampaignPointsCompleted = false;
  if (campaignId) {
    const activePoints = await prisma.electionRemovalPoint.findMany({
      where: { organizationId: existing.organizationId, campaignId, status: { not: 'CANCELLED' } },
      select: { id: true, status: true },
    });
    allCampaignPointsCompleted =
      activePoints.length > 0 && activePoints.every((p) => p.status === 'COMPLETED');
  }

  if (
    params.status === 'DONE' &&
    usesItemExecution(existing.items) &&
    !hasNavOrder &&
    !allItemsDone &&
    !allCampaignPointsCompleted
  ) {
    throw new WorkOrderActionError('Dokončete jednotlivé položky přes Moje trasa dnes.', 409);
  }

  const prevPc =
    existing.planningConstraints &&
    typeof existing.planningConstraints === 'object' &&
    !Array.isArray(existing.planningConstraints)
      ? (existing.planningConstraints as Record<string, unknown>)
      : {};

  const locationNote =
    cleanNote && params.viaEmail
      ? existing.locationNote
        ? `${existing.locationNote}\n[Dokončeno (${params.actor.name}): ${cleanNote}]`
        : `[Dokončeno (${params.actor.name}): ${cleanNote}]`
      : existing.locationNote;

  const updated = await prisma.workOrder.update({
    where: { id: existing.id },
    data: {
      status: params.status,
      locationNote,
      ftdSent: params.status === 'DONE' ? true : existing.ftdSent,
      ...(params.status === 'DONE'
        ? {
            planningConstraints: {
              ...prevPc,
              manualFtdSent: true,
              ftdSkipped: false,
              completedBySheetColor: false,
              ...(params.viaEmail
                ? {
                    lastEmailAction: 'COMPLETED',
                    lastWorkerReportBy: params.actor.name,
                    lastWorkerReportAt: now.toISOString(),
                    ...(cleanNote ? { lastWorkerNote: cleanNote } : {}),
                  }
                : {}),
            } as Prisma.InputJsonValue,
          }
        : {}),
    },
  });

  if (params.viaEmail && params.assignmentMatcher) {
    for (const a of existing.assignments) {
      if (params.assignmentMatcher({ userId: a.userId, workerName: a.workerName })) {
        await prisma.workAssignment.update({
          where: { id: a.id },
          data: {
            acknowledgedAt: a.acknowledgedAt ?? now,
            ...(cleanNote
              ? { note: `Dokončeno z e-mailu: ${cleanNote}` }
              : !a.note
              ? { note: 'Dokončeno kliknutím z e-mailu' }
              : {}),
          },
        });
      }
    }
  }

  if (params.status === 'IN_PROGRESS') {
    await prisma.workTask.updateMany({
      where: { workOrderId: existing.id, status: { notIn: ['DONE', 'CANCELLED'] } },
      data: { status: 'IN_PROGRESS' },
    });
  }

  if (params.status === 'DONE') {
    if (existing.items.length > 0) {
      await prisma.workOrderItem.updateMany({
        where: { workOrderId: existing.id, executionStatus: { not: 'CANCELLED' } },
        data: { executionStatus: 'DONE', completedAt: now },
      });
    }

    await prisma.workTask.updateMany({
      where: { workOrderId: existing.id, status: { notIn: ['DONE', 'CANCELLED'] } },
      data: { status: 'DONE' },
    });

    if (campaignId) {
      await prisma.electionCampaign.update({
        where: { id: campaignId, organizationId: existing.organizationId },
        data: { status: 'COMPLETED' },
      });
    }

    if (existing.navigationOrderId) {
      const navOrder = await prisma.navigationOrder.findUnique({
        where: { id: existing.navigationOrderId },
        include: { points: true },
      });
      if (
        navOrder &&
        ['PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE'].includes(navOrder.status)
      ) {
        const allPointsInstalled =
          navOrder.points.length > 0 && navOrder.points.every((p) => p.status === 'INSTALLED');
        const allPointsPhotographed =
          navOrder.points.length > 0 && navOrder.points.every((p) => Boolean(p.installedPhotoId));

        if (allPointsInstalled && allPointsPhotographed) {
          await prisma.navigationPoint.updateMany({
            where: {
              navigationOrderId: navOrder.id,
              qcStatus: 'PENDING',
            },
            data: {
              qcStatus: 'APPROVED',
              qcNote: 'Automaticky schváleno po dokončení zakázky technikem',
            },
          });

          await prisma.navigationOrder.update({
            where: { id: navOrder.id },
            data: {
              status: 'PRIPRAVENO_K_FAKTURACI',
              blockStatus: 'CEKA_NA_FAKTURACI',
              installedAt: navOrder.installedAt ?? now,
            },
          });

          if (navOrder.crmOrderId) {
            await prisma.crmOrder.update({
              where: { id: navOrder.crmOrderId },
              data: { status: 'IN_REALIZATION' },
            });
          }
        } else if (allPointsInstalled) {
          await prisma.navigationOrder.update({
            where: { id: navOrder.id },
            data: {
              status: 'FOTODOKUMENTACE',
              blockStatus: 'CEKA_NA_FAKTURACI',
              installedAt: navOrder.installedAt ?? now,
            },
          });
        }
      }
    }

    // Create automatic WorkEntry & settlement sync only once when transitioning to DONE
    if (!wasAlreadyDone) {
      const empOrFilters: Prisma.EmployeeWhereInput[] = [];
      if (params.actor.employeeId) empOrFilters.push({ id: params.actor.employeeId });
      if (params.actor.userId) empOrFilters.push({ userId: params.actor.userId });
      if (params.actor.email) empOrFilters.push({ email: params.actor.email });

      const employee =
        empOrFilters.length > 0
          ? await prisma.employee.findFirst({
              where: {
                organizationId: existing.organizationId,
                OR: empOrFilters,
              },
            })
          : null;

      let firstTask = existing.workTasks[0];
      const carrier = existing.items[0]?.carrier;
      const carrierTypeLabel =
        carrier?.carrierTypeRef?.name || carrier?.type || existing.title || null;

      if (employee) {
        if (!firstTask) {
          firstTask = await prisma.workTask.create({
            data: {
              title: existing.title,
              description: existing.description,
              status: 'DONE',
              priority: existing.priority || 'NORMAL',
              scheduledDate: existing.scheduledAt || now,
              assignedToEmployeeId: employee.id,
              workOrderId: existing.id,
            },
          });
        }

        const orderPrice = existing.price ?? 0;
        const entry = await prisma.workEntry.create({
          data: {
            employeeId: employee.id,
            workDate: now,
            workTaskId: firstTask.id,
            workOrderId: existing.id,
            clientId: existing.clientId || undefined,
            clientName: existing.clientName,
            workType: existing.workType,
            carrierTypeLabel,
            remunerationMethod: 'FIXED',
            quantity: 1,
            unit: 'ks',
            appliedUnitRate: orderPrice,
            calculatedAmount: orderPrice,
            rateSource: 'WORK_ORDER_RATE',
            note: cleanNote || `Dokončení zakázky: ${existing.title}`,
            status: 'APPROVED',
            creationSource: 'AUTOMATIC',
          },
        });

        try {
          const { getOrCreateSettlement, getPragueYearMonth } = await import(
            '../settlement-generation'
          );
          const { recalculateSettlementTotals } = await import('../settlement-recalculation');
          const { EDITABLE_SETTLEMENT_STATUSES } = await import('../settlement-statuses');

          await prisma.$transaction(async (tx) => {
            const settlement = await getOrCreateSettlement(
              { employeeId: employee.id, workDate: now },
              tx
            );
            const ym = getPragueYearMonth(now);
            if (
              settlement.periodYear === ym.year &&
              settlement.periodMonth === ym.month &&
              EDITABLE_SETTLEMENT_STATUSES.includes(settlement.status)
            ) {
              await tx.settlementItem.upsert({
                where: { workEntryId: entry.id },
                create: {
                  settlementId: settlement.id,
                  workEntryId: entry.id,
                  taskId: firstTask.id,
                  date: now,
                  description: cleanNote || `Zakázka: ${existing.title}`,
                  quantity: 1,
                  unit: 'ks',
                  unitPrice: orderPrice,
                  amount: orderPrice,
                  appliedRate: orderPrice,
                  rateType: 'FIXED',
                  rateSource: 'WORK_ORDER_RATE',
                  carrierTypeLabel,
                  workType: existing.workType,
                },
                update: {
                  amount: orderPrice,
                  unitPrice: orderPrice,
                  appliedRate: orderPrice,
                },
              });
              await recalculateSettlementTotals(settlement.id, tx);
            }
          });
        } catch (settlementErr) {
          console.error('Failed to sync completed workOrder into settlement:', settlementErr);
        }
      }

      if (existing.items[0]?.carrierId) {
        await logCarrierHistoryEvent({
          carrierId: existing.items[0].carrierId,
          eventType: 'SERVICE',
          title: `Dokončení zakázky: ${existing.title}`,
          description: `Pracovník ${params.actor.name} označil zakázku jako dokončenou. Poznámka: ${
            cleanNote || 'Bez poznámky'
          }`,
          performedBy: params.actor.name,
          photoUrl: existing.ftdUrl,
        });
      }
    }
  }

  return { order: updated, wasAlreadyDone };
}
