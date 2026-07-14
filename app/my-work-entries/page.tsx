import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { canAccess } from '@/lib/rbac';
import { AccessDenied } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { MyWorkEntriesManager } from '@/components/MyWorkEntriesManager';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MyWorkEntriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('myWorkEntries');
  if (!canAccess(user.role, 'myWorkEntries')) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  const params = await searchParams;
  const taskId = first(params.taskId);

  // 1. Resolve employee
  const employee = await prisma.employee.findFirst({
    where: { OR: [{ userId: user.id }, { email: user.email }] },
  });

  if (!employee) {
    return (
      <AppShell>
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Moje odvedená práce</h1>
          <p className="mt-1 text-sm text-slate-500">Osobní přehled vykázané práce.</p>
        </div>
        <section className="card">
          <h2 className="text-xl font-bold text-red-800">Profil nenalezen</h2>
          <p className="mt-2 text-sm text-slate-500">
            Pro uživatele {user.email} zatím není v systému založen zaměstnanecký profil. Kontaktujte administrátora.
          </p>
        </section>
      </AppShell>
    );
  }

  // 2. Fetch prefilled task if taskId is provided
  let prefilledTask = null;
  if (taskId) {
    const task = await prisma.workTask.findFirst({
      where: { id: taskId, assignedToEmployeeId: employee.id },
      include: { workOrder: true },
    });
    if (task) {
      prefilledTask = {
        id: task.id,
        title: task.title,
        description: task.description,
        scheduledDate: task.scheduledDate ? task.scheduledDate.toISOString() : null,
        remunerationMethod: task.remunerationMethod,
        workOrder: task.workOrder
          ? {
              id: task.workOrder.id,
              title: task.workOrder.title,
              workType: task.workOrder.workType,
              clientId: task.workOrder.clientId,
              clientName: task.workOrder.clientName,
            }
          : null,
      };
    }
  }

  // 3. Fetch initial entries
  const entries = await prisma.workEntry.findMany({
    where: { employeeId: employee.id },
    include: {
      workTask: true,
      workOrder: true,
      client: true,
    },
    orderBy: { workDate: 'desc' },
  });

  const formattedEntries = entries.map((entry) => ({
    id: entry.id,
    workDate: entry.workDate.toISOString(),
    workTaskId: entry.workTaskId,
    workOrderId: entry.workOrderId,
    workType: entry.workType,
    remunerationMethod: entry.remunerationMethod,
    quantity: entry.quantity.toString(),
    unit: entry.unit,
    appliedUnitRate: entry.appliedUnitRate?.toString() ?? null,
    calculatedAmount: entry.calculatedAmount.toString(),
    rateSource: entry.rateSource,
    note: entry.note,
    status: entry.status,
    creationSource: entry.creationSource,
    workTask: entry.workTask ? { title: entry.workTask.title } : null,
    workOrder: entry.workOrder ? { title: entry.workOrder.title } : null,
  }));

  // 4. Fetch assigned planned tasks for selection in dropdown
  const assignedTasks = await prisma.workTask.findMany({
    where: {
      assignedToEmployeeId: employee.id,
    },
    include: {
      workOrder: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  const formattedTasks = assignedTasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    scheduledDate: task.scheduledDate ? task.scheduledDate.toISOString() : null,
    remunerationMethod: task.remunerationMethod,
    workOrder: task.workOrder
      ? {
          id: task.workOrder.id,
          title: task.workOrder.title,
          workType: task.workOrder.workType,
          clientId: task.workOrder.clientId,
          clientName: task.workOrder.clientName || '',
        }
      : null,
  }));

  return (
    <AppShell>
      <MyWorkEntriesManager
        employee={{
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
        }}
        initialEntries={formattedEntries}
        prefilledTask={prefilledTask}
        assignedTasks={formattedTasks}
      />
    </AppShell>
  );
}
