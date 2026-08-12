import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { requirePageAccess } from '@/lib/page-auth';
import { WorkOrderForm } from '@/components/WorkOrderForm';
import { WorkWeekView } from '@/components/WorkWeekView';
import { WorkPlanListView } from '@/components/WorkPlanListView';
import { prisma } from '@/lib/db';
import { formatWorkDate, formatWorkPrice, workPriorityLabels, workPriorityStyles, workStatusLabels, workStatusStyles, workTypeLabels } from '@/lib/work';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
function cleanParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0]?.trim() : v?.trim();
}

export default async function WorkPlanPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageAccess('work');
  const params = await searchParams;

  const initialCarrierCode = cleanParam(params.carrierCode) || '';
  const initialClientName = cleanParam(params.clientName) || '';
  const initialCampaignDateFrom = cleanParam(params.campaignDateFrom) || '';
  const initialCampaignDateTo = cleanParam(params.campaignDateTo) || '';

  const [orders, clients, carriers, employees, rawAbsences] = await Promise.all([
    prisma.workOrder.findMany({
      include: { assignments: true, workTasks: { include: { assignedTo: true } }, items: { include: { carrier: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 200,
    }),
    prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.advertisingCarrier.findMany({ orderBy: [{ city: 'asc' }, { name: 'asc' }], select: { id: true, code: true, name: true, city: true } }),
    prisma.employee.findMany({ where: { isActive: true }, orderBy: { firstName: 'asc' }, select: { id: true, firstName: true, lastName: true } }),
    prisma.employeeAbsence.findMany({
      where: { dateTo: { gte: new Date() } },
      include: { employee: true },
      orderBy: { dateFrom: 'asc' },
    }),
  ]);

  const currentUserName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
    : user.name || user.email || 'Manažer';

  const employeeOptions = employees.map((emp) => ({
    id: emp.id,
    name: `${emp.firstName} ${emp.lastName}`.trim(),
  }));

  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(dayStart); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(dayStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const todayCount = orders.filter((order) => order.scheduledAt >= dayStart && order.scheduledAt < tomorrow).length;
  const weekCount = orders.filter((order) => order.scheduledAt >= dayStart && order.scheduledAt < weekEnd).length;
  const openCount = orders.filter((order) => !['DONE', 'CANCELLED'].includes(order.status)).length;
  const urgentCount = orders.filter((order) => order.priority === 'URGENT' && !['DONE', 'CANCELLED'].includes(order.status)).length;
  const billingOrders = orders.filter((order) => order.ftdSent && !order.invoiced && order.status !== 'CANCELLED');
  const internalTaskCount = orders.reduce((sum, order) => sum + order.workTasks.length, 0);
  const listOrders = orders.slice(0, 40);

  const canCreateWorkOrder = !['WORKER', 'TECHNICIAN'].includes(user.role);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Provoz SeePOINT</p>
          <h1 className="text-3xl font-bold">Plán práce</h1>
          <p className="mt-2 text-slate-600">Instalace, opravy, kontroly a převozy na jednom místě. Při uložení zakázky se automaticky vytvoří interní úkoly a notifikace pro pracovníky.</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="card"><p className="text-sm text-slate-500">Dnes</p><strong className="text-3xl">{todayCount}</strong></div>
          <div className="card"><p className="text-sm text-slate-500">Příštích 7 dní</p><strong className="text-3xl">{weekCount}</strong></div>
          <div className="card"><p className="text-sm text-slate-500">Otevřené úkoly</p><strong className="text-3xl">{openCount}</strong></div>
          <div className="card"><p className="text-sm text-slate-500">Interní úkoly</p><strong className="text-3xl">{internalTaskCount}</strong></div>
          <div className="card border-red-200 bg-red-50"><p className="text-sm text-red-700">Urgentní</p><strong className="text-3xl text-red-800">{urgentCount}</strong></div>
          <div className="card border-emerald-200 bg-emerald-50"><p className="text-sm text-emerald-700">Připravené k fakturaci</p><strong className="text-3xl text-emerald-800">{billingOrders.length}</strong></div>
        </section>

        <section className="card border-emerald-200 bg-emerald-50" aria-labelledby="billing-alerts-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Upozornění pro zadavatele</p>
              <h2 className="text-xl font-bold text-emerald-950" id="billing-alerts-heading">Fotky hotové, čeká se na fakturu</h2>
            </div>
            <span className="rounded-full bg-emerald-700 px-3 py-1 text-sm font-bold text-white">{billingOrders.length}</span>
          </div>
          {billingOrders.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-800">Žádný úkol nyní nečeká na fakturaci.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {billingOrders.map((order) => (
                <Link className="rounded-xl border border-emerald-200 bg-white p-3 transition hover:border-emerald-500 hover:shadow-sm" href={`/work/${order.id}`} key={order.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">{order.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{order.clientName} · zadavatel {order.requestedBy || 'neuveden'}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-800">{formatWorkPrice(order.price?.toString())}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <WorkWeekView initialOrders={orders.map((order) => ({
          id: order.id,
          title: order.title,
          clientName: order.clientName,
          requestedBy: order.requestedBy,
          scheduledAt: order.scheduledAt.toISOString(),
          deadlineAt: order.deadlineAt?.toISOString(),
          status: order.status,
          priority: order.priority,
          price: order.price?.toString() ?? null,
          workType: order.workType,
          ftdSent: order.ftdSent,
          invoiced: order.invoiced,
          workers: order.assignments.map((assignment) => assignment.workerName),
          carrierCode: order.items[0]?.carrier?.code,
        }))} />

        {canCreateWorkOrder ? (
          <WorkOrderForm
            clients={clients.map((client) => ({ id: client.id, label: client.name }))}
            carriers={carriers.map((carrier) => ({ id: carrier.id, code: carrier.code, label: `${carrier.city} · ${carrier.name}` }))}
            employees={employeeOptions}
            currentUserName={currentUserName}
            initialCarrierCode={initialCarrierCode}
            initialClientName={initialClientName}
            initialCampaignDateFrom={initialCampaignDateFrom}
            initialCampaignDateTo={initialCampaignDateTo}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700 text-sm flex items-center gap-3">
            <span className="text-xl">ℹ️</span>
            <div>
              <p className="font-bold">Zadávání zakázek do plánu práce</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Pracovník i technik má přístup k přehledu plánu práce pro čtení a orientaci v zakázkách. Nové úkoly zadává Obchodník nebo Manažer. Své přiřazené zakázky spravujte v záložce <Link href="/my-tasks" className="font-bold text-emerald-700 underline">Moje úkoly</Link>.
              </p>
            </div>
          </div>
        )}

        <WorkPlanListView
          orders={orders.map((order) => ({
            id: order.id,
            title: order.title,
            clientName: order.clientName,
            requestedBy: order.requestedBy,
            scheduledAt: order.scheduledAt.toISOString(),
            deadlineAt: order.deadlineAt?.toISOString(),
            status: order.status,
            priority: order.priority,
            price: order.price?.toString() ?? null,
            workType: order.workType,
            ftdSent: order.ftdSent,
            invoiced: order.invoiced,
            quantity: order.quantity,
            mediaLabel: order.mediaLabel,
            assignments: order.assignments.map((a) => ({ workerName: a.workerName })),
            workTasksCount: order.workTasks.length,
            carrierCode: order.items[0]?.carrier?.code,
            carrierCity: order.items[0]?.carrier?.city,
          }))}
          canCleanup={canCreateWorkOrder}
        />
      </div>
    </AppShell>
  );
}
