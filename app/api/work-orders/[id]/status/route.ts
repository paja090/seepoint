import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logCarrierHistoryEvent } from '@/lib/navigation/carrier-history-service';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
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
      include: { items: { include: { carrier: true } }, assignments: true, workTasks: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Zakázka nebyla nalezena' }, { status: 404 });
    }

    // Update WorkOrder status & FTD status if DONE
    const updated = await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        status,
        ftdSent: status === 'DONE' ? true : existing.ftdSent,
      },
    });

    // If DONE, automatically create WorkEntry in Odvedená práce if employee found and workTask exists
    if (status === 'DONE') {
      const employee = await prisma.employee.findFirst({
        where: { OR: [{ userId: user.id }, { email: user.email }] },
      });

      const firstTask = existing.workTasks[0];

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
