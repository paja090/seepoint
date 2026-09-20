import { Prisma } from '@prisma/client';
import { nextCrmOrderNumber } from '@/lib/crm/domain';
import { isModuleEnabled } from '@/lib/organization-modules';
import type { HandoffActor } from './navigation-handoff-adapter';

export async function executeStandardMediaHandoffInTransaction(
  tx: Prisma.TransactionClient,
  offerId: string,
  actor: HandoffActor
) {
  const offer = await tx.offer.findUnique({
    where: { id: offerId },
    include: {
      items: {
        include: {
          surface: {
            include: { carrier: true },
          },
        },
      },
      crmOrder: {
        include: {
          realizations: true,
        },
      },
    },
  });

  if (!offer) {
    throw new Error('Nabídka nebyla nalezena.');
  }

  const organizationId = offer.organizationId;

  // 1. Locate or create CrmOrder
  let crmOrder = offer.crmOrder;
  if (!crmOrder) {
    const year = new Date().getFullYear();
    const latestOrder = await tx.crmOrder.findFirst({
      where: { organizationId, orderNumber: { startsWith: `ZAK-${year}-` } },
      select: { orderNumber: true },
      orderBy: { orderNumber: 'desc' },
    });
    const orderNumber = nextCrmOrderNumber(year, latestOrder?.orderNumber);

    crmOrder = await tx.crmOrder.create({
      data: {
        organizationId,
        orderNumber,
        clientId: offer.clientId,
        offerId: offer.id,
        assignedUserId: offer.createdByUserId || actor.id,
        title: `Zakázka: ${offer.title}`,
        projectType: offer.offerType === 'CITY_GALLERY' ? 'CITY_GALLERY' : 'COMBINED',
        status: 'CONFIRMED',
        totalPrice: offer.totalPrice ?? offer.totalWithTax ?? offer.subtotal ?? 0,
        dateFrom: offer.items[0]?.dateFrom || null,
        dateTo: offer.items[0]?.dateTo || null,
        note: offer.note || null,
        internalNote: offer.internalNote || null,
      },
      include: {
        realizations: true,
      },
    });

    // Create CrmRealization per item
    for (const item of offer.items) {
      if (!item.surfaceId) continue;
      await tx.crmRealization.create({
        data: {
          organizationId,
          crmOrderId: crmOrder.id,
          surfaceId: item.surfaceId,
          carrierId: item.surface?.carrierId || null,
          status: 'WAITING_FOR_MATERIALS',
          plannedDate: item.dateFrom || null,
          note: `Realizace plochy ${item.surface?.name || ''}`,
        },
      });
    }

    // Create PrintProductionJob if module is enabled and does not exist
    const org = await tx.organization.findUnique({ where: { id: organizationId } });
    if (isModuleEnabled(org, 'printProduction')) {
      const existingJob = await tx.printProductionJob.findFirst({
        where: { offerId: offer.id, organizationId },
      });
      if (!existingJob) {
        await tx.printProductionJob.create({
          data: {
            organizationId,
            offerId: offer.id,
            clientId: offer.clientId,
            title: offer.campaignName ?? offer.title,
            campaignName: offer.campaignName ?? offer.title,
            status: 'PREPARATION',
          },
        });
      }
    }

    // Audit log
    await tx.crmAuditLog.create({
      data: {
        organizationId,
        userId: actor.id,
        userEmail: actor.email || 'system@seepoint.cz',
        action: 'HANDOFF_ACCEPTED_OFFER_TO_REALIZATION',
        entityType: 'CrmOrder',
        entityId: crmOrder.id,
        detailsJson: JSON.stringify({
          offerId: offer.id,
          orderNumber,
          surfaceCount: offer.items.length,
          handoffAt: new Date().toISOString(),
        }),
      },
    });
  }

  // Mark offer ACCEPTED
  await tx.offer.update({
    where: { id: offerId },
    data: { status: 'ACCEPTED', acceptedAt: offer.acceptedAt || new Date() },
  });

  return { crmOrder };
}
