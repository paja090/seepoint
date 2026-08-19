import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { AccessDenied, canAccess } from '@/lib/rbac';
import { requirePageAccess } from '@/lib/page-auth';
import { MyTasksView, type MyTaskItem } from '@/components/MyTasksView';
import { QuickInternalTasksView, type QuickTaskItem } from '@/components/tasks/QuickInternalTasksView';

export const dynamic = 'force-dynamic';

export default async function MyTasksPage() {
  const user = await requirePageAccess('myTasks');
  if (!canAccess(user.role, 'myTasks')) return <AppShell><AccessDenied /></AppShell>;

  const currentUserName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.name || user.email || 'Pracovník';

  // Find all WorkOrders assigned to this user / worker
  const [workOrders, quickTasksRaw] = await Promise.all([
    prisma.workOrder.findMany({
      where: {
        status: { not: 'CANCELLED' },
        OR: [
          { assignments: { some: { userId: user.id } } },
          { assignments: { some: { workerName: { contains: currentUserName, mode: 'insensitive' } } } },
          { assignments: { none: {} } },
        ],
      },
      include: {
        assignments: true,
        items: { include: { carrier: true } },
      },
      orderBy: [{ scheduledAt: 'asc' }, { priority: 'desc' }],
      take: 100,
    }),
    prisma.quickInternalTask.findMany({
      where: user.employee?.id
        ? { OR: [{ assignedToEmployeeId: user.employee.id }, { createdByUserId: user.id }] }
        : { createdByUserId: user.id },
      include: {
        assignedToEmployee: { select: { id: true, firstName: true, lastName: true, position: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

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

  const quickTasks: QuickTaskItem[] = quickTasksRaw.map((q) => ({
    id: q.id,
    title: q.title,
    description: q.description,
    assignedToEmployeeId: q.assignedToEmployeeId,
    createdByUserId: q.createdByUserId,
    dueDate: q.dueDate ? q.dueDate.toISOString() : null,
    priority: q.priority,
    status: q.status,
    unresolvedReason: q.unresolvedReason,
    completedAt: q.completedAt ? q.completedAt.toISOString() : null,
    completionNote: q.completionNote,
    createdAt: q.createdAt.toISOString(),
    assignedToEmployee: q.assignedToEmployee,
    createdByUser: q.createdByUser,
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8">
        {/* QUICK INTERNAL TASKS SECTION */}
        <section className="space-y-4">
          <div>
            <span className="text-xs font-bold text-fuchsia-700 uppercase tracking-wider">AI Rychlý Úkolníček</span>
            <h2 className="text-2xl font-black text-slate-900">📋 Provozní & Interní Úkoly na Dílně</h2>
            <p className="text-xs text-slate-500 mt-0.5">Rychlé úkoly přiřazené mimo klientské zakázky</p>
          </div>

          <QuickInternalTasksView tasks={quickTasks} currentUserId={user.id} userRole={user.role} />
        </section>

        {/* CLIENT WORK ORDERS SECTION */}
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plán práce & Zakázky</span>
            <h2 className="text-xl font-bold text-slate-900">🔨 Klientské Montáže & Výjezdy</h2>
          </div>

          <MyTasksView
            tasks={formattedTasks}
            currentUserId={user.id}
            currentUserName={currentUserName}
          />
        </section>
      </div>
    </AppShell>
  );
}
