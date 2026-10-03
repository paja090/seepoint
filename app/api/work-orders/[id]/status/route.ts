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

    if (usesItemExecution(existing.items) && !hasNavOrder && !allItemsDone) {
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

      // If linked to navigation order, check if all points are installed and advance status
      if (existing.navigationOrderId) {
        const navOrder = await prisma.navigationOrder.findUnique({
          where: { id: existing.navigationOrderId },
          include: { points: true },
        });
        if (navOrder && ['PRIPRAVENO_K_INSTALACI', 'INSTALACE'].includes(navOrder.status)) {
          const allPointsInstalled = navOrder.points.length > 0 && navOrder.points.every((p) => p.status === 'INSTALLED');
          if (allPointsInstalled) {
            await prisma.navigationOrder.update({
              where: { id: navOrder.id },
              data: {
                status: 'FOTODOKUMENTACE',
                blockStatus: 'CEKA_NA_FAKTURACI',
                installedAt: new Date(),
              },
            });
          }
        }
      }
    }

    // If DONE, automatically create WorkEntry in Odvedená práce if employee found and workTask exists
    if (status === 'DONE') {
      const employee = await prisma.employee.findFirst({
        where: { OR: [{ userId: user.id }, { email: user.email }] },
      });

      const firstTask = existing.workTasks[0];
      const carrier = existing.items[0]?.carrier;
      const carrierTypeLabel = carrier?.carrierTypeRef?.name || carrier?.type || null;

      if (employee && firstTask) {
        await prisma.workEntry.create({
          data: {
            employeeId: employee.id,
            workDate: new Date(),
            workTaskId: firstTask.id,
            workOrderId: existing.id,
            clientId: existing.clientId || undefined,
            clientName: existing.clientName,
            workType: existing.workType,
            carrierTypeLabel,
            remunerationMethod: 'HOURLY',
            quantity: 1,
            unit: 'ks',
            calculatedAmount: existing.price || 0,
            note: note || `Dokončení zakázky ${existing.title} z mobilní aplikace Moje úkoly.`,
            status: 'APPROVED',
            creationSource: 'MANUAL',
          },
        });
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
