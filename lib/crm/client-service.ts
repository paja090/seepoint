import { prisma } from '@/lib/db';
import { ClientStatus, ClientType, ClientSource, ClientPricingSegment, Prisma } from '@prisma/client';
import { recoverPortalToken } from '@/lib/offers/token';
import { normalizeClientName } from './domain';
import type { OccupiedSurfaceItem } from './types';

export type CreateClientInput = {
  name: string;
  tradingName?: string | null;
  companyId?: string | null;
  dic?: string | null;
  billingStreet?: string | null;
  billingCity?: string | null;
  billingZip?: string | null;
  billingCountry?: string | null;
  shippingStreet?: string | null;
  shippingCity?: string | null;
  shippingZip?: string | null;
  shippingCountry?: string | null;
  website?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: ClientStatus;
  clientType?: ClientType;
  pricingSegment?: ClientPricingSegment;
  source?: ClientSource;
  assignedUserId?: string | null;
  rating?: string | null;
  note?: string | null;
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

export async function createClient(input: CreateClientInput, actorUserId: string, actorEmail: string, actorOrganizationId: string) {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeClientName(name);

  return prisma.$transaction(async (tx) => {
  if (input.assignedUserId && !await tx.organizationMember.count({
    where: { organizationId: actorOrganizationId, userId: input.assignedUserId, isActive: true },
  })) {
    throw new Error('INVALID_ASSIGNEE');
  }
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
      pricingSegment: input.pricingSegment || 'COMMERCIAL',
      source: input.source || 'WEBSITE',
      assignedUserId: input.assignedUserId || null,
      rating: input.rating?.trim() || null,
      note: input.note?.trim() || null,
      lastActivityAt: new Date(),
    },
  });

  // If initial contact person details exist, create primary ClientContact
  if (input.contactPerson?.trim().includes(' ')) {
    const parts = input.contactPerson.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

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
      contacts: { where: { active: true }, orderBy: [{ isPrimary: 'desc' }, { lastName: 'asc' }] },
      branches: { where: { active: true }, orderBy: { name: 'asc' }, include: { contactPerson: true } },
      offers: {
        orderBy: { createdAt: 'desc' },
        include: {
          createdByUser: { select: { name: true } },
          navigationOffer: {
            include: {
              points: {
                include: { carrier: true },
              },
            },
          },
        },
      },
      crmOrders: {
        orderBy: { createdAt: 'desc' },
        include: {
          assignedUser: { select: { name: true } },
          realizations: true,
          offer: {
            select: {
              id: true,
              publicTokenHash: true,
              publicTokenEncrypted: true,
              publicTokenRevokedAt: true,
            },
          },
          navigationOrder: {
            include: {
              points: {
                include: { carrier: true },
              },
            },
          },
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

  // Map portal tokens for offers and orders
  const mappedOffers = client.offers.map((offer) => {
    const portalToken = recoverPortalToken(offer);
    return {
      ...offer,
      portalToken,
    };
  });

  const mappedOrders = client.crmOrders.map((order) => {
    const portalToken = order.offer ? recoverPortalToken(order.offer) : null;
    return {
      ...order,
      portalToken,
    };
  });

  // Find primary active portal token for the client (from active/accepted/sent offer or order)
  const activePortalToken =
    mappedOffers.find((o) => ['ACCEPTED', 'SENT'].includes(o.status) && o.portalToken)?.portalToken ||
    mappedOrders.find((ord) => ord.portalToken)?.portalToken ||
    mappedOffers.find((o) => o.portalToken)?.portalToken ||
    null;

  // Build unified list of all occupied surfaces for the client
  const occupiedSurfaces: OccupiedSurfaceItem[] = [];

  // 1. From standard Occupancy records
  for (const occ of client.occupancies) {
    const dateTo = new Date(occ.dateTo);
    const isExpired = dateTo < new Date();
    occupiedSurfaces.push({
      id: `occ-${occ.id}`,
      sourceType: 'OCCUPANCY',
      title: occ.surface?.carrier?.name || occ.surface?.name || 'Reklamní nosič',
      carrierCode: (occ.surface?.carrier as unknown as { code?: string })?.code || null,
      mediaType: occ.surface?.mediaType || 'Standardní nosič',
      variantOrSize: null,
      city: occ.surface?.carrier?.city || null,
      address: occ.surface?.carrier?.street || (occ.surface?.carrier as unknown as { address?: string })?.address || null,
      dateFrom: occ.dateFrom,
      dateTo: occ.dateTo,
      status: isExpired ? 'EXPIRED' : 'ACTIVE',
      campaignOrOrderName: null,
      portalToken: null,
    });
  }

  // 2. From directly assigned surfaces (currentSurfaces)
  for (const surf of client.currentSurfaces) {
    const exists = occupiedSurfaces.some((s) => s.title === (surf.carrier?.name || surf.name));
    if (!exists) {
      occupiedSurfaces.push({
        id: `surf-${surf.id}`,
        sourceType: 'CURRENT_SURFACE',
        title: surf.carrier?.name || surf.name || 'Přiřazená reklamní plocha',
        carrierCode: (surf.carrier as unknown as { code?: string })?.code || null,
        mediaType: surf.mediaType || 'Přiřazená plocha',
        variantOrSize: null,
        city: surf.carrier?.city || null,
        address: surf.carrier?.street || (surf.carrier as unknown as { address?: string })?.address || null,
        dateFrom: null,
        dateTo: null,
        status: 'ACTIVE',
        campaignOrOrderName: 'Dlouhodobé přiřazení nosiče',
        portalToken: null,
      });
    }
  }

  // 3. From active Navigation Orders & Points
  for (const order of client.crmOrders) {
    const navPoints = order.navigationOrder?.points || [];
    const orderPortalToken = order.offer ? recoverPortalToken(order.offer) : null;
    for (const point of navPoints) {
      occupiedSurfaces.push({
        id: `nav-ord-${point.id}`,
        sourceType: 'NAVIGATION',
        title: point.label || (point.pillarNumber ? `Sloup VO ${point.pillarNumber}` : 'Navigační bod'),
        carrierCode: point.pillarNumber ? `VO ${point.pillarNumber}` : null,
        mediaType: 'Městská navigace (VO)',
        variantOrSize: point.variant || '670 × 900 mm',
        city: point.carrier?.city || 'Ostrava',
        address: point.address || null,
        pillarNumber: point.pillarNumber || null,
        dateFrom: order.createdAt,
        dateTo: null,
        status: point.status === 'INSTALLED' ? 'ACTIVE' : 'PLANNED',
        campaignOrOrderName: order.title || order.orderNumber,
        portalToken: orderPortalToken,
      });
    }
  }

  // 4. From accepted Navigation Offers (in case not yet converted to order)
  for (const offer of client.offers) {
    if (['ACCEPTED', 'SENT'].includes(offer.status) && offer.navigationOffer?.points) {
      const offerPortalToken = recoverPortalToken(offer);
      for (const point of offer.navigationOffer.points) {
        const alreadyAdded = occupiedSurfaces.some(
          (s) => s.pillarNumber && point.pillarNumber && s.pillarNumber === point.pillarNumber
        );
        if (!alreadyAdded) {
          occupiedSurfaces.push({
            id: `nav-off-${point.id}`,
            sourceType: 'NAVIGATION',
            title: point.label || (point.pillarNumber ? `Sloup VO ${point.pillarNumber}` : 'Navigační bod'),
            carrierCode: point.pillarNumber ? `VO ${point.pillarNumber}` : null,
            mediaType: 'Městská navigace (VO)',
            variantOrSize: point.variant || '670 × 900 mm',
            city: point.carrier?.city || 'Ostrava',
            address: point.address || null,
            pillarNumber: point.pillarNumber || null,
            dateFrom: offer.createdAt,
            dateTo: null,
            status: offer.status === 'ACCEPTED' ? 'ACTIVE' : 'PLANNED',
            campaignOrOrderName: offer.campaignName || offer.title,
            portalToken: offerPortalToken,
          });
        }
      }
    }
  }

  // Calculate high-level financial & activity metrics
  const activeOccupanciesCount = occupiedSurfaces.filter((o) => o.status === 'ACTIVE').length;
  const inPreparationOrdersCount = client.crmOrders.filter((o) =>
    ['DRAFT', 'CONFIRMED', 'WAITING_FOR_MATERIALS', 'READY_FOR_PRODUCTION'].includes(o.status)
  ).length;

  const unpaidInvoices = client.invoices.filter((i) => i.status !== 'PAID' && i.status !== 'CANCELLED');
  const overdueInvoices = unpaidInvoices.filter((i) => new Date(i.dueDate) < new Date());

  const totalBilled = client.invoices.filter((i) => i.status !== 'CANCELLED').reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalPaid = client.invoices.filter((i) => i.status === 'PAID').reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalUnpaid = unpaidInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);

  const pendingTasks = client.crmTasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const overdueTasks = pendingTasks.filter((t) => new Date(t.dueDate) < new Date());

  const expiringContracts = client.contracts.filter((c) => {
    if (!c.validTo || c.status !== 'ACTIVE') return false;
    const daysLeft = Math.ceil((new Date(c.validTo).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    return daysLeft >= 0 && daysLeft <= 90;
  });

  return {
    ...client,
    offers: mappedOffers,
    crmOrders: mappedOrders,
    portalToken: activePortalToken,
    occupiedSurfaces,
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
