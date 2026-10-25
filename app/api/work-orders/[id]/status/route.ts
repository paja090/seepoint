import { enterTenantContext } from '@/lib/tenant-context';
import { usesItemExecution } from '@/lib/field-planning/item-jobs';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireApiAccess('work');
  if (isApiDenied(user)) return user;
    enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });
    if (!user) {
      return NextResponse.json({ error: 'Nejste přihlášeni' }, { status: 401 });
    }

    const workOrderId = (await params).id;
    const body = await req.json();
    const { status, note } = body;

    if (!status || !['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ error: 'Neplatný stav zakázky' }, { status: 400 });
    }

    const workerName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.email;

    const existing = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
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
      return NextResponse.json({ error: 'Zakázka nebyla nalezena' }, { status: 404 });
    }

    const hasNavOrder = Boolean(existing.navigationOrderId);
    const allItemsDone = existing.items.length > 0 && existing.items.every((i) => ['DONE', 'CANCELLED'].includes(i.executionStatus || ''));

    const campaignId = (existing.planningConstraints as { electionCampaignId?: string } | null)?.electionCampaignId;
    let allCampaignPointsCompleted = false;
    if (campaignId) {
      const activePoints = await prisma.electionRemovalPoint.findMany({
        where: { organizationId: existing.organizationId, campaignId, status: { not: 'CANCELLED' } },
        select: { id: true, status: true },
      });
      allCampaignPointsCompleted = activePoints.length > 0 && activePoints.every((p) => p.status === 'COMPLETED');
    }

    if (usesItemExecution(existing.items) && !hasNavOrder && !allItemsDone && !allCampaignPointsCompleted) {
      return NextResponse.json({ error: 'Dokončete jednotlivé položky přes Moje trasa dnes.' }, { status: 409 });
    }

    // Update WorkOrder status & FTD status if DONE
    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status,
        ftdSent: status === 'DONE' ? true : existing.ftdSent,
      },
    });

    if (status === 'DONE') {
      // Synchronize all items of this work order to DONE
      if (existing.items.length > 0) {
        await prisma.workOrderItem.updateMany({
          where: { workOrderId, executionStatus: { not: 'CANCELLED' } },
          data: { executionStatus: 'DONE', completedAt: new Date() },
        });
      }

      // Synchronize all tasks of this work order to DONE
      await prisma.workTask.updateMany({
        where: { workOrderId, status: { not: 'CANCELLED' } },
        data: { status: 'DONE' },
      });

      // Synchronize linked election campaign status to COMPLETED
      if (campaignId) {
        await prisma.electionCampaign.update({
          where: { id: campaignId, organizationId: existing.organizationId },
          data: { status: 'COMPLETED' },
        });
      }

      // If linked to navigation order, check if all points are installed and advance status
      if (existing.navigationOrderId) {
        const navOrder = await prisma.navigationOrder.findUnique({
          where: { id: existing.navigationOrderId },
          include: { points: true },
        });
        if (navOrder && ['PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE'].includes(navOrder.status)) {
          const allPointsInstalled = navOrder.points.length > 0 && navOrder.points.every((p) => p.status === 'INSTALLED');
          const allPointsPhotographed = navOrder.points.length > 0 && navOrder.points.every((p) => Boolean(p.installedPhotoId));

          if (allPointsInstalled && allPointsPhotographed) {
            // Auto-advance to PRIPRAVENO_K_FAKTURACI when everything is physically complete & photographed
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
                installedAt: navOrder.installedAt ?? new Date(),
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
                installedAt: navOrder.installedAt ?? new Date(),
              },
            });
          }
        }
      }
    }

    // If DONE, automatically create WorkEntry in Odvedená práce and sync into Settlement
    if (status === 'DONE') {
      const employee = await prisma.employee.findFirst({
        where: { OR: [{ userId: user.id }, { email: user.email }] },
      });

      let firstTask = existing.workTasks[0];
      const carrier = existing.items[0]?.carrier;
      const carrierTypeLabel = carrier?.carrierTypeRef?.name || carrier?.type || existing.title || null;

      if (employee) {
        if (!firstTask) {
          firstTask = await prisma.workTask.create({
            data: {
              title: existing.title,
              description: existing.description,
              status: 'DONE',
              priority: existing.priority || 'NORMAL',
              scheduledDate: existing.scheduledAt || new Date(),
              assignedToEmployeeId: employee.id,
              workOrderId: existing.id,
            },
          });
        }

        const nowDate = new Date();
        const orderPrice = existing.price ?? 0;
        const entry = await prisma.workEntry.create({
          data: {
            employeeId: employee.id,
            workDate: nowDate,
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
            note: note || `Dokončení zakázky: ${existing.title}`,
            status: 'APPROVED',
            creationSource: 'AUTOMATIC',
          },
        });

        try {
          const { getOrCreateSettlement, getPragueYearMonth } = await import('@/lib/settlement-generation');
          const { recalculateSettlementTotals } = await import('@/lib/settlement-recalculation');
          const { EDITABLE_SETTLEMENT_STATUSES } = await import('@/lib/settlement-statuses');

          await prisma.$transaction(async (tx) => {
            const settlement = await getOrCreateSettlement(
              { employeeId: employee.id, workDate: nowDate },
              tx
            );
            const ym = getPragueYearMonth(nowDate);
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
                  date: nowDate,
                  description: note || `Zakázka: ${existing.title}`,
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

      // Log to carrier history if carrier linked
      if (existing.items[0]?.carrierId) {
        await logCarrierHistoryEvent({
          carrierId: existing.items[0].carrierId,
          eventType: 'SERVICE',
          title: `Dokončení zakázky: ${existing.title}`,
          description: `Pracovník ${workerName} označil zakázku jako dokončenou. Poznámka: ${note || 'Bez poznámky'}`,
          performedBy: workerName,
          photoUrl: existing.ftdUrl,
        });
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error('Work order status update error:', error);
    return NextResponse.json({ error: 'Chyba při aktualizaci stavu zakázky' }, { status: 500 });
  }
}
