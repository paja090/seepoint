import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { canAccess } from '@/lib/rbac';
import { AccessDenied } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { getOrganizationWorkCategories } from '@/lib/work-categories-server';
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

  const [employees, workCategories, workOrders, entries] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    }),
    user.organizationId ? getOrganizationWorkCategories(user.organizationId) : Promise.resolve([]),
    prisma.workOrder.findMany({
      where: { status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: 150,
      select: {
        id: true,
        title: true,
        workType: true,
        clientName: true,
        price: true,
      },
    }),
    prisma.workEntry.findMany({
      include: {
        employee: true,
        workTask: true,
        workOrder: true,
        client: true,
        expenses: true,
      },
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }],
    }),
  ]);

  const formattedEntries = entries.map((entry) => ({
    id: entry.id,
    employeeId: entry.employeeId,
    workDate: entry.workDate.toISOString(),
    workTaskId: entry.workTaskId,
    workOrderId: entry.workOrderId,
    workType: entry.workType,
    carrierTypeLabel: entry.carrierTypeLabel,
    remunerationMethod: entry.remunerationMethod,
    quantity: entry.quantity.toString(),
    unit: entry.unit,
    appliedUnitRate: entry.appliedUnitRate?.toString() ?? null,
    calculatedAmount: entry.calculatedAmount.toString(),
    rateSource: entry.rateSource,
    note: entry.note,
    status: entry.status,
    creationSource: entry.creationSource,
    rejectionReason: entry.rejectionReason,
    employee: {
      firstName: entry.employee.firstName,
      lastName: entry.employee.lastName,
    },
    workTask: entry.workTask ? { title: entry.workTask.title } : null,
    workOrder: entry.workOrder ? { title: entry.workOrder.title } : null,
    expenses: entry.expenses.map(exp => ({
      id: exp.id,
      type: exp.type,
      description: exp.description,
      amount: exp.amount.toString(),
      status: exp.status,
      rejectionReason: exp.rejectionReason,
      receiptUrl: exp.receiptPhotoId ? `/api/photos/${exp.receiptPhotoId}/file` : null,
    })),
  }));

  return (
    <AppShell>
      <WorkEntriesManager
        employees={employees}
        initialEntries={formattedEntries}
        workCategories={workCategories}
        workOrders={workOrders.map((wo) => ({
          ...wo,
          price: wo.price ? Number(wo.price) : null,
        }))}
      />
    </AppShell>
  );
}
