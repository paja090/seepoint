import { AppShell } from '@/components/AppShell';
import { Button, PageHeader } from '@/components/ui';
import { requirePageAccess } from '@/lib/page-auth';
import { prisma } from '@/lib/db';
import {
  CrmOrdersAgencyManager,
  type CrmOrderManagerRow,
  type CrmClientWithBranchesOption,
} from '@/components/crm/CrmOrdersAgencyManager';

export const dynamic = 'force-dynamic';

export default async function CrmOrdersPage() {
  await requirePageAccess('clients');

  const [orders, clients] = await Promise.all([
    prisma.crmOrder.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyId: true,
            branches: {
              where: { active: true },
              orderBy: { name: 'asc' },
              select: { id: true, name: true, code: true, city: true },
            },
          },
        },
        agencyClient: { select: { id: true, name: true, companyId: true } },
        branch: { select: { id: true, name: true, code: true, city: true } },
        assignedUser: { select: { id: true, name: true } },
        realizations: {
          select: {
            id: true,
            branchId: true,
            branch: { select: { id: true, name: true, city: true } },
          },
        },
        _count: { select: { workOrders: true, clientInvoices: true, realizations: true } },
      },
    }),
    prisma.client.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      take: 1000,
      select: {
        id: true,
        name: true,
        clientType: true,
        companyId: true,
        branches: {
          where: { active: true },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true, city: true },
        },
      },
    }),
  ]);

  const serializedOrders: CrmOrderManagerRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    clientOrderCode: o.clientOrderCode,
    title: o.title,
    projectType: o.projectType,
    status: o.status,
    clientId: o.clientId,
    agencyClientId: o.agencyClientId,
    agencyName: o.agencyName,
    branchId: o.branchId,
    dateFrom: o.dateFrom ? o.dateFrom.toISOString() : null,
    dateTo: o.dateTo ? o.dateTo.toISOString() : null,
    totalPrice: o.totalPrice != null ? Number(o.totalPrice) : null,
    note: o.note,
    client: o.client,
    agencyClient: o.agencyClient,
    branch: o.branch,
    assignedUser: o.assignedUser,
    realizationBranches: Array.from(
      new Map(
        o.realizations
          .filter((r) => r.branch)
          .map((r) => [r.branch!.id, r.branch!])
      ).values()
    ),
    realizationsCount: o._count.realizations,
    workOrdersCount: o._count.workOrders,
  }));

  return (
    <AppShell>
      <PageHeader
        title="CRM Zakázky & Agentury"
        description="Přehled zakázek s vyhledáváním podle koncového klienta, agentury i pobočky a rychlým doplněním vazeb."
        actions={
          <div className="flex items-center gap-2">
            <Button href="/clients" variant="secondary">← Zpět na Klienty</Button>
          </div>
        }
      />

      <CrmOrdersAgencyManager
        initialOrders={serializedOrders}
        clients={clients as CrmClientWithBranchesOption[]}
      />
    </AppShell>
  );
}
