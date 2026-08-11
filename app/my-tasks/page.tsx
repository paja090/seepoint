import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { MyTasksView, type MyTaskItem } from '@/components/MyTasksView';

export const dynamic = 'force-dynamic';

export default async function MyTasksPage() {
  const user = await requirePageAccess('myTasks');
  if (!canAccess(user.role, 'myTasks')) return <AppShell><AccessDenied /></AppShell>;

  const currentUserName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.name || user.email || 'Pracovník';

  // Find all WorkOrders assigned to this user / worker
  const workOrders = await prisma.workOrder.findMany({
    where: {
      status: { not: 'CANCELLED' },
      OR: [
        { assignments: { some: { userId: user.id } } },
        { assignments: { some: { workerName: { contains: currentUserName, mode: 'insensitive' } } } },
        { assignments: { none: {} } }, // Show unassigned tasks to workers as well
      ],
    },
    include: {
      assignments: true,
      items: { include: { carrier: true } },
    },
    orderBy: [{ scheduledAt: 'asc' }, { priority: 'desc' }],
    take: 100,
  });

  const formattedTasks: MyTaskItem[] = workOrders.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    status: o.status,
    priority: o.priority,
    workType: o.workType,
    scheduledAt: o.scheduledAt.toISOString(),
    deadlineAt: o.deadlineAt?.toISOString(),
    clientName: o.clientName,
    contactName: o.contactName,
    contactPhone: o.contactPhone,
    locationNote: o.locationNote,
    mediaLabel: o.mediaLabel,
    quantity: o.quantity,
    price: o.price?.toString(),
    requestedBy: o.requestedBy,
    ftdUrl: o.ftdUrl,
    referenceUrl: o.referenceUrl,
    assignments: o.assignments.map((a) => ({
      id: a.id,
      workerName: a.workerName,
      acknowledgedAt: a.acknowledgedAt?.toISOString(),
    })),
    carrier: o.items[0]?.carrier
      ? {
          id: o.items[0].carrier.id,
          code: o.items[0].carrier.code,
          name: o.items[0].carrier.name,
          city: o.items[0].carrier.city,
        }
      : null,
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <MyTasksView
          tasks={formattedTasks}
          currentUserId={user.id}
          currentUserName={currentUserName}
        />
      </div>
    </AppShell>
  );
}
