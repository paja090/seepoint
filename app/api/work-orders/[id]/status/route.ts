import { enterTenantContext } from '@/lib/tenant-context';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { updateWorkOrderStatusAction, WorkOrderActionError } from '@/lib/work/work-order-actions';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireApiAccess('work');
    if (isApiDenied(user)) return user;
    enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });

    const workOrderId = (await params).id;
    const body = await req.json();
    const { status, note } = body;

    if (!status || !['PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED'].includes(status)) {
      return NextResponse.json({ error: 'Neplatný stav zakázky' }, { status: 400 });
    }

    const workerName = user.employee
      ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
      : user.email;

    const { order } = await updateWorkOrderStatusAction({
      organizationId: user.organizationId!,
      workOrderId,
      status,
      note,
      actor: {
        userId: user.id,
        employeeId: user.employee?.id,
        email: user.email,
        name: workerName,
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    if (error instanceof WorkOrderActionError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Work order status update error:', error);
    return NextResponse.json({ error: 'Chyba při aktualizaci stavu zakázky' }, { status: 500 });
  }
}
