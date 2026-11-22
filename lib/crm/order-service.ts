import { CrmOrderStatus, CrmProjectType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { nextCrmOrderNumber } from './domain';
import { syncCrmOrderToWorkOrderInTransaction } from './crm-work-sync';

export type CreateCrmOrderInput = {
  clientId: string;
  clientOrderCode?: string | null;
  agencyClientId?: string | null;
  agencyName?: string | null;
  contactId?: string | null;
  branchId?: string | null;
  offerId?: string | null;
  assignedUserId?: string | null;
  title: string;
  projectType?: CrmProjectType;
  status?: CrmOrderStatus;
  dateFrom?: Date | string | null;
  dateTo?: Date | string | null;
  totalPrice?: number | null;
  billingMethod?: string | null;
  note?: string | null;
  internalNote?: string | null;
};

export class CrmOrderConversionError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'CrmOrderConversionError';
  }
}

async function allocateCrmOrderNumberInTransaction(tx: Prisma.TransactionClient, organizationId?: string): Promise<string> {
  // Serializes order-number allocation and makes repeated conversions idempotent.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('seepoint-crm-order-number'))`;
  const year = new Date().getFullYear();
  const latestOrder = await tx.crmOrder.findFirst({
    where: {
      ...(organizationId ? { organizationId } : {}),
      orderNumber: { startsWith: `ZAK-${year}-` },
    },
    select: { orderNumber: true },
    orderBy: { orderNumber: 'desc' },
  });
  return nextCrmOrderNumber(year, latestOrder?.orderNumber);
}

export async function createCrmOrder(
  input: CreateCrmOrderInput,
  actorUserId: string,
  actorEmail: string,
  actorOrganizationId: string
) {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await allocateCrmOrderNumberInTransaction(tx, actorOrganizationId);

    const client = await tx.client.findFirst({
      where: { id: input.clientId, organizationId: actorOrganizationId, active: true },
      select: { id: true, name: true },
    });
    if (!client) {
      throw new CrmOrderConversionError('Koncový klient nebyl nalezen.', 404);
    }

    let resolvedAgencyName = input.agencyName?.trim() || null;
    if (input.agencyClientId) {
      const agency = await tx.client.findFirst({
        where: { id: input.agencyClientId, organizationId: actorOrganizationId, active: true },
        select: { id: true, name: true },
      });
      if (!agency) {
        throw new CrmOrderConversionError('Vybraná agentura nebyla nalezena.', 404);
      }
      if (!resolvedAgencyName) {
        resolvedAgencyName = agency.name;
      }
    }

    if (input.branchId) {
      const branch = await tx.clientBranch.findFirst({
        where: { id: input.branchId, clientId: client.id, organizationId: actorOrganizationId, active: true },
        select: { id: true },
      });
      if (!branch) {
        throw new CrmOrderConversionError('Vybraná pobočka nepatří tomuto klientovi.', 400);
      }
    }

    if (input.contactId) {
      const contact = await tx.clientContact.findFirst({
        where: { id: input.contactId, clientId: client.id, organizationId: actorOrganizationId, active: true },
        select: { id: true },
      });
      if (!contact) {
        throw new CrmOrderConversionError('Vybraný kontakt nepatří tomuto klientovi.', 400);
      }
    }

    const order = await tx.crmOrder.create({
      data: {
        organizationId: actorOrganizationId,
        orderNumber,
        clientOrderCode: input.clientOrderCode?.trim() || null,
        clientId: client.id,
        agencyClientId: input.agencyClientId || null,
        agencyName: resolvedAgencyName,
        contactId: input.contactId || null,
        branchId: input.branchId || null,
        assignedUserId: input.assignedUserId || actorUserId,
        title: input.title.trim(),
        projectType: input.projectType || 'OTHER',
        status: input.status || 'DRAFT',
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : null,
        dateTo: input.dateTo ? new Date(input.dateTo) : null,
        totalPrice: input.totalPrice ?? null,
        billingMethod: input.billingMethod?.trim() || null,
        note: input.note?.trim() || null,
        internalNote: input.internalNote?.trim() || null,
      },
      include: {
        client: { select: { id: true, name: true, companyId: true } },
        agencyClient: { select: { id: true, name: true, companyId: true } },
        branch: { select: { id: true, name: true, code: true, city: true } },
        assignedUser: { select: { name: true } },
      },
    });

    await tx.crmAuditLog.create({
      data: {
        userId: actorUserId,
        userEmail: actorEmail,
        action: 'CREATE_CRM_ORDER',
        entityType: 'CrmOrder',
        entityId: order.id,
        detailsJson: JSON.stringify({
          orderNumber,
          clientId: client.id,
          agencyClientId: order.agencyClientId,
          agencyName: order.agencyName,
          branchId: order.branchId,
        }),
      },
    });

    return order;
  });
}

export async function convertOfferToCrmOrder(offerId: string, actorUserId: string, actorEmail: string) {
  return prisma.$transaction(async (tx) => {
    const orderNumber = await allocateCrmOrderNumberInTransaction(tx);

    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      include: {
        items: { include: { surface: { include: { carrier: true } } } },
        crmOrder: true,
        client: {
          select: {
            branches: { where: { active: true }, select: { id: true }, take: 2 },
          },
        },
        navigationOffer: {
          select: {
            targets: { select: { clientBranchId: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    if (!offer) throw new CrmOrderConversionError('Nabídka nebyla nalezena.', 404);
    if (offer.crmOrder) return offer.crmOrder;
    if (offer.status !== 'ACCEPTED') {
      throw new CrmOrderConversionError('Na zakázku lze převést pouze přijatou nabídku.', 409);
    }

    const navBranchIds = Array.from(
      new Set((offer.navigationOffer?.targets || []).map((t) => t.clientBranchId).filter(Boolean) as string[])
    );
    const defaultBranchId =
      navBranchIds.length === 1
        ? navBranchIds[0]
        : offer.client?.branches.length === 1
          ? offer.client.branches[0].id
          : null;

    const order = await tx.crmOrder.create({
      data: {
        orderNumber,
        clientId: offer.clientId,
        branchId: defaultBranchId,
        offerId: offer.id,
        assignedUserId: offer.createdByUserId || actorUserId,
        title: `Zakázka: ${offer.title}`,
        projectType: offer.offerType === 'NAVIGATION'
          ? 'NAVIGATION'
          : offer.offerType === 'CITY_GALLERY'
            ? 'CITY_GALLERY'
            : 'COMBINED',
        status: 'CONFIRMED',
        totalPrice: offer.totalPrice ?? offer.subtotal ?? 0,
        note: offer.note || null,
        internalNote: offer.internalNote || null,
      },
    });

    for (const item of offer.items) {
      if (!item.surfaceId) continue;
      await tx.crmRealization.create({
        data: {
          crmOrderId: order.id,
          branchId: defaultBranchId,
          surfaceId: item.surfaceId,
          carrierId: item.surface?.carrierId || null,
          status: 'WAITING_FOR_MATERIALS',
          note: `Realizace pozice ${item.surface?.name || ''}`,
        },
      });
    }

    await syncCrmOrderToWorkOrderInTransaction(tx, order.id);

    await tx.crmAuditLog.create({
      data: {
        userId: actorUserId,
        userEmail: actorEmail,
        action: 'CONVERT_OFFER_TO_ORDER',
        entityType: 'CrmOrder',
        entityId: order.id,
        detailsJson: JSON.stringify({ offerId: offer.id, orderNumber }),
      },
    });

    return order;
  });
}
