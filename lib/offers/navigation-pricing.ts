import { Prisma } from '@prisma/client';

export type RentalDurationMonths = 1 | 3 | 6 | 12 | 24 | 36;

export interface RentalDurationOption {
  months: RentalDurationMonths;
  label: string;
  shortLabel: string;
  badge?: string;
  factor: number;
}

export const RENTAL_DURATION_OPTIONS: RentalDurationOption[] = [
  { months: 1, label: '1 měsíc', shortLabel: '1 měs', factor: 1 / 12 },
  { months: 3, label: '3 měsíce', shortLabel: '3 měs', badge: 'Čtvrtletí', factor: 3 / 12 },
  { months: 6, label: '6 měsíců', shortLabel: '6 měs', badge: 'Pololetí', factor: 6 / 12 },
  { months: 12, label: '1 rok (12 měsíců)', shortLabel: '1 rok', badge: 'Standard', factor: 1 },
  { months: 24, label: '2 roky (24 měsíců)', shortLabel: '2 roky', factor: 2 },
  { months: 36, label: '3 roky (36 měsíců)', shortLabel: '3 roky', factor: 3 },
];

export function getDurationOption(months: number): RentalDurationOption {
  const match = RENTAL_DURATION_OPTIONS.find((o) => o.months === months);
  return match || RENTAL_DURATION_OPTIONS[3]; // default 12 months (1 rok)
}

export function inferDurationMonthsFromDates(
  dateFrom?: string | null,
  dateTo?: string | null
): RentalDurationMonths {
  if (dateFrom && dateTo) {
    const d1 = new Date(dateFrom);
    const d2 = new Date(dateTo);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const diffDays = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
      const diffMonths = Math.round(diffDays / 30.4375);
      if (diffMonths <= 2) return 1;
      if (diffMonths <= 4) return 3;
      if (diffMonths <= 8) return 6;
      if (diffMonths <= 18) return 12;
      if (diffMonths <= 30) return 24;
      return 36;
    }
  }
  return 12;
}

export function addMonthsToDate(dateString: string, months: number): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + months);
    // End of previous day
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export type NavigationPointPriceParts = {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  installationPrice: Prisma.Decimal;
  removalPrice: Prisma.Decimal;
  productionPrice: Prisma.Decimal;
  framePrice?: Prisma.Decimal;
  durationMonths?: number;
};

export function calculateNavigationPointSubtotal(parts: NavigationPointPriceParts) {
  const frame = parts.framePrice || new Prisma.Decimal(0);
  const durationFactor =
    parts.durationMonths !== undefined
      ? new Prisma.Decimal(parts.durationMonths).div(12)
      : new Prisma.Decimal(1);
  const rentalForDuration = parts.unitPrice.mul(durationFactor).toDecimalPlaces(2);
  return parts.quantity
    .mul(
      rentalForDuration
        .add(parts.installationPrice)
        .add(parts.removalPrice)
        .add(parts.productionPrice)
        .add(frame)
    )
    .toDecimalPlaces(2);
}

export function calculateNavigationOfferTotals(
  subtotals: Prisma.Decimal[],
  taxRate = new Prisma.Decimal(21)
) {
  const subtotal = subtotals
    .reduce((sum, value) => sum.add(value), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
  const taxAmount = subtotal.mul(taxRate).div(100).toDecimalPlaces(2);
  return { subtotal, taxAmount, totalWithTax: subtotal.add(taxAmount).toDecimalPlaces(2) };
}

export function calculateNavigationPointPrice(
  point: {
    quantity?: string | number | null;
    unitPrice?: string | number | null;
    framePrice?: string | number | null;
    productionPrice?: string | number | null;
    installationPrice?: string | number | null;
    removalPrice?: string | number | null;
  },
  durationMonths: number = 12
) {
  const quantity = Math.max(1, Number(point.quantity || 1));
  const annualUnitPrice = Math.max(0, Number(point.unitPrice || 0));
  const rentalForDurationPerUnit = Math.round(annualUnitPrice * (durationMonths / 12));
  const rental = quantity * rentalForDurationPerUnit;
  const monthlyRate = quantity * Math.round(annualUnitPrice / 12);

  const framePerUnit = Math.max(0, Number(point.framePrice || 0));
  const frame = quantity * framePerUnit;

  const productionPerUnit = Math.max(0, Number(point.productionPrice || 0));
  const production = quantity * productionPerUnit;

  const installationPerUnit = Math.max(0, Number(point.installationPrice || 0));
  const installation = quantity * installationPerUnit;

  const removalPerUnit = Math.max(0, Number(point.removalPrice || 0));
  const removal = quantity * removalPerUnit;

  const oneOffTotal = frame + production + installation + removal;
  const subtotal = rental + oneOffTotal;

  return {
    quantity,
    annualUnitPrice,
    rentalForDurationPerUnit,
    rental,
    monthlyRate,
    frame,
    production,
    installation,
    removal,
    oneOffTotal,
    subtotal,
  };
}

export function calculateNavigationTotalsForDuration(
  points: Array<{
    quantity?: string | number | null;
    unitPrice?: string | number | null;
    framePrice?: string | number | null;
    productionPrice?: string | number | null;
    installationPrice?: string | number | null;
    removalPrice?: string | number | null;
    isSelectedByClient?: boolean;
  }>,
  durationMonths: number = 12,
  taxRatePercent: number = 21
) {
  const activePoints = points.filter((p) => p.isSelectedByClient !== false);
  const rows = activePoints.map((p) => calculateNavigationPointPrice(p, durationMonths));

  const totals = rows.reduce(
    (acc, row) => ({
      rental: acc.rental + row.rental,
      monthlyRate: acc.monthlyRate + row.monthlyRate,
      frame: acc.frame + row.frame,
      production: acc.production + row.production,
      installation: acc.installation + row.installation,
      removal: acc.removal + row.removal,
      oneOffTotal: acc.oneOffTotal + row.oneOffTotal,
      subtotal: acc.subtotal + row.subtotal,
    }),
    {
      rental: 0,
      monthlyRate: 0,
      frame: 0,
      production: 0,
      installation: 0,
      removal: 0,
      oneOffTotal: 0,
      subtotal: 0,
    }
  );

  const taxAmount = Math.round(totals.subtotal * (taxRatePercent / 100));
  const totalWithTax = totals.subtotal + taxAmount;

  return {
    rows,
    ...totals,
    taxRatePercent,
    taxAmount,
    totalWithTax,
  };
}
