import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runWithTenantContext } from '../lib/tenant-context.ts';
import { scopeTenantQuery, TENANT_MODEL_NAMES } from '../lib/tenant-prisma.ts';
import { selectMediaPackageSurfaces } from '../lib/offers/media-packages.ts';
import { filterOfferSurfaces } from '../lib/offers/surface-selection.ts';
import { parseRateInput } from '../lib/worker-rates.ts';
import { GENERIC_DEFAULT_CARRIER_TYPES } from '../lib/carrier-type-catalog.ts';

const orgA = 'org_a';
const orgB = 'org_b';

function scoped(model: string, operation: string, args: Record<string, unknown>, organizationId = orgA) {
  return runWithTenantContext({ organizationId, source: 'test' }, () => scopeTenantQuery(model, operation, args)) as Record<string, unknown>;
}

test('Organization A client listing is always scoped away from Organization B', () => {
  const query = scoped('Client', 'findMany', { where: { active: true } });
  assert.deepEqual(query.where, { active: true, organizationId: orgA });
  assert.notEqual((query.where as Record<string, unknown>).organizationId, orgB);
});

test('GET by a foreign client id receives an organization predicate and therefore resolves as 404', () => {
  const query = scoped('Client', 'findUnique', { where: { id: 'client_b' } });
  assert.deepEqual(query.where, { id: 'client_b', organizationId: orgA });
});

test('updates and deletes cannot target a record outside the active organization', () => {
  const update = scoped('Client', 'update', { where: { id: 'client_b' }, data: { name: 'attempt' } });
  assert.deepEqual(update.where, { id: 'client_b', organizationId: orgA });
  assert.throws(() => scoped('Client', 'update', { where: { id: 'client_b', organizationId: orgB }, data: {} }), /override the active organization/);
});

test('same normalized client name is unique per organization, not globally', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /@@unique\(\[organizationId, normalizedName\]\)/);
  assert.doesNotMatch(schema, /normalizedName\s+String\s+@unique/);
});

test('one global user email can have memberships in multiple organizations', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /email\s+String\s+@unique/);
  assert.match(schema, /@@unique\(\[organizationId, userId\]\)/);
  assert.match(schema, /organizationMemberships\s+OrganizationMember\[\]/);
});

test('AI inventory lookup is scoped to the active organization', () => {
  const query = scoped('AdvertisingSurface', 'findMany', { where: { status: 'AVAILABLE' } });
  assert.deepEqual(query.where, { status: 'AVAILABLE', organizationId: orgA });
});

test('dashboard counts and aggregates are scoped to the active organization', () => {
  const count = scoped('Offer', 'count', { where: { status: 'ACCEPTED' } });
  const aggregate = scoped('Occupancy', 'aggregate', { where: { status: 'OCCUPIED' }, _count: true });
  assert.equal((count.where as Record<string, unknown>).organizationId, orgA);
  assert.equal((aggregate.where as Record<string, unknown>).organizationId, orgA);
});

test('public offers resolve tenant only by an opaque token and never by offer id fallback', () => {
  const service = readFileSync(new URL('../lib/offers/service.ts', import.meta.url), 'utf8');
  assert.match(service, /if \(!isPlausiblePublicOfferToken\(cleanToken\)\)/);
  assert.match(service, /const tokenHash = hashPublicOfferToken\(cleanToken\)/);
  assert.match(service, /findUnique\(\{\s*where: \{ publicTokenHash: tokenHash \}/);
  assert.match(service, /enterTenantContext\(\{ organizationId: row\.organizationId, source: 'public-token' \}\)/);
  assert.doesNotMatch(service, /\{ id: cleanToken \}/);
  assert.doesNotMatch(service, /publicTokenHash: cleanToken/);
  assert.doesNotMatch(service, /publicTokenHash: \{ startsWith:/);
  assert.doesNotMatch(service, /token: id, path: `\/offer\/\$\{id\}`/);
  assert.ok((service.match(/preparePortalCredential\(existing\)/g) ?? []).length >= 2);
});

test('all declared tenant models receive create ownership and reject client overrides', () => {
  assert.ok(TENANT_MODEL_NAMES.length >= 70);
  const create = scoped('Offer', 'create', { data: { title: 'A' } });
  assert.equal((create.data as Record<string, unknown>).organizationId, orgA);
  assert.throws(() => scoped('Offer', 'create', { data: { title: 'B', organizationId: orgB } }), /override the active organization/);
});

test('OrganizationCarrierType is tenant-scoped', () => {
  const list = scoped('OrganizationCarrierType', 'findMany', { where: { active: true } });
  assert.deepEqual(list.where, { active: true, organizationId: orgA });

  const create = scoped('OrganizationCarrierType', 'create', { data: { code: 'LED', name: 'LED Totem' } });
  assert.equal((create.data as Record<string, unknown>).organizationId, orgA);

  assert.throws(
    () => scoped('OrganizationCarrierType', 'create', { data: { code: 'X', name: 'X', organizationId: orgB } }),
    /override the active organization/,
  );
});

test('Product model is tenant-scoped and rejects cross-org overrides', () => {
  const list = scoped('Product', 'findMany', { where: { active: true } });
  assert.deepEqual(list.where, { active: true, organizationId: orgA });

  const create = scoped('Product', 'create', { data: { code: 'P1', name: 'Product One' } });
  assert.equal((create.data as Record<string, unknown>).organizationId, orgA);

  assert.throws(
    () => scoped('Product', 'create', { data: { code: 'X', name: 'X', organizationId: orgB } }),
    /override the active organization/,
  );
});

test('OrganizationCarrierType and Product are in TENANT_MODEL_NAMES', () => {
  const names = TENANT_MODEL_NAMES as readonly string[];
  assert.ok(names.includes('OrganizationCarrierType'), 'OrganizationCarrierType missing from TENANT_MODEL_NAMES');
  assert.ok(names.includes('Product'), 'Product missing from TENANT_MODEL_NAMES');
});

test('OrganizationCarrierType schema has unique constraint on [organizationId, code]', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const octBlock = schema.slice(
    schema.indexOf('model OrganizationCarrierType {'),
    schema.indexOf('}', schema.indexOf('model OrganizationCarrierType {')) + 1,
  );
  assert.match(octBlock, /@@unique\(\[organizationId, code\]\)/);
  assert.match(octBlock, /legacyEnumValue/);
});

test('AdvertisingCarrier has carrierTypeId FK field', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  const acBlock = schema.slice(
    schema.indexOf('model AdvertisingCarrier {'),
    schema.indexOf('}', schema.indexOf('model AdvertisingCarrier {')) + 1,
  );
  assert.match(acBlock, /carrierTypeId\s+String\?/);
  assert.match(acBlock, /carrierTypeRef/);
});

test('PriceListItem, OfferPriceRule, and MediaPackageRule have carrierTypeId FK fields in schema', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /model PriceListItem\s*\{[\s\S]*?carrierTypeId\s+String\?[\s\S]*?carrierTypeRef/);
  assert.match(schema, /model OfferPriceRule\s*\{[\s\S]*?carrierTypeId\s+String\?[\s\S]*?carrierTypeRef/);
  assert.match(schema, /model MediaPackageRule\s*\{[\s\S]*?carrierTypeId\s+String\?[\s\S]*?carrierTypeRef/);
});

test('selectMediaPackageSurfaces matches by dynamic carrierTypeId first and falls back to mediaType', () => {
  const surfaces = [
    {
      id: 'surf_1',
      name: 'Plocha 1',
      mediaType: 'BILLBOARD',
      carrierTypeId: 'custom_totem_id',
      carrier: { id: 'c1', code: 'C1', name: 'Carrier 1', city: 'Praha', type: 'BILLBOARD', carrierTypeId: 'custom_totem_id' },
      status: 'AVAILABLE',
      price: '5000',
      photos: [],
    },
    {
      id: 'surf_2',
      name: 'Plocha 2',
      mediaType: 'BILLBOARD',
      carrierTypeId: 'other_type_id',
      carrier: { id: 'c2', code: 'C2', name: 'Carrier 2', city: 'Praha', type: 'BILLBOARD', carrierTypeId: 'other_type_id' },
      status: 'AVAILABLE',
      price: '5000',
      photos: [],
    },
  ];

  // Rule targeting the custom carrier type
  const pkgWithCustomType = {
    id: 'pkg_1',
    name: 'Balíček Totemů',
    rules: [
      { id: 'r1', mediaType: 'BILLBOARD', carrierTypeId: 'custom_totem_id', quantity: 1, sortOrder: 0 },
    ],
  };

  const result1 = selectMediaPackageSurfaces(pkgWithCustomType as any, surfaces as any);
  assert.equal(result1.surfaces.length, 1);
  assert.equal(result1.surfaces[0].id, 'surf_1');

  // Rule without carrierTypeId falls back to mediaType
  const pkgFallback = {
    id: 'pkg_2',
    name: 'Balíček Billboardů',
    rules: [
      { id: 'r2', mediaType: 'BILLBOARD', quantity: 2, sortOrder: 0 },
    ],
  };

  const result2 = selectMediaPackageSurfaces(pkgFallback as any, surfaces as any);
  assert.equal(result2.surfaces.length, 2);
});

test('filterOfferSurfaces supports dynamic carrierTypeId filter', () => {
  const surfaces = [
    {
      id: 's1',
      name: 'A',
      mediaType: 'CITY_POSTER',
      carrierTypeId: 'type_city_poster',
      carrier: { code: 'A1', name: 'Nosič A', city: 'Brno', type: 'CITY_POSTER', carrierTypeId: 'type_city_poster' },
      status: 'AVAILABLE',
      price: '1000',
      photos: [],
    },
    {
      id: 's2',
      name: 'B',
      mediaType: 'CITY_POSTER',
      carrierTypeId: 'type_custom',
      carrier: { code: 'B1', name: 'Nosič B', city: 'Brno', type: 'CITY_POSTER', carrierTypeId: 'type_custom' },
      status: 'AVAILABLE',
      price: '1000',
      photos: [],
    },
  ];

  const conflictMap = new Map();
  const filtered = filterOfferSurfaces(
    surfaces as any,
    { query: '', mediaType: '', carrierTypeId: 'type_custom', status: '', availability: 'all', gpsOnly: false },
    conflictMap,
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 's2');
});

test('parseRateInput handles carrierTypeLabel correctly', () => {
  const parsed = parseRateInput({
    type: 'HOURLY',
    workType: 'INSTALLATION',
    name: 'Montáž Totemů',
    amount: '450',
    currency: 'CZK',
    unit: 'hod',
    validFrom: '2026-01-01',
    carrierTypeLabel: 'Firemní Totem',
  });
  assert.equal(parsed.carrierTypeLabel, 'Firemní Totem');

  const parsedWithout = parseRateInput({
    type: 'TASK',
    workType: 'MAINTENANCE',
    name: 'Údržba',
    amount: '300',
    currency: 'CZK',
    validFrom: '2026-01-01',
  });
  assert.equal(parsedWithout.carrierTypeLabel, null);
});

test('WorkEntry and SettlementItem models contain carrierTypeLabel snapshot column in schema', () => {
  const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  assert.match(schema, /model WorkEntry \{[\s\S]*carrierTypeLabel\s+String\?/);
  assert.match(schema, /model SettlementItem \{[\s\S]*carrierTypeLabel\s+String\?/);
});

test('new organization default carrier types seed generic OOH types without SeePoint proprietary names', () => {
  const codes: string[] = GENERIC_DEFAULT_CARRIER_TYPES.map((t) => t.code);
  const names: string[] = GENERIC_DEFAULT_CARRIER_TYPES.map((t) => t.name.toLowerCase());

  // Standard generic types must be present
  assert.ok(codes.includes('BILLBOARD'));
  assert.ok(codes.includes('CITYLIGHT'));
  assert.ok(codes.includes('BANNER'));

  // SeePoint proprietary concepts must NOT be in default seed for other tenants
  assert.ok(!codes.includes('PROMO_BENCH'));
  assert.ok(!codes.includes('PROMO_HORIZON'));
  assert.ok(!codes.includes('PROMO_TOWER'));
  assert.ok(!codes.includes('PROMO_MINITOWER'));
  assert.ok(!codes.includes('CITY_POSTER'));
  assert.ok(!codes.includes('NAVIGATION'));

  assert.ok(!names.some((n) => n.includes('lavičk') || n.includes('promo') || n.includes('seepoint')));
});


