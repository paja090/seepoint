import { enterTenantContext } from '@/lib/tenant-context';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { canManageWorkOrderSchedule } from '@/lib/rbac';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAppOrigin } from '@/lib/app-url';
import { dayInZone } from '@/lib/field-planning/profile';
import {
  DEFAULT_BRIEFING_TIMEZONE,
  notifyWorkerPlanChangesForOrganization,
} from '@/lib/work/daily-briefing';
import { rescheduleWorkOrderAction, WorkOrderActionError } from '@/lib/work/work-order-actions';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess('work');
  if (isApiDenied(user)) return user;
  if (!canManageWorkOrderSchedule(user.role)) {
    return NextResponse.json(
      { error: 'Termín zakázky může měnit pouze zadavatel nebo manažer.' },
      { status: 403 }
    );
  }
  enterTenantContext({ organizationId: user.organizationId!, userId: user.id, source: 'session' });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    targetDate?: string;
    reason?: string;
  } | null;

  if (!body || !body.targetDate) {
    return NextResponse.json(
      { error: 'Chybí cílové datum pro přeplánování.' },
      { status: 400 }
    );
  }

  const actorName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.email;

  try {
    const beforeOrder = await prisma.workOrder.findUnique({
      where: { id },
      select: { scheduledAt: true },
    });

    const result = await rescheduleWorkOrderAction({
      organizationId: user.organizationId!,
      workOrderId: id,
      targetDate: body.targetDate,
      reason: body.reason,
      actorName,
    });

    if (user.organizationId) {
      const affectedDates = [
        ...(beforeOrder ? [dayInZone(beforeOrder.scheduledAt, DEFAULT_BRIEFING_TIMEZONE)] : []),
        dayInZone(result.workOrder.scheduledAt, DEFAULT_BRIEFING_TIMEZONE),
      ];
      await notifyWorkerPlanChangesForOrganization(user.organizationId, {
        dates: affectedDates,
        baseUrl: getAppOrigin(req),
        changedOrderIds: [id],
      }).catch((err) => {
        console.warn('[api/work-orders/[id]/reschedule] Plan change notification failed:', err);
      });
    }

    return NextResponse.json({
      success: true,
      message: `Zakázka byla úspěšně přeplánována na ${result.newDateStr}.`,
      workOrder: {
        ...result.workOrder,
        scheduledAt: result.workOrder.scheduledAt.toISOString(),
        deadlineAt: result.workOrder.deadlineAt?.toISOString() || null,
      },
    });
  } catch (err) {
    if (err instanceof WorkOrderActionError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Failed to reschedule work order:', err);
    return NextResponse.json(
      { error: 'Přeplánování zakázky selhalo.' },
      { status: 500 }
    );
  }
}
