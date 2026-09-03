import { CrmOrderStatus, CrmProjectType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { nextCrmOrderNumber } from './domain';

export type CreateCrmOrderInput = {
  clientId: string;
  contactId?: string;
  branchId?: string;
  offerId?: string;
  assignedUserId?: string;
  title: string;
  projectType?: CrmProjectType;
  status?: CrmOrderStatus;
  dateFrom?: string;
  dateTo?: string;
  totalPrice?: number;
  billingMethod?: string;
  note?: string;
  internalNote?: string;
};

export class CrmOrderConversionError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'CrmOrderConversionError';
  }
}

export async function convertOfferToCrmOrder(offerId: string, actorUserId: string, actorEmail: string) {
  return prisma.$transaction(async (tx) => {
    // Serializes order-number allocation and makes repeated conversions idempotent.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('seepoint-crm-order-number'))`;

    const offer = await tx.offer.findUnique({
      where: { id: offerId },
      include: {
        items: { include: { surface: { include: { carrier: true } } } },
        crmOrder: true,
      },
    });
    if (!offer) throw new CrmOrderConversionError('Nabídka nebyla nalezena.', 404);
    if (offer.crmOrder) return offer.crmOrder;
    if (offer.status !== 'ACCEPTED') {
      throw new CrmOrderConversionError('Na zakázku lze převést pouze přijatou nabídku.', 409);
    }

    const year = new Date().getFullYear();
    const latestOrder = await tx.crmOrder.findFirst({
      where: { orderNumber: { startsWith: `ZAK-${year}-` } },
      select: { orderNumber: true },
      orderBy: { orderNumber: 'desc' },
    });
    const orderNumber = nextCrmOrderNumber(year, latestOrder?.orderNumber);

    const order = await tx.crmOrder.create({
      data: {
        orderNumber,
        clientId: offer.clientId,
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
          surfaceId: item.surfaceId,
          carrierId: item.surface?.carrierId || null,
          status: 'WAITING_FOR_MATERIALS',
          note: `Realizace pozice ${item.surface?.name || ''}`,
        },
      });
    }

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
