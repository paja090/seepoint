import { Prisma } from '@prisma/client';

export type NavigationPointPriceParts = { quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; installationPrice: Prisma.Decimal; removalPrice: Prisma.Decimal; productionPrice: Prisma.Decimal; framePrice?: Prisma.Decimal };

export function calculateNavigationPointSubtotal(parts: NavigationPointPriceParts) {
  const frame = parts.framePrice || new Prisma.Decimal(0);
  return parts.quantity
    .mul(parts.unitPrice.add(parts.installationPrice).add(parts.removalPrice).add(parts.productionPrice).add(frame))
    .toDecimalPlaces(2);
}

export function calculateNavigationOfferTotals(subtotals: Prisma.Decimal[], taxRate = new Prisma.Decimal(21)) { const subtotal = subtotals.reduce((sum, value) => sum.add(value), new Prisma.Decimal(0)).toDecimalPlaces(2); const taxAmount = subtotal.mul(taxRate).div(100).toDecimalPlaces(2); return { subtotal, taxAmount, totalWithTax: subtotal.add(taxAmount).toDecimalPlaces(2) }; }
