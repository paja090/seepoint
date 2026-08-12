import { requirePageAccess } from '@/lib/page-auth';
import { AppShell } from '@/components/AppShell';
import { prisma } from '@/lib/db';
import { IntelligentCrmDashboard } from '@/components/crm/IntelligentCrmDashboard';

export const dynamic = 'force-dynamic';

export default async function CrmDashboardPage() {
  await requirePageAccess('clients');

  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000);
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 86_400_000);
  const now = new Date();

  const [
    totalActiveClients,
    newLeadsCount,
    formerClientsCount,
    openOffers,
    activeOrders,
    pendingTasks,
    inactiveClientsRaw,
    expiringOccupanciesRaw,
  ] = await Promise.all([
    prisma.client.count({ where: { active: true } }),
    prisma.client.count({ where: { active: true, status: 'LEAD' } }),
    prisma.client.count({ where: { active: true, status: 'FORMER_CLIENT' } }),
    prisma.offer.findMany({
      where: { status: { in: ['DRAFT', 'SENT'] } },
      include: { client: { select: { name: true } } },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.crmOrder.findMany({
      where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      include: { client: { select: { name: true } } },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.crmTask.findMany({
      where: { status: { notIn: ['DONE', 'CANCELLED'] } },
      include: { client: { select: { name: true } }, assignedUser: { select: { name: true } } },
      take: 10,
      orderBy: { dueDate: 'asc' },
    }),
    prisma.client.findMany({
      where: {
        active: true,
        updatedAt: { lt: sixtyDaysAgo },
      },
      select: {
        id: true,
        name: true,
        contactPerson: true,
        phone: true,
        updatedAt: true,
      },
      take: 8,
      orderBy: { updatedAt: 'asc' },
    }),
    prisma.occupancy.findMany({
      where: {
        dateTo: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        surface: {
          include: {
            carrier: { select: { name: true } },
          },
        },
      },
      take: 8,
      orderBy: { dateTo: 'asc' },
    }),
  ]);

  const openOffersValue = openOffers.reduce(
    (sum, o) => sum + (o.totalPrice ? Number(o.totalPrice) : 0),
    0
  );

  const formattedOpenOffers = openOffers.map((o) => ({
    id: o.id,
    number: o.id,
    title: o.title,
    clientName: o.client.name,
    clientId: o.clientId,
    totalPrice: o.totalPrice ? Number(o.totalPrice) : 0,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
  }));

  const formattedActiveOrders = activeOrders.map((ord) => ({
    id: ord.id,
    orderNumber: ord.orderNumber,
    title: ord.title,
    clientName: ord.client.name,
    clientId: ord.clientId,
    status: ord.status,
    createdAt: ord.createdAt.toISOString(),
  }));

  const formattedPendingTasks = pendingTasks.map((t) => ({
    id: t.id,
    title: t.title,
    clientName: t.client?.name ?? null,
    clientId: t.clientId ?? null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    priority: t.priority,
    status: t.status,
    assignedUserName: t.assignedUser?.name ?? null,
  }));

  const formattedInactiveClients = inactiveClientsRaw.map((ic) => {
    const days = Math.round((now.getTime() - new Date(ic.updatedAt).getTime()) / 86_400_000);
    return {
      id: ic.id,
      name: ic.name,
      contactPerson: ic.contactPerson,
      phone: ic.phone,
      lastContactDays: days,
    };
  });

  const formattedExpiringCampaigns = expiringOccupanciesRaw.map((occ) => {
    const daysRemaining = Math.round((new Date(occ.dateTo).getTime() - now.getTime()) / 86_400_000);
    return {
      id: occ.id,
      clientName: occ.clientName || 'Klient',
      campaignName: occ.campaignName || 'Kampan',
      surfaceName: `${occ.surface.carrier.name} (${occ.surface.name})`,
      dateTo: occ.dateTo.toISOString(),
      daysRemaining: Math.max(0, daysRemaining),
    };
  });

  return (
    <AppShell>
      <IntelligentCrmDashboard
        metrics={{
          totalActiveClients,
          newLeadsCount,
          vipClientsCount: formerClientsCount,
          openOffersValue,
          wonDealsValue: 0,
        }}
        openOffers={formattedOpenOffers}
        activeOrders={formattedActiveOrders}
        pendingTasks={formattedPendingTasks}
        inactiveClients={formattedInactiveClients}
        expiringCampaigns={formattedExpiringCampaigns}
      />
    </AppShell>
  );
}
