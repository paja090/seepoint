import type { CurrentUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { runWithTenantContext } from '@/lib/tenant-context';
import { nextCrmOrderNumber } from '@/lib/crm/domain';
import { isModuleEnabled } from '@/lib/organization-modules';
import { convertOfferToNavigationOrderInTransaction } from '@/lib/navigation/navigation-service';
import { buildRealizationContext } from './realization-engine';
import type { RealizationContext } from './contracts/realization-context';

export class RealizationHandoffError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'RealizationHandoffError';
  }
}

/**
 * Safely and idempotently hands off an ACCEPTED commercial offer into operational realization.
 * Guarantee: Calling this function multiple times for the same offer will NEVER produce
 * duplicate CrmOrders, duplicate CrmRealizations, duplicate NavigationOrders, or duplicate PrintJobs.
 */
export async function handoffAcceptedOfferToRealization(
  offerId: string,
  currentUser: CurrentUser
): Promise<RealizationContext> {
  const organizationId = currentUser.organizationId;
  if (!organizationId) {
    throw new RealizationHandoffError('Tenant security violation: Chybí kontext organizace.', 403);
  }

  return runWithTenantContext({ organizationId, userId: currentUser.id, source: 'session' }, async () => {
    // 1. Fetch offer and existing order
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      include: {
        crmOrder: {
          include: { navigationOrder: true, realizations: true },
        },
        items: { include: { surface: { include: { carrier: true } } } },
        navigationOffer: { include: { points: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
      },
    });

    if (!offer || offer.organizationId !== organizationId) {
      throw new RealizationHandoffError('Nabídka nebyla nalezena.', 404);
    }

    if (offer.status !== 'ACCEPTED') {
      throw new RealizationHandoffError(
        `Do realizace lze předat pouze schválenou nabídku (stav ACCEPTED). Aktuální stav: ${offer.status}`,
        409
      );
    }

    // 2. IDEMPOTENT CHECK (Clarification #2 & Scenario M):
    // If a CrmOrder already exists for this offer, return its existing realization context immediately.
    if (offer.crmOrder) {
      const existingContext = await buildRealizationContext(offer.crmOrder.id, currentUser);
      if (existingContext) return existingContext;
    }

    // 3. Perform atomic creation in serializable transaction
    const orderId = await prisma.$transaction(async (tx) => {
      // Re-check existing within transaction to prevent race conditions
      const doubleCheck = await tx.crmOrder.findFirst({
        where: { offerId: offer.id, organizationId },
        select: { id: true },
      });
      if (doubleCheck) return doubleCheck.id;

      // Check navigation project vs standard media
      if (offer.offerType === 'NAVIGATION') {
        const actor = {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
        };
        const navOrder = await convertOfferToNavigationOrderInTransaction(tx, offer.id, actor);
        return navOrder.crmOrderId;
      }

      // Standard media: Allocate unique order number
      const year = new Date().getFullYear();
      const latestOrder = await tx.crmOrder.findFirst({
        where: { organizationId, orderNumber: { startsWith: `ZAK-${year}-` } },
        select: { orderNumber: true },
        orderBy: { orderNumber: 'desc' },
      });
      const orderNumber = nextCrmOrderNumber(year, latestOrder?.orderNumber);

      const createdOrder = await tx.crmOrder.create({
        data: {
          organizationId,
          orderNumber,
          clientId: offer.clientId,
          offerId: offer.id,
          assignedUserId: offer.createdByUserId || currentUser.id,
          title: `Zakázka: ${offer.title}`,
          projectType: offer.offerType === 'CITY_GALLERY' ? 'CITY_GALLERY' : 'COMBINED',
          status: 'CONFIRMED',
          totalPrice: offer.totalPrice ?? offer.totalWithTax ?? offer.subtotal ?? 0,
          dateFrom: offer.items[0]?.dateFrom || null,
          dateTo: offer.items[0]?.dateTo || null,
          note: offer.note || null,
          internalNote: offer.internalNote || null,
        },
      });

      // Create CrmRealization per item
      for (const item of offer.items) {
        if (!item.surfaceId) continue;
        await tx.crmRealization.create({
          data: {
            organizationId,
            crmOrderId: createdOrder.id,
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
          userId: currentUser.id,
          userEmail: currentUser.email,
          action: 'HANDOFF_ACCEPTED_OFFER_TO_REALIZATION',
          entityType: 'CrmOrder',
          entityId: createdOrder.id,
          detailsJson: JSON.stringify({
            offerId: offer.id,
            orderNumber,
            surfaceCount: offer.items.length,
            handoffAt: new Date().toISOString(),
          }),
        },
      });

      return createdOrder.id;
    });

    const context = await buildRealizationContext(orderId, currentUser);
    if (!context) {
      throw new RealizationHandoffError('Chyba při sestavování kontextu realizace.', 500);
    }

    return context;
  });
}
