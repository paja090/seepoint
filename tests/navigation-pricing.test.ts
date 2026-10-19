import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import {
  RENTAL_DURATION_OPTIONS,
  getDurationOption,
  inferDurationMonthsFromDates,
  addMonthsToDate,
  calculateNavigationPointPrice,
  calculateNavigationTotalsForDuration,
  calculateNavigationPointSubtotal,
  calculateNavigationOfferTotals,
} from '../lib/offers/navigation-pricing';

test('RENTAL_DURATION_OPTIONS contains expected periods and factors', () => {
  const months = RENTAL_DURATION_OPTIONS.map((o) => o.months);
  assert.deepEqual(months, [1, 3, 6, 12, 24, 36]);

  const opt12 = getDurationOption(12);
  assert.equal(opt12.months, 12);
  assert.equal(opt12.factor, 1);

  const opt6 = getDurationOption(6);
  assert.equal(opt6.months, 6);
  assert.equal(opt6.factor, 0.5);

  const opt3 = getDurationOption(3);
  assert.equal(opt3.months, 3);
  assert.equal(opt3.factor, 0.25);

  // fallback to 12m for unknown
  const fallback = getDurationOption(99);
  assert.equal(fallback.months, 12);
});

test('inferDurationMonthsFromDates accurately determines duration', () => {
  // 1 month
  assert.equal(inferDurationMonthsFromDates('2026-05-01', '2026-05-31'), 1);

  // 3 months
  assert.equal(inferDurationMonthsFromDates('2026-05-01', '2026-07-31'), 3);

  // 6 months
  assert.equal(inferDurationMonthsFromDates('2026-05-01', '2026-10-31'), 6);

  // 12 months
  assert.equal(inferDurationMonthsFromDates('2026-05-01', '2027-04-30'), 12);

  // 24 months
  assert.equal(inferDurationMonthsFromDates('2026-05-01', '2028-04-30'), 24);

  // 36 months
  assert.equal(inferDurationMonthsFromDates('2026-05-01', '2029-04-30'), 36);

  // Fallback for missing/invalid
  assert.equal(inferDurationMonthsFromDates(null, null), 12);
  assert.equal(inferDurationMonthsFromDates('invalid', 'dates'), 12);
});

test('addMonthsToDate adds months correctly', () => {
  assert.equal(addMonthsToDate('2026-05-01', 1), '2026-05-31');
  assert.equal(addMonthsToDate('2026-05-01', 3), '2026-07-31');
  assert.equal(addMonthsToDate('2026-05-01', 6), '2026-10-31');
  assert.equal(addMonthsToDate('2026-05-01', 12), '2027-04-30');
});

test('calculateNavigationPointPrice computes accurate rental and keeps one-off costs fixed', () => {
  const point = {
    quantity: 1,
    unitPrice: 12000, // 12 000 CZK / year
    framePrice: 2500,
    productionPrice: 1800,
    installationPrice: 1500,
    removalPrice: 800,
  };

  // 12 months (1 year standard)
  const calc12 = calculateNavigationPointPrice(point, 12);
  assert.equal(calc12.rental, 12000);
  assert.equal(calc12.monthlyRate, 1000);
  assert.equal(calc12.oneOffTotal, 6600); // 2500 + 1800 + 1500 + 800
  assert.equal(calc12.subtotal, 18600); // 12000 + 6600

  // 6 months (half year)
  const calc6 = calculateNavigationPointPrice(point, 6);
  assert.equal(calc6.rental, 6000);
  assert.equal(calc6.monthlyRate, 1000);
  assert.equal(calc6.oneOffTotal, 6600);
  assert.equal(calc6.subtotal, 12600); // 6000 + 6600

  // 3 months (quarter year)
  const calc3 = calculateNavigationPointPrice(point, 3);
  assert.equal(calc3.rental, 3000);
  assert.equal(calc3.monthlyRate, 1000);
  assert.equal(calc3.oneOffTotal, 6600);
  assert.equal(calc3.subtotal, 9600); // 3000 + 6600

  // 1 month
  const calc1 = calculateNavigationPointPrice(point, 1);
  assert.equal(calc1.rental, 1000);
  assert.equal(calc1.monthlyRate, 1000);
  assert.equal(calc1.oneOffTotal, 6600);
  assert.equal(calc1.subtotal, 7600); // 1000 + 6600

  // 24 months (2 years)
  const calc24 = calculateNavigationPointPrice(point, 24);
  assert.equal(calc24.rental, 24000);
  assert.equal(calc24.monthlyRate, 1000);
  assert.equal(calc24.oneOffTotal, 6600);
  assert.equal(calc24.subtotal, 30600); // 24000 + 6600

  // Multiple quantity (quantity = 2)
  const calcQty2 = calculateNavigationPointPrice({ ...point, quantity: 2 }, 6);
  assert.equal(calcQty2.rental, 12000); // 2 * 6000
  assert.equal(calcQty2.monthlyRate, 2000); // 2 * 1000
  assert.equal(calcQty2.oneOffTotal, 13200); // 2 * 6600
  assert.equal(calcQty2.subtotal, 25200); // 12000 + 13200
});

test('calculateNavigationTotalsForDuration sums active points and calculates tax', () => {
  const points = [
    {
      id: 'pt-1',
      quantity: 1,
      unitPrice: 12000,
      framePrice: 2000,
      productionPrice: 1000,
      installationPrice: 1000,
      removalPrice: 500,
      isSelectedByClient: true,
    },
    {
      id: 'pt-2',
      quantity: 1,
      unitPrice: 24000,
      framePrice: 0,
      productionPrice: 1000,
      installationPrice: 1000,
      removalPrice: 500,
      isSelectedByClient: true,
    },
    {
      id: 'pt-3',
      quantity: 1,
      unitPrice: 15000,
      framePrice: 2000,
      productionPrice: 1000,
      installationPrice: 1000,
      removalPrice: 500,
      isSelectedByClient: false, // Unselected alternative should not be counted
    },
  ];

  // For 6 months:
  // pt-1: rental 6000 + one-off 4500 = 10500
  // pt-2: rental 12000 + one-off 2500 = 14500
  // total subtotal = 25000
  const totals6 = calculateNavigationTotalsForDuration(points, 6);
  assert.equal(totals6.rental, 18000);
  assert.equal(totals6.oneOffTotal, 7000);
  assert.equal(totals6.subtotal, 25000);
  assert.equal(totals6.taxAmount, 5250); // 21% of 25000
  assert.equal(totals6.totalWithTax, 30250);
});

test('calculateNavigationPointSubtotal and calculateNavigationOfferTotals (Prisma Decimal)', () => {
  const subtotal12 = calculateNavigationPointSubtotal({
    quantity: new Prisma.Decimal(1),
    unitPrice: new Prisma.Decimal(12000),
    framePrice: new Prisma.Decimal(2000),
    productionPrice: new Prisma.Decimal(1000),
    installationPrice: new Prisma.Decimal(1000),
    removalPrice: new Prisma.Decimal(500),
  });
  assert.equal(subtotal12.toNumber(), 16500);

  const subtotal6 = calculateNavigationPointSubtotal({
    quantity: new Prisma.Decimal(1),
    unitPrice: new Prisma.Decimal(12000),
    framePrice: new Prisma.Decimal(2000),
    productionPrice: new Prisma.Decimal(1000),
    installationPrice: new Prisma.Decimal(1000),
    removalPrice: new Prisma.Decimal(500),
    durationMonths: 6,
  });
  // rental 6000 + one-off 4500 = 10500
  assert.equal(subtotal6.toNumber(), 10500);

  const offerTotals = calculateNavigationOfferTotals([subtotal6]);
  assert.equal(offerTotals.subtotal.toNumber(), 10500);
  assert.equal(offerTotals.taxAmount.toNumber(), 2205);
  assert.equal(offerTotals.totalWithTax.toNumber(), 12705);
});
