import { Prisma } from '@prisma/client';
import { prisma } from '../db.ts';

export class NavigationPricingError extends Error {
  code: string;

  constructor(message: string, code = 'PRICING_ERROR') {
    super(message);
    this.name = 'NavigationPricingError';
    this.code = code;
  }
}

export type PriceChangeInput = {
  navigationPointId: string;
  newUnitPrice: number | string | Prisma.Decimal;
  effectiveDate: Date | string;
  reason: string;
  applyFromNextPeriod?: boolean;
};

export async function changeNavigationPointPrice(
  input: PriceChangeInput,
  actorUserId: string,
  actorUserName: string
) {
  const { navigationPointId, newUnitPrice, effectiveDate: rawEffectiveDate, reason } = input;
  const effectiveDate = new Date(rawEffectiveDate);
  const newPriceDecimal = new Prisma.Decimal(newUnitPrice);

  if (isNaN(effectiveDate.getTime())) {
    throw new NavigationPricingError('Datum účinnosti změny ceny není platné.', 'INVALID_DATE');
  }

  if (!reason || !reason.trim()) {
    throw new NavigationPricingError('Důvod změny ceny je povinný pro auditní log.', 'MISSING_REASON');
  }

  return prisma.$transaction(async (tx) => {
    const point = await tx.navigationPoint.findUnique({
      where: { id: navigationPointId },
      include: {
        navigationOrder: {
          include: {
            billingPeriods: true,
          },
        },
        priceVersions: {
          orderBy: { validFrom: 'desc' },
        },
      },
    });

    if (!point) {
      throw new NavigationPricingError('Navigační bod nebyl nalezen.', 'NOT_FOUND');
    }

    const oldPriceDecimal = point.unitPrice;

    // Uzavřené/fakturované podklady se nesmí měnit
    if (point.navigationOrder) {
      const closedPeriods = point.navigationOrder.billingPeriods.filter(
        (bp) => bp.invoiceId !== null || bp.invoicedAt !== null
      );
      for (const period of closedPeriods) {
        if (effectiveDate < period.dateTo) {
          throw new NavigationPricingError(
            `Nelze změnit cenu zpětně před datum ${period.dateTo.toLocaleDateString('cs-CZ')}, protože pro toto období již existuje faktura.`,
            'PERIOD_CLOSED'
          );
        }
      }
    }

    // 1. Zaznamenej auditní záznam o změně ceny
    await tx.navigationPriceAuditLog.create({
      data: {
        navigationPointId,
        oldUnitPrice: oldPriceDecimal,
        newUnitPrice: newPriceDecimal,
        effectiveDate,
        reason: reason.trim(),
        changedByUserId: actorUserId,
        changedByUserName: actorUserName,
      },
    });

    // 2. Uzavři předchozí verzi ceny (validTo = effectiveDate) a vlož novou verzi
    const latestVersion = point.priceVersions[0];
    if (latestVersion && (!latestVersion.validTo || latestVersion.validTo > effectiveDate)) {
      await tx.navigationPriceVersion.update({
        where: { id: latestVersion.id },
        data: { validTo: effectiveDate },
      });
    }

    const newSubtotal = point.quantity
      .mul(newPriceDecimal)
      .add(point.installationPrice)
      .add(point.removalPrice)
      .add(point.productionPrice)
      .toDecimalPlaces(2);

    await tx.navigationPriceVersion.create({
      data: {
        navigationPointId,
        validFrom: effectiveDate,
        unitPrice: newPriceDecimal,
        installationPrice: point.installationPrice,
        removalPrice: point.removalPrice,
        productionPrice: point.productionPrice,
        subtotal: newSubtotal,
        reason: reason.trim(),
        changedByUserId: actorUserId,
      },
    });

    // 3. Rozdělení dosud otevřeného fakturačního období, pokud účinnost nastává uprostřed něj
    if (point.navigationOrder && !input.applyFromNextPeriod) {
      const openPeriods = point.navigationOrder.billingPeriods.filter(
        (bp) => !bp.invoiceId && !bp.invoicedAt
      );

      for (const period of openPeriods) {
        if (effectiveDate > period.dateFrom && effectiveDate < period.dateTo) {
          // Rozdělíme období na 2 části: původní do effectiveDate, nová od effectiveDate
          const daysTotal = Math.ceil((period.dateTo.getTime() - period.dateFrom.getTime()) / (1000 * 3600 * 24));
          const daysFirst = Math.ceil((effectiveDate.getTime() - period.dateFrom.getTime()) / (1000 * 3600 * 24));
          const daysSecond = daysTotal - daysFirst;

          if (daysTotal > 0 && daysFirst > 0 && daysSecond > 0) {
            const originalAmount = period.amount;
            const amountFirst = originalAmount.mul(daysFirst).div(daysTotal).toDecimalPlaces(2);
            const amountSecond = originalAmount.mul(daysSecond).div(daysTotal).toDecimalPlaces(2);

            // Aktualizujeme původní období na první část
            await tx.navigationBillingPeriod.update({
              where: { id: period.id },
              data: {
                dateTo: effectiveDate,
                amount: amountFirst,
              },
            });

            // Vytvoříme druhé období s novou částkou
            await tx.navigationBillingPeriod.create({
              data: {
                navigationOrderId: point.navigationOrderId!,
                dateFrom: effectiveDate,
                dateTo: period.dateTo,
                amount: amountSecond,
                status: 'DRAFT',
              },
            });
          }
        }
      }
    }

    // 4. Aktualizace stávající ceny bodu
    return tx.navigationPoint.update({
      where: { id: navigationPointId },
      data: {
        unitPrice: newPriceDecimal,
        subtotal: newSubtotal,
      },
    });
  });
}

export async function deleteNavigationPrice(navigationPointId: string, actorUserId: string) {
  const point = await prisma.navigationPoint.findUnique({
    where: { id: navigationPointId },
    include: {
      navigationOrder: {
        include: {
          billingPeriods: true,
        },
      },
      navigationOffer: true,
      priceAuditLogs: true,
    },
  });

  if (!point) {
    throw new NavigationPricingError('Navigační bod nebyl nalezen.', 'NOT_FOUND');
  }

  // Cenu použitou v nabídce, zakázce nebo fakturačním podkladu nelze fyzicky smazat
  const isUsedInOffer = Boolean(point.navigationOfferId);
  const isUsedInOrder = Boolean(point.navigationOrderId);
  const isUsedInInvoices = Boolean(
    point.navigationOrder?.billingPeriods.some((bp) => bp.invoiceId !== null)
  );

  if (isUsedInOffer || isUsedInOrder || isUsedInInvoices) {
    throw new NavigationPricingError(
      'Cenu, která již byla použita v nabídce, zakázce nebo fakturaci, nelze fyzicky smazat. Lze ji pouze ukončit s datem platnosti.',
      'PRICE_IN_USE'
    );
  }

  // Fyzické smazání je možné pouze u nepoužité ceny
  await prisma.navigationPoint.delete({
    where: { id: navigationPointId },
  });

  return { success: true };
}
