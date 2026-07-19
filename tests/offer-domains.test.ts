import assert from 'node:assert/strict';
import test from 'node:test';
import { selectMediaPackageSurfaces } from '../lib/offers/media-packages.ts';
import type { MediaPackageOption, OfferSurfaceOption } from '../lib/offers/view-model.ts';
import { Prisma } from '@prisma/client';
import { calculateNavigationOfferTotals, calculateNavigationPointSubtotal } from '../lib/offers/navigation-pricing.ts';

const surface = (id: string, mediaType: string, city: string, price: string): OfferSurfaceOption => ({ id, name: id, mediaType, status: 'AVAILABLE', price, photos: [], carrier: { id: `c-${id}`, code: id, name: id, city, type: mediaType } });

test('mediální balíček vybere konkrétní plochy podle typu a města bez duplicit', () => {
  const pkg: MediaPackageOption = { id: 'package-1', name: 'Ostravský mix', rules: [{ id: 'r1', mediaType: 'CITY_POSTER', city: 'Ostrava', quantity: 2, sortOrder: 0 }, { id: 'r2', mediaType: 'PROMO_BENCH', city: 'Ostrava', quantity: 1, sortOrder: 1 }] };
  const result = selectMediaPackageSurfaces(pkg, [surface('cp-expensive', 'CITY_POSTER', 'Ostrava', '2000'), surface('cp-cheap', 'CITY_POSTER', 'Ostrava', '1000'), surface('cp-other', 'CITY_POSTER', 'Praha', '500'), surface('bench', 'PROMO_BENCH', 'Ostrava', '700')]);
  assert.deepEqual(result.surfaces.map((row) => row.id), ['cp-cheap', 'cp-expensive', 'bench']);
  assert.deepEqual(result.missing, []);
});

test('nekompletní balíček vrátí přesný chybějící požadavek', () => {
  const pkg: MediaPackageOption = { id: 'package-2', name: 'Síť', rules: [{ id: 'r1', mediaType: 'CITYLIGHT', quantity: 3, sortOrder: 0 }] };
  const result = selectMediaPackageSurfaces(pkg, [surface('one', 'CITYLIGHT', 'Ostrava', '1000')]);
  assert.equal(result.surfaces.length, 1);
  assert.deepEqual(result.missing, [{ mediaType: 'CITYLIGHT', city: undefined, locality: undefined, quantity: 3, available: 1 }]);
});

test('navigační bod počítá kusovou cenu, výrobu, montáž a demontáž pomocí Decimal', () => {
  const first = calculateNavigationPointSubtotal({ quantity: new Prisma.Decimal('3'), unitPrice: new Prisma.Decimal('1250.50'), installationPrice: new Prisma.Decimal('800'), removalPrice: new Prisma.Decimal('350'), productionPrice: new Prisma.Decimal('1200.25') });
  const second = calculateNavigationPointSubtotal({ quantity: new Prisma.Decimal('1'), unitPrice: new Prisma.Decimal('999.99'), installationPrice: new Prisma.Decimal('0'), removalPrice: new Prisma.Decimal('0'), productionPrice: new Prisma.Decimal('0') });
  assert.equal(first.toFixed(2), '6101.75');
  const totals = calculateNavigationOfferTotals([first, second]);
  assert.deepEqual({ subtotal: totals.subtotal.toFixed(2), tax: totals.taxAmount.toFixed(2), total: totals.totalWithTax.toFixed(2) }, { subtotal: '7101.74', tax: '1491.37', total: '8593.11' });
});
