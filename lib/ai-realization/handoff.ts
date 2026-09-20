import type { CurrentUser } from '@/lib/rbac';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { runWithTenantContext } from '@/lib/tenant-context';
import { buildRealizationContext } from './realization-engine';
import type { RealizationContext } from './contracts/realization-context';
import {
  executeNavigationHandoffInTransaction,
  type HandoffActor,
} from './adapters/navigation-handoff-adapter';
import { executeStandardMediaHandoffInTransaction } from './adapters/standard-media-handoff-adapter';
import { syncNavigationOfferToOrderInTransaction } from './navigation-sync';

export class RealizationHandoffError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = 'RealizationHandoffError';
  }
}

/**
 * Transaction-aware realization handoff.
 * Can be called inside existing Serializable transactions (e.g. during offer acceptance)
 * or standalone.
 */
export async function handoffAcceptedOfferToRealizationInTransaction(
  tx: Prisma.TransactionClient,
  offerId: string,
  actor: HandoffActor
): Promise<{ crmOrderId: string }> {
  const offer = await tx.offer.findUnique({
    where: { id: offerId },
    include: {
      crmOrder: {
        include: { navigationOrder: true, realizations: true },
      },
      navigationOffer: true,
    },
  });

  if (!offer) {
    throw new RealizationHandoffError('Nabídka nebyla nalezena.', 404);
  }

  // Two-phase navigation check: Phase 1 (LOCATION_SELECTION) MUST NEVER create operational orders!
  if (
    offer.offerType === 'NAVIGATION' &&
    offer.navigationOffer?.proposalMode === 'LOCATION_SELECTION'
  ) {
    return { crmOrderId: offer.crmOrder?.id || '' };
  }

  // Idempotent check: If CrmOrder already exists
  if (offer.crmOrder) {
    if (offer.offerType === 'NAVIGATION') {
      await syncNavigationOfferToOrderInTransaction(tx, offerId, actor);
    }
    return { crmOrderId: offer.crmOrder.id };
  }

  if (offer.offerType === 'NAVIGATION') {
    const result = await executeNavigationHandoffInTransaction(tx, offerId, actor);
    return { crmOrderId: result.crmOrder.id };
  }

  const result = await executeStandardMediaHandoffInTransaction(tx, offerId, actor);
  return { crmOrderId: result.crmOrder.id };
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
        navigationOffer: true,
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

    // 2. Execute within serializable transaction
    const actor: HandoffActor = {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
    };

    const { crmOrderId } = await prisma.$transaction(async (tx) => {
      return handoffAcceptedOfferToRealizationInTransaction(tx, offerId, actor);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!crmOrderId) {
      throw new RealizationHandoffError('Zakázka pro tuto nabídku nebyla vytvořena (např. Phase 1 výběr lokací).', 400);
    }

    const context = await buildRealizationContext(crmOrderId, currentUser);
    if (!context) {
      throw new RealizationHandoffError('Chyba při sestavování kontextu realizace.', 500);
    }

    return context;
  });
}
