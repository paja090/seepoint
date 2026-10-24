import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { WorkModuleClient } from '@/components/WorkModuleClient';
import { prisma, ensureWorkOrderSchema } from '@/lib/db';
import { overlapsAbsence } from '@/lib/work-absence-conflicts';
import { getOrganizationWorkCategories } from '@/lib/work-categories-server';
import { extractOrderRouteMap } from '@/lib/field-planning/order-route-mapper';
import { syncCrmOrderToWorkOrderInTransaction } from '@/lib/crm/crm-work-sync';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
function cleanParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0]?.trim() : v?.trim();
}

export default async function WorkPlanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('work');
  const params = await searchParams;
  await ensureWorkOrderSchema();

  const initialCarrierCode = cleanParam(params.carrierCode) || '';
  const initialClientName = cleanParam(params.clientName) || '';
  const initialCampaignDateFrom = cleanParam(params.campaignDateFrom) || '';
  const initialCampaignDateTo = cleanParam(params.campaignDateTo) || '';

  // Ensure active CRM realizations are reflected in WorkOrders
  const unlinkedCrmOrders = await prisma.crmOrder.findMany({
    where: {
      organizationId: user.organizationId,
      workOrders: { none: {} },
      realizations: { some: {} },
      status: { notIn: ['CANCELLED', 'COMPLETED'] },
    },
    select: { id: true },
    take: 20,
  });
  if (unlinkedCrmOrders.length > 0) {
    for (const o of unlinkedCrmOrders) {
      await prisma.$transaction(async (tx) => {
        await syncCrmOrderToWorkOrderInTransaction(tx, o.id);
      });
    }
  }

  const [orders, clients, carriers, employees, categories, plans] = await Promise.all([
    prisma.workOrder.findMany({
      include: {
        assignments: true,
        workTasks: { include: { assignedTo: true } },
        items: { include: { carrier: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 250,
    }),
    prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.advertisingCarrier.findMany({
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, city: true },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    }),
    getOrganizationWorkCategories(user.organizationId),
    prisma.fieldPlan.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED', 'DRAFT'] },
      },
      select: {
        id: true,
        date: true,
        status: true,
        version: true,
        planningSummary: true,
      },
      orderBy: { version: 'desc' },
      take: 80,
    }),
  ]);

  const { orderRouteMap, todayRoutes } = extractOrderRouteMap(plans, orders);

  const currentUserName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.name || user.email || 'Manažer';

  const employeeOptions = employees.map((emp) => ({
    id: emp.id,
    name: `${emp.firstName} ${emp.lastName}`.trim(),
  }));

  const canCreateWorkOrder = !['WORKER', 'TECHNICIAN'].includes(user.role);
  const assignedIds = [...new Set(orders.flatMap(order => order.workTasks.map(task => task.assignedToEmployeeId).filter((id): id is string => Boolean(id))))];
  const absences = canCreateWorkOrder && assignedIds.length ? await prisma.employeeAbsence.findMany({
    where: { employeeId: { in: assignedIds }, status: 'APPROVED' },
    select: { employeeId: true, dateFrom: true, dateTo: true },
  }) : [];
  const absenceConflicts = orders.filter(order => !['DONE', 'CANCELLED'].includes(order.status)).flatMap(order =>
    order.workTasks.filter(task => task.assignedTo && absences.some(absence => absence.employeeId === task.assignedToEmployeeId && overlapsAbsence(order.scheduledAt, order.deadlineAt, absence)))
      .map(task => `${order.title}: ${task.assignedTo!.firstName} ${task.assignedTo!.lastName} má schválenou nepřítomnost v termínu práce.`));

  const mappedOrders = orders.map((order) => ({
    id: order.id,
    title: order.title,
    clientName: order.clientName,
    requestedBy: order.requestedBy,
    scheduledAt: order.scheduledAt.toISOString(),
    deadlineAt: order.deadlineAt?.toISOString() ?? null,
    status: order.status,
    priority: order.priority,
    price: order.price?.toString() ?? null,
    workType: order.workType,
    ftdSent: order.ftdSent,
    invoiced: order.invoiced,
    quantity: order.quantity,
    mediaLabel: order.mediaLabel,
    contactPhone: order.contactPhone,
    locationNote: order.locationNote,
    assignments: order.assignments.map((a) => ({ workerName: a.workerName })),
    workTasksCount: order.workTasks.length,
    carrierCode: order.items[0]?.carrier?.code,
    carrierCity: order.items[0]?.carrier?.city,
    routeInfo: orderRouteMap.get(order.id) || null,
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        {absenceConflicts.length > 0 && <section role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><h2 className="font-bold">Konflikty s nepřítomností</h2><ul>{absenceConflicts.map((message, index) => <li key={index}>{message}</li>)}</ul><p>Upravte přiřazení nebo termín podle potřeby.</p></section>}
        <WorkModuleClient
          orders={mappedOrders}
          todayRoutes={todayRoutes}
          clients={clients.map((client) => ({ id: client.id, label: client.name }))}
          carriers={carriers.map((carrier) => ({
            id: carrier.id,
            code: carrier.code,
            label: `${carrier.city} · ${carrier.name}`,
          }))}
          employees={employeeOptions}
          currentUserName={currentUserName}
          initialCarrierCode={initialCarrierCode}
          initialClientName={initialClientName}
          initialCampaignDateFrom={initialCampaignDateFrom}
          initialCampaignDateTo={initialCampaignDateTo}
          canCreateWorkOrder={canCreateWorkOrder}
          categories={categories}
        />
      </div>
    </AppShell>
  );
}
