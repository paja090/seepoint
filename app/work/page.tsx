import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { WorkModuleClient } from '@/components/WorkModuleClient';
import { prisma, ensureWorkOrderSchema } from '@/lib/db';

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

  const [orders, clients, carriers, employees] = await Promise.all([
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
  ]);

  const currentUserName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.name || user.email || 'Manažer';

  const employeeOptions = employees.map((emp) => ({
    id: emp.id,
    name: `${emp.firstName} ${emp.lastName}`.trim(),
  }));

  const canCreateWorkOrder = !['WORKER', 'TECHNICIAN'].includes(user.role);

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
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <WorkModuleClient
          orders={mappedOrders}
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
        />
      </div>
    </AppShell>
  );
}
