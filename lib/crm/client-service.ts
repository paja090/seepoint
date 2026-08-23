import { prisma } from '@/lib/db';
import { ClientStatus, ClientType, ClientSource, Prisma } from '@prisma/client';
import { normalizeClientName } from './domain';

export type CreateClientInput = {
  name: string;
  tradingName?: string;
  companyId?: string;
  dic?: string;
  billingStreet?: string;
  billingCity?: string;
  billingZip?: string;
  billingCountry?: string;
  shippingStreet?: string;
  shippingCity?: string;
  shippingZip?: string;
  shippingCountry?: string;
  website?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  status?: ClientStatus;
  clientType?: ClientType;
  source?: ClientSource;
  assignedUserId?: string;
  rating?: string;
  note?: string;
};

export type UpdateClientInput = Partial<CreateClientInput>;

export async function findDuplicateClients(companyId?: string, name?: string, email?: string, excludeId?: string) {
  const conditions: Prisma.ClientWhereInput[] = [];
  if (companyId?.trim()) {
    conditions.push({ companyId: { equals: companyId.trim(), mode: 'insensitive' } });
  }
  if (name?.trim()) {
    conditions.push({ name: { equals: name.trim(), mode: 'insensitive' } });
    conditions.push({ normalizedName: { equals: normalizeClientName(name) } });
  }
  if (email?.trim()) {
    conditions.push({ email: { equals: email.trim(), mode: 'insensitive' } });
  }

  if (conditions.length === 0) return [];

  const where: Prisma.ClientWhereInput = {
    active: true,
    OR: conditions,
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  return prisma.client.findMany({
    where,
    select: {
      id: true,
      name: true,
      companyId: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
    },
    take: 10,
  });
}

export async function createClient(input: CreateClientInput, actorUserId: string, actorEmail: string) {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeClientName(name);

  return prisma.$transaction(async (tx) => {
  const existing = await tx.client.findFirst({
    where: { normalizedName },
  });
  if (existing) {
    throw new Error(`Klient se stejným názevem "${input.name}" již existuje.`);
  }

  const client = await tx.client.create({
    data: {
      name,
      normalizedName,
      tradingName: input.tradingName?.trim() || null,
      companyId: input.companyId?.trim() || null,
      dic: input.dic?.trim() || null,
      billingStreet: input.billingStreet?.trim() || null,
      billingCity: input.billingCity?.trim() || null,
      billingZip: input.billingZip?.trim() || null,
      billingCountry: input.billingCountry?.trim() || 'CZ',
      shippingStreet: input.shippingStreet?.trim() || null,
      shippingCity: input.shippingCity?.trim() || null,
      shippingZip: input.shippingZip?.trim() || null,
      shippingCountry: input.shippingCountry?.trim() || 'CZ',
      website: input.website?.trim() || null,
      contactPerson: input.contactPerson?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      status: input.status || 'ACTIVE',
      clientType: input.clientType || 'DIRECT_CLIENT',
      source: input.source || 'WEBSITE',
      assignedUserId: input.assignedUserId || null,
      rating: input.rating?.trim() || null,
      note: input.note?.trim() || null,
      lastActivityAt: new Date(),
    },
  });

  // If initial contact person details exist, create primary ClientContact
  if (input.contactPerson || input.email || input.phone) {
    const parts = (input.contactPerson || 'Zástupce').trim().split(' ');
    const firstName = parts[0] || 'Zástupce';
    const lastName = parts.slice(1).join(' ') || 'Firmy';

    await tx.clientContact.create({
      data: {
        clientId: client.id,
        firstName,
        lastName,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        isPrimary: true,
        isCommercial: true,
      },
    });
  }

  // Audit log
  await tx.crmAuditLog.create({
    data: {
      userId: actorUserId,
      userEmail: actorEmail,
      action: 'CREATE_CLIENT',
      entityType: 'Client',
      entityId: client.id,
      detailsJson: JSON.stringify({ name: client.name, companyId: client.companyId }),
    },
  });

  return client;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getClientProfile(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      assignedUser: { select: { id: true, name: true, email: true, role: true } },
      contacts: { orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }] },
      branches: { orderBy: { name: 'asc' }, include: { contactPerson: true } },
      offers: {
        orderBy: { createdAt: 'desc' },
        include: { createdByUser: { select: { name: true } } },
      },
      crmOrders: {
        orderBy: { createdAt: 'desc' },
        include: {
          assignedUser: { select: { name: true } },
          realizations: true,
          _count: { select: { workOrders: true, clientInvoices: true } },
        },
      },
      occupancies: {
        orderBy: { dateFrom: 'desc' },
        include: { surface: { include: { carrier: true } } },
      },
      currentSurfaces: {
        include: { carrier: true },
      },
      contracts: {
        orderBy: { validFrom: 'desc' },
        include: { assignedUser: { select: { name: true } } },
      },
      invoices: {
        orderBy: { issueDate: 'desc' },
        include: { items: true },
      },
      communications: {
        orderBy: { createdAt: 'desc' },
        include: { author: { select: { name: true } }, contact: true },
      },
      crmTasks: {
        orderBy: { dueDate: 'asc' },
        include: { assignedUser: { select: { name: true } }, createdUser: { select: { name: true } } },
      },
      documents: {
        orderBy: { createdAt: 'desc' },
        include: { uploaderUser: { select: { name: true } } },
      },
    },
  });

  if (!client) return null;

  // Calculate high-level financial & activity metrics
  const activeOccupanciesCount = client.occupancies.filter(o => o.dateTo >= new Date() && o.dateFrom <= new Date()).length;
  const inPreparationOrdersCount = client.crmOrders.filter(o => ['DRAFT', 'CONFIRMED', 'WAITING_FOR_MATERIALS', 'READY_FOR_PRODUCTION'].includes(o.status)).length;
  
  const unpaidInvoices = client.invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED');
  const overdueInvoices = unpaidInvoices.filter(i => new Date(i.dueDate) < new Date());
  
  const totalBilled = client.invoices.filter(i => i.status !== 'CANCELLED').reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalPaid = client.invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalUnpaid = unpaidInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);

  const pendingTasks = client.crmTasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const overdueTasks = pendingTasks.filter(t => new Date(t.dueDate) < new Date());

  const expiringContracts = client.contracts.filter(c => {
    if (!c.validTo || c.status !== 'ACTIVE') return false;
    const daysLeft = Math.ceil((new Date(c.validTo).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return daysLeft >= 0 && daysLeft <= 90;
  });

  return {
    ...client,
    metrics: {
      activeOccupanciesCount,
      inPreparationOrdersCount,
      unpaidInvoicesCount: unpaidInvoices.length,
      overdueInvoicesCount: overdueInvoices.length,
      totalBilled,
      totalPaid,
      totalUnpaid,
      totalOverdue,
      pendingTasksCount: pendingTasks.length,
      overdueTasksCount: overdueTasks.length,
      expiringContractsCount: expiringContracts.length,
    },
  };
}
