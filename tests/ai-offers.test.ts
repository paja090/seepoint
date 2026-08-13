import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recommendOfferType, inferMediaType, inferQuantity } from '../lib/ai-offers/intent-parser.ts';
import { hasBlockingCollision, isSurfaceAvailable } from '../lib/ai-offers/availability.ts';
import { scoreStandardSurface } from '../lib/ai-offers/scoring.ts';

test('navigation intent is never interpreted as standard media', () => {
  assert.equal(recommendOfferType('KFC chce navigaci k nové pobočce, 6 cedulí na rok.'), 'NAVIGATION');
  assert.equal(recommendOfferType('Potřebuji 6 navigačních cedulí ke Kauflandu.'), 'NAVIGATION');
});

test('standard media intent and media details are extracted', () => {
  const prompt = 'Divadlo chce 20 City Posterů na propagaci představení v říjnu.';
  assert.equal(recommendOfferType(prompt), 'STANDARD_MEDIA');
  assert.equal(inferMediaType(prompt), 'CITY_POSTER');
  assert.equal(inferQuantity(prompt), 20);
});

test('reserved and occupied overlaps block a surface', () => {
  const dateFrom = new Date('2026-10-01'); const dateTo = new Date('2026-10-31');
  assert.equal(hasBlockingCollision([{ status: 'RESERVED', dateFrom: new Date('2026-09-15'), dateTo: new Date('2026-10-02') }], dateFrom, dateTo), true);
  assert.equal(hasBlockingCollision([{ status: 'OCCUPIED', dateFrom: new Date('2026-11-01'), dateTo: new Date('2026-11-30') }], dateFrom, dateTo), false);
});

test('availability is evaluated per advertising surface (A can be blocked while B is free)', () => {
  const period = { dateFrom: new Date('2026-10-01'), dateTo: new Date('2026-10-31') };
  const common = { carrierActive: true, carrierArchived: false, surfaceStatus: 'AVAILABLE', ...period };
  assert.equal(isSurfaceAvailable({ ...common, occupancies: [{ status: 'OCCUPIED', dateFrom: period.dateFrom, dateTo: period.dateTo }] }), false);
  assert.equal(isSurfaceAvailable({ ...common, occupancies: [] }), true);
});

test('surface scoring is transparent', () => {
  const result = scoreStandardSurface({ cityMatch: true, mediaMatch: true, price: 1000, budgetPerItem: 1500, hasGps: true });
  assert.equal(result.score, 95);
  assert.ok(result.reasons.some((reason) => reason.includes('dostupná')));
  assert.ok(result.reasons.some((reason) => reason.includes('městu')));
});

test('AI endpoint contains no invented price fallback or automatic budget discount', () => {
  const route = readFileSync(new URL('../app/api/offers/ai-generate/route.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../lib/ai-offers/service.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /surface\.price\s*\|\|\s*2500/);
  assert.doesNotMatch(service, /discountAmount\s*=\s*currentTotal/);
  assert.match(service, /previewAiOffer/);
  assert.match(service, /confirmAiOffer/);
});

test('pricing segment and historical price snapshot fields exist in schema', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /enum ClientPricingSegment/);
  assert.match(schema, /pricingSegment\s+ClientPricingSegment/);
  assert.match(schema, /catalogPrice\s+Decimal\?/);
  assert.match(schema, /overrideReason\s+String\?/);
  assert.match(schema, /mountingType\s+MountingType\?/);
});

test('navigation catalog migration contains the supplied Ostrava prices', () => {
  const migration = readFileSync(new URL('../prisma/migrations/20260813180000_navigation_ostrava_price_catalog/migration.sql', import.meta.url), 'utf8');
  assert.match(migration, /NAV_OSR_RENTAL_LIGHT_POLE_12M[\s\S]*9500/);
  assert.match(migration, /NAV_OSR_RENTAL_TRACTION_12M[\s\S]*12000/);
  assert.match(migration, /NAV_OSR_RENTAL_COLUMN_12M[\s\S]*12000/);
  assert.match(migration, /NAV_OSR_INSTALLATION[\s\S]*800/);
  assert.match(migration, /NAV_OSR_REMOVAL[\s\S]*600/);
  assert.match(migration, /NAV_OSR_FRAME_DFLEX[\s\S]*1960/);
  assert.match(migration, /NAV_OSR_PRINT_UV_DIBOND[\s\S]*600/);
});

test('navigation confirmation records missing prices as an explicit draft state', () => {
  const service = readFileSync(new URL('../lib/ai-offers/service.ts', import.meta.url), 'utf8');
  assert.match(service, /status: preview\.items\[index\]\?\.finalPrice === null \? 'MISSING' : 'PROVISIONAL'/);
  assert.match(service, /requiresSitePhoto: true/);
  assert.doesNotMatch(service, /unitPrice:\s*\(item\.componentPrices\?\.RENTAL\?\.unitPrice\s*\?\?\s*0\)/);
});

test('navigation target can be geocoded from an address', () => {
  const generator = readFileSync(new URL('../lib/ai-offers/navigation-generator.ts', import.meta.url), 'utf8');
  assert.match(generator, /geocodeAddress/);
  assert.match(generator, /selectedCandidateIds/);
  assert.match(generator, /approachOrigins/);
  assert.doesNotMatch(generator, /advertisingSurface\.findMany|advertisingCarrier\.findMany/);
});

test('AI navigation points are new proposals requiring a real pole photo', () => {
  const service = readFileSync(new URL('../lib/ai-offers/service.ts', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../lib/offers/workflow.ts', import.meta.url), 'utf8');
  assert.match(service, /carrierId: null, surfaceId: null/);
  assert.match(service, /requiresSitePhoto: true/);
  assert.match(workflow, /navigationSitePhotos/);
});
