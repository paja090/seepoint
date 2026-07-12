import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { canAccess } from '@/lib/rbac';
import { AccessDenied } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { WorkEntriesManager } from '@/components/WorkEntriesManager';

export const dynamic = 'force-dynamic';

export default async function WorkEntriesPage() {
  const user = await requirePageAccess('workEntries');
  if (!canAccess(user.role, 'workEntries')) {
    return (
      <AppShell>
        <AccessDenied />
      </AppShell>
    );
  }

  // Load active employees for filter/dropdown
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  // Load all initial entries
  const entries = await prisma.workEntry.findMany({
    include: {
      employee: true,
      workTask: true,
      workOrder: true,
      client: true,
    },
    orderBy: { workDate: 'desc' },
  });

  const formattedEntries = entries.map((entry) => ({
    id: entry.id,
    employeeId: entry.employeeId,
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
    employee: {
      firstName: entry.employee.firstName,
      lastName: entry.employee.lastName,
    },
    workTask: entry.workTask ? { title: entry.workTask.title } : null,
    workOrder: entry.workOrder ? { title: entry.workOrder.title } : null,
  }));

  return (
    <AppShell>
      <WorkEntriesManager
        employees={employees}
        initialEntries={formattedEntries}
        currentUserRole={user.role}
      />
    </AppShell>
  );
}
