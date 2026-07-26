import Link from 'next/link';
import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { PageHeader } from '@/components/ui';
import { prisma } from '@/lib/db';
import { ORDER_STATUS_LABELS } from '@/lib/crm/types';

export const dynamic = 'force-dynamic';

export default async function CrmDashboardPage() {
  await requirePageAccess('clients');

  const [
    totalClients,
    newLeads,
    openOffers,
    activeOrders,
    pendingTasks,
  ] = await Promise.all([
    prisma.client.count({ where: { active: true } }),
    prisma.client.count({ where: { active: true, status: 'LEAD' } }),
    prisma.offer.findMany({
      where: { status: { in: ['DRAFT', 'SENT'] } },
      include: { client: { select: { name: true } } },
      take: 6,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.crmOrder.findMany({
      where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      include: { client: { select: { name: true } } },
      take: 6,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.crmTask.findMany({
      where: { status: { notIn: ['DONE', 'CANCELLED'] } },
      include: { client: { select: { name: true } }, assignedUser: { select: { name: true } } },
      take: 6,
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="CRM Obchodní Dashboard"
          description="Přehled obchodních příležitostí, aktivních zakázek, neuhrazených faktur a nadcházejících úkolů."
        />

        {/* Global Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5">
            <div className="text-xs text-slate-400 font-medium">Aktivní klienti</div>
            <div className="text-3xl font-bold mt-1 text-sky-400">{totalClients}</div>
          </div>
          <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5">
            <div className="text-xs text-slate-400 font-medium">Nové Poptávky (Leads)</div>
            <div className="text-3xl font-bold mt-1 text-amber-400">{newLeads}</div>
          </div>
          <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5">
            <div className="text-xs text-slate-400 font-medium">Otevřené Nabídky</div>
            <div className="text-3xl font-bold mt-1 text-emerald-400">{openOffers.length}</div>
          </div>
          <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5">
            <div className="text-xs text-slate-400 font-medium">Úkoly k řešení</div>
            <div className="text-3xl font-bold mt-1 text-indigo-400">{pendingTasks.length}</div>
          </div>
        </div>

        {/* Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Proposals */}
          <div className="card space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center justify-between border-b pb-2">
              <span>📄 Otevřené Nabídky</span>
              <Link href="/offers" className="text-xs text-sky-600 hover:underline">Všechny nabídky →</Link>
            </h3>
            <div className="space-y-2">
              {openOffers.map(o => (
                <div key={o.id} className="p-3 bg-slate-50 rounded-xl border flex items-center justify-between">
                  <div>
                    <Link href={`/offers/${o.id}`} className="font-bold text-sm text-slate-900 hover:underline">{o.title}</Link>
                    <div className="text-xs text-slate-500">{o.client.name}</div>
                  </div>
                  <div className="font-bold text-sm">{o.totalPrice ? `${Number(o.totalPrice).toLocaleString('cs-CZ')} Kč` : '-'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Orders */}
          <div className="card space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center justify-between border-b pb-2">
              <span>🛒 Zakázky v realizaci</span>
            </h3>
            <div className="space-y-2">
              {activeOrders.map(o => {
                const statusObj = ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS] || ORDER_STATUS_LABELS.DRAFT;
                return (
                  <div key={o.id} className="p-3 bg-slate-50 rounded-xl border flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{o.title}</div>
                      <div className="text-xs text-slate-500">{o.client.name} • {o.orderNumber}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusObj.badge}`}>
                      {statusObj.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
