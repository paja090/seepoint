import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { WorkOrderForm } from '@/components/WorkOrderForm';
import { WorkWeekView } from '@/components/WorkWeekView';
import { prisma } from '@/lib/db';
import { formatWorkDate, workStatusLabels, workStatusStyles, workTypeLabels } from '@/lib/work';

export const dynamic = 'force-dynamic';

export default async function WorkPlanPage() {
  const [orders, clients, carriers] = await Promise.all([
    prisma.workOrder.findMany({ include: { assignments: true, items: { include: { carrier: true } } }, orderBy: { scheduledAt: 'asc' }, take: 200 }),
    prisma.client.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.advertisingCarrier.findMany({ orderBy: [{ city: 'asc' }, { name: 'asc' }], select: { id: true, code: true, name: true, city: true } }),
  ]);
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(dayStart); tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(dayStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const todayCount = orders.filter((order) => order.scheduledAt >= dayStart && order.scheduledAt < tomorrow).length;
  const weekCount = orders.filter((order) => order.scheduledAt >= dayStart && order.scheduledAt < weekEnd).length;
  const openCount = orders.filter((order) => !['DONE', 'CANCELLED'].includes(order.status)).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Provoz SeePOINT</p>
          <h1 className="text-3xl font-bold">Plán práce</h1>
          <p className="mt-2 text-slate-600">Instalace, opravy, kontroly a převozy na jednom místě.</p>
        </header>
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="card"><p className="text-sm text-slate-500">Dnes</p><strong className="text-3xl">{todayCount}</strong></div>
          <div className="card"><p className="text-sm text-slate-500">Příštích 7 dní</p><strong className="text-3xl">{weekCount}</strong></div>
          <div className="card"><p className="text-sm text-slate-500">Otevřené úkoly</p><strong className="text-3xl">{openCount}</strong></div>
        </section>
        <WorkWeekView initialOrders={orders.map((order) => ({
          id: order.id,
          title: order.title,
          clientName: order.clientName,
          scheduledAt: order.scheduledAt.toISOString(),
          status: order.status,
          workType: order.workType,
          ftdSent: order.ftdSent,
          invoiced: order.invoiced,
          workers: order.assignments.map((assignment) => assignment.workerName),
          carrierCode: order.items[0]?.carrier?.code,
        }))} />
        <WorkOrderForm
          clients={clients.map((client) => ({ id: client.id, label: client.name }))}
          carriers={carriers.map((carrier) => ({ id: carrier.id, code: carrier.code, label: `${carrier.city} · ${carrier.name}` }))}
        />
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">Všechny pracovní úkoly</h2><p className="text-sm text-slate-500">Řazeno podle data provedení.</p></div><span className="text-sm font-medium text-slate-500">{orders.length} úkolů</span></div>
          {orders.length === 0 ? <div className="card text-center"><p className="font-medium">Zatím zde není žádný pracovní úkol.</p><p className="mt-1 text-sm text-slate-500">První úkol vytvořte ve formuláři výše. Původní tabulka zůstává beze změny.</p></div> : orders.map((order) => (
            <Link className="card block transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md" href={`/work/${order.id}`} key={order.id}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${workStatusStyles[order.status]}`}>{workStatusLabels[order.status]}</span><span className="text-sm font-medium text-slate-500">{workTypeLabels[order.workType]}</span></div>
                  <h3 className="mt-2 text-lg font-bold">{order.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{order.clientName} · {formatWorkDate(order.scheduledAt)}</p>
                  {order.items[0]?.carrier && <p className="mt-1 text-sm text-slate-500">{order.items[0].carrier.code} · {order.items[0].carrier.city}</p>}
                </div>
                <div className="text-sm md:text-right"><p className="font-medium">{order.assignments.map((assignment) => assignment.workerName).join(', ') || 'Nepřiřazený pracovník'}</p>{order.quantity && <p className="text-slate-500">{order.quantity} ks {order.mediaLabel || ''}</p>}</div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
