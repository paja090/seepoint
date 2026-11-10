import { enterTenantContext } from '@/lib/tenant-context';
import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncWorkOrderTasks } from '@/lib/work-task-sync';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireApiAccess('work');
  if (isApiDenied(user)) return user;
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

  const rawDate = body.targetDate.trim();
  let newScheduledAt: Date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const [y, m, d] = rawDate.split('-').map(Number);
    newScheduledAt = new Date(Date.UTC(y, m - 1, d, 7, 0, 0));
  } else {
    newScheduledAt = new Date(rawDate);
  }

  if (Number.isNaN(newScheduledAt.getTime())) {
    return NextResponse.json(
      { error: 'Zadané datum přeplánování není platné.' },
      { status: 400 }
    );
  }

  const existing = await prisma.workOrder.findFirst({
    where: { id, organizationId: user.organizationId },
    select: {
      id: true,
      title: true,
      scheduledAt: true,
      deadlineAt: true,
      status: true,
      locationNote: true,
      planningConstraints: true,
    },
  });

  if (!existing) {
    return NextResponse.json(
      { error: 'Pracovní zakázka nebyla nalezena.' },
      { status: 404 }
    );
  }

  // Adjust deadline if new scheduledAt is after existing deadline
  let deadlineAt = existing.deadlineAt;
  if (deadlineAt && newScheduledAt > deadlineAt) {
    deadlineAt = newScheduledAt;
  }

  // Append reschedule reason to location/reschedule note history
  let locationNote = existing.locationNote;
  const oldDateStr = existing.scheduledAt.toLocaleDateString('cs-CZ');
  const newDateStr = newScheduledAt.toLocaleDateString('cs-CZ');

  const reasonText = body.reason?.trim();
  const rescheduleLog = `[Přeplánováno z ${oldDateStr} na ${newDateStr}${reasonText ? `: ${reasonText}` : ''}]`;
  locationNote = locationNote ? `${locationNote}\n${rescheduleLog}` : rescheduleLog;

  // If order was completed or cancelled, rescheduling moves it back to PLANNED
  const status =
    existing.status === 'DONE' || existing.status === 'CANCELLED'
      ? 'PLANNED'
      : existing.status;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.workOrder.update({
        where: { id },
        data: {
          scheduledAt: newScheduledAt,
          deadlineAt,
          status,
          locationNote,
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

      await syncWorkOrderTasks(id, tx);
      return saved;
    });

    return NextResponse.json({
      success: true,
      message: `Zakázka byla úspěšně přeplánována na ${newDateStr}.`,
      workOrder: {
        ...updated,
        scheduledAt: updated.scheduledAt.toISOString(),
        deadlineAt: updated.deadlineAt?.toISOString() || null,
      },
    });
  } catch (err) {
    console.error('Failed to reschedule work order:', err);
    return NextResponse.json(
      { error: 'Přeplánování zakázky selhalo.' },
      { status: 500 }
    );
  }
}
